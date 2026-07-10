"""Teleology matrix persistence (Postgres). JSON matches the web app's
TeleologyRow/TeleologyMatrix types. Stream-level rows are auto-created for
every loaded value stream when the matrix is fetched."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from audit import Actor, ActorDep, record_audit
from db import get_session
from db_models import TeleologyRowDB, ValueStreamRow

router = APIRouter(prefix="/api/v1/teleology", tags=["teleology"])

EMPTY_ORG = {"revenue": [], "cost": [], "cx": [], "ttm": []}
VALID_STATUSES = {"draft", "in_review", "approved", "rejected"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TeleologyRowModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    function_unit: str | None = Field(default=None, alias="functionUnit")
    goals: list[str]
    gaps: list[str]
    ambitions: list[str]
    org_ambitions: dict = Field(alias="orgAmbitions")
    approval_status: str = Field(alias="approvalStatus")
    updated_at: str = Field(alias="updatedAt")


class TeleologyMatrixModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    rows: list[TeleologyRowModel]


class UpdateRowRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    goals: list[str] | None = None
    gaps: list[str] | None = None
    ambitions: list[str] | None = None
    org_ambitions: dict | None = Field(default=None, alias="orgAmbitions")


class AddFunctionRowRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stream_type: str = Field(alias="streamType")
    function_unit: str = Field(alias="functionUnit")


class StatusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    approval_status: str = Field(alias="approvalStatus")


def _to_model(row: TeleologyRowDB) -> TeleologyRowModel:
    return TeleologyRowModel(
        id=row.id,
        engagement_id=row.engagement_id,
        stream_type=row.stream_type,
        function_unit=row.function_unit,
        goals=row.goals or [],
        gaps=row.gaps or [],
        ambitions=row.ambitions or [],
        org_ambitions={**EMPTY_ORG, **(row.org_ambitions or {})},
        approval_status=row.approval_status,
        updated_at=row.updated_at,
    )


def _loaded_stream_types(session, engagement_id: str) -> list[str]:
    streams = session.exec(
        select(ValueStreamRow).where(
            ValueStreamRow.engagement_id == engagement_id,
            ValueStreamRow.baseline_loaded == True,  # noqa: E712
        )
    ).all()
    return [stream.type for stream in streams]


def _get_row_or_404(session, engagement_id: str, row_id: str) -> TeleologyRowDB:
    row = session.get(TeleologyRowDB, row_id)
    if not row or row.engagement_id != engagement_id:
        raise HTTPException(status_code=404, detail="Teleology row not found")
    return row


@router.get("/{engagement_id}", response_model=TeleologyMatrixModel)
def get_matrix(engagement_id: str) -> TeleologyMatrixModel:
    with get_session() as session:
        loaded = _loaded_stream_types(session, engagement_id)

        rows = session.exec(
            select(TeleologyRowDB).where(
                TeleologyRowDB.engagement_id == engagement_id
            )
        ).all()

        # Auto-create the stream-level row for loaded streams that lack one
        existing_stream_rows = {
            row.stream_type for row in rows if row.function_unit is None
        }
        for stream_type in loaded:
            if stream_type not in existing_stream_rows:
                new_row = TeleologyRowDB(
                    id=f"tel-{stream_type}-stream-{engagement_id[-8:]}",
                    engagement_id=engagement_id,
                    stream_type=stream_type,
                    goals=[],
                    gaps=[],
                    ambitions=[],
                    org_ambitions=dict(EMPTY_ORG),
                    approval_status="draft",
                    updated_at=_now(),
                )
                session.add(new_row)
                rows = list(rows) + [new_row]
        session.commit()

        visible = [row for row in rows if row.stream_type in set(loaded)]
        visible.sort(
            key=lambda r: (r.stream_type, r.function_unit is not None, r.function_unit or "")
        )
        return TeleologyMatrixModel(
            engagement_id=engagement_id,
            rows=[_to_model(row) for row in visible],
        )


@router.patch("/{engagement_id}/rows/{row_id}", response_model=TeleologyRowModel)
def update_row(
    engagement_id: str,
    row_id: str,
    payload: UpdateRowRequest,
    actor: Actor = ActorDep,
) -> TeleologyRowModel:
    with get_session() as session:
        row = _get_row_or_404(session, engagement_id, row_id)
        if payload.goals is not None:
            row.goals = payload.goals
        if payload.gaps is not None:
            row.gaps = payload.gaps
        if payload.ambitions is not None:
            row.ambitions = payload.ambitions
        if payload.org_ambitions is not None:
            row.org_ambitions = {**EMPTY_ORG, **(row.org_ambitions or {}), **payload.org_ambitions}
        row.updated_at = _now()
        session.add(row)
        record_audit(
            session,
            actor,
            action="teleology.row_updated",
            artefact_type="teleology_row",
            artefact_id=row_id,
            engagement_id=engagement_id,
            detail={
                "streamType": row.stream_type,
                "functionUnit": row.function_unit,
                "fields": sorted(payload.model_dump(exclude_unset=True).keys()),
            },
        )
        session.commit()
        session.refresh(row)
        return _to_model(row)


@router.post("/{engagement_id}/rows", response_model=TeleologyRowModel)
def add_function_row(
    engagement_id: str,
    payload: AddFunctionRowRequest,
    actor: Actor = ActorDep,
) -> TeleologyRowModel:
    with get_session() as session:
        existing = session.exec(
            select(TeleologyRowDB).where(
                TeleologyRowDB.engagement_id == engagement_id,
                TeleologyRowDB.stream_type == payload.stream_type,
                TeleologyRowDB.function_unit == payload.function_unit,
            )
        ).first()
        if existing:
            return _to_model(existing)

        row = TeleologyRowDB(
            id=f"tel-{payload.stream_type}-{payload.function_unit}-{engagement_id[-8:]}",
            engagement_id=engagement_id,
            stream_type=payload.stream_type,
            function_unit=payload.function_unit,
            goals=[],
            gaps=[],
            ambitions=[],
            org_ambitions=dict(EMPTY_ORG),
            approval_status="draft",
            updated_at=_now(),
        )
        session.add(row)
        record_audit(
            session,
            actor,
            action="teleology.row_added",
            artefact_type="teleology_row",
            artefact_id=row.id,
            engagement_id=engagement_id,
            detail={
                "streamType": payload.stream_type,
                "functionUnit": payload.function_unit,
            },
        )
        session.commit()
        session.refresh(row)
        return _to_model(row)


@router.post("/{engagement_id}/rows/{row_id}/status", response_model=TeleologyRowModel)
def set_status(
    engagement_id: str,
    row_id: str,
    payload: StatusRequest,
    actor: Actor = ActorDep,
) -> TeleologyRowModel:
    if payload.approval_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid approval status")
    with get_session() as session:
        row = _get_row_or_404(session, engagement_id, row_id)
        previous = row.approval_status
        row.approval_status = payload.approval_status
        row.updated_at = _now()
        session.add(row)
        record_audit(
            session,
            actor,
            action="teleology.status_changed",
            artefact_type="teleology_row",
            artefact_id=row_id,
            engagement_id=engagement_id,
            detail={
                "streamType": row.stream_type,
                "functionUnit": row.function_unit,
                "from": previous,
                "to": payload.approval_status,
            },
        )
        session.commit()
        session.refresh(row)
        return _to_model(row)
