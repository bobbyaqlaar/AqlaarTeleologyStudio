"""Parse the TM Forum MODA crawl dump (JSONL of {url, title, html}).

Extracts eTOM process elements and SID domain entities from the Enterprise
Architect HTML export pages.

NOTE (2026-07-08): the current dump has only 83 pages — mostly navigation
stubs plus the main index. Detail coverage is thin; re-run
ReferenceDocs/moda_spider.py with deeper link-following before trusting
telecom baselines produced from this source. The parser below is
best-effort against the existing dump and will report what it found.
"""

from __future__ import annotations

import json
from pathlib import Path

from bs4 import BeautifulSoup

from services.ingest.models import DataEntity, Framework, ProcessElement


def _clean(text: str) -> str:
    return " ".join(text.split())


def parse(
    dump_path: Path,
) -> tuple[list[ProcessElement], list[DataEntity], dict[str, int]]:
    """Return (etom process elements, sid data entities, coverage stats)."""
    processes: list[ProcessElement] = []
    entities: list[DataEntity] = []
    stats = {"pages": 0, "stub_pages": 0, "parsed_objects": 0}

    with dump_path.open() as handle:
        for line in handle:
            record = json.loads(line)
            stats["pages"] += 1
            html = record.get("html", "")
            if len(html) < 8000:
                stats["stub_pages"] += 1

            soup = BeautifulSoup(html, "lxml")
            title = _clean(record.get("title") or "")

            # EA export object pages carry the object name in .ObjectTitle
            # and notes/description in .ObjectDetailsNotes.
            name_node = soup.select_one(".ObjectTitle")
            notes_node = soup.select_one(".ObjectDetailsNotes")
            name = _clean(name_node.get_text()) if name_node else title
            if not name or name in {":", "None"}:
                continue
            description = _clean(notes_node.get_text()) if notes_node else None

            lowered = (name + " " + (description or "")).lower()
            object_id = record["url"].rsplit("/", 1)[-1].removesuffix(".htm")
            stats["parsed_objects"] += 1

            if "sid" in lowered or "domain" in lowered and "abe" in lowered:
                entities.append(
                    DataEntity(
                        id=f"sid:{object_id}",
                        framework=Framework.SID,
                        name=name,
                        description=description,
                    )
                )
            else:
                processes.append(
                    ProcessElement(
                        id=f"etom:{object_id}",
                        framework=Framework.ETOM,
                        level=1,  # true level unknown until deeper crawl
                        name=name,
                        description=description,
                        industry="telecom",
                    )
                )

    return processes, entities, stats
