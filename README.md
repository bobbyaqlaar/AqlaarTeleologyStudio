# Ontology-Teleology Studio (OTS)

Consultant platform for enterprise digital transformation: manage OWL ontologies, BPMN process maps, and teleology/goal alignment across value streams and enterprise function units.

---

## Vision

OTS holds industry-standard process and ontology baselines, supports enterprise customization through system integration and stakeholder workshops, and drives an iterative pipeline from current-state artefacts to AI initiative candidates aligned with organizational ambitions.

**Phase 2** adds autonomous agents that connect to enterprise systems to draft artefacts; workshops shift to verification-only sessions.

---

## Phase 1 — Current Build (v1)

**Status (2026-07-09):** UI iterations **A–E complete**, plus: ingestion agent (APQC PCF v8 + TM Forum eTOM/SID → TTL/SKOS/BPMN baselines, generic + telecom), **Postgres persistence** (engagements, streams, process state, comments, teleology), thesaurus concept mapping, step→system tagging with coverage matrix, live LLM gap analysis (needs Anthropic credits). Remaining: Alembic, audit trail, PDF export, real connectors, SSO, Playwright E2E — see [docs/TODO-implementation-plan.md](docs/TODO-implementation-plan.md).

Services are fetch-first against FastAPI/Postgres/Fuseki with in-memory mock fallback, so `npm run dev` alone still works for UI-only exploration.

### Streams vs processes

| | **Streams** (Step 1) | **Process** (Step 2) |
|---|---|---|
| **Level** | End-to-end value journey (O2C, P2P, C2M, H2R, T2R) | BPMN map inside a stream — tasks, approvals, handoffs |
| **Consultant** | Pick streams; **load generic baseline** | **Customize** flow; tag each step with a function unit |
| **Question answered** | *Which journeys matter for this client?* | *How does work actually happen?* |

**Streams = which journeys. Process = what happens inside each journey.** Load baselines first; customize in workshops second.

```
Engagement → Value stream (e.g. O2C) → Process (BPMN) + Ontology (OWL) + Teleology
```

### Consultant workflow (5 steps)

The app stepper follows this sequence. You edit; stakeholders comment and approve in Review.

| Step | Where in app | What you do |
|------|----------------|-------------|
| **0** | Engagements | Create engagement for client |
| **1 — Streams** | Value streams | Load baseline per O2C / P2P / C2M / H2R / T2R |
| **2 — Process** | Process (BPMN) | Customize maps; tag function units; use AI gap hints |
| **3 — Ontology** | Ontology (OWL) | Graph + class editor; link classes to process steps |
| **4 — Teleology** | Teleology | Capture goals, gaps, ambitions vs revenue / cost / CX / TTM |
| **5 — Review** | Review | Stakeholders approve; you resolve feedback |

**Connectors** (optional): Salesforce / Jira import preview to pre-fill templates before or during workshops — see `/engagements/[id]/connectors`.

