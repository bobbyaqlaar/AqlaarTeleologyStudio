"""Parse APQC industry PCF PDFs into ProcessElements.

STATUS: stub — implement per docs/TODO-implementation-plan.md §1.3.
Plan: pdfplumber text extraction, regex hierarchy ids (e.g. "3.5.2 (10123)"),
cache raw extraction to services/ingest/cache/apqc_pdf/{stem}.jsonl, optional
LLM cleanup for descriptions. Industry PDFs live in ReferenceDocs/Industries/.
"""

from __future__ import annotations

from pathlib import Path

from services.ingest.models import ProcessElement


def parse(pdf_path: Path, industry: str) -> list[ProcessElement]:
    raise NotImplementedError(
        "APQC industry PDF parser not yet implemented — see "
        "docs/TODO-implementation-plan.md §1.3"
    )
