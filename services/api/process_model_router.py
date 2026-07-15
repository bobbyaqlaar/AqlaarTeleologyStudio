"""Actor–Method process model API (Phase 1).

Actors own typed methods; a process is an ordered sequence of method invocations
with input/output variable bindings, validated as a dataflow against initialised
globals. The BPMN diagram is generated from the steps. See
docs/superpowers/specs/2026-07-13-actor-method-process-model-design.md.
"""

from __future__ import annotations

import uuid
from xml.etree import ElementTree as ET

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import select

from db import get_session, now_iso
from db_models import (
    ActorRow,
    EngagementRow,
    MethodParamRow,
    MethodRow,
    ProcessGlobalRow,
    ProcessStepRow,
)
from fuseki_client import FusekiClient
from process_model_bpmn import generate_bpmn
from process_validation import validate_process
from profiles import FUNCTION_UNIT_LIBRARY

router = APIRouter(prefix="/api/v1/process-model", tags=["process-model"])
fuseki = FusekiClient()


# --- schemas -------------------------------------------------------------

class ParamModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    direction: str
    name: str
    concept_uri: str = Field(alias="conceptUri")
    concept_label: str | None = Field(default=None, alias="conceptLabel")
    required: bool = True
    seq: int = 0


class ActorModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str | None = Field(default=None, alias="engagementId")
    name: str
    kind: str
    function_unit: str = Field(alias="functionUnit")
    description: str | None = None


class CreateActorRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    kind: str = "role"
    function_unit: str = Field(alias="functionUnit")
    description: str | None = None
    engagement_id: str | None = Field(default=None, alias="engagementId")


class MethodModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    actor_id: str = Field(alias="actorId")
    engagement_id: str | None = Field(default=None, alias="engagementId")
    name: str
    description: str | None = None
    params: list[ParamModel] = []


class CreateMethodRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    actor_id: str = Field(alias="actorId")
    name: str
    description: str | None = None
    engagement_id: str | None = Field(default=None, alias="engagementId")
    params: list[ParamModel] = []


class StepModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    method_id: str = Field(alias="methodId")
    seq: int
    input_bindings: dict = Field(default_factory=dict, alias="inputBindings")
    output_bindings: dict = Field(default_factory=dict, alias="outputBindings")
    label: str | None = None
    method: MethodModel | None = None


class CreateStepRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    method_id: str = Field(alias="methodId")
    seq: int | None = None
    input_bindings: dict = Field(default_factory=dict, alias="inputBindings")
    output_bindings: dict = Field(default_factory=dict, alias="outputBindings")
    label: str | None = None


class UpdateStepRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    seq: int | None = None
    input_bindings: dict | None = Field(default=None, alias="inputBindings")
    output_bindings: dict | None = Field(default=None, alias="outputBindings")
    label: str | None = None


class GlobalModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    engagement_id: str = Field(alias="engagementId")
    stream_type: str = Field(alias="streamType")
    name: str
    concept_uri: str = Field(alias="conceptUri")
    concept_label: str | None = Field(default=None, alias="conceptLabel")
    initial_value: str | None = Field(default=None, alias="initialValue")


class CreateGlobalRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    concept_uri: str = Field(alias="conceptUri")
    concept_label: str | None = Field(default=None, alias="conceptLabel")
    initial_value: str | None = Field(default=None, alias="initialValue")


class ProcessModelResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    steps: list[StepModel]
    globals: list[GlobalModel]
    problems: list[dict]


# --- helpers -------------------------------------------------------------

def _params_for(session, method_id: str) -> list[ParamModel]:
    rows = session.exec(
        select(MethodParamRow).where(MethodParamRow.method_id == method_id)
    ).all()
    rows.sort(key=lambda p: (p.direction, p.seq))
    return [
        ParamModel(
            direction=p.direction,
            name=p.name,
            concept_uri=p.concept_uri,
            concept_label=p.concept_label,
            required=p.required,
            seq=p.seq,
        )
        for p in rows
    ]


