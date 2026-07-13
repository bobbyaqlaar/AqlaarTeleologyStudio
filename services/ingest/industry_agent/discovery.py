"""Discover industry PCF PDFs and derive slugs, profiles, and content hashes."""

from __future__ import annotations

import hashlib
from pathlib import Path

from services.ingest.models import ProcessElement

# Distinctive lowercased filename substring → (slug, label). Telecom is excluded
# (it uses the TM Forum eTOM baselines); NACE corrosion is not an industry PCF.
INDUSTRY_MATCHERS: list[tuple[str, str, str]] = [
    ("consumer products", "consumer_products", "Consumer Products"),
    ("consumer electronics", "consumer_electronics", "Consumer Electronics"),
    ("downstream petroleum", "downstream_petroleum", "Downstream Petroleum"),
    ("upstream petroleum", "upstream_petroleum", "Upstream Petroleum"),
    ("education", "education", "Education"),
    ("healthcare provider", "healthcare_provider", "Healthcare Provider"),
    ("health insurance payor", "health_insurance_payor", "Health Insurance Payor"),
    ("property and casualty", "property_casualty_insurance", "Property & Casualty Insurance"),
    ("life sciences", "life_sciences", "Life Sciences"),
    ("retail", "retail", "Retail"),
    ("utilities", "utilities", "Utilities"),
]

EXCLUDE = ["nace", "telecom"]

# Function-unit library (matches services/api/profiles.py + web).
_BASE_UNITS = [
    "sales",
    "marketing",
    "customer_care",
    "finance",
    "procurement_scm",
    "operations",
    "hr",
    "products",
    "it",
]

_STANDARD_STREAMS = [
    {"type": "o2c", "label": "Order to Cash"},
    {"type": "p2p", "label": "Procure to Pay"},
    {"type": "c2m", "label": "Concept to Market"},
    {"type": "h2r", "label": "Hire to Retire"},
    {"type": "t2r", "label": "Trouble to Resolve"},
]


def discover(industries_dir: Path) -> list[tuple[Path, str, str]]:
    """Return [(pdf_path, slug, label)] for recognised industry PCFs."""
    found: list[tuple[Path, str, str]] = []
    seen_slugs: set[str] = set()
    for pdf in sorted(industries_dir.glob("*.pdf")):
        lower = pdf.name.lower()
        if any(token in lower for token in EXCLUDE):
            continue
        for needle, slug, label in INDUSTRY_MATCHERS:
            if needle in lower and slug not in seen_slugs:
                found.append((pdf, slug, label))
                seen_slugs.add(slug)
                break
    return found


def pdf_hash(pdf_path: Path) -> str:
    """Content hash of a source PDF (drift detection for periodic runs)."""
    digest = hashlib.sha256()
    digest.update(pdf_path.read_bytes())
    return digest.hexdigest()[:16]


def derive_profile(
    label: str, elements: list[ProcessElement]
) -> dict:
    """Function-unit subset + value streams for the industry profile JSON.

    Starts from the base library and adds `production` / `networks` when the
    industry's categories show manufacturing or network/utility processes.
    """
    names = " ".join((e.name or "").lower() for e in elements if e.level <= 2)
    units = list(_BASE_UNITS)
    if any(k in names for k in ("produce", "assemble", "manufactur", "production", "refin")):
        # keep library order: insert production before operations
        units.insert(units.index("operations"), "production")
    if any(k in names for k in ("network", "utility", "grid", "pipeline", "metering")):
        units.append("networks")

    return {
        "label": f"{label} (APQC)",
        "functionUnits": units,
        "valueStreams": list(_STANDARD_STREAMS),
    }
