"""Real Salesforce/Jira connectors (spec §15 'real connector APIs').

State (connections + field mappings) is Postgres-backed. Connect validates
credentials against the live system; preview pulls live sample values for
the engagement's mapped source fields; apply writes ready values into the
stream's process state (element_meta[<element>]["connectorData"]) so the
Process/Ontology workspaces can surface them for consultant validation.

JSON mirrors apps/web/lib/types connector shapes so the web service swaps
from the mock store without UI changes. When server credentials are absent
the connect endpoint returns 503 with a hint; the web keeps its mock
fallback for API-down/unconfigured dev.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

import connector_clients
from audit import Actor, ActorDep, record_audit
from db import get_session, now_iso
from db_models import (
    ConnectorConnectionRow,
    ConnectorMappingRow,
    EngagementRow,
    ProcessStateRow,
)
from gaps_router import _extract_tasks

router = APIRouter(prefix="/api/v1/connectors", tags=["connectors"])

CONNECTOR_TYPES = ("salesforce", "jira")

DEFAULT_INSTANCE_URLS = {
    "salesforce": "https://acme.my.salesforce.com",
    "jira": "https://acme.atlassian.net",
}

# Mirror of apps/web/lib/mock/fixtures/connector-fixtures.ts defaultMappings
DEFAULT_MAPPINGS: list[dict] = [
    {"connector_type": "salesforce", "source_field": "Opportunity.StageName", "target_field": "Task_validate", "target_type": "bpmn_task", "target_label": "Validate order", "stream_type": "o2c"},
    {"connector_type": "salesforce", "source_field": "Account.CreditScore", "target_field": "Task_credit", "target_type": "bpmn_task", "target_label": "Credit assessment", "stream_type": "o2c"},
    {"connector_type": "salesforce", "source_field": "Order.FulfillmentStatus", "target_field": "Task_fulfil", "target_type": "bpmn_task", "target_label": "Fulfillment", "stream_type": "o2c"},
    {"connector_type": "salesforce", "source_field": "Invoice.Status", "target_field": "Task_invoice", "target_type": "bpmn_task", "target_label": "Invoice", "stream_type": "o2c"},
    {"connector_type": "salesforce", "source_field": "Payment.AmountReceived", "target_field": "Task_collect", "target_type": "bpmn_task", "target_label": "Payment collection", "stream_type": "o2c"},
    {"connector_type": "salesforce", "source_field": "Product2.Name", "target_field": "ots:ProductConcept", "target_type": "owl_class", "target_label": "Product concept", "stream_type": "c2m"},
    {"connector_type": "jira", "source_field": "IssueType.name", "target_field": "Task_intake", "target_type": "bpmn_task", "target_label": "Incident intake", "stream_type": "t2r"},
    {"connector_type": "jira", "source_field": "Priority.name", "target_field": "Task_triage", "target_type": "bpmn_task", "target_label": "Triage", "stream_type": "t2r"},
    {"connector_type": "jira", "source_field": "Status.name", "target_field": "Task_diagnose", "target_type": "bpmn_task", "target_label": "Diagnose", "stream_type": "t2r"},
    {"connector_type": "jira", "source_field": "Resolution.name", "target_field": "Task_resolve", "target_type": "bpmn_task", "target_label": "Resolve", "stream_type": "t2r"},
    {"connector_type": "jira", "source_field": "CustomField.slaBreached", "target_field": "Task_close", "target_type": "bpmn_task", "target_label": "Close incident", "stream_type": "t2r"},
    {"connector_type": "jira", "source_field": "IssueType.name", "target_field": "Task_onboard", "target_type": "bpmn_task", "target_label": "Onboard employee", "stream_type": "h2r"},
]


class ConnectionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    connector_type: str = Field(alias="connectorType")
    connected: bool
    instance_url: str = Field(alias="instanceUrl")
    last_sync_at: str | None = Field(default=None, alias="lastSyncAt")
    last_preview_at: str | None = Field(default=None, alias="lastPreviewAt")
    last_applied_at: str | None = Field(default=None, alias="lastAppliedAt")
    configured: bool  # server-side credentials present for this connector


class MappingModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    connector_type: str = Field(alias="connectorType")
    source_field: str = Field(alias="sourceField")
    target_field: str = Field(alias="targetField")
    target_type: str = Field(alias="targetType")
    target_label: str = Field(alias="targetLabel")
    stream_type: str = Field(alias="streamType")


class ConnectRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    instance_url: str = Field(alias="instanceUrl")


class UpdateMappingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_field: str | None = Field(default=None, alias="sourceField")
    target_field: str | None = Field(default=None, alias="targetField")
    target_label: str | None = Field(default=None, alias="targetLabel")
    target_type: str | None = Field(default=None, alias="targetType")


class PreviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stream_type: str = Field(alias="streamType")


class PreviewItemModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    source_field: str = Field(alias="sourceField")
    source_value: str = Field(alias="sourceValue")
    target_field: str = Field(alias="targetField")
    target_label: str = Field(alias="targetLabel")
    target_type: str = Field(alias="targetType")
    stream_type: str = Field(alias="streamType")
    status: str  # ready | conflict | unmapped
    note: str | None = None


class PreviewSummaryModel(BaseModel):
    ready: int
    conflict: int
    unmapped: int


class PreviewResultModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    connector_type: str = Field(alias="connectorType")
    stream_type: str = Field(alias="streamType")
    items: list[PreviewItemModel]
    summary: PreviewSummaryModel
    error: str | None = None


class ApplyRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stream_type: str = Field(alias="streamType")
    preview: PreviewResultModel


class ApplyResultModel(BaseModel):
    applied: int
    skipped: int
    message: str


def _ensure_state(session, engagement_id: str) -> None:
    if not session.get(EngagementRow, engagement_id):
        raise HTTPException(status_code=404, detail="Engagement not found")
    existing = session.exec(
        select(ConnectorConnectionRow).where(
            ConnectorConnectionRow.engagement_id == engagement_id
        )
    ).all()
    if existing:
        return
    for connector_type in CONNECTOR_TYPES:
        session.add(
            ConnectorConnectionRow(
                engagement_id=engagement_id,
                connector_type=connector_type,
                instance_url=DEFAULT_INSTANCE_URLS[connector_type],
            )
        )
    for mapping in DEFAULT_MAPPINGS:
        session.add(
            ConnectorMappingRow(
                id=f"map-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                **mapping,
            )
        )
    session.commit()


def _connection_or_404(
    session, engagement_id: str, connector_type: str
) -> ConnectorConnectionRow:
    if connector_type not in CONNECTOR_TYPES:
        raise HTTPException(status_code=400, detail="Unknown connector type")
    row = session.get(ConnectorConnectionRow, (engagement_id, connector_type))
    if not row:
        raise HTTPException(status_code=404, detail="Connector not found")
    return row


def _to_connection(row: ConnectorConnectionRow) -> ConnectionModel:
    return ConnectionModel(
        engagement_id=row.engagement_id,
        connector_type=row.connector_type,
        connected=row.connected,
        instance_url=row.instance_url,
        last_sync_at=row.last_sync_at,
        last_preview_at=row.last_preview_at,
        last_applied_at=row.last_applied_at,
        configured=connector_clients.configured(row.connector_type),
    )


def _to_mapping(row: ConnectorMappingRow) -> MappingModel:
    return MappingModel(
        id=row.id,
        engagement_id=row.engagement_id,
        connector_type=row.connector_type,
        source_field=row.source_field,
        target_field=row.target_field,
        target_type=row.target_type,
        target_label=row.target_label,
        stream_type=row.stream_type,
    )


@router.get("/{engagement_id}", response_model=list[ConnectionModel])
def list_connections(engagement_id: str) -> list[ConnectionModel]:
    with get_session() as session:
        _ensure_state(session, engagement_id)
        rows = session.exec(
            select(ConnectorConnectionRow).where(
                ConnectorConnectionRow.engagement_id == engagement_id
            )
        ).all()
        return [_to_connection(row) for row in sorted(rows, key=lambda r: r.connector_type, reverse=True)]


@router.get("/{engagement_id}/mappings", response_model=list[MappingModel])
def list_mappings(
    engagement_id: str,
    connector_type: str | None = Query(default=None, alias="connectorType"),
    stream_type: str | None = Query(default=None, alias="streamType"),
) -> list[MappingModel]:
    with get_session() as session:
        _ensure_state(session, engagement_id)
        query = select(ConnectorMappingRow).where(
            ConnectorMappingRow.engagement_id == engagement_id
        )
        if connector_type:
            query = query.where(ConnectorMappingRow.connector_type == connector_type)
        if stream_type:
            query = query.where(ConnectorMappingRow.stream_type == stream_type)
        return [_to_mapping(row) for row in session.exec(query).all()]


@router.post(
    "/{engagement_id}/{connector_type}/connect", response_model=ConnectionModel
)
async def connect(
    engagement_id: str,
    connector_type: str,
    payload: ConnectRequest,
    actor: Actor = ActorDep,
) -> ConnectionModel:
    instance_url = payload.instance_url.strip() or DEFAULT_INSTANCE_URLS.get(
        connector_type, ""
    )
    if not connector_clients.configured(connector_type):
        raise HTTPException(
            status_code=503,
            detail=connector_clients.missing_credentials_hint(connector_type),
        )
    try:
        await connector_clients.VALIDATORS[connector_type](instance_url)
    except connector_clients.ConnectorError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    with get_session() as session:
        _ensure_state(session, engagement_id)
        row = _connection_or_404(session, engagement_id, connector_type)
        row.connected = True
        row.instance_url = instance_url
        row.last_sync_at = now_iso()
        session.add(row)
        record_audit(
            session,
            actor,
            action="connector.connected",
            artefact_type="connector",
            artefact_id=f"{engagement_id}/{connector_type}",
            engagement_id=engagement_id,
            detail={"connectorType": connector_type, "instanceUrl": instance_url},
        )
        session.commit()
        session.refresh(row)
        return _to_connection(row)


@router.post(
    "/{engagement_id}/{connector_type}/disconnect", response_model=ConnectionModel
)
def disconnect(
    engagement_id: str, connector_type: str, actor: Actor = ActorDep
) -> ConnectionModel:
    with get_session() as session:
        _ensure_state(session, engagement_id)
        row = _connection_or_404(session, engagement_id, connector_type)
        row.connected = False
        row.last_sync_at = None
        row.last_preview_at = None
        session.add(row)
        record_audit(
            session,
            actor,
            action="connector.disconnected",
            artefact_type="connector",
            artefact_id=f"{engagement_id}/{connector_type}",
            engagement_id=engagement_id,
            detail={"connectorType": connector_type},
        )
        session.commit()
        session.refresh(row)
        return _to_connection(row)


@router.patch("/{engagement_id}/mappings/{mapping_id}", response_model=MappingModel)
def update_mapping(
    engagement_id: str,
    mapping_id: str,
    payload: UpdateMappingRequest,
) -> MappingModel:
    with get_session() as session:
        row = session.get(ConnectorMappingRow, mapping_id)
        if not row or row.engagement_id != engagement_id:
            raise HTTPException(status_code=404, detail="Mapping not found")
        if payload.source_field is not None:
            row.source_field = payload.source_field
        if payload.target_field is not None:
            row.target_field = payload.target_field
        if payload.target_label is not None:
            row.target_label = payload.target_label
        if payload.target_type is not None:
            row.target_type = payload.target_type
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_mapping(row)


def _stream_tasks(session, engagement_id: str, stream_type: str) -> list[dict]:
    state = session.get(ProcessStateRow, (engagement_id, stream_type))
    return _extract_tasks(state.bpmn_xml) if state else []


@router.post(
    "/{engagement_id}/{connector_type}/preview", response_model=PreviewResultModel
)
async def preview(
    engagement_id: str,
    connector_type: str,
    payload: PreviewRequest,
    actor: Actor = ActorDep,
) -> PreviewResultModel:
    stream_type = payload.stream_type
    with get_session() as session:
        _ensure_state(session, engagement_id)
        connection = _connection_or_404(session, engagement_id, connector_type)
        if not connection.connected:
            return PreviewResultModel(
                connector_type=connector_type,
                stream_type=stream_type,
                items=[],
                summary=PreviewSummaryModel(ready=0, conflict=0, unmapped=0),
                error="Connect to the system before running import preview.",
            )
        instance_url = connection.instance_url
        mappings = session.exec(
            select(ConnectorMappingRow).where(
                ConnectorMappingRow.engagement_id == engagement_id,
                ConnectorMappingRow.connector_type == connector_type,
                ConnectorMappingRow.stream_type == stream_type,
            )
        ).all()
        tasks = _stream_tasks(session, engagement_id, stream_type)
        for mapping in mappings:
            session.expunge(mapping)

    try:
        samples = await connector_clients.SAMPLERS[connector_type](
            instance_url, [m.source_field for m in mappings]
        )
    except connector_clients.ConnectorError as exc:
        return PreviewResultModel(
            connector_type=connector_type,
            stream_type=stream_type,
            items=[],
            summary=PreviewSummaryModel(ready=0, conflict=0, unmapped=0),
            error=f"Connector preview error — no merge performed. {exc}",
        )

    task_ids = {t["id"] for t in tasks}
    task_names = {t["name"].lower() for t in tasks}
    items: list[PreviewItemModel] = []
    for mapping in mappings:
        value = samples.get(mapping.source_field)
        status, note = "ready", None
        if value is None:
            status = "unmapped"
            note = "No live value returned for this field."
            value = f"— ({mapping.source_field})"
        elif mapping.target_type == "bpmn_task" and tasks and (
            mapping.target_field not in task_ids
            and mapping.target_label.lower() not in task_names
        ):
            status = "conflict"
            note = "Target BPMN element not found in this stream's process map."
        items.append(
            PreviewItemModel(
                id=f"preview-{mapping.id}",
                source_field=mapping.source_field,
                source_value=str(value),
                target_field=mapping.target_field,
                target_label=mapping.target_label,
                target_type=mapping.target_type,
                stream_type=mapping.stream_type,
                status=status,
                note=note,
            )
        )

    summary = PreviewSummaryModel(
        ready=sum(1 for i in items if i.status == "ready"),
        conflict=sum(1 for i in items if i.status == "conflict"),
        unmapped=sum(1 for i in items if i.status == "unmapped"),
    )

    with get_session() as session:
        row = _connection_or_404(session, engagement_id, connector_type)
        row.last_preview_at = now_iso()
        session.add(row)
        record_audit(
            session,
            actor,
            action="connector.previewed",
            artefact_type="connector",
            artefact_id=f"{engagement_id}/{connector_type}",
            engagement_id=engagement_id,
            detail={"streamType": stream_type, **summary.model_dump()},
        )
        session.commit()

    return PreviewResultModel(
        connector_type=connector_type,
        stream_type=stream_type,
        items=items,
        summary=summary,
    )


@router.post(
    "/{engagement_id}/{connector_type}/apply", response_model=ApplyResultModel
)
def apply_preview(
    engagement_id: str,
    connector_type: str,
    payload: ApplyRequest,
    actor: Actor = ActorDep,
) -> ApplyResultModel:
    preview_result = payload.preview
    if preview_result.error:
        return ApplyResultModel(
            applied=0,
            skipped=len(preview_result.items),
            message="Import blocked — resolve preview errors first.",
        )

    ready = [item for item in preview_result.items if item.status == "ready"]
    skipped = len(preview_result.items) - len(ready)

    with get_session() as session:
        _ensure_state(session, engagement_id)
        connection = _connection_or_404(session, engagement_id, connector_type)
        state = session.get(
            ProcessStateRow, (engagement_id, payload.stream_type)
        )
        applied = 0
        if state:
            tasks = _extract_tasks(state.bpmn_xml)
            by_id = {t["id"] for t in tasks}
            by_name = {t["name"].lower(): t["id"] for t in tasks}
            meta = dict(state.element_meta or {})
            for item in ready:
                element_id = (
                    item.target_field
                    if item.target_field in by_id
                    else by_name.get(item.target_label.lower())
                )
                if not element_id:
                    skipped += 1
                    continue
                entry = dict(meta.get(element_id, {}))
                connector_data = dict(entry.get("connectorData", {}))
                connector_data[item.source_field] = item.source_value
                entry["connectorData"] = connector_data
                meta[element_id] = entry
                applied += 1
            state.element_meta = meta
            state.updated_at = now_iso()
            session.add(state)

        connection.last_applied_at = now_iso()
        session.add(connection)
        record_audit(
            session,
            actor,
            action="connector.applied",
            artefact_type="connector",
            artefact_id=f"{engagement_id}/{connector_type}",
            engagement_id=engagement_id,
            detail={
                "streamType": payload.stream_type,
                "applied": applied,
                "skipped": skipped,
            },
        )
        session.commit()

    return ApplyResultModel(
        applied=applied,
        skipped=skipped,
        message=(
            f"Applied {applied} live value(s) to "
            f"{payload.stream_type.upper()} process metadata. "
            "Consultant validation still required in Process and Ontology."
        ),
    )