def _method_model(session, row: MethodRow) -> MethodModel:
    return MethodModel(
        id=row.id,
        actor_id=row.actor_id,
        engagement_id=row.engagement_id,
        name=row.name,
        description=row.description,
        params=_params_for(session, row.id),
    )


def _method_dict(model: MethodModel) -> dict:
    """Shape the validation engine expects."""
    return {
        "name": model.name,
        "inputs": [
            {"name": p.name, "concept_uri": p.concept_uri,
             "concept_label": p.concept_label, "required": p.required}
            for p in model.params if p.direction == "input"
        ],
        "outputs": [
            {"name": p.name, "concept_uri": p.concept_uri,
             "concept_label": p.concept_label}
            for p in model.params if p.direction == "output"
        ],
    }


# --- actors --------------------------------------------------------------

@router.get("/actors", response_model=list[ActorModel])
def list_actors(engagement_id: str | None = Query(default=None, alias="engagementId")):
    with get_session() as session:
        stmt = select(ActorRow)
        rows = session.exec(stmt).all()
        rows = [
            r for r in rows
            if r.engagement_id is None or r.engagement_id == engagement_id
        ]
        return [
            ActorModel(
                id=r.id, engagement_id=r.engagement_id, name=r.name, kind=r.kind,
                function_unit=r.function_unit, description=r.description,
            )
            for r in sorted(rows, key=lambda r: (r.function_unit, r.name))
        ]


