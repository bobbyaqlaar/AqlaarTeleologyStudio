"""OIDC bearer-token auth (SSO, spec §15).

Enabled by setting OTS_OIDC_ISSUER (e.g. http://localhost:8081/realms/ots —
the docker-compose Keycloak dev realm). Modes via OTS_AUTH_MODE:

- "off"       (default when no issuer): X-OTS-User-* headers / demo actor.
- "optional"  (default with an issuer): a valid Bearer token supplies the
  actor identity; requests without one fall back to headers/demo. Lets the
  web app adopt login incrementally.
- "required"  : mutating endpoints reject requests without a valid token.

Tokens are RS256-verified against the issuer's JWKS (cached by PyJWKClient).
Role comes from the realm roles (consultant/stakeholder).
"""

from __future__ import annotations

import os
from functools import lru_cache

import jwt
from fastapi import HTTPException

OIDC_ISSUER = os.getenv("OTS_OIDC_ISSUER")
AUTH_MODE = os.getenv("OTS_AUTH_MODE", "optional" if OIDC_ISSUER else "off")


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        f"{OIDC_ISSUER}/protocol/openid-connect/certs", cache_keys=True
    )


def decode_bearer(authorization: str) -> dict:
    """Verify a `Bearer <jwt>` header value and return its claims."""
    token = authorization.removeprefix("Bearer ").strip()
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=OIDC_ISSUER,
        # Keycloak's default audience is "account"; we pin identity to the
        # issuer + signature. Tighten with an audience mapper later.
        options={"verify_aud": False},
    )


def claims_to_identity(claims: dict) -> tuple[str, str, str]:
    """(id, name, role) from OIDC claims; realm roles decide the OTS role."""
    roles = claims.get("realm_access", {}).get("roles", [])
    role = "stakeholder" if "stakeholder" in roles else "consultant"
    name = (
        claims.get("name")
        or claims.get("preferred_username")
        or claims.get("sub", "unknown")
    )
    return claims.get("sub", "unknown"), name, role


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )
