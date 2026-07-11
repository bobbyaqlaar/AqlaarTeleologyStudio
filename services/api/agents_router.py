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

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from alignment_router import AlignmentStreamModel, build_alignment_report
from audit import Actor, ActorDep, record_audit
from db import get_session, now_iso
from db_models import (
    CommentRow,
    EngagementRow,
    InitiativeRow,
    ProcessStateRow,
    SolutionOptionRow,
    TeleologyRowDB,
)
from fuseki_client import FusekiClient
from gaps_router import _extract_tasks
from llm import LlmUnavailable, generate_json
from solutions_router import (
    InitiativeModel,
    SolutionOptionModel,
    initiative_to_model,
    option_to_model,
)

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


# --- Gap-bridge agent (stream-scoped solution options) ---------------------

LEVEL = {"type": "string", "enum": ["low", "medium", "high"]}

OPTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "functionUnit": {"type": ["string", "null"]},
                    "title": {"type": "string"},
                    "optionType": {
                        "type": "string",
                        "enum": ["quick_win", "strategic", "transformational"],
                    },
                    "rationale": {"type": "string"},
                    "proposedChanges": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "kind": {
                                    "type": "string",
                                    "enum": [
                                        "add_step",
                                        "modify_step",
                                        "tag_system",
                                        "add_class",
                                        "link_class_goal",
                                        "update_teleology",
                                        "other",
                                    ],
                                },
                                "description": {"type": "string"},
                                "targetId": {"type": ["string", "null"]},
                                "targetLabel": {"type": ["string", "null"]},
                            },
                            "required": ["kind", "description", "targetId", "targetLabel"],
                            "additionalProperties": False,
                        },
                    },
                    "impactedStepNames": {"type": "array", "items": {"type": "string"}},
                    "impactedClassLabels": {"type": "array", "items": {"type": "string"}},
                    "effort": LEVEL,
                    "impact": LEVEL,
                },
                "required": [
                    "functionUnit",
                    "title",
                    "optionType",
                    "rationale",
                    "proposedChanges",
                    "impactedStepNames",
                    "impactedClassLabels",
                    "effort",
                    "impact",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["options"],
    "additionalProperties": False,
}

BRIDGE_SYSTEM_PROMPT = """You are a transformation consultant's gap-bridging \
agent. You are given the alignment picture for ONE value stream: the target \
teleology (goals, ambitions, org-theme ambitions per function unit), the \
client's stated gaps, and the current-state evidence (process steps with \
function/system tags, ontology classes and their links, unresolved \
stakeholder comments, and a computed alignment score with its breakdown).

Propose solution options that connect the current state to the teleology — \
concrete moves that close specific gaps.

Rules:
- 3-6 options, each addressing a specific gap or weak score component.
- Stay INSIDE this value stream: process steps, ontology classes, system \
tagging, teleology refinements. Cross-stream transformation ideas are out of \
scope here (a separate initiatives agent handles those).
- Each option: sharp title (<=10 words), optionType quick_win (days-weeks, \
low risk), strategic (a quarter), or transformational (structural change), \
a rationale naming the evidence it responds to, and 1-4 proposedChanges \
with concrete kinds. Use exact step names / class labels / function unit \
ids from the evidence.
- functionUnit: the unit the option mostly belongs to, or null if stream-wide.
- These are DRAFTS for the consultant to accept or dismiss, never \
auto-applied."""


class BridgeResultModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    options: list[SolutionOptionModel]
    source: str


def _serialize_stream_alignment(stream: AlignmentStreamModel) -> str:
    lines = [
        f"Value stream: {stream.stream_type.upper()} "
        f"(approval: {stream.approval_status})",
        "",
    ]
    for unit in stream.units:
        label = unit.function_unit or "STREAM-WIDE"
        ev = unit.evidence
        lines.append(
            f"[{label}] score {unit.score}/100 "
            f"(goals {unit.score_breakdown.goals_defined}/20, process "
            f"{unit.score_breakdown.process_evidence}/20, systems "
            f"{unit.score_breakdown.system_coverage}/20, ontology "
            f"{unit.score_breakdown.ontology_coverage}/20, goal-trace "
            f"{unit.score_breakdown.goal_traceability}/10, feedback "
            f"{unit.score_breakdown.feedback_clear}/10)"
        )
        if unit.goals:
            lines.append(f"  goals: {'; '.join(unit.goals)}")
        if unit.gaps:
            lines.append(f"  stated gaps: {'; '.join(unit.gaps)}")
        if unit.ambitions:
            lines.append(f"  ambitions: {'; '.join(unit.ambitions)}")
        themes = {
            theme: values
            for theme, values in (unit.org_ambitions or {}).items()
            if values
        }
        if themes:
            lines.append(
                "  org themes: "
                + " | ".join(f"{t}: {'; '.join(v)}" for t, v in themes.items())
            )
        lines.append(
            f"  evidence: {ev.step_count} steps ({ev.steps_with_systems} with "
            f"systems: {', '.join(ev.systems) or 'none'}), "
            f"{ev.ontology_classes} ontology classes "
            f"({ev.bpmn_linked_classes} BPMN-linked, {ev.goal_linked_classes} "
            f"goal-linked), {ev.open_comments} open comments"
        )
        if ev.step_names:
            lines.append(f"  steps: {', '.join(ev.step_names)}")
        lines.append("")
    return "\n".join(lines)


