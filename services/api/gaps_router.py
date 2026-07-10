"""Live LLM gap analysis for process maps.

POST /api/v1/gaps/{engagement}/{stream}/analyze reads the persisted process
state (BPMN XML + element meta) and the engagement's ontology classes, then:

1. always runs deterministic heuristics (missing function tags / systems), and
2. when Anthropic credentials are available, asks Claude to compare the
   customized process against the industry baseline and suggest gaps —
   merged after the heuristics. Any LLM failure degrades to heuristics-only.

Response items match the web app's AiGapSuggestion type.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from db import get_session
from db_models import EngagementRow, ProcessStateRow
from fuseki_client import FusekiClient

router = APIRouter(prefix="/api/v1/gaps", tags=["gaps"])
fuseki = FusekiClient()

VALID_STREAMS = {"o2c", "p2p", "c2m", "h2r", "t2r"}
GAP_MODEL = os.getenv("OTS_GAP_MODEL", "claude-opus-4-8")
# OpenRouter is the exception fallback when the Anthropic call fails (no
# credits, model unavailable, network). "openrouter/auto" routes to whatever
# capable model OpenRouter has live; "openrouter/free" is a zero-cost option.
OPENROUTER_GAP_MODEL = os.getenv("OTS_GAP_FALLBACK_MODEL", "openrouter/auto")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

TASK_TAG_RE = re.compile(r"<bpmn:task\s+([^>]*?)/?>")

GAP_SCHEMA = {
    "type": "object",
    "properties": {
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["warning", "info"]},
                    "elementId": {"type": ["string", "null"]},
                    "elementLabel": {"type": ["string", "null"]},
                    "message": {"type": "string"},
                },
                "required": ["severity", "elementId", "elementLabel", "message"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["suggestions"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You are a business process consultant reviewing a BPMN \
process map that a consultant is customizing with client stakeholders during \
a workshop. The map was seeded from an industry-standard baseline (APQC PCF \
or TM Forum eTOM). Identify gaps concisely and practically:

- steps present in a typical industry process of this kind but missing here
- steps with no owning enterprise system (manual/spreadsheet risk)
- sequencing or hand-off risks between function units
- anything a stakeholder review would likely flag

Rules: at most 6 suggestions, each one sentence, workshop-friendly language. \
Use severity "warning" for likely problems and "info" for observations. Set \
elementId/elementLabel when a suggestion concerns one existing step, else \
null. Do not repeat missing-function-tag issues; those are already flagged \
programmatically."""


class GapSuggestionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    severity: str
    element_id: str | None = Field(default=None, alias="elementId")
    element_label: str | None = Field(default=None, alias="elementLabel")
    message: str


class GapAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    suggestions: list[GapSuggestionModel]
    source: str  # "heuristic" | "heuristic+llm"


def _extract_tasks(bpmn_xml: str) -> list[dict[str, str]]:
    tasks = []
    for match in TASK_TAG_RE.finditer(bpmn_xml):
        attrs = match.group(1)
        id_match = re.search(r'id="([^"]*)"', attrs)
        name_match = re.search(r'name="([^"]*)"', attrs)
        if id_match:
            tasks.append(
                {"id": id_match.group(1), "name": name_match.group(1) if name_match else id_match.group(1)}
            )
    return tasks


def _heuristics(
    tasks: list[dict[str, str]],
    element_meta: dict,
) -> list[GapSuggestionModel]:
    suggestions: list[GapSuggestionModel] = []
    untagged = 0
    unmapped_systems = 0

    for task in tasks:
        meta = element_meta.get(task["id"], {})
        if not meta.get("functionUnit"):
            untagged += 1
            suggestions.append(
                GapSuggestionModel(
                    id=f"gap-missing-fn-{task['id']}",
                    severity="warning",
                    element_id=task["id"],
                    element_label=task["name"],
                    message=f'"{task["name"]}" is missing a function unit tag.',
                )
            )
        if not meta.get("systems"):
            unmapped_systems += 1

    if untagged == 0:
        suggestions.append(
            GapSuggestionModel(
                id="gap-fn-clear",
                severity="info",
                message="All process steps are tagged. Ready for ontology linking.",
            )
        )
    else:
        suggestions.append(
            GapSuggestionModel(
                id="gap-fn-summary",
                severity="info",
                message=f"{untagged} step(s) need function unit tags before stakeholder review.",
            )
        )

    if tasks and unmapped_systems > 0:
        suggestions.append(
            GapSuggestionModel(
                id="gap-systems-summary",
                severity="info",
                message=f"{unmapped_systems} of {len(tasks)} step(s) have no system mapped yet.",
            )
        )

    return suggestions


@lru_cache(maxsize=1)
def _anthropic_client():
    """Anthropic client, or None when the SDK/credentials are unavailable."""
    try:
        import anthropic

        client = anthropic.Anthropic()
        # The zero-arg constructor resolves env vars or an `ant auth` profile;
        # if neither exists it raises here rather than at request time.
        return client
    except Exception:
        return None


