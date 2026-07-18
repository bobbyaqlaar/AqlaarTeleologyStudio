# Ontology-Teleology Studio — Product Archive

**Purpose:** Completed product-backlog items (historical record).  
**Open work lives in:** [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md)

**Governance:** When a backlog item is completed, **move it from PRODUCT_BACKLOG.md into this file** (with completion date and short evidence note). Do not keep done items in the open backlog.

---

## How to read this archive

Each entry: **ID · Title · Completed · Evidence / notes**.

Detailed session notes remain in [TODO-implementation-plan.md](./TODO-implementation-plan.md) (legacy tracker).

---

## Phase 0 — Repo hygiene

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| P0.1 | Extended `.gitignore`, branch `main`, initial commit | 2026-07-08 | `bc74a87` |

---

## Phase 1 — Ingestion & semantic baselines

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| P1.1 | Ingest scaffold (`services/ingest/`) | 2026-07-08 | parsers, emitters, CLI |
| P1.2 | APQC xlsx + PDF parsers; MODA crawl/parser | 2026-07-08 | eTOM 3198 / SID 5124 |
| P1.3 | Stream mapping YAML; TTL / SKOS / BPMN emitters | 2026-07-08 | generic + telecom |
| P1.4 | Basic validate (labels, functionUnit, precedes) | 2026-07-08 | SHACL shapes still open → backlog |
| P1.5 | Telecom baselines from eTOM; APQC↔eTOM alignment emit | 2026-07-08 | 13 candidates still need human review → backlog |
| P1.6 | `hr` function unit across web/ingest | 2026-07-08 | Bobby-approved |

---

## Phase 2 — API semantic layer & workshop UI

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| P2.1 | Baselines by industry; thesaurus search; concept mapping | 2026-07-08 | Fuseki graphs |
| P2.2 | Industry picker, system mapping, thesaurus panel, API BPMN | 2026-07-08 | Phase 3 workshop features in plan naming |
| P2.3 | Systems coverage matrix | 2026-07-09 | `5416eef` |

---

## Phase 4 — Persistence, LLM, governance

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| P4.1 | Postgres core (engagements, streams, process) | 2026-07-09 | host :5434 |
| P4.2 | Comments + teleology in Postgres; live review queue | 2026-07-09 | `3d60321` |
| P4.3 | Alembic migrations | 2026-07-10 | stamp + upgrade |
| P4.4 | Live LLM gap analysis + OpenRouter path | 2026-07-09/10 | later: OpenRouter **primary** |
| P4.5 | Audit trail + CSV | 2026-07-10 | |
| P4.6 | Watermarked PDF export (API) | 2026-07-10 | |
| P4.7 | Playwright consultant-flow E2E | 2026-07-10 | extended 2026-07-12 |
| P4.8 | API OIDC + Keycloak realm | 2026-07-10 | |
| P4.9 | Web SSO PKCE + token proxy | 2026-07-11/12 | `/api/auth/token` |
| P4.10 | Engagement delete + E2E teardown | 2026-07-12 | |
| P4.11 | PDF + audit UI | 2026-07-12 | `41d05a7` |
| P4.12 | Real Salesforce/Jira connectors (API + Postgres) | 2026-07-11 | `fd6f425` |
| P4.13 | Connectors web API-only (remove mock store) | 2026-07-12 | |

---

## Phase 2 (product) — Alignment, agents, workshop

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| A.1 | Shared `llm.py`; gaps_router refactor | 2026-07-11 | |
| A.2 | Alignment API + heatmap UI | 2026-07-11 | |
| A.3 | Goal links (`ots:supportsGoal`) | 2026-07-11 | |
| A.4 | Gap-bridge agent + solution options | 2026-07-11 | |
| A.5 | Draft initiatives (≥2 streams) | 2026-07-11 | |
| A.6 | Workshop mode presenter | 2026-07-11 | |
| A.7 | Draft teleology / process tags / ontology links | 2026-07-11/12 | draft-then-verify |
| A.8 | Agent event triggers (baseline + ontology ready) | 2026-07-12 | 60s debounce + banners |
| A.9 | OpenRouter as primary LLM route | 2026-07-12 | Claude fallback |
| A.10 | E2E: alignment → bridge → initiatives → workshop + SSO | 2026-07-12 | `demo-script.spec.ts` |
| A.11 | Guided journey / progress stepper fix | 2026-07-11 | `98dc3f8` |

---

## Multi-industry genericity (P1 objective)

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| MI.1 | Emit from industry PDF caches; retail/utilities baselines | 2026-07-13 | fixed `apqc.ttl` eTOM pollution |
| MI.2 | Industry-standards agent (`ots-industry-agent`) | 2026-07-13 | 13 industries; manifest drift check |
| MI.3 | Catalog-driven web industry list | 2026-07-13 | `listBaselines()` |
| MI.4 | Per-engagement config from industry profiles | 2026-07-13 | Alembic `c4e7a1b9d2f0` |
| MI.5 | Dev server default port 3001 | 2026-07-14 | avoid AgenticFramework :3000 |

---

## Actor–Method process model

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| AM.1 | Design spec approved | 2026-07-13 | `2026-07-13-actor-method-process-model-design.md` |
| AM.2 | Phase 1 backend (tables, validate, BPMN gen) | 2026-07-13 | Alembic `d5f8b2a1c3e4` |
| AM.3 | Phase 2 seed-from-baseline | 2026-07-13 | |
| AM.4 | Phase 3 workshop UI + severity + apply-fix + input bind | 2026-07-13–15 | process-model workspace |

---

## Documentation (prior pack)

| ID | Item | Completed | Notes |
|----|------|-----------|-------|
| D.1 | Specs / user manual / DemoScript (initial) | 2026-07-12 | superseded by formal set 2026-07-18 |
| D.2 | Docs refresh for 13 industries + agents | 2026-07-15 | |

---

## Explicitly closed / superseded

| Former backlog note | Resolution |
|---------------------|------------|
| “Connectors state mock-only” | Superseded — API Postgres connectors + web API-only |
| “Anthropic credits required for LLM” | Superseded — OpenRouter primary |
| “Agent triggers button-only” | Superseded — event triggers shipped (scheduling still open → backlog) |
