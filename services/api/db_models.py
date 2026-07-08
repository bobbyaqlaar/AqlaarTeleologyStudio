from __future__ import annotations

from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class EngagementRow(SQLModel, table=True):
    __tablename__ = "engagements"

    id: str = Field(primary_key=True)
    name: str
    client: str
    description: str | None = None
    industry: str = "generic"
    status: str = "draft"
    current_step: str = "streams"
    participants: list = Field(default_factory=list, sa_column=Column(JSONB))
    created_at: str
    updated_at: str


class ValueStreamRow(SQLModel, table=True):
    __tablename__ = "value_streams"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    type: str
    baseline_id: str
    baseline_loaded: bool = False
    approval_status: str = "draft"


class ProcessStateRow(SQLModel, table=True):
    __tablename__ = "process_states"

    engagement_id: str = Field(primary_key=True, foreign_key="engagements.id")
    stream_type: str = Field(primary_key=True)
    bpmn_xml: str = Field(sa_column=Column(Text))
    element_meta: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    updated_at: str
