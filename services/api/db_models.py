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


class CommentRow(SQLModel, table=True):
    __tablename__ = "process_comments"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    stream_type: str
    author_id: str
    author_name: str
    role: str
    target_type: str = "bpmn_element"
    target_id: str
    target_label: str
    function_unit: str | None = None
    body: str = Field(sa_column=Column(Text))
    resolved: bool = False
    created_at: str


class TeleologyRowDB(SQLModel, table=True):
    __tablename__ = "teleology_rows"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    stream_type: str
    function_unit: str | None = None
    goals: list = Field(default_factory=list, sa_column=Column(JSONB))
    gaps: list = Field(default_factory=list, sa_column=Column(JSONB))
    ambitions: list = Field(default_factory=list, sa_column=Column(JSONB))
    org_ambitions: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    approval_status: str = "draft"
    updated_at: str
