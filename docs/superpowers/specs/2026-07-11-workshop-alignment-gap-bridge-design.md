# Workshop Mode + Alignment + Gap-Bridge Agents

**Date:** 2026-07-11  
**Status:** Approved and implemented  
**Builds on:** [2026-06-11-ots-phase1-design.md](./2026-06-11-ots-phase1-design.md)

## Summary

Phase 2 consultant surfaces that guide stakeholders through business processes and ontology, compare current state against teleology, and use AI agents to propose stream-scoped solution options plus cross-stream initiative candidates.

## Decisions

| Topic | Choice |
|-------|--------|
| Workshop audience | Same-screen v1 (consultant presents; no multi-device sync) |
| AI output tiers | Tier 1: stream-scoped solution options (process/ontology/teleology). Tier 2: cross-stream initiative candidates |
| Build order | llm.py refactor → alignment → options agent → initiatives agent → workshop → SSO |
| SSO | Wired last; API OIDC already done |

## Architecture

```
Alignment API (join Postgres + Fuseki)
    ↓
Bridge-gaps agent (per stream) → solution_options table
    ↓
Draft-initiatives agent (engagement) → initiatives table
    ↓
Workshop Mode (consumes alignment + live edits)
```

### Routes

| Route | Purpose |
|-------|---------|
| `/engagements/[id]/alignment` | Heatmap + current vs teleology drill-down + solution options |
| `/engagements/[id]/initiatives` | Cross-stream initiative cards + linkage visual |
| `/engagements/[id]/workshop` | Full-screen presenter (no app shell) |

### API

| Endpoint | Role |
|----------|------|
| `GET /api/v1/alignment/{eng}` | Alignment report with 0–100 scores per function unit |
| `POST /api/v1/agents/{eng}/{stream}/bridge-gaps` | Draft stream-scoped solution options |
| `POST /api/v1/agents/{eng}/draft-initiatives` | Draft cross-stream initiatives (≥2 streams) |
| `GET/POST /api/v1/solutions/{eng}/options` | List + accept/dismiss options |
| `GET/POST /api/v1/solutions/{eng}/initiatives` | List + accept/dismiss initiatives |
| `POST /api/v1/ontology/{eng}/{stream}/goal-links` | `ots:supportsGoal` triples |

### Data model

- `solution_options` — draft → accepted → dismissed; accept appends title to draft teleology ambitions
- `initiatives` — `stream_links` JSONB connects steps/classes across streams

### SSO (web)

OIDC PKCE via Keycloak dev realm; `authHeaders()` sends Bearer token; role switcher falls back when unsigned.

## Workshop flow

Per loaded stream: stream intro → step spotlight (function tag, systems, linked ontology, comments) → ontology overview → teleology goals/gaps/ambitions → wrap-up alignment scores. Parking lot persists as comments.

## Alignment scoring (per function unit)

| Component | Weight |
|-----------|--------|
| Goals & ambitions defined | 20 |
| Process steps mapped | 20 |
| Systems on steps | 20 |
| Ontology coverage | 20 |
| Ontology → goal links | 10 |
| Feedback resolved | 10 |
