"""Current-state vs teleology alignment report.

GET /api/v1/alignment/{engagement_id} joins the teleology matrix (target:
goals / ambitions / org themes per function unit) against the current state
evidence (tagged BPMN steps + systems from Postgres, ontology classes +
BPMN links + ots:supportsGoal links from Fuseki, unresolved comments) and
computes a deterministic 0-100 alignment score per unit.

The payload feeds the alignment heatmap view and is the input canvas for the
gap-bridge agent (solution options) and the initiative candidates agent.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from db import get_session
from db_models import (
    CommentRow,
    EngagementRow,
    ProcessStateRow,
    TeleologyRowDB,
    ValueStreamRow,
)
from fuseki_client import FusekiClient
from gaps_router import _extract_tasks

router = APIRouter(prefix="/api/v1/alignment", tags=["alignment"])
fuseki = FusekiClient()

ORG_THEMES = ("revenue", "cost", "cx", "ttm")
EMPTY_ORG = {theme: [] for theme in ORG_THEMES}


class ScoreBreakdownModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    goals_defined: int = Field(alias="goalsDefined")  # /20
    process_evidence: int = Field(alias="processEvidence")  # /20
    system_coverage: int = Field(alias="systemCoverage")  # /20
    ontology_coverage: int = Field(alias="ontologyCoverage")  # /20
    goal_traceability: int = Field(alias="goalTraceability")  # /10
    feedback_clear: int = Field(alias="feedbackClear")  # /10


class UnitEvidenceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    step_count: int = Field(alias="stepCount")
    steps_with_systems: int = Field(alias="stepsWithSystems")
    systems: list[str]
    ontology_classes: int = Field(alias="ontologyClasses")
    bpmn_linked_classes: int = Field(alias="bpmnLinkedClasses")
    goal_linked_classes: int = Field(alias="goalLinkedClasses")
    open_comments: int = Field(alias="openComments")
    step_names: list[str] = Field(alias="stepNames")


class AlignmentUnitModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    function_unit: str | None = Field(default=None, alias="functionUnit")
    teleology_row_id: str | None = Field(default=None, alias="teleologyRowId")
    approval_status: str = Field(alias="approvalStatus")
    goals: list[str]
    gaps: list[str]
    ambitions: list[str]
    org_ambitions: dict = Field(alias="orgAmbitions")
    evidence: UnitEvidenceModel
    score: int
    score_breakdown: ScoreBreakdownModel = Field(alias="scoreBreakdown")


class AlignmentStreamModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    stream_type: str = Field(alias="streamType")
    approval_status: str = Field(alias="approvalStatus")
    units: list[AlignmentUnitModel]


class AlignmentReportModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    generated_at: str = Field(alias="generatedAt")
    streams: list[AlignmentStreamModel]


def _ratio_points(numerator: int, denominator: int, weight: int) -> int:
    if denominator <= 0:
        return 0
    return round(weight * min(numerator / denominator, 1.0))


def _score_unit(
    goals: list[str],
    ambitions: list[str],
    evidence: UnitEvidenceModel,
) -> tuple[int, ScoreBreakdownModel]:
    goals_defined = (10 if goals else 0) + (10 if ambitions else 0)
    # Evidence that the unit's work is actually mapped: 3+ steps = full marks.
    process_evidence = _ratio_points(evidence.step_count, 3, 20)
    system_coverage = _ratio_points(
        evidence.steps_with_systems, evidence.step_count, 20
    )
    ontology_coverage = (10 if evidence.ontology_classes > 0 else 0) + _ratio_points(
        evidence.bpmn_linked_classes, evidence.ontology_classes, 10
    )
    goal_traceability = 10 if evidence.goal_linked_classes > 0 else 0
    feedback_clear = max(0, 10 - 2 * evidence.open_comments)

    breakdown = ScoreBreakdownModel(
        goals_defined=goals_defined,
        process_evidence=process_evidence,
        system_coverage=system_coverage,
        ontology_coverage=ontology_coverage,
        goal_traceability=goal_traceability,
        feedback_clear=feedback_clear,
    )
    total = (
        goals_defined
        + process_evidence
        + system_coverage
        + ontology_coverage
        + goal_traceability
        + feedback_clear
    )
    return total, breakdown


def _unit_evidence(
    function_unit: str | None,
    tasks: list[dict],
    element_meta: dict,
    classes: list[dict],
    open_comments: list[CommentRow],
    row_ids: set[str],
) -> UnitEvidenceModel:
    """Evidence scoped to one function unit, or the whole stream when None."""

    def unit_of(task: dict) -> str | None:
        return (element_meta.get(task["id"], {}) or {}).get("functionUnit")

    if function_unit is None:
        unit_tasks = tasks
        unit_classes = classes
        unit_comments = open_comments
    else:
        unit_tasks = [t for t in tasks if unit_of(t) == function_unit]
        unit_classes = [c for c in classes if c.get("functionUnit") == function_unit]
        unit_task_ids = {t["id"] for t in unit_tasks}
        unit_comments = [
            c
            for c in open_comments
            if c.function_unit == function_unit or c.target_id in unit_task_ids
        ]

    systems: set[str] = set()
    steps_with_systems = 0
    for task in unit_tasks:
        meta = element_meta.get(task["id"], {}) or {}
        task_systems = meta.get("systems") or []
        if task_systems:
            steps_with_systems += 1
            systems.update(task_systems)

    goal_linked = sum(
        1
        for c in unit_classes
        if any(goal in row_ids for goal in c.get("supportsGoals", []))
    )

    return UnitEvidenceModel(
        step_count=len(unit_tasks),
        steps_with_systems=steps_with_systems,
        systems=sorted(systems),
        ontology_classes=len(unit_classes),
        bpmn_linked_classes=sum(
            1 for c in unit_classes if c.get("linkedBpmnElements")
        ),
        goal_linked_classes=goal_linked,
        open_comments=len(unit_comments),
        step_names=[t["name"] for t in unit_tasks][:20],
    )


async def build_alignment_report(engagement_id: str) -> AlignmentReportModel:
    """Shared with the agent routers, which reuse the same canvas."""
    with get_session() as session:
        engagement = session.get(EngagementRow, engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")

        streams = session.exec(
            select(ValueStreamRow).where(
                ValueStreamRow.engagement_id == engagement_id,
                ValueStreamRow.baseline_loaded == True,  # noqa: E712
            )
        ).all()
        stream_status = {s.type: s.approval_status for s in streams}

        teleology_rows = session.exec(
            select(TeleologyRowDB).where(
                TeleologyRowDB.engagement_id == engagement_id
            )
        ).all()

        process_states: dict[str, tuple[list[dict], dict]] = {}
        comments_by_stream: dict[str, list[CommentRow]] = {}
        for stream_type in stream_status:
            state = session.get(ProcessStateRow, (engagement_id, stream_type))
            if state:
                process_states[stream_type] = (
                    _extract_tasks(state.bpmn_xml),
                    dict(state.element_meta or {}),
                )
            open_comments = session.exec(
                select(CommentRow).where(
                    CommentRow.engagement_id == engagement_id,
                    CommentRow.stream_type == stream_type,
                    CommentRow.resolved == False,  # noqa: E712
                )
            ).all()
            for comment in open_comments:
                session.expunge(comment)
            comments_by_stream[stream_type] = list(open_comments)

        for row in teleology_rows:
            session.expunge(row)

    stream_models: list[AlignmentStreamModel] = []
    for stream_type in sorted(stream_status):
        tasks, element_meta = process_states.get(stream_type, ([], {}))
        open_comments = comments_by_stream.get(stream_type, [])

        try:
            classes = await fuseki.fetch_graph(
                fuseki.graph_uri(engagement_id, stream_type)
            )
        except Exception:
            classes = []

        rows = [r for r in teleology_rows if r.stream_type == stream_type]
        rows_by_unit = {r.function_unit: r for r in rows}
        row_ids = {r.id for r in rows}

        tagged_units = sorted(
            {
                meta["functionUnit"]
                for meta in element_meta.values()
                if meta.get("functionUnit")
            }
        )
        # Stream-wide unit first (None), then every unit seen in the process
        # map or the teleology matrix.
        unit_keys: list[str | None] = [None]
        unit_keys += sorted(
            set(tagged_units)
            | {r.function_unit for r in rows if r.function_unit is not None}
        )

        unit_models: list[AlignmentUnitModel] = []
        for unit in unit_keys:
            row = rows_by_unit.get(unit)
            goals = list(row.goals or []) if row else []
            gaps = list(row.gaps or []) if row else []
            ambitions = list(row.ambitions or []) if row else []
            org = {**EMPTY_ORG, **((row.org_ambitions or {}) if row else {})}

            evidence = _unit_evidence(
                unit, tasks, element_meta, classes, open_comments, row_ids
            )
            score, breakdown = _score_unit(goals, ambitions, evidence)
            unit_models.append(
                AlignmentUnitModel(
                    function_unit=unit,
                    teleology_row_id=row.id if row else None,
                    approval_status=row.approval_status if row else "draft",
                    goals=goals,
                    gaps=gaps,
                    ambitions=ambitions,
                    org_ambitions=org,
                    evidence=evidence,
                    score=score,
                    score_breakdown=breakdown,
                )
            )

        stream_models.append(
            AlignmentStreamModel(
                stream_type=stream_type,
                approval_status=stream_status[stream_type],
                units=unit_models,
            )
        )

    return AlignmentReportModel(
        engagement_id=engagement_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        streams=stream_models,
    )


@router.get("/{engagement_id}", response_model=AlignmentReportModel)
async def get_alignment(engagement_id: str) -> AlignmentReportModel:
    return await build_alignment_report(engagement_id)
