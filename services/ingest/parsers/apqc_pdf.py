"""Parse APQC industry PCF PDFs (two-column process lists) into ProcessElements.

Industry PDFs (ReferenceDocs/Industries/*.pdf) are hierarchical lists:
"3.1.1 Perform customer and market intelligence analysis (10106)"
laid out in two columns per page, with entries wrapping across lines and
"fi"/"fl" ligatures extracted as split text ("Defi ne").

Strategy: crop each page into left/right half, extract text per column in
reading order, then accumulate lines into entries — an entry starts with a
hierarchy id and closes at a trailing "(NNNNN)" PCF id.
"""

from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

from services.ingest.models import Framework, ProcessElement

ENTRY_START = re.compile(r"^(\d+(?:\.\d+)+)\s+(.+)$")  # id must contain a dot
MAX_NAME_LEN = 150  # runaway accumulation (prose swallowed) → junk
PCF_ID_END = re.compile(r"\((\d{4,6})\)\s*$")
LIGATURE = re.compile(r"\b(\w*f[il])\s(?=[a-z])")


def _fix_ligatures(text: str) -> str:
    # "Defi ne" -> "Define", "workfl ow" -> "workflow"
    return LIGATURE.sub(r"\1", text)


def _level(hierarchy_id: str) -> int:
    parts = hierarchy_id.split(".")
    if len(parts) == 2 and parts[1] == "0":
        return 1
    return len(parts)


def _parent_id(hierarchy_id: str) -> str | None:
    parts = hierarchy_id.split(".")
    if len(parts) == 2:
        return None if parts[1] == "0" else f"{parts[0]}.0"
    return ".".join(parts[:-1])


def _column_lines(pdf_path: Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            half = page.width / 2
            for bbox in ((0, 0, half, page.height), (half, 0, page.width, page.height)):
                text = page.crop(bbox).extract_text() or ""
                lines.extend(text.splitlines())
    return lines


def parse(pdf_path: Path, industry: str) -> list[ProcessElement]:
    elements: list[ProcessElement] = []
    sibling_order: dict[str | None, int] = {}

    current_id: str | None = None
    current_text: list[str] = []

    def close_entry() -> None:
        nonlocal current_id, current_text
        if current_id is None:
            return
        joined = _fix_ligatures(" ".join(current_text).strip())
        match = PCF_ID_END.search(joined)
        pcf_id = match.group(1) if match else None
        name = PCF_ID_END.sub("", joined).strip().rstrip("-").strip()
        # Table-of-contents leader dots/underscores + page numbers
        name = re.sub(r"[_.\s]*[_.]+\s*\d*$", "", name).strip()
        # TOC category lines lack PCF ids; body category lines have them —
        # keep id-less entries only when short enough to be a plausible name
        if len(name) > MAX_NAME_LEN:
            name = ""
        if name:
            parent = _parent_id(current_id)
            order = sibling_order.get(parent, 0)
            sibling_order[parent] = order + 1
            elements.append(
                ProcessElement(
                    id=current_id,
                    pcf_id=pcf_id,
                    framework=Framework.APQC_INDUSTRY,
                    level=_level(current_id),
                    name=name,
                    parent_id=parent,
                    order=order,
                    industry=industry,
                )
            )
        current_id, current_text = None, []

    for raw_line in _column_lines(pdf_path):
        line = raw_line.strip()
        if not line:
            continue
        start = ENTRY_START.match(line)
        if start:
            close_entry()
            current_id, current_text = start.group(1), [start.group(2)]
        elif current_id is not None:
            current_text.append(line)
        if current_id is not None and PCF_ID_END.search(current_text[-1]):
            close_entry()

    close_entry()

    # De-duplicate (headers repeating category lines) keeping first occurrence
    seen: set[str] = set()
    unique: list[ProcessElement] = []
    for element in elements:
        if element.id not in seen:
            seen.add(element.id)
            unique.append(element)
    return unique
