"""Shared LLM JSON generation: Claude primary, OpenRouter exception fallback.

Same resilience pattern proven in gaps_router (which predates this module):
claude-opus-4-8 with adaptive thinking + JSON-schema output when Anthropic
credentials work; any failure retries once through OpenRouter's
OpenAI-compatible endpoint with prompt-enforced JSON and lenient parsing.
Raises LlmUnavailable when both paths fail so callers can surface it.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache

import httpx

GAP_MODEL = os.getenv("OTS_GAP_MODEL", "claude-opus-4-8")
OPENROUTER_MODEL = os.getenv("OTS_GAP_FALLBACK_MODEL", "openrouter/auto")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class LlmUnavailable(Exception):
    """Neither Claude nor the OpenRouter fallback produced a result."""


@lru_cache(maxsize=1)
def _anthropic_client():
    try:
        import anthropic

        return anthropic.Anthropic()
    except Exception:
        return None


def _claude_json(system: str, user: str, schema: dict, max_tokens: int) -> dict:
    client = _anthropic_client()
    if client is None:
        raise RuntimeError("Anthropic credentials unavailable")
    response = client.messages.create(
        model=GAP_MODEL,
        max_tokens=max_tokens,
        thinking={"type": "adaptive"},
        system=system,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": user}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude refused the request")
    text = next((b.text for b in response.content if b.type == "text"), "{}")
    return json.loads(text)


async def _openrouter_json(
    system: str, user: str, schema: dict, max_tokens: int
) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OpenRouter credentials unavailable")
    system_prompt = (
        system
        + "\n\nRespond with ONLY a JSON object matching this schema, no prose, "
        "no markdown fences:\n"
        + json.dumps(schema)
    )
    async with httpx.AsyncClient(timeout=120) as http:
        response = await http.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-Title": "OTS Drafting Agent",
            },
            json={
                "model": OPENROUTER_MODEL,
                "max_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user},
                ],
            },
        )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("No JSON object in OpenRouter reply")
    return json.loads(text[start : end + 1])


async def generate_json(
    system: str, user: str, schema: dict, max_tokens: int = 4096
) -> tuple[dict, str]:
    """Returns (payload, source) where source is 'claude' or 'openrouter'."""
    try:
        return _claude_json(system, user, schema, max_tokens), "claude"
    except Exception:
        try:
            return await _openrouter_json(system, user, schema, max_tokens), "openrouter"
        except Exception as exc:
            raise LlmUnavailable(str(exc)) from exc
