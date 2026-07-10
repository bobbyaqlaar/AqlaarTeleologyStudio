"""Engagement + value stream persistence (Postgres). JSON shape mirrors
apps/web/lib/types Engagement/ValueStream so the TS services can swap from
the mock store without UI changes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from audit import Actor, ActorDep, record_audit
from db import STREAM_TYPES, get_session, now_iso
from db_models import EngagementRow, ValueStreamRow

router = APIRouter(prefix="/api/v1/engagements", tags=["engagements"])


class ValueStreamModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    type: str
    baseline_id: str = Field(alias="baselineId")
    baseline_loaded: bool = Field(alias="baselineLoaded")
    approval_status: str = Field(alias="approvalStatus")


class EngagementModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    name: str
    client: str
    status: str
    description: str | None = None
    industry: str
    participants: list[dict]
    value_streams: list[ValueStreamModel] = Field(alias="valueStreams")
    current_step: str = Field(alias="currentStep")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class CreateEngagementRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    client: str
    description: str | None = None
    industry: str = "generic"


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    approval_status: str = Field(alias="approvalStatus")


def _to_model(row: EngagementRow, streams: list[ValueStreamRow]) -> EngagementModel:
    return EngagementModel(
        id=row.id,
        name=row.name,
        client=row.client,
        status=row.status,
        description=row.description,
        industry=row.industry,
        participants=row.participants or [],
        value_streams=[
            ValueStreamModel(
                id=s.id,
                type=s.type,
                baseline_id=s.baseline_id,
                baseline_loaded=s.baseline_loaded,
                approval_status=s.approval_status,
            )
            for s in streams
        ],
        current_step=row.current_step,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _streams_for(session, engagement_id: str) -> list[ValueStreamRow]:
    rows = session.exec(
        select(ValueStreamRow).where(ValueStreamRow.engagement_id == engagement_id)
    ).all()
    order = {t: i for i, t in enumerate(STREAM_TYPES)}
    return sorted(rows, key=lambda s: order.get(s.type, 99))


def _get_or_404(session, engagement_id: str) -> EngagementRow:
    row = session.get(EngagementRow, engagement_id)
    if not row:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return row


@router.get("", response_model=list[EngagementModel])
def list_engagements() -> list[EngagementModel]:
    with get_session() as session:
        rows = session.exec(
            select(EngagementRow).order_by(EngagementRow.created_at.desc())
        ).all()
        return [_to_model(row, _streams_for(session, row.id)) for row in rows]


@router.post("", response_model=EngagementModel)
def create_engagement(
    payload: CreateEngagementRequest, actor: Actor = ActorDep
) -> EngagementModel:
    with get_session() as session:
        engagement_id = f"eng-{uuid.uuid4().hex[:8]}"
        timestamp = now_iso()
        row = EngagementRow(
            id=engagement_id,
            name=payload.name,
            client=payload.client,
            description=payload.description,
            industry=payload.industry,
            status="draft",
            current_step="streams",
            participants=[
                {
                    "userId": "user-consultant-1",
                    "displayName": "Alex Morgan",
                    "role": "consultant",
                }
            ],
            created_at=timestamp,
            updated_at=timestamp,
        )
        session.add(row)
        streams = [
            ValueStreamRow(
                id=f"stream-{stream_type}-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                type=stream_type,
                baseline_id=f"baseline-{stream_type}",
            )
            for stream_type in STREAM_TYPES
        ]
        for stream in streams:
            session.add(stream)
        record_audit(
            session,
            actor,
            action="engagement.created",
            artefact_type="engagement",
            artefact_id=engagement_id,
            engagement_id=engagement_id,
            detail={"name": payload.name, "client": payload.client, "industry": payload.industry},
        )
        session.commit()
        session.refresh(row)
        return _to_model(row, _streams_for(session, engagement_id))


@router.get("/{engagement_id}", response_model=EngagementModel)
def get_engagement(engagement_id: str) -> EngagementModel:
    with get_session() as session:
        row = _get_or_404(session, engagement_id)
        return _to_model(row, _streams_for(session, engagement_id))


@router.post(
    "/{engagement_id}/streams/{stream_type}/load-baseline",
    response_model=EngagementModel,
)
def load_baseline(
    engagement_id: str, stream_type: str, actor: Actor = ActorDep
) -> EngagementModel:
    with get_session() as session:
        row = _get_or_404(session, engagement_id)
        stream = session.exec(
            select(ValueStreamRow).where(
                ValueStreamRow.engagement_id == engagement_id,
                ValueStreamRow.type == stream_type,
            )
        ).first()
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        stream.baseline_loaded = True
        row.updated_at = now_iso()
        session.add(stream)
        session.add(row)
        record_audit(
            session,
            actor,
            action="stream.baseline_loaded",
            artefact_type="value_stream",
            artefact_id=stream.id,
            engagement_id=engagement_id,
            detail={"streamType": stream_type, "baselineId": stream.baseline_id},
        )
        session.commit()
        return _to_model(row, _streams_for(session, engagement_id))


@router.patch(
    "/{engagement_id}/streams/{stream_type}/approval",
    response_model=EngagementModel,
)
def set_stream_approval(
    engagement_id: str,
    stream_type: str,
    payload: ApprovalRequest,
    actor: Actor = ActorDep,
) -> EngagementModel:
    with get_session() as session:
        row = _get_or_404(session, engagement_id)
        stream = session.exec(
            select(ValueStreamRow).where(
                ValueStreamRow.engagement_id == engagement_id,
                ValueStreamRow.type == stream_type,
            )
        ).first()
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        previous = stream.approval_status
        stream.approval_status = payload.approval_status
        row.updated_at = now_iso()
        session.add(stream)
        session.add(row)
        record_audit(
            session,
            actor,
            action="stream.approval_changed",
            artefact_type="value_stream",
            artefact_id=stream.id,
            engagement_id=engagement_id,
            detail={
                "streamType": stream_type,
                "from": previous,
                "to": payload.approval_status,
            },
        )
        session.commit()
        return _to_model(row, _streams_for(session, engagement_id))
