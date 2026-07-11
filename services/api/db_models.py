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


class ConnectorConnectionRow(SQLModel, table=True):
    __tablename__ = "connector_connections"

    engagement_id: str = Field(primary_key=True, foreign_key="engagements.id")
    connector_type: str = Field(primary_key=True)  # salesforce | jira
    connected: bool = False
    instance_url: str = ""
    last_sync_at: str | None = None
    last_preview_at: str | None = None
    last_applied_at: str | None = None


class ConnectorMappingRow(SQLModel, table=True):
    __tablename__ = "connector_field_mappings"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    connector_type: str
    source_field: str
    target_field: str
    target_type: str  # bpmn_task | owl_class | process_meta
    target_label: str
    stream_type: str


class AuditEventRow(SQLModel, table=True):
    """Append-only audit trail: who did what to which artefact, when."""

    __tablename__ = "audit_events"

    id: int | None = Field(default=None, primary_key=True)
    actor_id: str
    actor_name: str
    actor_role: str = "consultant"
    action: str  # e.g. "engagement.created", "process.element_tagged"
    artefact_type: str  # engagement | value_stream | process_state | ...
    artefact_id: str
    engagement_id: str | None = Field(default=None, index=True)
    detail: dict = Field(default_factory=dict, sa_column=Column(JSONB))
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
