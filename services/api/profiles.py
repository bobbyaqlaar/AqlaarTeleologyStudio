"""Industry profiles — per-industry configuration source of truth.

A profile declares the function units and value streams appropriate to an
industry. Function-unit ids are drawn from the fixed library whose colours are
compiled Tailwind tokens in apps/web (a profile selects a subset). Value-stream
`type` is an open string so the industry-standards agent can add new streams.

Profiles live in data/profiles/{industry}.json; `_default.json` is the fallback
merged under every profile. The engagement stores its resolved config so that
evolving standards do not silently mutate existing engagements.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

PROFILES_DIR = Path(
    os.getenv("OTS_PROFILES_DIR", "../../data/profiles")
).resolve()

DEFAULT_INDUSTRY = "generic"

# Fixed function-unit library (must match apps/web function-units.ts + globals.css
# colour tokens and services/ingest/validate.py FUNCTION_UNITS).
FUNCTION_UNIT_LIBRARY = [
    "sales",
    "marketing",
    "customer_care",
    "finance",
    "procurement_scm",
    "production",
    "operations",
    "hr",
    "products",
    "it",
    "networks",
]

_FALLBACK_PROFILE = {
    "label": "Cross-industry",
    "functionUnits": [u for u in FUNCTION_UNIT_LIBRARY if u != "networks"],
    "valueStreams": [
        {"type": "o2c", "label": "Order to Cash"},
        {"type": "p2p", "label": "Procure to Pay"},
        {"type": "c2m", "label": "Concept to Market"},
        {"type": "h2r", "label": "Hire to Retire"},
        {"type": "t2r", "label": "Trouble to Resolve"},
    ],
}


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _default_profile() -> dict:
    return _read(PROFILES_DIR / "_default.json") or dict(_FALLBACK_PROFILE)


def load_profile(industry: str) -> dict:
    """Resolved profile for an industry: {industry}.json merged over _default.json.

    Unknown industries fall back to the default profile (labelled with the slug).
    Function units are filtered to the known library; value streams pass through.
    """
    base = _default_profile()
    specific = _read(PROFILES_DIR / f"{industry}.json") or {}
    merged = {**base, **specific}

    units = [u for u in merged.get("functionUnits", []) if u in FUNCTION_UNIT_LIBRARY]
    if not units:
        units = list(base.get("functionUnits", []))

    streams = merged.get("valueStreams") or base.get("valueStreams", [])
    normalised_streams = [
        {"type": s["type"], "label": s.get("label", s["type"].upper())}
        for s in streams
        if isinstance(s, dict) and s.get("type")
    ]

    label = merged.get("label") or industry.replace("_", " ").title()
    return {
        "industry": industry,
        "label": label,
        "functionUnits": units,
        "valueStreams": normalised_streams,
    }


def list_profiles() -> dict[str, dict]:
    """All industries with a profile JSON (excluding _default), resolved."""
    result: dict[str, dict] = {}
    if not PROFILES_DIR.exists():
        return {DEFAULT_INDUSTRY: load_profile(DEFAULT_INDUSTRY)}
    for path in sorted(PROFILES_DIR.glob("*.json")):
        if path.stem.startswith("_"):
            continue
        result[path.stem] = load_profile(path.stem)
    if DEFAULT_INDUSTRY not in result:
        result[DEFAULT_INDUSTRY] = load_profile(DEFAULT_INDUSTRY)
    return result


def stream_types_for(industry: str) -> list[str]:
    """Value-stream `type` list for an industry (used to seed engagement streams)."""
    return [s["type"] for s in load_profile(industry)["valueStreams"]]
