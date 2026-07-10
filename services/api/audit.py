"""Event-sourced audit trail (spec §15).

`record_audit` is called by each mutating router inside the same DB session
as the mutation, so the event commits atomically with the change it records.
Actor identity comes from optional X-OTS-User-* headers (the demo web app
runs unauthenticated; SSO will populate these properly) with the demo
consultant as fallback. Read side: JSON list + CSV export per engagement.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from auth import AUTH_MODE, claims_to_identity, decode_bearer, unauthorized
from db import get_session, now_iso
from db_models import AuditEventRow

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@dataclass
class Actor:
    id: str
    name: str
    role: str


def get_actor(
    authorization: str | None = Header(default=None),
    user_id: str | None = Header(default=None, alias="X-OTS-User-Id"),
    user_name: str | None = Header(default=None, alias="X-OTS-User-Name"),
    user_role: str | None = Header(default=None, alias="X-OTS-User-Role"),
) -> Actor:
    # SSO path: a valid OIDC bearer token wins over headers (see auth.py).
    if AUTH_MODE != "off" and authorization and authorization.startswith("Bearer "):
        try:
            claims = decode_bearer(authorization)
        except Exception as exc:
            raise unauthorized(f"Invalid bearer token: {exc}") from exc
        sub, name, role = claims_to_identity(claims)
        return Actor(id=sub, name=name, role=role)

    if AUTH_MODE == "required":
        raise unauthorized("Bearer token required")

    return Actor(
        id=user_id or "user-consultant-1",
        name=user_name or "Alex Morgan",
        role=user_role or "consultant",
    )


def record_audit(
    session,
    actor: Actor,
    action: str,
    artefact_type: str,
    artefact_id: str,
    engagement_id: str | None = None,
    detail: dict | None = None,
) -> None:
    """Append an audit event; caller's session.commit() makes it durable."""
    session.add(
        AuditEventRow(
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role,
            action=action,
            artefact_type=artefact_type,
            artefact_id=artefact_id,
            engagement_id=engagement_id,
            detail=detail or {},
            created_at=now_iso(),
        )
    )


class AuditEventModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: int
    actor_id: str = Field(alias="actorId")
    actor_name: str = Field(alias="actorName")
    actor_role: str = Field(alias="actorRole")
    action: str
    artefact_type: str = Field(alias="artefactType")
    artefact_id: str = Field(alias="artefactId")
    engagement_id: str | None = Field(default=None, alias="engagementId")
    detail: dict
    created_at: str = Field(alias="createdAt")


def _events_for(session, engagement_id: str, limit: int) -> list[AuditEventRow]:
    return session.exec(
        select(AuditEventRow)
        .where(AuditEventRow.engagement_id == engagement_id)
        .order_by(AuditEventRow.id.desc())
        .limit(limit)
    ).all()


@router.get("/{engagement_id}", response_model=list[AuditEventModel])
def list_events(
    engagement_id: str,
    limit: int = Query(default=200, ge=1, le=2000),
) -> list[AuditEventModel]:
    with get_session() as session:
        return [
            AuditEventModel(
                id=row.id,
                actor_id=row.actor_id,
                actor_name=row.actor_name,
                actor_role=row.actor_role,
                action=row.action,
                artefact_type=row.artefact_type,
                artefact_id=row.artefact_id,
                engagement_id=row.engagement_id,
                detail=row.detail or {},
                created_at=row.created_at,
            )
            for row in _events_for(session, engagement_id, limit)
        ]


@router.get("/{engagement_id}/export.csv")
def export_csv(
    engagement_id: str,
    limit: int = Query(default=2000, ge=1, le=10000),
) -> StreamingResponse:
    with get_session() as session:
        rows = _events_for(session, engagement_id, limit)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "timestamp",
            "actor_id",
            "actor_name",
            "actor_role",
            "action",
            "artefact_type",
            "artefact_id",
            "detail",
        ]
    )
    for row in reversed(rows):  # chronological order in the export
        writer.writerow(
            [
                row.id,
                row.created_at,
                row.actor_id,
                row.actor_name,
                row.actor_role,
                row.action,
                row.artefact_type,
                row.artefact_id,
                str(row.detail or {}),
            ]
        )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="audit-{engagement_id}.csv"'
        },
    )


ActorDep = Depends(get_actor)
