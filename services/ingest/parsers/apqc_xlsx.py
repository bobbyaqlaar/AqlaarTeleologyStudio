"""Parse the APQC PCF cross-industry Excel (v8) into ProcessElements.

Source sheet "Combined" columns:
PCF ID | Hierarchy ID | Name | Difference Index | Change Details | Metrics Available? | Element Description
"""

from __future__ import annotations

import re
from pathlib import Path

import openpyxl

from services.ingest.models import Framework, ProcessElement

HIERARCHY_RE = re.compile(r"^\d+(\.\d+)*$")


def _parent_id(hierarchy_id: str) -> str | None:
    parts = hierarchy_id.split(".")
    if len(parts) == 2:
        # "1.0" is a root category; "1.1" hangs off "1.0"
        return None if parts[1] == "0" else f"{parts[0]}.0"
    return ".".join(parts[:-1])


def _level(hierarchy_id: str) -> int:
    parts = hierarchy_id.split(".")
    if len(parts) == 2 and parts[1] == "0":
        return 1
    return len(parts)


def parse(xlsx_path: Path, industry: str | None = None) -> list[ProcessElement]:
    workbook = openpyxl.load_workbook(xlsx_path, read_only=True)
    sheet = workbook["Combined"]

    elements: list[ProcessElement] = []
    sibling_order: dict[str | None, int] = {}

    for row in sheet.iter_rows(min_row=2, values_only=True):
        pcf_id, hierarchy_id, name = row[0], row[1], row[2]
        description = row[6] if len(row) > 6 else None
        if not hierarchy_id or not name:
            continue
        hierarchy_id = str(hierarchy_id).strip()
        if not HIERARCHY_RE.match(hierarchy_id):
            continue

        parent = _parent_id(hierarchy_id)
        order = sibling_order.get(parent, 0)
        sibling_order[parent] = order + 1

        elements.append(
            ProcessElement(
                id=hierarchy_id,
                pcf_id=str(pcf_id).strip() if pcf_id else None,
                framework=Framework.APQC_INDUSTRY if industry else Framework.APQC,
                level=_level(hierarchy_id),
                name=str(name).strip(),
                description=str(description).strip() if description else None,
                parent_id=parent,
                order=order,
                industry=industry,
            )
        )

    workbook.close()
    return elements
