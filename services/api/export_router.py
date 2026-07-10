"""Watermarked PDF export of the engagement summary (spec §15).

GET /api/v1/engagements/{id}/export.pdf renders streams + approvals, a
task-level snapshot of each loaded BPMN process (function/system tags),
and the teleology matrix. Every page carries a diagonal watermark
(default "CONFIDENTIAL - DRAFT", override with ?watermark=...) plus a
footer with generation time and page number. Exports are audit-logged.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlmodel import select

from audit import Actor, get_actor, record_audit
from db import STREAM_TYPES, get_session
from db_models import (
    EngagementRow,
    ProcessStateRow,
    TeleologyRowDB,
    ValueStreamRow,
)
from gaps_router import _extract_tasks

router = APIRouter(prefix="/api/v1/engagements", tags=["export"])

STREAM_LABELS = {
    "o2c": "Order to Cash",
    "p2p": "Procure to Pay",
    "c2m": "Concept to Market",
    "h2r": "Hire to Retire",
    "t2r": "Trouble to Resolve",
}

_styles = getSampleStyleSheet()
_body = _styles["BodyText"]
_cell = ParagraphStyle("cell", parent=_body, fontSize=8, leading=10)
_cell_bold = ParagraphStyle("cellBold", parent=_cell, fontName="Helvetica-Bold")

_TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
)


def _p(text: str, style: ParagraphStyle = _cell) -> Paragraph:
    return Paragraph(text or "—", style)


def _watermark_and_footer(watermark_text: str, generated_at: str):
    def draw(canvas, doc) -> None:
        canvas.saveState()
        # Diagonal watermark
        canvas.setFont("Helvetica-Bold", 48)
        canvas.setFillColor(colors.Color(0.85, 0.1, 0.1, alpha=0.12))
        width, height = A4
        canvas.translate(width / 2, height / 2)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, watermark_text)
        canvas.restoreState()
        # Footer
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#6b7280"))
        canvas.drawString(15 * mm, 10 * mm, f"Generated {generated_at} · OTS")
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    return draw


def _bullets(items: list[str]) -> str:
    return "<br/>".join(f"• {item}" for item in items) if items else "—"


@router.get("/{engagement_id}/export.pdf")
def export_pdf(
    engagement_id: str,
    watermark: str = Query(default="CONFIDENTIAL - DRAFT", max_length=60),
    actor: Actor = Depends(get_actor),
) -> Response:
    with get_session() as session:
        engagement = session.get(EngagementRow, engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        streams = session.exec(
            select(ValueStreamRow).where(
                ValueStreamRow.engagement_id == engagement_id
            )
        ).all()
        states = session.exec(
            select(ProcessStateRow).where(
                ProcessStateRow.engagement_id == engagement_id
            )
        ).all()
        teleology = session.exec(
            select(TeleologyRowDB).where(
                TeleologyRowDB.engagement_id == engagement_id
            )
        ).all()

        # Materialize before the audit commit expires the ORM instances.
        for obj in [engagement, *streams, *states, *teleology]:
            session.expunge(obj)

        record_audit(
            session,
            actor,
            action="engagement.exported",
            artefact_type="engagement",
            artefact_id=engagement_id,
            engagement_id=engagement_id,
            detail={"format": "pdf", "watermark": watermark},
        )
        session.commit()

    order = {t: i for i, t in enumerate(STREAM_TYPES)}
    streams = sorted(streams, key=lambda s: order.get(s.type, 99))
    states_by_type = {s.stream_type: s for s in states}
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story = []
    story.append(Paragraph(engagement.name, _styles["Title"]))
    story.append(
        Paragraph(
            f"{engagement.client} · {engagement.industry} · status: {engagement.status}",
            _styles["Heading3"],
        )
    )
    if engagement.description:
        story.append(Paragraph(engagement.description, _body))
    participants = ", ".join(
        f"{p.get('displayName', p.get('userId', '?'))} ({p.get('role', '?')})"
        for p in (engagement.participants or [])
    )
    story.append(Paragraph(f"Participants: {participants or '—'}", _body))
    story.append(Spacer(1, 8))

    # Value streams + approvals
    story.append(Paragraph("Value streams &amp; approvals", _styles["Heading2"]))
    rows = [["Stream", "Baseline", "Loaded", "Approval status"]]
    for stream in streams:
        rows.append(
            [
                _p(STREAM_LABELS.get(stream.type, stream.type), _cell_bold),
                _p(stream.baseline_id),
                _p("yes" if stream.baseline_loaded else "no"),
                _p(stream.approval_status),
            ]
        )
    table = Table(rows, colWidths=[45 * mm, 45 * mm, 25 * mm, 45 * mm], repeatRows=1)
    table.setStyle(_TABLE_STYLE)
    story.append(table)
    story.append(Spacer(1, 10))

    # Process snapshot per loaded stream
    for stream in streams:
        state = states_by_type.get(stream.type)
        if not state:
            continue
        tasks = _extract_tasks(state.bpmn_xml)
        meta = state.element_meta or {}
        tagged = sum(1 for t in tasks if meta.get(t["id"], {}).get("functionUnit"))
        story.append(
            Paragraph(
                f"Process snapshot — {STREAM_LABELS.get(stream.type, stream.type)}",
                _styles["Heading2"],
            )
        )
        story.append(
            Paragraph(
                f"{len(tasks)} steps · {tagged} tagged with a function unit · "
                f"last updated {state.updated_at[:19]}",
                _body,
            )
        )
        rows = [["Step", "Function unit", "Systems"]]
        for task in tasks:
            entry = meta.get(task["id"], {})
            rows.append(
                [
                    _p(task["name"]),
                    _p(entry.get("functionUnit") or "—"),
                    _p(", ".join(entry.get("systems", [])) or "—"),
                ]
            )
        table = Table(rows, colWidths=[85 * mm, 35 * mm, 40 * mm], repeatRows=1)
        table.setStyle(_TABLE_STYLE)
        story.append(table)
        story.append(Spacer(1, 10))

    # Teleology matrix
    if teleology:
        story.append(Paragraph("Teleology matrix", _styles["Heading2"]))
        rows = [["Scope", "Goals", "Gaps", "Ambitions", "Status"]]
        teleology = sorted(
            teleology,
            key=lambda r: (
                order.get(r.stream_type, 99),
                r.function_unit is not None,
                r.function_unit or "",
            ),
        )
        for row in teleology:
            scope = STREAM_LABELS.get(row.stream_type, row.stream_type)
            if row.function_unit:
                scope += f" / {row.function_unit}"
            rows.append(
                [
                    _p(scope, _cell_bold),
                    _p(_bullets(row.goals or [])),
                    _p(_bullets(row.gaps or [])),
                    _p(_bullets(row.ambitions or [])),
                    _p(row.approval_status),
                ]
            )
        table = Table(
            rows, colWidths=[32 * mm, 42 * mm, 42 * mm, 42 * mm, 20 * mm], repeatRows=1
        )
        table.setStyle(_TABLE_STYLE)
        story.append(table)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Engagement summary — {engagement.name}",
        author="OTS",
    )
    on_page = _watermark_and_footer(watermark, generated_at)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="engagement-{engagement_id}.pdf"'
        },
    )