Detailed guide: [Design spec §2–3](docs/superpowers/specs/2026-06-11-ots-phase1-design.md#2-streams-vs-processes)

### Roles

| Role | Permissions |
|------|-------------|
| Consultant | Edit BPMN, OWL, teleology; run connectors; submit for review; resolve feedback |
| Stakeholder | Comment and approve/reject within assigned function unit scope |

Dev role switcher in the header toggles consultant vs stakeholder (with function-unit scope).

### Enterprise function units

Every BPMN step is tagged with one function:

Sales · Marketing · Customer care/experience · Finance · Procurement/SCM · Production · Operations · Human Resources · Products · IT · Networks

### Value streams (generic baseline)

Order to Cash (O2C) · Procure to Pay (P2P) · Concept to Market (C2M) · Hire to Retire (H2R) · Trouble to Resolve (T2R)

Vertical industry ontologies (TM Forum SID/eTOM, BIAN, Microsoft CDM) and the standards crawl agent are deferred to post-v1.

---

## UI build order

| Iter | Focus | Backend | Status |
|------|-------|---------|--------|
| A | Engagement shell, stream picker, baseline load | Mock | ✅ |
| B | BPMN editor, function tags, comments, AI gap drawer | Mock | ✅ |
| C | OWL graph viewer, class editor, BPMN links | **Fuseki + FastAPI** | ✅ |
| D | Teleology matrix + function drill-down | Mock | ✅ |
| E | Connectors + Review approval queue | Mock | ✅ |

**After E (done):** Postgres core, live LLM gap analysis, ingestion agent, industry baselines, thesaurus mapping, system tagging + coverage matrix. **Still open:** audit trail, Alembic, PDF export, real Salesforce/Jira APIs, SSO, Playwright E2E.

### What ships in each iteration

| Iter | Routes / features |
|------|-------------------|
| **A** | App shell (dark/light, collapsible sidebar, stepper, breadcrumbs, role switcher), engagement CRUD, stream baseline load |
| **B** | `bpmn-js` editor, function tagging, stakeholder comment thread, debounced AI gap drawer, stream tabs |
| **C** | React Flow OWL graph (`subClassOf` + `precedes` edges), class tree/editor, BPMN link panel, Fuseki SPARQL |
| **D** | Teleology matrix table, row editor, org themes (revenue/cost/CX/TTM), function drill-down rows, submit/approve |
| **E** | Salesforce + Jira connector cards, field map, import preview/apply (mock); Review queue (streams, teleology, BPMN feedback) |

### UX standards

Data-dense professional SaaS (Datadog/Palantir-inspired):

- **Dark default** + light toggle; enterprise **blue** accent on zinc surfaces
- **Geist Sans + Geist Mono**; balanced density; soft 8px radius cards
- Collapsible sidebar; icon + **Ontology-Teleology Studio** wordmark in header
- Horizontal **numbered stepper** (1–5); breadcrumbs; one primary CTA per screen
- **11 function-unit colors** with fixed legend on BPMN views
- Role-aware views; status badges (`Draft` · `In review` · `Approved` · `Rejected`)

Full spec: [`docs/superpowers/specs/2026-06-11-ots-phase1-design.md`](docs/superpowers/specs/2026-06-11-ots-phase1-design.md)

---

## Architecture

```
Next.js (apps/web)  →  FastAPI (services/api)  →  Fuseki (OWL/RDF)
        │                     │
        │                     └──  Postgres (engagements, streams, process
        │                          state, comments, teleology) + Claude API
        │                          (gap analysis)
        └── mock fallbacks (used when the API is offline; connectors still mock-only)

services/ingest (uv)  →  ReferenceDocs (APQC xlsx/PDF, TM Forum MODA crawl)
                          → data/baselines/{industry}/{stream}.{ttl,bpmn}
                          → data/thesaurus/{apqc,etom,sid,alignments}.ttl
```

- **Frontend:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind, shadcn/ui (base-ui), Geist fonts
- **OWL graph UI:** `@xyflow/react` + dagre layout for class nodes and relationship edges
- **API:** FastAPI sidecar for SPARQL, graph init, class CRUD, BPMN↔OWL links
- **Semantic store:** Apache Jena Fuseki 5.1 (named graph per engagement stream)
- **Baselines:** `data/baselines/{industry}/{stream}.ttl` + `.bpmn` — generated by `uv run ots-ingest` from APQC PCF v8 (generic) and TM Forum eTOM (telecom), with provenance, `ots:precedes` flow edges, and function-unit tags
- **Auth (dev):** Role switcher (consultant/stakeholder); SSO before production

### Fuseki named graphs

```
urn:ots:engagement:{engagementId}:stream:{streamType}
```

---

## Repository layout

```
OTS/
├── apps/web/              # Next.js frontend
│   ├── app/engagements/   # Routes (streams, process, ontology, teleology, connectors, review)
│   ├── components/        # shell, bpmn, ontology, teleology, connectors, review, …
│   └── lib/
│       ├── api/           # ontology-service → FastAPI
│       └── mock/          # engagement, process, teleology, connector, review stores
├── services/api/          # FastAPI + Fuseki client
├── data/baselines/        # Seed TTL per value stream (o2c, p2p, c2m, h2r, t2r)
├── docker-compose.yml     # Fuseki + API
└── docs/superpowers/specs/  # Design specs
```

---

## Getting started

### UI only (mock data, no Fuseki)

```bash
cd apps/web && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/engagements`.

### Full stack (ontology + Fuseki)

```bash
# Terminal 1 — semantic stack
docker compose up fuseki api

# Terminal 2 — UI
cd apps/web && npm run dev
# Optional: NEXT_PUBLIC_OTS_API_URL=http://localhost:8000
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| FastAPI | http://localhost:8000 |
| Fuseki | http://localhost:3030 |

### Demo engagement (Acme Corp)

Pre-seeded engagement `eng-acme-001` with O2C baseline loaded:

| Page | URL |
|------|-----|
| Dashboard | `/engagements/eng-acme-001` |
| Process (O2C) | `/engagements/eng-acme-001/streams/o2c/process` |
| Ontology (O2C) | `/engagements/eng-acme-001/streams/o2c/ontology` |
| Teleology | `/engagements/eng-acme-001/teleology` |
| Connectors | `/engagements/eng-acme-001/connectors` |
| Review | `/engagements/eng-acme-001/review` |

**Review demo seed:** O2C stream in review, finance teleology row in review, open BPMN feedback on credit check. Switch role to **Stakeholder** to approve scoped items; switch to **Consultant** to resolve feedback.

**Ontology note:** If a graph was loaded before edge support shipped, the API auto-reloads the baseline when classes exist but edges are empty. Force reload: `POST /api/v1/ontology/{engagementId}/{stream}/initialize?force=true`.

---

## Mock service layer

UI imports services, not fixtures directly. Swap to FastAPI/Postgres post-E without rewrites.

| Service | Location | Responsibility |
|---------|----------|----------------|
| `engagementService` | `lib/mock/services/engagement-service.ts` | CRUD engagements |
| `streamService` | `lib/mock/services/stream-service.ts` | Load baseline |
| `processService` / `commentService` / `aiGapService` | `lib/mock/services/process-service.ts` | BPMN, comments, gap analysis |
| `ontologyService` | `lib/api/ontology-service.ts` | Graph CRUD via FastAPI |
| `teleologyService` | `lib/mock/services/teleology-service.ts` | Matrix, drill-down, approvals |
| `connectorService` | `lib/mock/services/connector-service.ts` | Connect, field map, preview, apply |
| `reviewService` | `lib/mock/services/review-service.ts` | Approval queue, feedback resolution |

---

## Long-term capabilities (post-v1)

- Postgres persistence for engagements, BPMN, teleology, comments, connectors
- Event-sourced audit trail
- Watermarked PDF export
- Real Salesforce and Jira connector APIs
- Live LLM gap analysis
- SSO (SAML/OIDC)
- Playwright E2E
- Industry standards crawl agent (quarterly or on-demand refresh)
- Phase 2 autonomous agent pipeline
