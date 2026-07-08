from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class InitializeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    graph_uri: str = Field(alias="graphUri")
    initialized: bool
    triple_count: int = Field(alias="tripleCount")


class OwlClassModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    uri: str
    label: str
    function_unit: str | None = Field(default=None, alias="functionUnit")
    linked_bpmn_elements: list[str] = Field(default_factory=list, alias="linkedBpmnElements")
    mapped_concepts: list[str] = Field(default_factory=list, alias="mappedConcepts")


class OntologyEdgeModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    source: str
    target: str
    label: str
    edge_type: str = Field(alias="edgeType")


class OntologyGraphResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    graph_uri: str = Field(alias="graphUri")
    classes: list[OwlClassModel]
    edges: list[OntologyEdgeModel]


class UpdateClassRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    uri: str
    label: str | None = None
    function_unit: str | None = Field(default=None, alias="functionUnit")


class LinkRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    class_uri: str = Field(alias="classUri")
    bpmn_element_id: str = Field(alias="bpmnElementId")


class UnlinkRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    class_uri: str = Field(alias="classUri")
    bpmn_element_id: str = Field(alias="bpmnElementId")


class BaselineCatalogResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    industries: dict[str, list[str]]
    thesauri: list[str]


class ThesaurusConceptModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    uri: str
    label: str
    notation: str | None = None
    definition: str | None = None
    broader_uri: str | None = Field(default=None, alias="broaderUri")


class ConceptMappingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    class_uri: str = Field(alias="classUri")
    concept_uri: str = Field(alias="conceptUri")


class HealthResponse(BaseModel):
    status: str
    fuseki: bool