@router.post("/actors", response_model=ActorModel)
def create_actor(payload: CreateActorRequest):
    if payload.function_unit not in FUNCTION_UNIT_LIBRARY:
        raise HTTPException(
            status_code=400,
            detail=f"functionUnit must be one of the {len(FUNCTION_UNIT_LIBRARY)} units",
        )
    with get_session() as session:
        row = ActorRow(
            id=f"actor-{uuid.uuid4().hex[:8]}",
            engagement_id=payload.engagement_id,
            name=payload.name,
            kind=payload.kind,
            function_unit=payload.function_unit,
            description=payload.description,
            created_at=now_iso(),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return ActorModel(
            id=row.id, engagement_id=row.engagement_id, name=row.name, kind=row.kind,
            function_unit=row.function_unit, description=row.description,
        )


@router.delete("/actors/{actor_id}", status_code=204)
def delete_actor(actor_id: str):
    with get_session() as session:
        row = session.get(ActorRow, actor_id)
        if row:
            session.delete(row)
            session.commit()


# --- methods -------------------------------------------------------------

@router.get("/methods", response_model=list[MethodModel])
def list_methods(
    engagement_id: str | None = Query(default=None, alias="engagementId"),
    actor_id: str | None = Query(default=None, alias="actorId"),
):
    with get_session() as session:
        rows = session.exec(select(MethodRow)).all()
        rows = [
            r for r in rows
            if (r.engagement_id is None or r.engagement_id == engagement_id)
            and (actor_id is None or r.actor_id == actor_id)
        ]
        return [_method_model(session, r) for r in sorted(rows, key=lambda r: r.name)]


@router.post("/methods", response_model=MethodModel)
def create_method(payload: CreateMethodRequest):
    with get_session() as session:
        if not session.get(ActorRow, payload.actor_id):
            raise HTTPException(status_code=404, detail="Actor not found")
        method_id = f"method-{uuid.uuid4().hex[:8]}"
        session.add(
            MethodRow(
                id=method_id,
                actor_id=payload.actor_id,
                engagement_id=payload.engagement_id,
                name=payload.name,
                description=payload.description,
                created_at=now_iso(),
            )
        )
        session.flush()  # method must exist before its FK-linked params insert
        for index, param in enumerate(payload.params):
            session.add(
                MethodParamRow(
                    id=f"param-{uuid.uuid4().hex[:8]}",
                    method_id=method_id,
                    direction=param.direction,
                    name=param.name,
                    concept_uri=param.concept_uri,
                    concept_label=param.concept_label,
                    required=param.required,
                    seq=param.seq or index,
                )
            )
        session.commit()
        return _method_model(session, session.get(MethodRow, method_id))


@router.delete("/methods/{method_id}", status_code=204)
def delete_method(method_id: str):
    with get_session() as session:
        for param in session.exec(
            select(MethodParamRow).where(MethodParamRow.method_id == method_id)
        ).all():
            session.delete(param)
        row = session.get(MethodRow, method_id)
        if row:
            session.delete(row)
        session.commit()


# --- process (steps + globals + validation) ------------------------------

def _steps_for(session, engagement_id: str, stream_type: str) -> list[ProcessStepRow]:
    rows = session.exec(
        select(ProcessStepRow).where(
            ProcessStepRow.engagement_id == engagement_id,
            ProcessStepRow.stream_type == stream_type,
        )
    ).all()
    return sorted(rows, key=lambda s: s.seq)


def _globals_for(session, engagement_id: str, stream_type: str) -> list[ProcessGlobalRow]:
    return session.exec(
        select(ProcessGlobalRow).where(
            ProcessGlobalRow.engagement_id == engagement_id,
            ProcessGlobalRow.stream_type == stream_type,
        )
    ).all()


async def _build_response(
    session, engagement_id: str, stream_type: str
) -> ProcessModelResponse:
    step_rows = _steps_for(session, engagement_id, stream_type)
    global_rows = _globals_for(session, engagement_id, stream_type)

    method_models: dict[str, MethodModel] = {}
    step_models: list[StepModel] = []
    for row in step_rows:
        method_row = session.get(MethodRow, row.method_id)
        method_model = _method_model(session, method_row) if method_row else None
        if method_model:
            method_models[row.method_id] = method_model
        step_models.append(
            StepModel(
                id=row.id, engagement_id=row.engagement_id, stream_type=row.stream_type,
                method_id=row.method_id, seq=row.seq,
                input_bindings=row.input_bindings or {},
                output_bindings=row.output_bindings or {},
                label=row.label, method=method_model,
            )
        )

    global_models = [
        GlobalModel(
            id=g.id, engagement_id=g.engagement_id, stream_type=g.stream_type,
            name=g.name, concept_uri=g.concept_uri, concept_label=g.concept_label,
            initial_value=g.initial_value,
        )
        for g in global_rows
    ]

    # Ontology subtype closure: a variable typed by a subclass satisfies an input
    # expecting the superclass. Best-effort via Fuseki; exact-match if unavailable.
    concept_uris: list[str] = [g.concept_uri for g in global_rows]
    for model in method_models.values():
        concept_uris.extend(p.concept_uri for p in model.params)
    ancestors = await fuseki.ancestor_map(concept_uris)

    def is_a(actual: str, expected: str) -> bool:
        return actual == expected or expected in ancestors.get(actual, set())

    problems = validate_process(
        steps=[
            {"id": s.id, "seq": s.seq, "method_id": s.method_id,
             "input_bindings": s.input_bindings or {},
             "output_bindings": s.output_bindings or {}}
            for s in step_rows
        ],
        methods={mid: _method_dict(m) for mid, m in method_models.items()},
        globals_=[{"name": g.name, "concept_uri": g.concept_uri} for g in global_rows],
        is_a=is_a,
    )
    return ProcessModelResponse(
        steps=step_models, globals=global_models, problems=problems
    )


@router.get("/{engagement_id}/{stream_type}", response_model=ProcessModelResponse)
async def get_process_model(engagement_id: str, stream_type: str) -> ProcessModelResponse:
    with get_session() as session:
        return await _build_response(session, engagement_id, stream_type)


@router.get("/{engagement_id}/{stream_type}/validate")
async def validate(engagement_id: str, stream_type: str) -> dict:
    with get_session() as session:
        response = await _build_response(session, engagement_id, stream_type)
        errors = [p for p in response.problems if p.get("severity") != "warning"]
        warnings = [p for p in response.problems if p.get("severity") == "warning"]
        return {
            "valid": not errors,
            "errors": len(errors),
            "warnings": len(warnings),
            "problems": response.problems,
        }


@router.get("/{engagement_id}/{stream_type}/bpmn")
def get_generated_bpmn(engagement_id: str, stream_type: str) -> Response:
    with get_session() as session:
        step_rows = _steps_for(session, engagement_id, stream_type)
        steps = []
        for row in step_rows:
            method = session.get(MethodRow, row.method_id)
            actor = session.get(ActorRow, method.actor_id) if method else None
            steps.append({
                "id": row.id,
                "name": row.label or (method.name if method else row.method_id),
                "function_unit": actor.function_unit if actor else "operations",
            })
        xml = generate_bpmn(stream_type, steps)
        return Response(content=xml, media_type="application/xml")


@router.post("/{engagement_id}/{stream_type}/steps", response_model=ProcessModelResponse)
async def add_step(
    engagement_id: str, stream_type: str, payload: CreateStepRequest
) -> ProcessModelResponse:
    with get_session() as session:
        if not session.get(EngagementRow, engagement_id):
            raise HTTPException(status_code=404, detail="Engagement not found")
        if not session.get(MethodRow, payload.method_id):
            raise HTTPException(status_code=404, detail="Method not found")
        existing = _steps_for(session, engagement_id, stream_type)
        seq = payload.seq if payload.seq is not None else (
            max((s.seq for s in existing), default=-1) + 1
        )
        session.add(
            ProcessStepRow(
                id=f"step-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                stream_type=stream_type,
                method_id=payload.method_id,
                seq=seq,
                input_bindings=payload.input_bindings,
                output_bindings=payload.output_bindings,
                label=payload.label,
            )
        )
        session.commit()
        return await _build_response(session, engagement_id, stream_type)


@router.patch(
    "/{engagement_id}/{stream_type}/steps/{step_id}",
    response_model=ProcessModelResponse,
)
async def update_step(
    engagement_id: str, stream_type: str, step_id: str, payload: UpdateStepRequest
) -> ProcessModelResponse:
    with get_session() as session:
        row = session.get(ProcessStepRow, step_id)
        if not row:
            raise HTTPException(status_code=404, detail="Step not found")
        if payload.seq is not None:
            row.seq = payload.seq
        if payload.input_bindings is not None:
            row.input_bindings = payload.input_bindings
        if payload.output_bindings is not None:
            row.output_bindings = payload.output_bindings
        if payload.label is not None:
            row.label = payload.label
        session.add(row)
        session.commit()
        return await _build_response(session, engagement_id, stream_type)


@router.delete(
    "/{engagement_id}/{stream_type}/steps/{step_id}",
    response_model=ProcessModelResponse,
)
async def delete_step(
    engagement_id: str, stream_type: str, step_id: str
) -> ProcessModelResponse:
    with get_session() as session:
        row = session.get(ProcessStepRow, step_id)
        if row:
            session.delete(row)
            session.commit()
        return await _build_response(session, engagement_id, stream_type)


@router.post("/{engagement_id}/{stream_type}/globals", response_model=ProcessModelResponse)
async def add_global(
    engagement_id: str, stream_type: str, payload: CreateGlobalRequest
) -> ProcessModelResponse:
    with get_session() as session:
        session.add(
            ProcessGlobalRow(
                id=f"global-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                stream_type=stream_type,
                name=payload.name,
                concept_uri=payload.concept_uri,
                concept_label=payload.concept_label,
                initial_value=payload.initial_value,
            )
        )
        session.commit()
        return await _build_response(session, engagement_id, stream_type)


@router.delete(
    "/{engagement_id}/{stream_type}/globals/{global_id}",
    response_model=ProcessModelResponse,
)
async def delete_global(
    engagement_id: str, stream_type: str, global_id: str
) -> ProcessModelResponse:
    with get_session() as session:
        row = session.get(ProcessGlobalRow, global_id)
        if row:
            session.delete(row)
            session.commit()
        return await _build_response(session, engagement_id, stream_type)


# --- Phase 2: seed the process model from a generated baseline -----------

_BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"


def _parse_baseline_tasks(xml: str) -> list[tuple[str, str]]:
    """Ordered [(task_name, function_unit)] from a baseline BPMN (lanes carry the
    function unit; tasks appear in document order in the process)."""
    root = ET.fromstring(xml)
    process = root.find(f"{{{_BPMN_NS}}}process")
    if process is None:
        return []
    unit_by_node: dict[str, str] = {}
    lane_set = process.find(f"{{{_BPMN_NS}}}laneSet")
    if lane_set is not None:
        for lane in lane_set.findall(f"{{{_BPMN_NS}}}lane"):
            unit = lane.get("name") or "operations"
            for ref in lane.findall(f"{{{_BPMN_NS}}}flowNodeRef"):
                if ref.text:
                    unit_by_node[ref.text] = unit
    tasks: list[tuple[str, str]] = []
    for task in process.findall(f"{{{_BPMN_NS}}}task"):
        name = task.get("name") or task.get("id") or "Step"
        tasks.append((name, unit_by_node.get(task.get("id", ""), "operations")))
    return tasks


@router.post(
    "/{engagement_id}/{stream_type}/seed-from-baseline",
    response_model=ProcessModelResponse,
)
async def seed_from_baseline(
    engagement_id: str, stream_type: str
) -> ProcessModelResponse:
    """Bootstrap the actor-method model for an engagement+stream from its
    generated baseline: each BPMN task → an engagement method (owned by a
    get-or-created actor tagged to the task's function unit) + a step in order.
    Parameters start empty; consultants add typed I/O in workshops. Idempotent:
    a prior seed for this stream (its steps + the engagement methods those steps
    referenced) is cleared first."""
    with get_session() as session:
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
        tasks = _parse_baseline_tasks(bpmn_path.read_text(encoding="utf-8"))

        # Clear a prior seed: steps for this stream + the engagement methods
        # (1:1 with steps) they referenced, and those methods' params.
        old_steps = _steps_for(session, engagement_id, stream_type)
        old_method_ids = [s.method_id for s in old_steps]
        for step in old_steps:
            session.delete(step)
        for mid in old_method_ids:
            method = session.get(MethodRow, mid)
            if method and method.engagement_id == engagement_id:
                for param in session.exec(
                    select(MethodParamRow).where(MethodParamRow.method_id == mid)
                ).all():
                    session.delete(param)
                session.delete(method)
        session.flush()

        # Get-or-create one engagement actor per function unit used.
        existing_actors = session.exec(
            select(ActorRow).where(ActorRow.engagement_id == engagement_id)
        ).all()
        actor_by_unit = {
            a.function_unit: a.id
            for a in existing_actors
            if a.kind == "role" and a.name == f"{a.function_unit} function"
        }
        for _name, unit in tasks:
            if unit not in actor_by_unit:
                actor_id = f"actor-{uuid.uuid4().hex[:8]}"
                session.add(
                    ActorRow(
                        id=actor_id, engagement_id=engagement_id,
                        name=f"{unit} function", kind="role", function_unit=unit,
                        description="Seeded from baseline", created_at=now_iso(),
                    )
                )
                actor_by_unit[unit] = actor_id
        session.flush()

        # Methods (one per task), then steps in order.
        method_ids: list[str] = []
        for name, unit in tasks:
            mid = f"method-{uuid.uuid4().hex[:8]}"
            session.add(
                MethodRow(
                    id=mid, actor_id=actor_by_unit[unit], engagement_id=engagement_id,
                    name=name, description=None, created_at=now_iso(),
                )
            )
            method_ids.append(mid)
        session.flush()
        for seq, (mid, (name, _unit)) in enumerate(zip(method_ids, tasks)):
            session.add(
                ProcessStepRow(
                    id=f"step-{uuid.uuid4().hex[:8]}",
                    engagement_id=engagement_id, stream_type=stream_type,
                    method_id=mid, seq=seq, label=name,
                )
            )
        session.commit()
        return await _build_response(session, engagement_id, stream_type)
