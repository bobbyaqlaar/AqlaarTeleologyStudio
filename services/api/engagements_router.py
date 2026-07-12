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
from db_models import (
    CommentRow,
    ConnectorConnectionRow,
    ConnectorMappingRow,
    EngagementRow,
    InitiativeRow,
    ProcessStateRow,
    SolutionOptionRow,
    TeleologyRowDB,
    ValueStreamRow,
)
from fuseki_client import FusekiClient

router = APIRouter(prefix="/api/v1/engagements", tags=["engagements"])
fuseki = FusekiClient()


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


class EngagementProgressModel(BaseModel):
    """Real per-step completion, derived from artefact state (spec §10:
    the stepper shows checkmarks on complete — not positional guesses)."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    streams: bool
    process: bool
    ontology: bool
    teleology: bool
    connectors: bool
    review: bool
    first_loaded_stream: str | None = Field(default=None, alias="firstLoadedStream")


@router.get("/{engagement_id}/progress", response_model=EngagementProgressModel)
async def get_progress(engagement_id: str) -> EngagementProgressModel:
    with get_session() as session:
        _get_or_404(session, engagement_id)
        streams = _streams_for(session, engagement_id)
        loaded = [s for s in streams if s.baseline_loaded]

        process_done = False
        for state in session.exec(
            select(ProcessStateRow).where(
                ProcessStateRow.engagement_id == engagement_id
            )
        ).all():
            meta = state.element_meta or {}
            if any(entry.get("functionUnit") for entry in meta.values()):
                process_done = True
                break

        teleology_done = any(
            row.goals or row.gaps or row.ambitions
            for row in session.exec(
                select(TeleologyRowDB).where(
                    TeleologyRowDB.engagement_id == engagement_id
                )
            ).all()
        )

        review_done = bool(loaded) and all(
            s.approval_status == "approved" for s in loaded
        )
        loaded_types = [s.type for s in loaded]

    ontology_done = False
    for stream_type in loaded_types:
        try:
            classes = await fuseki.fetch_graph(
                fuseki.graph_uri(engagement_id, stream_type)
            )
        except Exception:
            break  # Fuseki down — leave ontology as not-done
        if any(c["mappedConcepts"] or c["linkedBpmnElements"] for c in classes):
            ontology_done = True
            break

    return EngagementProgressModel(
        streams=bool(loaded),
        process=process_done,
        ontology=ontology_done,
        teleology=teleology_done,
        connectors=False,  # optional step — never gates the journey
        review=review_done,
        first_loaded_stream=loaded_types[0] if loaded_types else None,
    )


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


@router.delete("/{engagement_id}", status_code=204)
async def delete_engagement(
    engagement_id: str, actor: Actor = ActorDep
) -> None:
    """Delete engagement and all child rows (FK-first). Audit events are kept;
    engagement.deleted is recorded before removal. Fuseki graphs cleared best-effort."""
    with get_session() as session:
        row = _get_or_404(session, engagement_id)

        record_audit(
            session,
            actor,
            action="engagement.deleted",
            artefact_type="engagement",
            artefact_id=engagement_id,
            engagement_id=engagement_id,
            detail={"name": row.name, "client": row.client},
        )

        for comment in session.exec(
            select(CommentRow).where(CommentRow.engagement_id == engagement_id)
        ).all():
            session.delete(comment)
        for teleology in session.exec(
            select(TeleologyRowDB).where(
                TeleologyRowDB.engagement_id == engagement_id
            )
        ).all():
            session.delete(teleology)
        for process in session.exec(
            select(ProcessStateRow).where(
                ProcessStateRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(process)
        for mapping in session.exec(
            select(ConnectorMappingRow).where(
                ConnectorMappingRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(mapping)
        for connection in session.exec(
            select(ConnectorConnectionRow).where(
                ConnectorConnectionRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(connection)
        for option in session.exec(
            select(SolutionOptionRow).where(
                SolutionOptionRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(option)
        for initiative in session.exec(
            select(InitiativeRow).where(
                InitiativeRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(initiative)
        for stream in session.exec(
            select(ValueStreamRow).where(
                ValueStreamRow.engagement_id == engagement_id
            )
        ).all():
            session.delete(stream)

        session.flush()
        session.delete(row)
        session.commit()

    for stream_type in STREAM_TYPES:
        try:
            await fuseki.clear_graph(fuseki.graph_uri(engagement_id, stream_type))
        except Exception:
            pass