@router.post(
    "/{engagement_id}/{stream_type}/bridge-gaps",
    response_model=BridgeResultModel,
)
async def bridge_gaps(
    engagement_id: str, stream_type: str, actor: Actor = ActorDep
) -> BridgeResultModel:
    if stream_type not in VALID_STREAMS:
        raise HTTPException(status_code=400, detail="Invalid stream type")

    report = await build_alignment_report(engagement_id)
    stream = next(
        (s for s in report.streams if s.stream_type == stream_type), None
    )
    if stream is None:
        raise HTTPException(
            status_code=409,
            detail="Load the stream baseline before bridging gaps.",
        )

    row_id_by_unit = {u.function_unit: u.teleology_row_id for u in stream.units}
    class_by_label: dict[str, str] = {}
    try:
        classes = await fuseki.fetch_graph(
            fuseki.graph_uri(engagement_id, stream_type)
        )
        class_by_label = {c["label"]: c["uri"] for c in classes}
    except Exception:
        pass

    try:
        payload, source = await generate_json(
            BRIDGE_SYSTEM_PROMPT,
            _serialize_stream_alignment(stream),
            OPTIONS_SCHEMA,
            max_tokens=8192,
        )
    except LlmUnavailable as exc:
        raise HTTPException(
            status_code=502, detail=f"Gap-bridge agent unavailable: {exc}"
        ) from exc

    models: list[SolutionOptionModel] = []
    with get_session() as session:
        # Refresh drafts; accepted/dismissed options are history and stay.
        stale = session.exec(
            select(SolutionOptionRow).where(
                SolutionOptionRow.engagement_id == engagement_id,
                SolutionOptionRow.stream_type == stream_type,
                SolutionOptionRow.status == "draft",
            )
        ).all()
        for row in stale:
            session.delete(row)

        for item in payload.get("options", []):
            unit = item.get("functionUnit") or None
            row = SolutionOptionRow(
                id=f"opt-{uuid.uuid4().hex[:12]}",
                engagement_id=engagement_id,
                stream_type=stream_type,
                function_unit=unit,
                teleology_row_id=row_id_by_unit.get(unit),
                title=item.get("title", "Untitled option"),
                option_type=item.get("optionType", "strategic"),
                rationale=item.get("rationale", ""),
                proposed_changes=item.get("proposedChanges", []),
                impacted_steps=[
                    {"name": name} for name in item.get("impactedStepNames", [])
                ],
                impacted_classes=[
                    {"label": label, "uri": class_by_label.get(label)}
                    for label in item.get("impactedClassLabels", [])
                ],
                effort=item.get("effort", "medium"),
                impact=item.get("impact", "medium"),
                status="draft",
                source=source,
                created_at=now_iso(),
                updated_at=now_iso(),
            )
            session.add(row)
            models.append(option_to_model(row))

        record_audit(
            session,
            actor,
            action="agent.gaps_bridged",
            artefact_type="solution_option",
            artefact_id=f"{engagement_id}/{stream_type}",
            engagement_id=engagement_id,
            detail={
                "streamType": stream_type,
                "source": source,
                "drafted": len(models),
                "replacedDrafts": len(stale),
            },
        )
        session.commit()

    return BridgeResultModel(
        engagement_id=engagement_id,
        stream_type=stream_type,
        options=models,
        source=source,
    )


# --- Initiative candidates agent (cross-stream) -----------------------------

INITIATIVES_SCHEMA = {
    "type": "object",
    "properties": {
        "initiatives": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "narrative": {"type": "string"},
                    "streams": {"type": "array", "items": {"type": "string"}},
                    "functionUnits": {"type": "array", "items": {"type": "string"}},
                    "streamLinks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "streamType": {"type": "string"},
                                "role": {"type": "string"},
                                "stepNames": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "classLabels": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["streamType", "role", "stepNames", "classLabels"],
                            "additionalProperties": False,
                        },
                    },
                    "consolidates": {"type": "array", "items": {"type": "string"}},
                    "orgImpact": {
                        "type": "object",
                        "properties": {
                            "revenue": {"type": "string"},
                            "cost": {"type": "string"},
                            "cx": {"type": "string"},
                            "ttm": {"type": "string"},
                        },
                        "required": ["revenue", "cost", "cx", "ttm"],
                        "additionalProperties": False,
                    },
                    "horizon": {"type": "string", "enum": ["now", "next", "later"]},
                },
                "required": [
                    "name",
                    "narrative",
                    "streams",
                    "functionUnits",
                    "streamLinks",
                    "consolidates",
                    "orgImpact",
                    "horizon",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["initiatives"],
    "additionalProperties": False,
}

