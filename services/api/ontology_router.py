from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from fuseki_client import DEFAULT_INDUSTRY, FusekiClient, FusekiError, VALID_STREAMS
from models import (
    BaselineCatalogResponse,
    ConceptMappingRequest,
    InitializeResponse,
    LinkRequest,
    OntologyEdgeModel,
    OntologyGraphResponse,
    OwlClassModel,
    ThesaurusConceptModel,
    UnlinkRequest,
    UpdateClassRequest,
)

router = APIRouter(prefix="/api/v1/ontology", tags=["ontology"])
fuseki = FusekiClient()


@router.get("/baselines", response_model=BaselineCatalogResponse)
async def list_baselines() -> BaselineCatalogResponse:
    return BaselineCatalogResponse(
        industries=fuseki.list_baselines(),
        thesauri=fuseki.list_thesauri(),
    )


@router.get("/baselines/{industry}/{stream_type}/bpmn")
async def get_baseline_bpmn(industry: str, stream_type: str) -> Response:
    """Serve the generated BPMN 2.0 XML for an industry baseline."""
    _validate_stream(stream_type)
    bpmn_path = fuseki.baseline_path(stream_type, industry).with_suffix(".bpmn")
    if not bpmn_path.exists():
        raise HTTPException(status_code=404, detail=f"Baseline BPMN not found: {bpmn_path.name}")
    return Response(content=bpmn_path.read_text(encoding="utf-8"), media_type="application/xml")


@router.get("/thesaurus/{framework}/search", response_model=list[ThesaurusConceptModel])
async def search_thesaurus(
    framework: str,
    q: str = Query(min_length=2),
    limit: int = Query(default=25, le=100),
) -> list[ThesaurusConceptModel]:
    try:
        await fuseki.ensure_dataset()
        concepts = await fuseki.search_thesaurus(framework, q, limit)
        return [ThesaurusConceptModel(**item) for item in concepts]
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/{engagement_id}/{stream_type}/initialize", response_model=InitializeResponse)
async def initialize_graph(
    engagement_id: str,
    stream_type: str,
    force: bool = Query(default=False),
    industry: str = Query(default=DEFAULT_INDUSTRY),
) -> InitializeResponse:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.ensure_dataset()
        count = await fuseki.graph_triple_count(graph_uri)
        initialized = False

        if force:
            await fuseki.reload_baseline(graph_uri, stream_type, industry)
            initialized = True
            count = await fuseki.graph_triple_count(graph_uri)
        elif count == 0:
            await fuseki.load_baseline(graph_uri, stream_type, industry)
            initialized = True
            count = await fuseki.graph_triple_count(graph_uri)

        return InitializeResponse(
            graph_uri=graph_uri,
            initialized=initialized,
            triple_count=count,
        )
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


async def _load_ontology_payload(
    graph_uri: str,
    stream_type: str,
) -> dict[str, object]:
    count = await fuseki.graph_triple_count(graph_uri)
    if count == 0:
        await fuseki.load_baseline(graph_uri, stream_type)

    payload = await fuseki.fetch_ontology(graph_uri)
    if len(payload["edges"]) == 0 and len(payload["classes"]) > 0:
        await fuseki.reload_baseline(graph_uri, stream_type)
        payload = await fuseki.fetch_ontology(graph_uri)

    return payload


@router.get("/{engagement_id}/{stream_type}", response_model=OntologyGraphResponse)
async def get_graph(engagement_id: str, stream_type: str) -> OntologyGraphResponse:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.ensure_dataset()
        payload = await _load_ontology_payload(graph_uri, stream_type)
        return OntologyGraphResponse(
            graphUri=graph_uri,
            classes=[OwlClassModel(**item) for item in payload["classes"]],
            edges=[OntologyEdgeModel(**item) for item in payload["edges"]],
        )
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.patch("/{engagement_id}/{stream_type}/classes", response_model=OwlClassModel)
async def update_class(
    engagement_id: str,
    stream_type: str,
    payload: UpdateClassRequest,
) -> OwlClassModel:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.update_class(
            graph_uri,
            payload.uri,
            payload.label,
            payload.function_unit,
        )
        classes = await fuseki.fetch_graph(graph_uri)
        match = next((item for item in classes if item["uri"] == payload.uri), None)
        if not match:
            raise HTTPException(status_code=404, detail="Class not found after update")
        return OwlClassModel(**match)
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/{engagement_id}/{stream_type}/links", response_model=OwlClassModel)
async def create_link(
    engagement_id: str,
    stream_type: str,
    payload: LinkRequest,
) -> OwlClassModel:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.set_link(graph_uri, payload.class_uri, payload.bpmn_element_id)
        classes = await fuseki.fetch_graph(graph_uri)
        match = next((item for item in classes if item["uri"] == payload.class_uri), None)
        if not match:
            raise HTTPException(status_code=404, detail="Class not found after link")
        return OwlClassModel(**match)
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/{engagement_id}/{stream_type}/links/unlink", response_model=OwlClassModel)
async def unlink(
    engagement_id: str,
    stream_type: str,
    payload: UnlinkRequest,
) -> OwlClassModel:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.remove_class_link(
            graph_uri,
            payload.class_uri,
            payload.bpmn_element_id,
        )
        classes = await fuseki.fetch_graph(graph_uri)
        match = next((item for item in classes if item["uri"] == payload.class_uri), None)
        if not match:
            raise HTTPException(status_code=404, detail="Class not found after unlink")
        return OwlClassModel(**match)
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/{engagement_id}/{stream_type}/concept-mapping", response_model=OwlClassModel)
async def map_concept(
    engagement_id: str,
    stream_type: str,
    payload: ConceptMappingRequest,
) -> OwlClassModel:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.set_concept_mapping(graph_uri, payload.class_uri, payload.concept_uri)
        return await _class_or_404(graph_uri, payload.class_uri)
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/{engagement_id}/{stream_type}/concept-mapping/remove", response_model=OwlClassModel)
async def unmap_concept(
    engagement_id: str,
    stream_type: str,
    payload: ConceptMappingRequest,
) -> OwlClassModel:
    _validate_stream(stream_type)
    graph_uri = fuseki.graph_uri(engagement_id, stream_type)

    try:
        await fuseki.remove_concept_mapping(graph_uri, payload.class_uri, payload.concept_uri)
        return await _class_or_404(graph_uri, payload.class_uri)
    except FusekiError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


async def _class_or_404(graph_uri: str, class_uri: str) -> OwlClassModel:
    classes = await fuseki.fetch_graph(graph_uri)
    match = next((item for item in classes if item["uri"] == class_uri), None)
    if not match:
        raise HTTPException(status_code=404, detail="Class not found")
    return OwlClassModel(**match)


def _validate_stream(stream_type: str) -> None:
    if stream_type not in VALID_STREAMS:
        raise HTTPException(status_code=400, detail="Invalid stream type")
