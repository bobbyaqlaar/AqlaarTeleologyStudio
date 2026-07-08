"""Process state persistence (Postgres). BPMN XML + per-element meta
(functionUnit, systems). On first load the state seeds from the generated
industry baseline .bpmn (falling back across industries to generic)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from db import get_session, now_iso
from db_models import EngagementRow, ProcessStateRow
from fuseki_client import FusekiClient

router = APIRouter(prefix="/api/v1/process", tags=["process"])
fuseki = FusekiClient()

VALID_STREAMS = {"o2c", "p2p", "c2m", "h2r", "t2r"}


class ProcessStateModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    bpmn_xml: str = Field(alias="bpmnXml")
    element_meta: dict = Field(alias="elementMeta")


class SaveXmlRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bpmn_xml: str = Field(alias="bpmnXml")


class ElementMetaRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    function_unit: str | None = Field(default=None, alias="functionUnit")
    systems: list[str] | None = None


def _to_model(row: ProcessStateRow) -> ProcessStateModel:
    return ProcessStateModel(
        engagement_id=row.engagement_id,
        stream_type=row.stream_type,
        bpmn_xml=row.bpmn_xml,
        element_meta=row.element_meta or {},
    )


def _ensure_state(session, engagement_id: str, stream_type: str) -> ProcessStateRow:
    row = session.get(ProcessStateRow, (engagement_id, stream_type))
    if row:
        return row

    engagement = session.get(EngagementRow, engagement_id)
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    bpmn_path = fuseki.baseline_path(stream_type, engagement.industry).with_suffix(
        ".bpmn"
    )
    if not bpmn_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Baseline BPMN not found for {engagement.industry}/{stream_type}",
        )

    row = ProcessStateRow(
        engagement_id=engagement_id,
        stream_type=stream_type,
        bpmn_xml=bpmn_path.read_text(encoding="utf-8"),
        element_meta={},
        updated_at=now_iso(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _validate(stream_type: str) -> None:
    if stream_type not in VALID_STREAMS:
        raise HTTPException(status_code=400, detail="Invalid stream type")


@router.get("/{engagement_id}/{stream_type}", response_model=ProcessStateModel)
def get_state(engagement_id: str, stream_type: str) -> ProcessStateModel:
    _validate(stream_type)
    with get_session() as session:
        return _to_model(_ensure_state(session, engagement_id, stream_type))


@router.put("/{engagement_id}/{stream_type}", response_model=ProcessStateModel)
def save_xml(
    engagement_id: str,
    stream_type: str,
    payload: SaveXmlRequest,
) -> ProcessStateModel:
    _validate(stream_type)
    with get_session() as session:
        row = _ensure_state(session, engagement_id, stream_type)
        row.bpmn_xml = payload.bpmn_xml
        row.updated_at = now_iso()
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_model(row)


@router.patch(
    "/{engagement_id}/{stream_type}/elements/{element_id}",
    response_model=ProcessStateModel,
)
def set_element_meta(
    engagement_id: str,
    stream_type: str,
    element_id: str,
    payload: ElementMetaRequest,
) -> ProcessStateModel:
    _validate(stream_type)
    with get_session() as session:
        row = _ensure_state(session, engagement_id, stream_type)
        meta = dict(row.element_meta or {})
        entry = dict(meta.get(element_id, {}))
        fields = payload.model_dump(exclude_unset=True, by_alias=False)
        if "function_unit" in fields:
            if payload.function_unit:
                entry["functionUnit"] = payload.function_unit
            else:
                entry.pop("functionUnit", None)
        if "systems" in fields:
            if payload.systems:
                entry["systems"] = payload.systems
            else:
                entry.pop("systems", None)
        meta[element_id] = entry
        row.element_meta = meta
        row.updated_at = now_iso()
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_model(row)
