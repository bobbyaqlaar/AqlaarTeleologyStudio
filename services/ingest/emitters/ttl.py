"""Emit OWL baseline TTL for a value stream from mapped ProcessElements.

Output shape matches what services/api/fuseki_client.py already loads:
- one stream root owl:Class
- step classes with rdfs:subClassOf up the hierarchy
- ots:precedes chain over ordered process-level classes
- ots:functionUnit on every step class
- dcterms:source provenance (PCF id) on every emitted class
"""

from __future__ import annotations

import re
from pathlib import Path

from rdflib import DCTERMS, OWL, RDF, RDFS, Graph, Literal, Namespace, URIRef

from services.ingest.models import ProcessElement, StreamMapping

OTS = Namespace("http://ots.local/ontology/")

STREAM_ROOTS = {
    "o2c": ("OrderToCash", "Order to cash"),
    "p2p": ("ProcureToPay", "Procure to pay"),
    "c2m": ("ConceptToMarket", "Concept to market"),
    "h2r": ("HireToRetire", "Hire to retire"),
    "t2r": ("TroubleToResolve", "Trouble to resolve"),
}


def _class_uri(element: ProcessElement) -> URIRef:
    slug = re.sub(r"[^A-Za-z0-9]+", " ", element.name).title().replace(" ", "")
    return OTS[f"{slug}_{element.id.replace('.', '_')}"]


def _in_subtree(element: ProcessElement, prefix: str) -> bool:
    return element.id == prefix or element.id.startswith(prefix + ".")


def emit(
    stream: StreamMapping,
    elements: list[ProcessElement],
    out_path: Path,
) -> Graph:
    graph = Graph()
    graph.bind("ots", OTS)
    graph.bind("owl", OWL)
    graph.bind("dcterms", DCTERMS)

    graph.add((OTS.precedes, RDF.type, OWL.ObjectProperty))
    graph.add((OTS.precedes, RDFS.label, Literal("precedes", lang="en")))

    root_local, root_label = STREAM_ROOTS[stream.stream]
    root = OTS[root_local]
    graph.add((root, RDF.type, OWL.Class))
    graph.add((root, RDFS.label, Literal(root_label, lang="en")))

    uri_by_id: dict[str, URIRef] = {}
    chain: list[URIRef] = []  # process-level classes in stream order

    for subtree in stream.subtrees:
        selected = sorted(
            (e for e in elements if _in_subtree(e, subtree.prefix) and e.level <= subtree.max_level),
            key=lambda e: [int(p) for p in e.id.split(".")],
        )
        for element in selected:
            uri = _class_uri(element)
            uri_by_id[element.id] = uri
            graph.add((uri, RDF.type, OWL.Class))
            graph.add((uri, RDFS.label, Literal(element.name, lang="en")))
            parent_uri = uri_by_id.get(element.parent_id or "")
            graph.add((uri, RDFS.subClassOf, parent_uri if parent_uri else root))
            graph.add((uri, OTS.functionUnit, Literal(subtree.function_unit)))
            source = f"APQC PCF v8 {element.id}" + (f" (PCF ID {element.pcf_id})" if element.pcf_id else "")
            graph.add((uri, DCTERMS.source, Literal(source)))
            if element.description:
                graph.add((uri, RDFS.comment, Literal(element.description, lang="en")))
            if element.level == subtree.max_level:
                chain.append(uri)

    for current, following in zip(chain, chain[1:]):
        graph.add((current, OTS.precedes, following))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    graph.serialize(destination=out_path, format="turtle")
    return graph
