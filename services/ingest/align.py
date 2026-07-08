"""Cross-framework concept alignment (APQC ↔ eTOM) for skos:exactMatch.

Deterministic pass: normalized-name equality → confidence "exact";
token-Jaccard ≥ 0.75 → "candidate" (needs human review). Results land in
mapping/alignments/apqc-etom.yaml — edit `status` to approve/reject —
then `ots-ingest emit` writes approved pairs to data/thesaurus/alignments.ttl.
LLM-assisted semantic alignment can extend this later.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml
from rdflib import Graph, Namespace, SKOS, URIRef

from services.ingest.models import ProcessElement

THES = Namespace("http://ots.local/thesaurus/")

STOPWORDS = {"the", "and", "of", "for", "to", "a", "an", "&", "manage", "management"}


def _norm_tokens(name: str) -> frozenset[str]:
    tokens = re.sub(r"[^a-z0-9 ]", " ", name.lower()).split()
    return frozenset(t for t in tokens if t not in STOPWORDS)


def _concept_uri(framework: str, native_id: str) -> str:
    return str(THES[f"{framework}/{native_id.replace('.', '_').replace(':', '_')}"])


def build_alignments(
    apqc: list[ProcessElement],
    etom: list[ProcessElement],
    out_yaml: Path,
) -> dict[str, int]:
    etom_by_tokens: dict[frozenset[str], list[ProcessElement]] = {}
    for element in etom:
        etom_by_tokens.setdefault(_norm_tokens(element.name), []).append(element)

    pairs: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for a in apqc:
        a_tokens = _norm_tokens(a.name)
        if not a_tokens:
            continue
        for e_tokens, e_elements in etom_by_tokens.items():
            if not e_tokens:
                continue
            union = a_tokens | e_tokens
            jaccard = len(a_tokens & e_tokens) / len(union)
            if jaccard < 0.75:
                continue
            status = "exact" if a_tokens == e_tokens else "candidate"
            for e in e_elements:
                key = (a.id, e.id)
                if key in seen:
                    continue
                seen.add(key)
                pairs.append(
                    {
                        "apqc_id": a.id,
                        "apqc_name": a.name,
                        "etom_id": e.id,
                        "etom_name": e.name,
                        "status": status,  # exact | candidate | approved | rejected
                    }
                )

    pairs.sort(key=lambda p: (p["status"] != "exact", p["apqc_id"]))
    out_yaml.parent.mkdir(parents=True, exist_ok=True)
    out_yaml.write_text(yaml.safe_dump(pairs, sort_keys=False, allow_unicode=True))
    return {
        "exact": sum(1 for p in pairs if p["status"] == "exact"),
        "candidate": sum(1 for p in pairs if p["status"] == "candidate"),
    }


def emit_alignment_ttl(alignment_yaml: Path, out_path: Path) -> int:
    """Write skos:exactMatch triples for exact/approved pairs; returns count."""
    pairs = yaml.safe_load(alignment_yaml.read_text()) or []
    graph = Graph()
    graph.bind("skos", SKOS)
    count = 0
    for pair in pairs:
        if pair.get("status") not in {"exact", "approved"}:
            continue
        apqc_uri = URIRef(_concept_uri("apqc", pair["apqc_id"]))
        etom_uri = URIRef(_concept_uri("etom", pair["etom_id"]))
        graph.add((apqc_uri, SKOS.exactMatch, etom_uri))
        count += 1
    out_path.parent.mkdir(parents=True, exist_ok=True)
    graph.serialize(destination=out_path, format="turtle")
    return count
