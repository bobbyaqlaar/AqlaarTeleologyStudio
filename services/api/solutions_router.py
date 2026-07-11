"""Solution options + initiative candidates: read + lifecycle endpoints.

The rows themselves are drafted by the agents in agents_router (bridge-gaps,
draft-initiatives). Consultants accept or dismiss here. Accepting a solution
option with a draft teleology row attached appends the option title to that
row's ambitions — a visible draft materialization that never touches
in_review/approved rows.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from audit import Actor, ActorDep, record_audit
from db import get_session, now_iso
from db_models import InitiativeRow, SolutionOptionRow, TeleologyRowDB

router = APIRouter(prefix="/api/v1/solutions", tags=["solutions"])

OPTION_STATUSES = {"draft", "accepted", "dismissed"}


class ProposedChangeModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    kind: str  # add_step | modify_step | tag_system | add_class | link_class_goal | update_teleology | other
    description: str
    target_id: str | None = Field(default=None, alias="targetId")
    target_label: str | None = Field(default=None, alias="targetLabel")


class SolutionOptionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    function_unit: str | None = Field(default=None, alias="functionUnit")
    teleology_row_id: str | None = Field(default=None, alias="teleologyRowId")
    title: str
    option_type: str = Field(alias="optionType")
    rationale: str
    proposed_changes: list[ProposedChangeModel] = Field(alias="proposedChanges")
    impacted_steps: list[dict] = Field(alias="impactedSteps")
    impacted_classes: list[dict] = Field(alias="impactedClasses")
    effort: str
    impact: str
    status: str
    source: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class InitiativeStreamLinkModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    stream_type: str = Field(alias="streamType")
    role: str
    step_names: list[str] = Field(default_factory=list, alias="stepNames")
    class_labels: list[str] = Field(default_factory=list, alias="classLabels")


class InitiativeModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    name: str
    narrative: str
    streams: list[str]
    function_units: list[str] = Field(alias="functionUnits")
    stream_links: list[InitiativeStreamLinkModel] = Field(alias="streamLinks")
    consolidates: list[str]
    org_impact: dict = Field(alias="orgImpact")
    horizon: str
    status: str
    source: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class StatusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str


def option_to_model(row: SolutionOptionRow) -> SolutionOptionModel:
    return SolutionOptionModel(
        id=row.id,
        engagement_id=row.engagement_id,
        stream_type=row.stream_type,
        function_unit=row.function_unit,
        teleology_row_id=row.teleology_row_id,
        title=row.title,
        option_type=row.option_type,
        rationale=row.rationale or "",
        proposed_changes=[ProposedChangeModel(**c) for c in row.proposed_changes or []],
        impacted_steps=row.impacted_steps or [],
        impacted_classes=row.impacted_classes or [],
        effort=row.effort,
        impact=row.impact,
        status=row.status,
        source=row.source,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def initiative_to_model(row: InitiativeRow) -> InitiativeModel:
    return InitiativeModel(
        id=row.id,
        engagement_id=row.engagement_id,
        name=row.name,
        narrative=row.narrative or "",
        streams=row.streams or [],
        function_units=row.function_units or [],
        stream_links=[InitiativeStreamLinkModel(**l) for l in row.stream_links or []],
        consolidates=row.consolidates or [],
        org_impact=row.org_impact or {},
        horizon=row.horizon,
        status=row.status,
        source=row.source,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/{engagement_id}/options", response_model=list[SolutionOptionModel])
def list_options(
    engagement_id: str, stream_type: str | None = None
) -> list[SolutionOptionModel]:
    with get_session() as session:
        statement = select(SolutionOptionRow).where(
            SolutionOptionRow.engagement_id == engagement_id
        )
        if stream_type:
            statement = statement.where(SolutionOptionRow.stream_type == stream_type)
        rows = session.exec(statement).all()
        rows.sort(key=lambda r: (r.status != "draft", r.stream_type, r.created_at))
        return [option_to_model(row) for row in rows]


@router.post(
    "/{engagement_id}/options/{option_id}/status",
    response_model=SolutionOptionModel,
)
def set_option_status(
    engagement_id: str,
    option_id: str,
    payload: StatusRequest,
    actor: Actor = ActorDep,
) -> SolutionOptionModel:
    if payload.status not in OPTION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    with get_session() as session:
        row = session.get(SolutionOptionRow, option_id)
        if not row or row.engagement_id != engagement_id:
            raise HTTPException(status_code=404, detail="Solution option not found")
        previous = row.status
        row.status = payload.status
        row.updated_at = now_iso()
        session.add(row)

        materialized = False
        if payload.status == "accepted" and row.teleology_row_id:
            teleology = session.get(TeleologyRowDB, row.teleology_row_id)
            if (
                teleology
                and teleology.engagement_id == engagement_id
                and teleology.approval_status == "draft"
            ):
                ambitions = list(teleology.ambitions or [])
                if row.title not in ambitions:
                    ambitions.append(row.title)
                    teleology.ambitions = ambitions
                    teleology.updated_at = now_iso()
                    session.add(teleology)
                    materialized = True

        record_audit(
            session,
            actor,
            action=f"solution_option.{payload.status}",
            artefact_type="solution_option",
            artefact_id=option_id,
            engagement_id=engagement_id,
            detail={
                "streamType": row.stream_type,
                "from": previous,
                "to": payload.status,
                "materializedToTeleology": materialized,
            },
        )
        session.commit()
        session.refresh(row)
        return option_to_model(row)


@router.get("/{engagement_id}/initiatives", response_model=list[InitiativeModel])
def list_initiatives(engagement_id: str) -> list[InitiativeModel]:
    with get_session() as session:
        rows = session.exec(
            select(InitiativeRow).where(
                InitiativeRow.engagement_id == engagement_id
            )
        ).all()
        rows.sort(key=lambda r: (r.status != "draft", r.created_at))
        return [initiative_to_model(row) for row in rows]


@router.post(
    "/{engagement_id}/initiatives/{initiative_id}/status",
    response_model=InitiativeModel,
)
def set_initiative_status(
    engagement_id: str,
    initiative_id: str,
    payload: StatusRequest,
    actor: Actor = ActorDep,
) -> InitiativeModel:
    if payload.status not in OPTION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    with get_session() as session:
        row = session.get(InitiativeRow, initiative_id)
        if not row or row.engagement_id != engagement_id:
            raise HTTPException(status_code=404, detail="Initiative not found")
        previous = row.status
        row.status = payload.status
        row.updated_at = now_iso()
        session.add(row)
        record_audit(
            session,
            actor,
            action=f"initiative.{payload.status}",
            artefact_type="initiative",
            artefact_id=initiative_id,
            engagement_id=engagement_id,
            detail={"from": previous, "to": payload.status},
        )
        session.commit()
        session.refresh(row)
        return initiative_to_model(row)
