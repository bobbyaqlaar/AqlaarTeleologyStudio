"""Canonical ingestion model shared by all parsers and emitters."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class Framework(str, Enum):
    APQC = "apqc"
    APQC_INDUSTRY = "apqc_industry"
    ETOM = "etom"
    SID = "sid"


class ProcessElement(BaseModel):
    """One node of a process framework hierarchy.

    id is the framework-native hierarchy id (APQC "3.5.2.1", eTOM "1.3.4").
    pcf_id is APQC's stable numeric identifier, None for other frameworks.
    """

    id: str
    framework: Framework
    level: int
    name: str
    pcf_id: str | None = None
    description: str | None = None
    parent_id: str | None = None
    order: int = 0
    function_unit: str | None = None
    industry: str | None = None  # None = cross-industry


class DataEntity(BaseModel):
    """A data concept (e.g. TM Forum SID domain / ABE / entity)."""

    id: str
    framework: Framework
    name: str
    description: str | None = None
    parent_id: str | None = None
    domain: str | None = None


class SubtreeMapping(BaseModel):
    """One framework subtree contributing to a value stream baseline.

    Identified by `prefix` (dotted hierarchy id, APQC) or `root_name`
    (element name, eTOM — duplicates resolved to the richest subtree).
    """

    framework: Framework
    prefix: str | None = None  # hierarchy-id prefix, e.g. "4.2"
    root_name: str | None = None  # e.g. "Customer Order Processing Management"
    function_unit: str  # default; consultant retags in workshops
    max_level: int = 3  # deepest level emitted into the baseline


class StreamMapping(BaseModel):
    stream: str  # o2c | p2p | c2m | h2r | t2r
    label: str
    subtrees: list[SubtreeMapping]
