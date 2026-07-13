"""ots-ingest CLI — parse ReferenceDocs, emit baselines/thesaurus/BPMN.

Usage:
  uv run ots-ingest parse-apqc          # cache PCF Excel → cache/apqc.jsonl
  uv run ots-ingest parse-moda          # report TM Forum dump coverage
  uv run ots-ingest emit --stream all   # TTL + SKOS + BPMN from cache
  uv run ots-ingest validate            # check emitted TTL
"""

from __future__ import annotations

import json
from pathlib import Path

import typer
import yaml

from services.ingest.models import ProcessElement, StreamMapping
from services.ingest.parsers import apqc_xlsx, moda
from services.ingest.emitters import bpmn as bpmn_emitter
from services.ingest.emitters import skos as skos_emitter
from services.ingest.emitters import ttl as ttl_emitter
from services.ingest.validate import validate_ttl

app = typer.Typer(help="OTS ingestion agent")

REPO = Path(__file__).resolve().parents[2]
CACHE = REPO / "services" / "ingest" / "cache"
APQC_XLSX = (
    REPO / "ReferenceDocs" / "General"
    / "K016808_APQC Process Classification Framework (PCF) - Cross-Industry - Excel Version 8.0.xlsx"
)
MODA_DUMP = REPO / "services" / "ingest" / "cache" / "moda_full.jsonl"
STREAMS_YAML = REPO / "services" / "ingest" / "mapping" / "streams.yaml"
BASELINES = REPO / "data" / "baselines"
THESAURUS = REPO / "data" / "thesaurus"

ALL_STREAMS = ["o2c", "p2p", "c2m", "h2r", "t2r"]


def _load_stream_mappings(industry: str = "generic") -> dict[str, StreamMapping]:
    per_industry = STREAMS_YAML.with_name(f"streams_{industry}.yaml")
    path = per_industry if per_industry.exists() else STREAMS_YAML
    raw = yaml.safe_load(path.read_text())
    return {
        key: StreamMapping(stream=key, label=value["label"], subtrees=value["subtrees"])
        for key, value in raw.items()
    }


def _read_elements(path: Path) -> list[ProcessElement]:
    return [
        ProcessElement.model_validate_json(line)
        for line in path.read_text().splitlines()
    ]


def _load_apqc_cache(industry: str = "generic") -> list[ProcessElement]:
    """Load the APQC cache feeding an industry's baselines.

    Industries with a self-contained PCF (retail, utilities, …) parse into
    ``cache/apqc_{industry}.jsonl`` and are used directly. ``generic`` uses the
    cross-industry PCF; ``telecom`` also uses it (its baselines come from the
    eTOM MODA cache plus APQC h2r), so it is not treated as self-contained here.
    """
    industry_cache = CACHE / f"apqc_{industry}.jsonl"
    if industry not in ("generic", "telecom") and industry_cache.exists():
        cache_file = industry_cache
    else:
        cache_file = CACHE / "apqc.jsonl"
    if not cache_file.exists():
        typer.echo(
            f"No cache {cache_file.name} — run `ots-ingest parse-apqc` "
            "or `parse-industry` first.",
            err=True,
        )
        raise typer.Exit(1)
    return _read_elements(cache_file)


@app.command()
def parse_apqc() -> None:
    """Parse the APQC PCF Excel into cache/apqc.jsonl."""
    elements = apqc_xlsx.parse(APQC_XLSX)
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / "apqc.jsonl"
    out.write_text("\n".join(e.model_dump_json() for e in elements))
    typer.echo(f"Parsed {len(elements)} PCF elements → {out}")


@app.command()
def parse_industry(
    pdf: Path = typer.Argument(help="APQC industry PCF PDF path"),
    industry: str = typer.Option(..., help="industry slug, e.g. telecom"),
) -> None:
    """Parse an APQC industry PCF PDF into cache/apqc_{industry}.jsonl."""
    from services.ingest.parsers import apqc_pdf

    elements = apqc_pdf.parse(pdf, industry)
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"apqc_{industry}.jsonl"
    out.write_text("\n".join(e.model_dump_json() for e in elements))
    categories = sum(1 for e in elements if e.level == 1)
    typer.echo(f"Parsed {len(elements)} elements ({categories} categories) → {out}")


