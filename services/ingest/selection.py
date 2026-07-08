"""Select the ProcessElements a SubtreeMapping contributes to a baseline.

Two addressing modes:
- prefix: dotted hierarchy-id prefix (APQC), ordered by numeric id parts.
- root_name: element name (eTOM slug ids aren't meaningful). Duplicate
  names (element page vs diagram page) resolve to the candidate with the
  largest subtree. Order is depth-first by each element's `order`.
"""

from __future__ import annotations

from services.ingest.models import ProcessElement, SubtreeMapping


def _prefix_select(subtree: SubtreeMapping, elements: list[ProcessElement]) -> list[ProcessElement]:
    assert subtree.prefix is not None
    selected = [
        e for e in elements
        if (e.id == subtree.prefix or e.id.startswith(subtree.prefix + "."))
        and e.level <= subtree.max_level
    ]
    return sorted(selected, key=lambda e: [int(p) for p in e.id.split(".")])


def _name_select(subtree: SubtreeMapping, elements: list[ProcessElement]) -> list[ProcessElement]:
    assert subtree.root_name is not None
    by_id = {e.id: e for e in elements}
    children: dict[str, list[ProcessElement]] = {}
    for element in elements:
        if element.parent_id:
            children.setdefault(element.parent_id, []).append(element)
    for kids in children.values():
        kids.sort(key=lambda e: e.order)

    def subtree_size(root: ProcessElement) -> int:
        size, stack = 0, [root]
        while stack:
            node = stack.pop()
            size += 1
            stack.extend(children.get(node.id, []))
        return size

    candidates = [e for e in elements if e.name == subtree.root_name]
    if not candidates:
        raise ValueError(f"root_name not found: {subtree.root_name!r}")
    root = max(candidates, key=subtree_size)

    ordered: list[ProcessElement] = []

    def walk(node: ProcessElement) -> None:
        if node.level > subtree.max_level:
            return
        ordered.append(node)
        for child in children.get(node.id, []):
            # Skip self-referential diagram duplicates sharing the name
            if child.name == node.name:
                continue
            walk(child)

    walk(root)
    return [e for e in ordered if e.id in by_id]


def select(subtree: SubtreeMapping, elements: list[ProcessElement]) -> list[ProcessElement]:
    if subtree.prefix:
        return _prefix_select(subtree, elements)
    if subtree.root_name:
        return _name_select(subtree, elements)
    raise ValueError("SubtreeMapping needs prefix or root_name")


def leaf_level_elements(
    subtree: SubtreeMapping, selected: list[ProcessElement]
) -> list[ProcessElement]:
    """Elements forming the process chain (BPMN tasks / ots:precedes)."""
    return [e for e in selected if e.level == subtree.max_level]
