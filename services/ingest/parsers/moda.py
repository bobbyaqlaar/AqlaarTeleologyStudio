"""Parse the TM Forum MODA crawl (cache/moda_full.jsonl) into eTOM + SID.

The MODA site is an Enterprise Architect HTML export. Every page carries a
breadcrumb trail (div.breadcrumb_frame) of <a href> ancestors; consecutive
anchors define parent→child edges, so the full tree can be reconstructed
from breadcrumbs alone. Page bodies contribute descriptions
(div.ObjectDetailsNotes).

Top-level sections observed (2026-07 crawl, 17k+ pages):
  Business Process Framework  → eTOM process hierarchy   (framework=etom)
  Information Framework       → SID domains/ABEs         (framework=sid)
Other sections (Functional/Application Framework, ODA) are ignored for now.
"""

from __future__ import annotations

import json
import posixpath
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from services.ingest.models import DataEntity, Framework, ProcessElement

ETOM_ROOT_NAME = "Business Process Framework"
ETOM_TREE_NAME = "Process"  # child of BPF holding the real hierarchy
SID_ROOT_NAME = "Information Framework"
# Deleted/template/status noise mixed into the EA export
NOISE_MARKERS = (
    "[deleted]", "(deleted)", "ztemplate", "tmf status", "hierarchy level",
    "start here", "unused abe", "$diagram",
)
# EA-export boilerplate injected into notes cells
JUNK_NOTES_PREFIXES = ("Description: the level of this object",)


def _clean(text: str) -> str:
    return " ".join(text.split())


def _norm_url(url: str) -> str:
    parts = url.split("://", 1)
    if len(parts) == 2:
        scheme, rest = parts
        return f"{scheme}://{posixpath.normpath(rest)}"
    return posixpath.normpath(url)


def parse(
    dump_path: Path,
) -> tuple[list[ProcessElement], list[DataEntity], dict[str, int]]:
    """Return (etom process elements, sid data entities, coverage stats)."""
    name_by_url: dict[str, str] = {}
    parent_by_url: dict[str, str] = {}
    children_by_url: dict[str, list[str]] = {}
    desc_by_url: dict[str, str] = {}
    stats = {"pages": 0, "breadcrumb_pages": 0, "described": 0}

    with dump_path.open() as handle:
        for line in handle:
            record = json.loads(line)
            stats["pages"] += 1
            page_url = _norm_url(record["url"])
            soup = BeautifulSoup(record["html"], "lxml")

            crumbs = soup.select_one("div.breadcrumb_frame")
            if crumbs is None:
                continue
            anchors = [
                (_norm_url(urljoin(page_url, a["href"])), _clean(a.get_text()))
                for a in crumbs.find_all("a", href=True)
            ]
            # Drop the site root ("MODA" / index.htm)
            anchors = [a for a in anchors if not a[0].endswith("index.htm")]
            if not anchors:
                continue
            stats["breadcrumb_pages"] += 1

            previous: tuple[str, str] | None = None
            for url, name in anchors:
                if name:
                    name_by_url.setdefault(url, name)
                if previous is not None and url != previous[0] and url not in parent_by_url:
                    parent_by_url[url] = previous[0]
                    children_by_url.setdefault(previous[0], []).append(url)
                previous = (url, name)

            if page_url not in desc_by_url:
                for notes in soup.select("div.ObjectDetailsNotes"):
                    text = _clean(notes.get_text())
                    if text and not text.startswith(JUNK_NOTES_PREFIXES):
                        desc_by_url[page_url] = text
                        stats["described"] += 1
                        break

    def _is_noise(url: str) -> bool:
        name = name_by_url.get(url, "").lower()
        return any(marker in name for marker in NOISE_MARKERS)

    def collect(root_url: str) -> list[tuple[str, int]]:
        """(url, depth) for all descendants of root, depth 0 = root.

        Skips noise nodes (deleted/template/status) and their subtrees.
        """
        out: list[tuple[str, int]] = []
        stack: list[tuple[str, int]] = [(root_url, 0)]
        seen: set[str] = set()
        while stack:
            url, depth = stack.pop()
            if url in seen or _is_noise(url):
                continue
            seen.add(url)
            out.append((url, depth))
            for child in children_by_url.get(url, []):
                stack.append((child, depth + 1))
        return out

    def find_tree_root(framework_root_name: str, tree_name: str) -> str | None:
        framework_urls = {u for u, n in name_by_url.items() if n == framework_root_name}
        for url, name in name_by_url.items():
            if name == tree_name and parent_by_url.get(url) in framework_urls:
                return url
        return None

    roots = {
        ETOM_ROOT_NAME: find_tree_root(ETOM_ROOT_NAME, ETOM_TREE_NAME),
        SID_ROOT_NAME: max(
            (url for url, name in name_by_url.items() if name == SID_ROOT_NAME),
            key=lambda url: len(children_by_url.get(url, [])),
            default=None,
        ),
    }

    processes: list[ProcessElement] = []
    entities: list[DataEntity] = []
    order_by_parent: dict[str, int] = {}

    def slug(url: str) -> str:
        return url.rsplit("/MODA/", 1)[-1].removesuffix(".htm").replace("/", "_")

    etom_root = roots.get(ETOM_ROOT_NAME)
    if etom_root:
        for url, depth in collect(etom_root):
            if depth == 0:
                continue
            parent = parent_by_url.get(url)
            order = order_by_parent.get(parent or "", 0)
            order_by_parent[parent or ""] = order + 1
            processes.append(
                ProcessElement(
                    id=f"etom:{slug(url)}",
                    framework=Framework.ETOM,
                    level=depth,
                    name=name_by_url.get(url, slug(url)),
                    description=desc_by_url.get(url),
                    parent_id=f"etom:{slug(parent)}" if parent and parent != etom_root else None,
                    order=order,
                    industry="telecom",
                )
            )

    sid_root = roots.get(SID_ROOT_NAME)
    if sid_root:
        for url, depth in collect(sid_root):
            if depth == 0:
                continue
            parent = parent_by_url.get(url)
            entities.append(
                DataEntity(
                    id=f"sid:{slug(url)}",
                    framework=Framework.SID,
                    name=name_by_url.get(url, slug(url)),
                    description=desc_by_url.get(url),
                    parent_id=f"sid:{slug(parent)}" if parent and parent != sid_root else None,
                )
            )

    stats["etom_elements"] = len(processes)
    stats["sid_entities"] = len(entities)
    return processes, entities, stats
