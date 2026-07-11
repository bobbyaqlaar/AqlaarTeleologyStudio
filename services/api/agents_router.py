"""Phase 2 — autonomous drafting agents (spec §16).

The first agent drafts the teleology matrix for a stream from everything
the platform already knows: the customized BPMN map (function/system tags,
connector-imported values), open stakeholder comments, and the engagement's
ontology classes. Drafts land as normal *draft* rows for the consultant to
verify and edit — workshops shift toward verification, never auto-approval.

Rows that are already in_review/approved are never touched; existing draft
rows are refreshed. Every run is audit-logged with the LLM source.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from audit import Actor, ActorDep, record_audit
from db import get_session, now_iso
from db_models import CommentRow, EngagementRow, ProcessStateRow, TeleologyRowDB
from fuseki_client import FusekiClient
from gaps_router import _extract_tasks
from llm import LlmUnavailable, generate_json

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])
fuseki = FusekiClient()

VALID_STREAMS = {"o2c", "p2p", "c2m", "h2r", "t2r"}
EMPTY_ORG = {"revenue": [], "cost": [], "cx": [], "ttm": []}

STRING_LIST = {"type": "array", "items": {"type": "string"}}

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "functionUnit": {"type": ["string", "null"]},
                    "goals": STRING_LIST,
                    "gaps": STRING_LIST,
                    "ambitions": STRING_LIST,
                    "orgAmbitions": {
                        "type": "object",
                        "properties": {
                            "revenue": STRING_LIST,
                            "cost": STRING_LIST,
                            "cx": STRING_LIST,
                            "ttm": STRING_LIST,
                        },
                        "required": ["revenue", "cost", "cx", "ttm"],
                        "additionalProperties": False,
                    },
                },
                "required": [
                    "functionUnit",
                    "goals",
                    "gaps",
                    "ambitions",
                    "orgAmbitions",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["rows"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You are a transformation consultant's drafting agent. \
From the current state of a client's value-stream process map — steps, \
owning function units, enterprise systems, live values imported from those \
systems, and stakeholder workshop comments — draft the teleology matrix: \
what the client is trying to achieve (goals), what blocks them today \
(gaps), and what they should pursue (ambitions), plus organization-level \
ambitions across revenue / cost / customer experience (cx) / time-to-market \
(ttm) themes.

Rules:
- One row with functionUnit null (stream-wide), plus one row per function \
unit that appears in the process map (use the exact ids given).
- 2-4 items per list; each one concrete, workshop-ready, grounded in the \
provided evidence (name specific steps, systems, or comment themes — no \
generic filler).
- Gaps must reflect real signals: untagged steps, steps with no owning \
system, unresolved comments, conflicting imported values.
- These are DRAFTS for human verification, not final answers."""


class DraftedRowModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    function_unit: str | None = Field(default=None, alias="functionUnit")
    action: str  # created | updated | skipped_not_draft


class DraftResultModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    rows: list[DraftedRowModel]
    source: str  # claude | openrouter


def _build_context(
    industry: str,
    stream_type: str,
    tasks: list[dict],
    element_meta: dict,
    comments: list[CommentRow],
    ontology_labels: list[str],
) -> str:
    lines = [f"Industry: {industry} · Value stream: {stream_type.upper()}", ""]
    lines.append("Process steps (function unit · systems · imported values):")
    for task in tasks:
        meta = element_meta.get(task["id"], {})
        connector_data = meta.get("connectorData", {})
        imported = (
            "; ".join(f"{k}={v}" for k, v in connector_data.items())
            if connector_data
            else "none"
        )
        lines.append(
            f"- {task['name']} · function={meta.get('functionUnit', 'UNTAGGED')} · "
            f"systems={', '.join(meta.get('systems', [])) or 'NONE'} · imported: {imported}"
        )
    lines.append("")
    if comments:
        lines.append("Open stakeholder comments:")
        for comment in comments:
            lines.append(
                f'- [{comment.author_name}/{comment.role}] on "{comment.target_label}": {comment.body}'
            )
        lines.append("")
    if ontology_labels:
        lines.append("Ontology classes: " + ", ".join(ontology_labels[:40]))
    return "\n".join(lines)


