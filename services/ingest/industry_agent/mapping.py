"""Propose a value-stream → PCF-subtree mapping for an industry.

The industry PCFs vary in top-level numbering, so this proposes a *draft*
mapping by keyword-matching each stream's buckets against the industry's own
level-1/level-2 category names. Output mirrors the hand-written
mapping/streams_{industry}.yaml files (framework/prefix/function_unit/max_level)
and is meant to be reviewed by a consultant. An optional LLM refinement pass can
sharpen it when credentials are available; heuristics are the always-on default.
"""

from __future__ import annotations

from services.ingest.models import ProcessElement

# (stream, function_unit, [keyword substrings]) — matched against lowercased
# category names at level 1 and 2. Ordering within a stream is preserved.
STREAM_RULES: list[tuple[str, str, list[str]]] = [
    ("o2c", "sales", ["operate direct channel", "manage sales order", "sales plan", "sell products", "market and sell", "sales strategy"]),
    ("o2c", "operations", ["logistics", "warehous", "fulfil", "transportation", "distribut", "deliver product", "deliver physical", "metering"]),
    ("o2c", "finance", ["revenue accounting"]),
    ("p2p", "procurement_scm", ["procure", "source product", "sourcing", "supplier", "supply chain resource"]),
    ("p2p", "finance", ["accounts payable"]),
    ("c2m", "products", ["develop product", "product development", "define new product", "product plan", "generate and define", "manage product development lifecycle", "product portfolio", "product specification"]),
    ("c2m", "marketing", ["develop and manage marketing", "market to customer", "marketing plan", "marketing campaign", "marketing strategy"]),
    ("h2r", "hr", ["recruit", "on-board", "on board", "onboard", "reward and retain", "redeploy and retire", "employee on"]),
    ("h2r", "finance", ["payroll"]),
    ("t2r", "customer_care", ["plan and manage customer service", "customer service contact", "service products after sales", "deliver service to customer", "manage customer relationship", "problem management", "after sales", "evaluate customer service", "customer qos"]),
    ("t2r", "operations", ["operate utility", "operate major utility", "operate network", "network and pipeline", "resource trouble"]),
]

STREAM_LABELS = {
    "o2c": "Order to Cash",
    "p2p": "Procure to Pay",
    "c2m": "Concept to Market",
    "h2r": "Hire to Retire",
    "t2r": "Trouble to Resolve",
}

STREAM_ORDER = ["o2c", "p2p", "c2m", "h2r", "t2r"]


def _to_prefix(hierarchy_id: str) -> str:
    """Prefix that selects a category's whole subtree.

    A level-1 category id is "N.0" but its children are "N.1"/"N.2" (which do not
    start with "N.0."), so the selecting prefix must be the bare "N". Level-2+ ids
    are used as-is.
    """
    return hierarchy_id[:-2] if hierarchy_id.endswith(".0") else hierarchy_id


def _prune_descendants(ids: list[str]) -> list[str]:
    """Drop any id whose ancestor is already selected (keep the shallowest)."""
    kept: list[str] = []
    for candidate in ids:
        if any(
            candidate != other and candidate.startswith(other + ".")
            for other in ids
        ):
            continue
        if candidate not in kept:
            kept.append(candidate)
    return kept


def propose_streams(elements: list[ProcessElement]) -> dict[str, dict]:
    """Return {stream: {label, subtrees:[{framework,prefix,function_unit,max_level}]}}."""
    # Candidate categories: level 1 and 2, with lowercased names for matching.
    categories = [
        (e.id, (e.name or "").lower(), e.level)
        for e in elements
        if e.level in (1, 2)
    ]

    result: dict[str, dict] = {
        s: {"label": STREAM_LABELS[s], "subtrees": []} for s in STREAM_ORDER
    }

    for stream, function_unit, keywords in STREAM_RULES:
        matched = [
            _to_prefix(cid)
            for (cid, name, _level) in categories
            if any(kw in name for kw in keywords)
        ]
        for prefix in _prune_descendants(matched):
            result[stream]["subtrees"].append(
                {
                    "framework": "apqc",
                    "prefix": prefix,
                    "function_unit": function_unit,
                    "max_level": 3,
                }
            )

    return result
