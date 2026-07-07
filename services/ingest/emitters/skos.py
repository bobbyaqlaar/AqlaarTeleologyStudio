"""Emit a SKOS thesaurus TTL from a full framework hierarchy.

Every ProcessElement / DataEntity becomes a skos:Concept with prefLabel,
definition, broader → parent, and skos:notation carrying the framework id.
Cross-framework skos:exactMatch alignments are a separate later step
(docs/TODO-implementation-plan.md §1.5).
"""

from __future__ import annotations

from pathlib import Path

from rdflib import RDF, SKOS, Graph, Literal, Namespace, URIRef

from services.ingest.models import DataEntity, ProcessElement

THES = Namespace("http://ots.local/thesaurus/")


def _concept_uri(framework: str, native_id: str) -> URIRef:
    return THES[f"{framework}/{native_id.replace('.', '_').replace(':', '_')}"]


def emit(
    framework: str,
    elements: list[ProcessElement] | list[DataEntity],
    out_path: Path,
) -> Graph:
    graph = Graph()
    graph.bind("skos", SKOS)
    graph.bind("thes", THES)

    scheme = THES[framework]
    graph.add((scheme, RDF.type, SKOS.ConceptScheme))
    graph.add((scheme, SKOS.prefLabel, Literal(framework.upper(), lang="en")))

    for element in elements:
        uri = _concept_uri(framework, element.id)
        graph.add((uri, RDF.type, SKOS.Concept))
        graph.add((uri, SKOS.inScheme, scheme))
        graph.add((uri, SKOS.prefLabel, Literal(element.name, lang="en")))
        graph.add((uri, SKOS.notation, Literal(element.id)))
        if element.description:
            graph.add((uri, SKOS.definition, Literal(element.description, lang="en")))
        if element.parent_id:
            graph.add((uri, SKOS.broader, _concept_uri(framework, element.parent_id)))
        else:
            graph.add((scheme, SKOS.hasTopConcept, uri))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    graph.serialize(destination=out_path, format="turtle")
    return graph