@router.post(
    "/{engagement_id}/{stream_type}/draft-teleology",
    response_model=DraftResultModel,
)
async def draft_teleology(
    engagement_id: str, stream_type: str, actor: Actor = ActorDep
) -> DraftResultModel:
    if stream_type not in VALID_STREAMS:
        raise HTTPException(status_code=400, detail="Invalid stream type")

    with get_session() as session:
        engagement = session.get(EngagementRow, engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        industry = engagement.industry
        state = session.get(ProcessStateRow, (engagement_id, stream_type))
        if not state:
            raise HTTPException(
                status_code=409,
                detail="Load the stream baseline and open the process map first.",
            )
        tasks = _extract_tasks(state.bpmn_xml)
        element_meta = dict(state.element_meta or {})
        comments = session.exec(
            select(CommentRow).where(
                CommentRow.engagement_id == engagement_id,
                CommentRow.stream_type == stream_type,
                CommentRow.resolved == False,  # noqa: E712
            )
        ).all()
        for comment in comments:
            session.expunge(comment)

    try:
        classes = await fuseki.fetch_graph(
            fuseki.graph_uri(engagement_id, stream_type)
        )
        labels = [item["label"] for item in classes]
    except Exception:
        labels = []

    function_units = sorted(
        {
            meta["functionUnit"]
            for meta in element_meta.values()
            if meta.get("functionUnit")
        }
    )
    user_prompt = _build_context(
        industry, stream_type, tasks, element_meta, comments, labels
    )
    if function_units:
        user_prompt += (
            "\n\nFunction units present (draft one drill-down row for each): "
            + ", ".join(function_units)
        )

    try:
        payload, source = await generate_json(
            SYSTEM_PROMPT, user_prompt, DRAFT_SCHEMA, max_tokens=8192
        )
    except LlmUnavailable as exc:
        raise HTTPException(
            status_code=502, detail=f"Drafting agent unavailable: {exc}"
        ) from exc

    results: list[DraftedRowModel] = []
    with get_session() as session:
        for drafted in payload.get("rows", []):
            function_unit = drafted.get("functionUnit") or None
            existing = session.exec(
                select(TeleologyRowDB).where(
                    TeleologyRowDB.engagement_id == engagement_id,
                    TeleologyRowDB.stream_type == stream_type,
                    TeleologyRowDB.function_unit == function_unit,
                )
            ).first()

            if existing and existing.approval_status != "draft":
                results.append(
                    DraftedRowModel(
                        id=existing.id,
                        function_unit=function_unit,
                        action="skipped_not_draft",
                    )
                )
                continue

            org = {**EMPTY_ORG, **(drafted.get("orgAmbitions") or {})}
            if existing:
                existing.goals = drafted.get("goals", [])
                existing.gaps = drafted.get("gaps", [])
                existing.ambitions = drafted.get("ambitions", [])
                existing.org_ambitions = org
                existing.updated_at = now_iso()
                session.add(existing)
                results.append(
                    DraftedRowModel(
                        id=existing.id, function_unit=function_unit, action="updated"
                    )
                )
            else:
                suffix = f"-{function_unit}" if function_unit else "-stream"
                row = TeleologyRowDB(
                    id=f"tel-{stream_type}{suffix}-{engagement_id[-8:]}",
                    engagement_id=engagement_id,
                    stream_type=stream_type,
                    function_unit=function_unit,
                    goals=drafted.get("goals", []),
                    gaps=drafted.get("gaps", []),
                    ambitions=drafted.get("ambitions", []),
                    org_ambitions=org,
                    approval_status="draft",
                    updated_at=now_iso(),
                )
                session.add(row)
                results.append(
                    DraftedRowModel(
                        id=row.id, function_unit=function_unit, action="created"
                    )
                )

        record_audit(
            session,
            actor,
            action="agent.teleology_drafted",
            artefact_type="teleology_row",
            artefact_id=f"{engagement_id}/{stream_type}",
            engagement_id=engagement_id,
            detail={
                "streamType": stream_type,
                "source": source,
                "rows": [r.action for r in results],
            },
        )
        session.commit()

    return DraftResultModel(
        engagement_id=engagement_id,
        stream_type=stream_type,
        rows=results,
        source=source,
    )
