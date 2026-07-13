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
    # Per-engagement configuration, seeded from the industry profile at create
    # time (see services/api/profiles.py). function_units = ordered subset of the
    # function-unit library; value_streams = [{type, label}]. Empty on rows that
    # predate this feature — the API falls back to the profile on read.
    function_units: list = Field(default_factory=list, sa_column=Column(JSONB))
    value_streams_config: list = Field(default_factory=list, sa_column=Column(JSONB))
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


class SolutionOptionRow(SQLModel, table=True):
    """AI-drafted, stream-scoped option that closes a gap between the current
    process/ontology state and the teleology. Lifecycle: draft → accepted /
    dismissed; accepting never auto-mutates approved artefacts."""

    __tablename__ = "solution_options"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    stream_type: str
    function_unit: str | None = None
    teleology_row_id: str | None = None
    title: str
    option_type: str = "strategic"  # quick_win | strategic | transformational
    rationale: str = Field(sa_column=Column(Text))
    proposed_changes: list = Field(default_factory=list, sa_column=Column(JSONB))
    impacted_steps: list = Field(default_factory=list, sa_column=Column(JSONB))
    impacted_classes: list = Field(default_factory=list, sa_column=Column(JSONB))
    effort: str = "medium"  # low | medium | high
    impact: str = "medium"  # low | medium | high
    status: str = "draft"  # draft | accepted | dismissed
    source: str = "claude"
    created_at: str
    updated_at: str


class InitiativeRow(SQLModel, table=True):
    """Cross-stream transformation initiative candidate: the bigger-picture
    object that links gaps/options across several value streams."""

    __tablename__ = "initiatives"

    id: str = Field(primary_key=True)
    engagement_id: str = Field(foreign_key="engagements.id", index=True)
    name: str
    narrative: str = Field(sa_column=Column(Text))
    streams: list = Field(default_factory=list, sa_column=Column(JSONB))
    function_units: list = Field(default_factory=list, sa_column=Column(JSONB))
    stream_links: list = Field(default_factory=list, sa_column=Column(JSONB))
    consolidates: list = Field(default_factory=list, sa_column=Column(JSONB))
    org_impact: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    horizon: str = "next"  # now | next | later
    status: str = "draft"  # draft | accepted | dismissed
    source: str = "claude"
    created_at: str
    updated_at: str


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