@app.command()
def parse_moda() -> None:
    """Parse the TM Forum MODA dump; report coverage."""
    processes, entities, stats = moda.parse(MODA_DUMP)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "etom.jsonl").write_text("\n".join(p.model_dump_json() for p in processes))
    (CACHE / "sid.jsonl").write_text("\n".join(e.model_dump_json() for e in entities))
    typer.echo(json.dumps(stats, indent=2))


@app.command()
def emit(
    stream: str = typer.Option("all", help="o2c|p2p|c2m|h2r|t2r|all"),
    industry: str = typer.Option("generic", help="baseline industry folder"),
) -> None:
    """Emit TTL + BPMN baselines per stream, and the SKOS thesauri."""
    apqc_elements = _load_apqc_cache(industry)
    elements = list(apqc_elements)
    etom_cache = CACHE / "etom.jsonl"
    if etom_cache.exists():
        elements = elements + _read_elements(etom_cache)
    mappings = _load_stream_mappings(industry)
    targets = ALL_STREAMS if stream == "all" else [stream]

    for key in targets:
        mapping = mappings[key]
        ttl_path = BASELINES / industry / f"{key}.ttl"
        ttl_emitter.emit(mapping, elements, ttl_path)
        bpmn_path = BASELINES / industry / f"{key}.bpmn"
        bpmn_emitter.emit(mapping, elements, bpmn_path)
        typer.echo(f"{key}: {ttl_path} + {bpmn_path}")

    # Process thesaurus from the APQC element set only — eTOM/SID get their own
    # schemes below. Self-contained industries (retail, utilities, …) publish a
    # per-industry scheme so their ontology search returns industry concepts.
    thes_framework = (
        f"apqc_{industry}" if industry not in ("generic", "telecom") else "apqc"
    )
    skos_path = THESAURUS / f"{thes_framework}.ttl"
    skos_emitter.emit(thes_framework, apqc_elements, skos_path)
    typer.echo(f"thesaurus: {skos_path}")

    # TM Forum thesauri when the MODA caches exist
    from services.ingest.models import DataEntity

    etom_cache = CACHE / "etom.jsonl"
    if etom_cache.exists():
        etom = [
            ProcessElement.model_validate_json(line)
            for line in etom_cache.read_text().splitlines()
        ]
        path = THESAURUS / "etom.ttl"
        skos_emitter.emit("etom", etom, path)
        typer.echo(f"thesaurus: {path}")

    sid_cache = CACHE / "sid.jsonl"
    if sid_cache.exists():
        sid = [
            DataEntity.model_validate_json(line)
            for line in sid_cache.read_text().splitlines()
        ]
        path = THESAURUS / "sid.ttl"
        skos_emitter.emit("sid", sid, path)
        typer.echo(f"thesaurus: {path}")

    alignment_yaml = REPO / "services" / "ingest" / "mapping" / "alignments" / "apqc-etom.yaml"
    if alignment_yaml.exists():
        from services.ingest.align import emit_alignment_ttl

        path = THESAURUS / "alignments.ttl"
        count = emit_alignment_ttl(alignment_yaml, path)
        typer.echo(f"alignments: {count} exactMatch → {path}")


@app.command()
def align() -> None:
    """Build APQC↔eTOM alignment candidates (mapping/alignments/apqc-etom.yaml)."""
    from services.ingest.align import build_alignments

    apqc = _load_apqc_cache()
    etom_cache = CACHE / "etom.jsonl"
    if not etom_cache.exists():
        typer.echo("No etom cache — run `ots-ingest parse-moda` first.", err=True)
        raise typer.Exit(1)
    etom = [
        ProcessElement.model_validate_json(line)
        for line in etom_cache.read_text().splitlines()
    ]
    out = REPO / "services" / "ingest" / "mapping" / "alignments" / "apqc-etom.yaml"
    stats = build_alignments(apqc, etom, out)
    typer.echo(f"{stats['exact']} exact + {stats['candidate']} candidates → {out}")
    typer.echo("Review candidates (set status: approved/rejected), then `ots-ingest emit`.")


@app.command()
def validate(industry: str = typer.Option("generic")) -> None:
    """Validate emitted TTL baselines."""
    failed = False
    for path in sorted((BASELINES / industry).glob("*.ttl")):
        problems = validate_ttl(path)
        status = "OK" if not problems else f"{len(problems)} problems"
        typer.echo(f"{path.name}: {status}")
        for problem in problems:
            typer.echo(f"  - {problem}")
            failed = True
    if failed:
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
