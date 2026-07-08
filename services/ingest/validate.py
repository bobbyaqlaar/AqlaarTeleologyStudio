"""Validation checks for emitted baseline TTL graphs.

Checks: every class has a label, functionUnit values in the OTS enum,
ots:precedes is acyclic, exactly one root class (no ots:functionUnit and no
subClassOf pointing outside the graph). SHACL shapes can extend this later.
"""

from __future__ import annotations

from pathlib import Path

from rdflib import OWL, RDF, RDFS, Graph, Namespace

OTS = Namespace("http://ots.local/ontology/")

FUNCTION_UNITS = {
    "sales", "marketing", "customer_care", "finance", "procurement_scm",
    "production", "operations", "hr", "products", "it", "networks",
}


def validate_ttl(path: Path) -> list[str]:
    """Return list of problems; empty list = valid."""
    problems: list[str] = []
    graph = Graph()
    graph.parse(path, format="turtle")

    classes = set(graph.subjects(RDF.type, OWL.Class))

    for cls in classes:
        if not any(graph.objects(cls, RDFS.label)):
            problems.append(f"missing rdfs:label: {cls}")
        for unit in graph.objects(cls, OTS.functionUnit):
            if str(unit) not in FUNCTION_UNITS:
                problems.append(f"invalid functionUnit '{unit}' on {cls}")

    # precedes acyclicity (iterative DFS)
    successors: dict[object, list[object]] = {}
    for source, target in graph.subject_objects(OTS.precedes):
        successors.setdefault(source, []).append(target)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[object, int] = {}
    for start in successors:
        if color.get(start, WHITE) != WHITE:
            continue
        stack: list[tuple[object, bool]] = [(start, False)]
        while stack:
            node, processed = stack.pop()
            if processed:
                color[node] = BLACK
                continue
            state = color.get(node, WHITE)
            if state == GRAY:
                continue
            color[node] = GRAY
            stack.append((node, True))
            for nxt in successors.get(node, []):
                if color.get(nxt, WHITE) == GRAY:
                    problems.append(f"precedes cycle involving {nxt}")
                elif color.get(nxt, WHITE) == WHITE:
                    stack.append((nxt, False))

    roots = [
        cls for cls in classes
        if not any(graph.objects(cls, RDFS.subClassOf))
        and not any(graph.objects(cls, OTS.functionUnit))
    ]
    if len(roots) != 1:
        problems.append(f"expected exactly 1 root class, found {len(roots)}: {roots}")

    return problems
