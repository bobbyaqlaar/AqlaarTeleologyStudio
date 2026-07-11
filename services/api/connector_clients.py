"""Live Salesforce + Jira clients for the connector import preview.

Credentials come from the environment (root .env is loaded by main.py):

- Jira Cloud:   OTS_JIRA_EMAIL + OTS_JIRA_API_TOKEN (basic auth)
- Salesforce:   OTS_SF_CLIENT_ID + OTS_SF_CLIENT_SECRET
                (OAuth 2.0 client-credentials flow on the instance URL)

Each client validates credentials on connect and fetches live sample values
for the engagement's mapped source fields during preview. Failures raise
ConnectorError with a workshop-friendly message; the router surfaces them
as the preview `error` field (mirroring the mock contract).
"""

from __future__ import annotations

import os

import httpx

SF_API_VERSION = "v61.0"
TIMEOUT = 20.0


class ConnectorError(Exception):
    """Connector call failed — message is safe to show in the UI."""


def configured(connector_type: str) -> bool:
    if connector_type == "jira":
        return bool(os.getenv("OTS_JIRA_EMAIL") and os.getenv("OTS_JIRA_API_TOKEN"))
    if connector_type == "salesforce":
        return bool(
            os.getenv("OTS_SF_CLIENT_ID") and os.getenv("OTS_SF_CLIENT_SECRET")
        )
    return False


def missing_credentials_hint(connector_type: str) -> str:
    envs = {
        "jira": "OTS_JIRA_EMAIL and OTS_JIRA_API_TOKEN",
        "salesforce": "OTS_SF_CLIENT_ID and OTS_SF_CLIENT_SECRET",
    }[connector_type]
    return f"Connector not configured on the server — set {envs} in the API environment."


# ---------------------------------------------------------------------------
# Jira Cloud


def _jira_auth() -> tuple[str, str]:
    return (os.environ["OTS_JIRA_EMAIL"], os.environ["OTS_JIRA_API_TOKEN"])


async def jira_validate(instance_url: str) -> None:
    """Check credentials against the instance; raises ConnectorError."""
    url = f"{instance_url.rstrip('/')}/rest/api/3/myself"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(url, auth=_jira_auth())
    except httpx.HTTPError as exc:
        raise ConnectorError(f"Jira unreachable at {instance_url}: {exc}") from exc
    if response.status_code == 200:
        return
    if response.status_code in (401, 403):
        raise ConnectorError("Jira rejected the credentials (check email/API token).")
    raise ConnectorError(f"Jira returned HTTP {response.status_code} for {url}.")


def _jira_extract(source_field: str, issues: list[dict]) -> str | None:
    """Resolve e.g. 'Priority.name' against the most recent issue that has it."""
    head, _, tail = source_field.partition(".")
    key = head.lower()  # IssueType -> issuetype, Priority -> priority, ...
    for issue in issues:
        fields = issue.get("fields", {})
        value = fields.get(key)
        if key == "customfield":
            value = next(
                (v for k, v in fields.items() if k.startswith("customfield_") and v),
                None,
            )
        if isinstance(value, dict):
            value = value.get(tail or "name")
        if value not in (None, ""):
            return str(value)
    return None


async def jira_fetch_samples(
    instance_url: str, source_fields: list[str]
) -> dict[str, str | None]:
    """Live sample value per source field from the latest issues."""
    url = f"{instance_url.rstrip('/')}/rest/api/3/search/jql"
    params = {
        "jql": "ORDER BY updated DESC",
        "maxResults": "10",
        "fields": "issuetype,priority,status,resolution,summary,*all",
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(url, params=params, auth=_jira_auth())
    except httpx.HTTPError as exc:
        raise ConnectorError(f"Jira unreachable: {exc}") from exc
    if response.status_code != 200:
        raise ConnectorError(
            f"Jira issue search failed (HTTP {response.status_code})."
        )
    issues = response.json().get("issues", [])
    return {field: _jira_extract(field, issues) for field in source_fields}


# ---------------------------------------------------------------------------
# Salesforce


async def _sf_token(instance_url: str) -> str:
    url = f"{instance_url.rstrip('/')}/services/oauth2/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": os.environ["OTS_SF_CLIENT_ID"],
        "client_secret": os.environ["OTS_SF_CLIENT_SECRET"],
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(url, data=data)
    except httpx.HTTPError as exc:
        raise ConnectorError(
            f"Salesforce unreachable at {instance_url}: {exc}"
        ) from exc
    if response.status_code != 200:
        detail = response.json().get("error_description", response.text[:120])
        raise ConnectorError(f"Salesforce auth failed: {detail}")
    return response.json()["access_token"]


async def salesforce_validate(instance_url: str) -> None:
    await _sf_token(instance_url)


async def salesforce_fetch_samples(
    instance_url: str, source_fields: list[str]
) -> dict[str, str | None]:
    """One SOQL query per source object; missing objects/fields → None
    (surfaces as 'unmapped' in the preview, matching real-org variance)."""
    token = await _sf_token(instance_url)
    base = instance_url.rstrip("/")
    samples: dict[str, str | None] = {}

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for source_field in source_fields:
            obj, _, field = source_field.partition(".")
            if not field:
                samples[source_field] = None
                continue
            soql = f"SELECT {field} FROM {obj} ORDER BY LastModifiedDate DESC LIMIT 5"
            response = await client.get(
                f"{base}/services/data/{SF_API_VERSION}/query",
                params={"q": soql},
                headers={"Authorization": f"Bearer {token}"},
            )
            if response.status_code != 200:
                samples[source_field] = None  # object/field absent in this org
                continue
            records = response.json().get("records", [])
            samples[source_field] = next(
                (
                    str(record[field])
                    for record in records
                    if record.get(field) not in (None, "")
                ),
                None,
            )
    return samples


VALIDATORS = {"jira": jira_validate, "salesforce": salesforce_validate}
SAMPLERS = {"jira": jira_fetch_samples, "salesforce": salesforce_fetch_samples}