INITIATIVES_SYSTEM_PROMPT = """You are a transformation consultant's \
initiative-drafting agent. You see the WHOLE engagement: every value \
stream's alignment picture (teleology targets, stated gaps, current-state \
evidence, scores) plus the stream-scoped solution options already drafted \
or accepted.

Draft transformation initiative candidates — the bigger-picture moves that \
individual streams cannot see. An initiative earns its place by SPANNING \
streams: e.g. a master-data backbone that O2C, P2P and C2M all depend on, \
or an automation platform reused across function units.

Rules:
- 2-5 initiatives, each spanning AT LEAST TWO streams. Single-stream ideas \
belong to solution options, not here.
- streamLinks: for each touched stream, its role in the initiative (one \
short phrase) and the exact step names / ontology class labels it connects. \
This is how the initiative "links the streams together" — be specific.
- consolidates: which stated gaps or existing option titles (verbatim \
strings from the input) this initiative absorbs or supersedes.
- orgImpact: one sentence per theme (revenue / cost / cx / ttm); empty \
string when no meaningful impact.
- horizon: now (start immediately), next (this year), later (foundational, \
sequence after prerequisites).
- narrative: 2-4 sentences a stakeholder executive would understand.
- These are DRAFTS for the consultant to accept or dismiss."""


class InitiativesResultModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    initiatives: list[InitiativeModel]
    source: str


@router.post(
    "/{engagement_id}/draft-initiatives",
    response_model=InitiativesResultModel,
)
async def draft_initiatives(
    engagement_id: str, actor: Actor = ActorDep
) -> InitiativesResultModel:
    report = await build_alignment_report(engagement_id)
    if len(report.streams) < 2:
        raise HTTPException(
            status_code=409,
            detail="Initiative candidates need at least two loaded streams.",
        )

    sections = [_serialize_stream_alignment(s) for s in report.streams]

    with get_session() as session:
        options = session.exec(
            select(SolutionOptionRow).where(
                SolutionOptionRow.engagement_id == engagement_id,
                SolutionOptionRow.status != "dismissed",
            )
        ).all()
        option_lines = [
            f"- [{o.stream_type.upper()}/{o.status}] {o.title} ({o.option_type}): {o.rationale}"
            for o in options
        ]

    user_prompt = "\n".join(sections)
    if option_lines:
        user_prompt += "\n\nExisting stream-scoped solution options:\n" + "\n".join(
            option_lines
        )

    try:
        payload, source = await generate_json(
            INITIATIVES_SYSTEM_PROMPT,
            user_prompt,
            INITIATIVES_SCHEMA,
            max_tokens=8192,
        )
    except LlmUnavailable as exc:
        raise HTTPException(
            status_code=502, detail=f"Initiatives agent unavailable: {exc}"
        ) from exc

    models: list[InitiativeModel] = []
    with get_session() as session:
        stale = session.exec(
            select(InitiativeRow).where(
                InitiativeRow.engagement_id == engagement_id,
                InitiativeRow.status == "draft",
            )
        ).all()
        for row in stale:
            session.delete(row)

        for item in payload.get("initiatives", []):
            org_impact = {
                theme: value
                for theme, value in (item.get("orgImpact") or {}).items()
                if value
            }
            # Models sometimes echo stream ids uppercase (O2C) — normalize.
            streams_norm = [s.lower() for s in item.get("streams", [])]
            links_norm = [
                {**link, "streamType": str(link.get("streamType", "")).lower()}
                for link in item.get("streamLinks", [])
            ]
            row = InitiativeRow(
                id=f"init-{uuid.uuid4().hex[:12]}",
                engagement_id=engagement_id,
                name=item.get("name", "Untitled initiative"),
                narrative=item.get("narrative", ""),
                streams=streams_norm,
                function_units=item.get("functionUnits", []),
                stream_links=links_norm,
                consolidates=item.get("consolidates", []),
                org_impact=org_impact,
                horizon=item.get("horizon", "next"),
                status="draft",
                source=source,
                created_at=now_iso(),
                updated_at=now_iso(),
            )
            session.add(row)
            models.append(initiative_to_model(row))

        record_audit(
            session,
            actor,
            action="agent.initiatives_drafted",
            artefact_type="initiative",
            artefact_id=engagement_id,
            engagement_id=engagement_id,
            detail={
                "source": source,
                "drafted": len(models),
                "replacedDrafts": len(stale),
            },
        )
        session.commit()

    return InitiativesResultModel(
        engagement_id=engagement_id, initiatives=models, source=source
    )
