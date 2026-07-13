"""Read-only endpoints exposing industry profiles to the web app."""

from __future__ import annotations

from fastapi import APIRouter

from profiles import list_profiles, load_profile

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


@router.get("")
def get_profiles() -> dict[str, dict]:
    """All industries with a profile → resolved config."""
    return list_profiles()


@router.get("/{industry}")
def get_profile(industry: str) -> dict:
    """Resolved config for one industry (falls back to the default profile)."""
    return load_profile(industry)
