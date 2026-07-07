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
MODA_DUMP = REPO / "ReferenceDocs" / "moda_dump.jsonl"
STREAMS_YAML = REPO / "services" / "ingest" / "mapping" / "streams.yaml"
BASELINES = REPO / "data" / "baselines"
THESAURUS = REPO / "data" / "thesaurus"

ALL_STREAMS = ["o2c", "p2p", "c2m", "h2r", "t2r"]


def _load_stream_mappings() -> dict[str, StreamMapping]:
    raw = yaml.safe_load(STREAMS_YAML.read_text())
    return {
        key: StreamMapping(stream=key, label=value["label"], subtrees=value["subtrees"])
        for key, value in raw.items()
    }


def _load_apqc_cache() -> list[ProcessElement]:
    cache_file = CACHE / "apqc.jsonl"
    if not cache_file.exists():
        typer.echo("No cache — run `ots-ingest parse-apqc` first.", err=True)
        raise typer.Exit(1)
    return [
        ProcessElement.model_validate_json(line)
        for line in cache_file.read_text().splitlines()
    ]


@app.command()
def parse_apqc() -> None:
    """Parse the APQC PCF Excel into cache/apqc.jsonl."""
    elements = apqc_xlsx.parse(APQC_XLSX)
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / "apqc.jsonl"
    out.write_text("\n".join(e.model_dump_json() for e in elements))
    typer.echo(f"Parsed {len(elements)} PCF elements → {out}")


@app.command()
def parse_moda() -> None:
    """Parse the TM Forum MODA dump; report coverage."""
    processes, entities, stats = moda.parse(MODA_DUMP)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "etom.jsonl").write_text("\n".join(p.model_dump_json() for p in processes))
    (CACHE / "sid.jsonl").write_text("\n".join(e.model_dump_json() for e in entities))
    typer.echo(json.dumps(stats, indent=2))
    if stats["stub_pages"] > stats["pages"] * 0.5:
        typer.echo(
            "WARNING: dump is mostly navigation stubs — re-run "
            "ReferenceDocs/moda_spider.py with deeper crawling before "
            "trusting telecom output.",
            err=True,
        )


@app.command()
def emit(
    stream: str = typer.Option("all", help="o2c|p2p|c2m|h2r|t2r|all"),
    industry: str = typer.Option("generic", help="baseline industry folder"),
) -> None:
    """Emit TTL + BPMN baselines per stream, and the APQC SKOS thesaurus."""
    elements = _load_apqc_cache()
    mappings = _load_stream_mappings()
    targets = ALL_STREAMS if stream == "all" else [stream]

    for key in targets:
        mapping = mappings[key]
        ttl_path = BASELINES / industry / f"{key}.ttl"
        ttl_emitter.emit(mapping, elements, ttl_path)
        bpmn_path = BASELINES / industry / f"{key}.bpmn"
        bpmn_emitter.emit(mapping, elements, bpmn_path)
        typer.echo(f"{key}: {ttl_path} + {bpmn_path}")

    skos_path = THESAURUS / "apqc.ttl"
    skos_emitter.emit("apqc", elements, skos_path)
    typer.echo(f"thesaurus: {skos_path}")


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
