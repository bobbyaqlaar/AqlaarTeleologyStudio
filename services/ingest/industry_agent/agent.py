"""Industry-standards agent — keeps industry process baselines in sync with the
APQC industry PCF source PDFs.

Pipeline per industry: parse PDF → ProcessElements (cache) → propose value-stream
mapping (draft, reviewable) → derive engagement profile → emit OWL TTL + BPMN
baselines + SKOS thesaurus → validate. A manifest records source-PDF hashes so a
periodic `check` run can report drift (new/changed/removed industries) without
writing anything, and `sync` only re-emits what changed unless forced.

Reuses services.ingest parsers/emitters/validator so agent output is identical to
`ots-ingest emit --industry <slug>`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from services.ingest.cli import _load_stream_mappings
from services.ingest.emitters import bpmn as bpmn_emitter
from services.ingest.emitters import skos as skos_emitter
from services.ingest.emitters import ttl as ttl_emitter
from services.ingest.models import ProcessElement
from services.ingest.parsers import apqc_pdf
from services.ingest.validate import validate_ttl

AGENT_DRAFT_MARKER = "AGENT-GENERATED DRAFT"

from .discovery import derive_profile, discover, pdf_hash
from .mapping import STREAM_ORDER, propose_streams

REPO = Path(__file__).resolve().parents[3]
INDUSTRIES_DIR = REPO / "ReferenceDocs" / "Industries"
CACHE = REPO / "services" / "ingest" / "cache"
MAPPING_DIR = REPO / "services" / "ingest" / "mapping"
BASELINES = REPO / "data" / "baselines"
THESAURUS = REPO / "data" / "thesaurus"
PROFILES = REPO / "data" / "profiles"
MANIFEST = BASELINES / ".industry_manifest.json"


@dataclass
class IndustryResult:
    slug: str
    label: str
    element_count: int = 0
    stream_tasks: dict[str, int] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)
    status: str = "synced"  # synced | unchanged | error


def _load_manifest() -> dict:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save_manifest(manifest: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def _write_cache(slug: str, elements: list[ProcessElement]) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"apqc_{slug}.jsonl").write_text(
        "\n".join(e.model_dump_json() for e in elements) + "\n"
    )


def _write_streams_yaml(slug: str, label: str, proposal: dict) -> None:
    """Write the agent's draft mapping, but never overwrite a human-reviewed one
    (a file that lacks the agent-draft marker is treated as curated)."""
    path = MAPPING_DIR / f"streams_{slug}.yaml"
    if path.exists() and AGENT_DRAFT_MARKER not in path.read_text():
        return
    header = (
        f"# {label} value stream mapping — {AGENT_DRAFT_MARKER}.\n"
        f"# Produced by services/ingest/industry_agent from the APQC {label} PCF.\n"
        "# Prefixes are pinned to this industry's own PCF numbering via keyword\n"
        "# heuristics — REVIEW before relying on the baselines in a live engagement.\n"
        "# (Remove this marker once reviewed to protect it from agent re-writes.)\n\n"
    )
    body = yaml.safe_dump(proposal, sort_keys=False, default_flow_style=False)
    path.write_text(header + body)


def _write_profile(slug: str, profile: dict) -> None:
    """Create the industry profile if absent; never clobber a curated one."""
    PROFILES.mkdir(parents=True, exist_ok=True)
    path = PROFILES / f"{slug}.json"
    if path.exists():
        return
    path.write_text(json.dumps(profile, indent=2) + "\n")


def _emit_and_validate(
    slug: str, elements: list[ProcessElement]
) -> IndustryResult:
    """Emit from the on-disk streams_{slug}.yaml (the reviewed source of truth,
    which may be the agent draft or a curated override)."""
    result = IndustryResult(slug=slug, label=slug, element_count=len(elements))
    mappings = _load_stream_mappings(slug)
    for stream in STREAM_ORDER:
        mapping = mappings[stream]
        ttl_path = BASELINES / slug / f"{stream}.ttl"
        bpmn_path = BASELINES / slug / f"{stream}.bpmn"
        ttl_emitter.emit(mapping, elements, ttl_path)
        bpmn_emitter.emit(mapping, elements, bpmn_path)
        result.stream_tasks[stream] = len(mapping.subtrees)
        problems = validate_ttl(ttl_path)
        result.problems.extend(f"{stream}: {p}" for p in problems)

    skos_emitter.emit(f"apqc_{slug}", elements, THESAURUS / f"apqc_{slug}.ttl")
    if result.problems:
        result.status = "error"
    return result


def sync_industry(
    pdf: Path, slug: str, label: str, *, force: bool = False, manifest: dict | None = None
) -> IndustryResult:
    """Parse + emit one industry. Skips (status=unchanged) when the PDF hash
    matches the manifest and outputs already exist, unless `force`."""
    manifest = manifest if manifest is not None else _load_manifest()
    digest = pdf_hash(pdf)
    prior = manifest.get(slug, {})
    outputs_exist = (BASELINES / slug / "o2c.ttl").exists()
    if not force and prior.get("hash") == digest and outputs_exist:
        return IndustryResult(
            slug=slug,
            label=label,
            element_count=prior.get("elementCount", 0),
            status="unchanged",
        )

    elements = apqc_pdf.parse(pdf, slug)
    if not elements:
        return IndustryResult(
            slug=slug,
            label=label,
            element_count=0,
            status="error",
            problems=["no elements parsed — unsupported PDF layout for apqc_pdf"],
        )
    _write_cache(slug, elements)
    _write_streams_yaml(slug, label, propose_streams(elements))
    _write_profile(slug, derive_profile(label, elements))
    result = _emit_and_validate(slug, elements)
    result.label = label

    manifest[slug] = {
        "hash": digest,
        "label": label,
        "source": pdf.name,
        "elementCount": len(elements),
        "streamTasks": result.stream_tasks,
        "problems": len(result.problems),
    }
    _save_manifest(manifest)
    return result


def sync_all(*, force: bool = False) -> list[IndustryResult]:
    manifest = _load_manifest()
    results: list[IndustryResult] = []
    for pdf, slug, label in discover(INDUSTRIES_DIR):
        try:
            results.append(
                sync_industry(pdf, slug, label, force=force, manifest=manifest)
            )
        except Exception as exc:  # noqa: BLE001 — report, keep going
            results.append(
                IndustryResult(slug=slug, label=label, status="error", problems=[str(exc)])
            )
    return results


def check() -> list[dict]:
    """Drift report for periodic runs. No writes. Returns per-industry status:
    new | changed | current | missing-output."""
    manifest = _load_manifest()
    report: list[dict] = []
    for pdf, slug, label in discover(INDUSTRIES_DIR):
        digest = pdf_hash(pdf)
        prior = manifest.get(slug, {})
        outputs_exist = (BASELINES / slug / "o2c.ttl").exists()
        if not prior:
            status = "new"
        elif prior.get("hash") != digest:
            status = "changed"
        elif not outputs_exist:
            status = "missing-output"
        else:
            status = "current"
        report.append({"slug": slug, "label": label, "status": status, "source": pdf.name})
    return report