def _build_user_prompt(
    stream_type: str,
    industry: str,
    tasks: list[dict[str, str]],
    element_meta: dict,
    ontology_labels: list[str],
) -> str:
    task_lines = []
    for task in tasks:
        meta = element_meta.get(task["id"], {})
        task_lines.append(
            f"- {task['name']} (id={task['id']}, function={meta.get('functionUnit', 'untagged')}, "
            f"systems={', '.join(meta.get('systems', [])) or 'none'})"
        )

    return (
        f"Value stream: {stream_type.upper()} · Industry baseline: {industry}\n\n"
        f"Process steps as customized so far:\n" + "\n".join(task_lines) + "\n\n"
        f"Ontology classes in this engagement's knowledge graph:\n"
        + ", ".join(ontology_labels[:60])
    )


def _parse_suggestions(payload: dict) -> list[GapSuggestionModel]:
    suggestions = []
    for index, item in enumerate(payload.get("suggestions", [])):
        suggestions.append(
            GapSuggestionModel(
                id=f"gap-llm-{index}",
                severity=item.get("severity", "info"),
                element_id=item.get("elementId"),
                element_label=item.get("elementLabel"),
                message=item["message"],
            )
        )
    return suggestions


async def _llm_suggestions(
    stream_type: str,
    industry: str,
    tasks: list[dict[str, str]],
    element_meta: dict,
    ontology_labels: list[str],
) -> list[GapSuggestionModel]:
    client = _anthropic_client()
    if client is None:
        raise RuntimeError("Anthropic credentials unavailable")

    user_prompt = _build_user_prompt(
        stream_type, industry, tasks, element_meta, ontology_labels
    )

    response = client.messages.create(
        model=GAP_MODEL,
        max_tokens=2048,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        output_config={"format": {"type": "json_schema", "schema": GAP_SCHEMA}},
        messages=[{"role": "user", "content": user_prompt}],
    )

    if response.stop_reason == "refusal":
        return []

    text = next((b.text for b in response.content if b.type == "text"), "{}")
    return _parse_suggestions(json.loads(text))


async def _openrouter_suggestions(
    stream_type: str,
    industry: str,
    tasks: list[dict[str, str]],
    element_meta: dict,
    ontology_labels: list[str],
) -> list[GapSuggestionModel]:
    """Exception fallback: same gap analysis via OpenRouter (spec §13).

    Uses the OpenAI-compatible chat endpoint with the auto-router, so no
    response_format is sent (support varies by routed model) — the schema is
    enforced by prompt and the reply parsed leniently.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OpenRouter credentials unavailable")

    system_prompt = (
        SYSTEM_PROMPT
        + "\n\nRespond with ONLY a JSON object matching this schema, no prose, "
        "no markdown fences:\n"
        + json.dumps(GAP_SCHEMA)
    )
    user_prompt = _build_user_prompt(
        stream_type, industry, tasks, element_meta, ontology_labels
    )

    async with httpx.AsyncClient(timeout=90) as http:
        response = await http.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-Title": "OTS Gap Analysis",
            },
            json={
                "model": OPENROUTER_GAP_MODEL,
                "max_tokens": 2048,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
        )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    # Lenient extraction: routed models sometimes wrap JSON in fences/prose.
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("No JSON object in OpenRouter reply")
    return _parse_suggestions(json.loads(text[start : end + 1]))


@router.post("/{engagement_id}/{stream_type}/analyze", response_model=GapAnalysisResponse)
async def analyze(engagement_id: str, stream_type: str) -> GapAnalysisResponse:
    if stream_type not in VALID_STREAMS:
        raise HTTPException(status_code=400, detail="Invalid stream type")

    with get_session() as session:
        engagement = session.get(EngagementRow, engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        state = session.get(ProcessStateRow, (engagement_id, stream_type))
        if not state:
            raise HTTPException(status_code=404, detail="Process state not found")
        industry = engagement.industry
        bpmn_xml = state.bpmn_xml
        element_meta = state.element_meta or {}

    tasks = _extract_tasks(bpmn_xml)
    suggestions = _heuristics(tasks, element_meta)
    source = "heuristic"

    try:
        graph_uri = fuseki.graph_uri(engagement_id, stream_type)
        classes = await fuseki.fetch_graph(graph_uri)
        labels = [item["label"] for item in classes]
    except Exception:
        labels = []

    try:
        llm = await _llm_suggestions(stream_type, industry, tasks, element_meta, labels)
        if llm:
            suggestions.extend(llm)
            source = "heuristic+llm"
    except Exception:
        # Claude unavailable (no credits, model down, no credentials) —
        # retry once via OpenRouter before degrading to heuristics (spec §13).
        try:
            llm = await _openrouter_suggestions(
                stream_type, industry, tasks, element_meta, labels
            )
            if llm:
                suggestions.extend(llm)
                source = "heuristic+llm(openrouter)"
        except Exception:
            pass  # degrade to heuristics-only per spec §13

    return GapAnalysisResponse(suggestions=suggestions, source=source)
