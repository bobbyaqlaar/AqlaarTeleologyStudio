"""Process comment persistence (Postgres). JSON matches the web app's
ProcessComment type."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from db import get_session
from db_models import CommentRow

router = APIRouter(prefix="/api/v1/comments", tags=["comments"])


class CommentModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    author_id: str = Field(alias="authorId")
    author_name: str = Field(alias="authorName")
    role: str
    target_type: str = Field(alias="targetType")
    target_id: str = Field(alias="targetId")
    target_label: str = Field(alias="targetLabel")
    function_unit: str | None = Field(default=None, alias="functionUnit")
    body: str
    resolved: bool
    created_at: str = Field(alias="createdAt")


class CreateCommentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    author_id: str = Field(alias="authorId")
    author_name: str = Field(alias="authorName")
    role: str
    target_type: str = Field(default="bpmn_element", alias="targetType")
    target_id: str = Field(alias="targetId")
    target_label: str = Field(alias="targetLabel")
    function_unit: str | None = Field(default=None, alias="functionUnit")
    body: str
    resolved: bool = False


def _to_model(row: CommentRow) -> CommentModel:
    return CommentModel(
        id=row.id,
        engagement_id=row.engagement_id,
        stream_type=row.stream_type,
        author_id=row.author_id,
        author_name=row.author_name,
        role=row.role,
        target_type=row.target_type,
        target_id=row.target_id,
        target_label=row.target_label,
        function_unit=row.function_unit,
        body=row.body,
        resolved=row.resolved,
        created_at=row.created_at,
    )


@router.get("/{engagement_id}/open", response_model=list[CommentModel])
def list_open(engagement_id: str) -> list[CommentModel]:
    with get_session() as session:
        rows = session.exec(
            select(CommentRow)
            .where(
                CommentRow.engagement_id == engagement_id,
                CommentRow.resolved == False,  # noqa: E712
            )
            .order_by(CommentRow.created_at.desc())
        ).all()
        return [_to_model(row) for row in rows]


@router.get("/{engagement_id}/{stream_type}", response_model=list[CommentModel])
def list_comments(
    engagement_id: str,
    stream_type: str,
    target_id: str | None = Query(default=None, alias="targetId"),
) -> list[CommentModel]:
    with get_session() as session:
        query = select(CommentRow).where(
            CommentRow.engagement_id == engagement_id,
            CommentRow.stream_type == stream_type,
        )
        if target_id:
            query = query.where(CommentRow.target_id == target_id)
        rows = session.exec(query.order_by(CommentRow.created_at.asc())).all()
        return [_to_model(row) for row in rows]


@router.post("", response_model=CommentModel)
def create_comment(payload: CreateCommentRequest) -> CommentModel:
    with get_session() as session:
        row = CommentRow(
            id=f"comment-{uuid.uuid4().hex[:8]}",
            engagement_id=payload.engagement_id,
            stream_type=payload.stream_type,
            author_id=payload.author_id,
            author_name=payload.author_name,
            role=payload.role,
            target_type=payload.target_type,
            target_id=payload.target_id,
            target_label=payload.target_label,
            function_unit=payload.function_unit,
            body=payload.body,
            resolved=payload.resolved,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_model(row)


@router.post("/{comment_id}/resolve", response_model=CommentModel)
def resolve_comment(comment_id: str) -> CommentModel:
    with get_session() as session:
        row = session.get(CommentRow, comment_id)
        if not row:
            raise HTTPException(status_code=404, detail="Comment not found")
        row.resolved = True
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_model(row)
