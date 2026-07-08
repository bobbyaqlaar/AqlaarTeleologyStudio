# OTS Phase 1 Design Specification

**Date:** 2026-06-11  
**Status:** Approved — **UI iterations A–E implemented** (2026-06-11)  
**Approach:** Mock-first UI with typed contracts; Fuseki + FastAPI live from iteration C

---

## 1. Purpose

Ontology-Teleology Studio (OTS) is a consultant platform for enterprise digital transformation. Phase 1 delivers a **human-driven engagement workflow**: load generic process baselines, customize linked BPMN and OWL artefacts, capture stakeholder feedback, align teleology to organizational ambitions, and preview enterprise system imports.

Phase 2 (deferred) adds autonomous agents that crawl enterprise systems and shift workshops to verification-only sessions.

---

## 2. Streams vs processes

These terms sit at different levels of the engagement model. Confusing them makes the stepper harder to follow.

| | **Value streams** (Step 1 — Streams) | **Processes** (Step 2 — Process) |
|---|---|---|
| **What it is** | An end-to-end **business value stream** — a major journey the enterprise runs | The **BPMN process map(s)** inside that stream — detailed flow of work |
| **Examples** | Order to Cash (O2C), Procure to Pay (P2P), Concept to Market (C2M), Hire to Retire (H2R), Trouble to Resolve (T2R) | Quote → approve → fulfil → invoice; requisition → PO → receipt → payment |
| **Consultant action** | Choose which streams apply to the client; **load generic baseline** templates | **Customize** the map in workshops; tag every step with a function unit |
| **Granularity** | Portfolio / engagement scope — “which journeys matter?” | Operational — “how does work actually happen?” |
| **Artefacts at this level** | Baseline bundle (seed BPMN + OWL) per stream | Editable BPMN canvas; linked ontology in Step 3 |

**Analogy:** The **stream** is the whole Order to Cash journey. The **process** is the specific flow diagram inside it.

A single value stream can contain **multiple** process maps in its baseline. The UI works **one stream at a time** when editing process and ontology.

### Hierarchy

```
Engagement
 └── Value stream (e.g. O2C)
      ├── Process maps (BPMN)   ← how work flows
      ├── Ontology (OWL)        ← what concepts mean
      └── Teleology             ← goals, gaps, ambitions
```

**Rule of thumb:** **Streams = which journeys.** **Process = what happens inside each journey.** Load templates first (Step 1); customize in workshops (Step 2 onward).

---

## 3. Consultant workflow guide

The numbered stepper in the app header follows this sequence. The consultant drives every edit; stakeholders comment and approve in later steps.

```
Step 1 STREAMS     Step 2 PROCESS      Step 3 ONTOLOGY
Pick O2C…T2R  →   Edit BPMN per   →   Link OWL classes
Load baselines    stream; tag         to process steps
                  function units

Step 4 TELEOLOGY    Step 5 REVIEW
Goals / gaps /  →   Stakeholders
ambitions vs        comment + approve
org ambitions       (consultant edits)
```

### Step 0 — Set up the engagement

Create an engagement for the client from **Engagements**. Open the engagement dashboard to see scope, participants, and progress.

### Step 1 — Streams (value stream baselines)

Go to **Value streams**. For each relevant stream (O2C, P2P, C2M, H2R, T2R), click **Load baseline**.

This pulls in the **generic cross-industry template** — not yet customized to the client. Each baseline includes seed BPMN process maps and OWL ontology with function-unit tags on steps.

**Deliverable:** All required streams show **Loaded** status.

### Step 2 — Process (BPMN customization)

Open a loaded stream → **Process (BPMN)**. Walk through the flow with workshop stakeholders.

- Adjust tasks, gateways, approvals, and manual handoffs to match the client’s current or target state.
- Assign every step to one **enterprise function unit** (Sales, Finance, IT, etc.).
- Use the **AI gap analysis** drawer for live suggestions on missing tags or process gaps.

Stakeholders add **comments** on steps; the consultant applies edits. Process maps are not stakeholder-editable.

**Deliverable:** Client-accurate BPMN per stream, fully function-tagged.

### Step 3 — Ontology (OWL alignment)

Open the same stream → **Ontology (OWL)**. Align semantic concepts to process steps.

- **Graph viewer** — React Flow canvas showing OWL classes as nodes and relationships as edges (`rdfs:subClassOf` hierarchy + `ots:precedes` process-flow chain). Dagre top-to-bottom layout; click node to select.
- **Class list + editor** — refine labels and function units; stored in Fuseki from iteration C onward.
- **BPMN link panel** — maintain **BPMN ↔ OWL links** (`ots:linkedBpmnElement`) so process steps and ontology stay consistent.

Baseline TTL in `data/baselines/{stream}.ttl` defines stream root class, step classes, hierarchy, and precedes chain. API auto-reloads baseline when an existing graph has classes but no edges (migration for stale Fuseki data).

**Deliverable:** Linked ontology graph per stream with visible structure, not a flat class list.

### Step 4 — Teleology (goals and ambitions)

Go to **Teleology**. For each loaded value stream (and optionally per function unit via **function drill-down**), capture:

- **Goals** — desired outcomes
- **Gaps** — current pain points
- **Ambitions** — target improvements

Link rows to organizational themes: **revenue**, **cost**, **customer experience** (CX), **time-to-market** (TTM).

Consultant saves rows and **submits for review**. Stakeholders approve/reject drill-down rows within function scope.

**Deliverable:** Structured teleology matrix ready for stakeholder review.

### Step 5 — Review and approve

Open **Review**. Unified approval queue aggregates:

- **Value stream bundles** — process + ontology for a loaded stream (`draft` → `in_review` → `approved` / `rejected`)
- **Teleology rows** — stream-level and function drill-down rows submitted for review
- **BPMN feedback** — open stakeholder comments on process steps (consultant marks **resolved**)

Stakeholders **approve or reject** in-scope items. Consultant resolves feedback, revises artefacts, and resubmits until sign-off.

**Deliverable:** Approved streams, process maps, ontology links, and teleology rows.

### Optional — Connectors (Salesforce / Jira)

From **Connectors**, preview imports from enterprise systems to **pre-fill** BPMN/OWL templates before or during workshops:

- **Connector cards** — connect/disconnect mock Salesforce and Jira instances
- **Field map** — map source fields (e.g. `Opportunity.StageName`) to BPMN tasks or OWL classes per stream
- **Import preview** — sample values with ready / conflict / unmapped status; **Apply ready items** (mock merge)
- **Simulate preview error** — dev toggle; error state blocks merge per §13

Consultant still validates everything in Process and Ontology steps. **UI shipped in iteration E**; real REST APIs post-v1.

---

## 4. Phase 1 Scope (v1)

### In scope

| Area | Detail |
|------|--------|
| Core unit | One **Engagement** per client transformation |
| Roles | **Consultant** edits artefacts; **Stakeholder** comments and approves only |
| Value streams | O2C, P2P, C2M, H2R, T2R (generic cross-industry baselines) |
| Artefacts | Linked **BPMN** process maps + **OWL** ontology (RDF/Turtle) |
| Function units | Every BPMN step tagged with one of 11 enterprise functions |
| Teleology | Matrix table, row editor, org themes, function drill-down, submit/approve |
| Connectors (UI) | Salesforce + Jira cards, field map, import preview/apply (**mock** — UI complete) |
| Review (UI) | Approval queue: streams, teleology, BPMN feedback resolution |
| AI gap analysis | Live debounced suggestions on edit (**mock** until post-E) |
| Auth | Local dev role switcher; SSO before production |
| Semantic store | Apache Jena Fuseki + FastAPI from iteration C |

### Deferred until after UI iteration E

UI iteration E is **complete**. Remaining post-E work:

- Event-sourced audit trail
- Watermarked PDF export
- Real Salesforce + Jira connector APIs
- Live LLM gap analysis
- SSO (SAML/OIDC)
- Postgres persistence for engagements, BPMN, teleology, comments, connectors, review state
- Industry standards crawl agent (TM Forum, BIAN, CDM, etc.)
- Playwright E2E

---

## 5. Enterprise Function Units

Every step in any business process maps to exactly one function unit.

| ID | Function |
|----|----------|
| `sales` | Sales |
| `marketing` | Marketing |
| `customer_care` | Customer care / experience |
| `finance` | Finance |
| `procurement_scm` | Procurement / SCM |
| `production` | Production |
| `operations` | Operations |
| `hr` | Human Resources |
| `products` | Products |
| `it` | IT |
| `networks` | Networks |

### Rules

- BPMN tasks, events, and gateways require a `functionUnit` before save.
- Stakeholders may be scoped to one or more function units; they comment/approve within scope.
- Consultants see and edit all function units.
- OWL classes linked to BPMN steps carry the same function unit.
- Teleology matrix supports per-stream rows with optional per-function drill-down.

---

## 6. Screen Map

### App shell

- Top bar: engagement selector, role switcher, settings
- Left nav: Overview, Streams, BPMN, Ontology, Teleology, Connectors, Review (all unlocked at iteration 5)

### Routes

| Route | Purpose |
|-------|---------|
| `/engagements` | List and create engagements |
| `/engagements/[id]` | Engagement dashboard |
| `/engagements/[id]/streams` | Value stream picker; load baseline |
| `/engagements/[id]/streams/[streamId]/process` | BPMN editor + comments + AI gap drawer |
| `/engagements/[id]/streams/[streamId]/ontology` | OWL graph viewer + class editor + BPMN link panel |
| `/engagements/[id]/teleology` | Teleology matrix + function drill-down |
| `/engagements/[id]/connectors` | Salesforce + Jira connect, field map, import preview |
| `/engagements/[id]/review` | Stakeholder approval queue + feedback resolution |

---

## 7. UI Build Order

| Iteration | Deliverable | Data source | Status |
|-----------|-------------|-------------|--------|
| **A** | Engagement shell, stream picker, baseline load | Mock fixtures | ✅ Done |
| **B** | BPMN editor, function tags, comment thread, AI gap drawer | Mock fixtures | ✅ Done |
| **C** | OWL graph viewer, class editor, BPMN link panel | **Fuseki via FastAPI** | ✅ Done |
| **D** | Teleology matrix with function drill-down | Mock fixtures | ✅ Done |
| **E** | Connector cards, field map, import preview; Review approval queue | Mock fixtures | ✅ Done |

`CURRENT_ITERATION = 5` in `apps/web/lib/constants/navigation.ts` unlocks all sidebar routes.

### Iteration C — OWL graph

- **Library:** `@xyflow/react` + `dagre` layout
- **Edges:** `rdfs:subClassOf` (gray) + `ots:precedes` (blue, animated)
- **API:** `GET /api/v1/ontology/{engagement}/{stream}` returns `classes` + `edges`; auto-reload baseline when edges missing
- **Components:** `OwlGraphViewer`, `OwlClassTree`, `OwlClassPanel`, `BpmnLinkPanel`

### Iteration D — Teleology

- Stream tabs filter matrix rows per loaded baseline
- Stream row + optional **function drill-down** rows (`teleologyService.addFunctionRow`)
- Org themes: revenue, cost, cx, ttm list fields per row
- Approval flow: draft → in_review → approved / rejected

### Iteration E — Connectors + Review

- **Connectors:** `connectorService` — connect, field map CRUD, preview, apply (mock)
- **Review:** `reviewService` — aggregates stream approval, teleology rows, open BPMN comments
- Demo seed on `eng-acme-001`: O2C in review, finance teleology in review, credit-check feedback open

---

## 8. Data Model

```typescript
type FunctionalUnit =
  | 'sales' | 'marketing' | 'customer_care' | 'finance'
  | 'procurement_scm' | 'production' | 'operations'
  | 'products' | 'it' | 'networks';

interface Engagement {
  id: string;
  name: string;
  client: string;
  status: 'draft' | 'active' | 'completed';
  participants: Participant[];
  valueStreams: ValueStream[];
  teleology: TeleologyMatrix;
}

interface Participant {
  userId: string;
  role: 'consultant' | 'stakeholder';
  functionUnits?: FunctionalUnit[];
}

interface ValueStream {
  id: string;
  type: 'o2c' | 'p2p' | 'c2m' | 'h2r' | 't2r';
  baselineId: string;
  bpmn: BpmnDocument;
  ontologyGraphUri: string;
  approvalStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
}

interface BpmnElement {
  id: string;
  name: string;
  type: string;
  functionUnit: FunctionalUnit;
}

interface Comment {
  id: string;
  authorId: string;
  role: 'consultant' | 'stakeholder';
  targetType: 'bpmn_element' | 'owl_class' | 'teleology_row' | 'function_unit';
  targetId: string;
  functionUnit?: FunctionalUnit;
  body: string;
  createdAt: string;
}

interface TeleologyRow {
  id: string;
  engagementId: string;
  streamType: ValueStreamType;
  functionUnit?: FunctionalUnit;
  goals: string[];
  gaps: string[];
  ambitions: string[];
  orgAmbitions: {
    revenue: string[];
    cost: string[];
    cx: string[];
    ttm: string[];
  };
  approvalStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
  updatedAt: string;
}

interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: 'subClassOf' | 'precedes' | 'relation';
}

interface OntologyGraph {
  graphUri: string;
  classes: OwlClass[];
  edges: OntologyEdge[];
}

interface ConnectorConnection {
  engagementId: string;
  connectorType: 'salesforce' | 'jira';
  connected: boolean;
  instanceUrl: string;
  lastSyncAt: string | null;
  lastPreviewAt: string | null;
  lastAppliedAt: string | null;
}

interface FieldMapping {
  id: string;
  engagementId: string;
  connectorType: 'salesforce' | 'jira';
  sourceField: string;
  targetField: string;
  targetType: 'bpmn_task' | 'owl_class' | 'process_meta';
  targetLabel: string;
  streamType: ValueStreamType;
}

interface ReviewQueueItem {
  id: string;
  engagementId: string;
  artefactType: 'value_stream' | 'teleology_row' | 'process_feedback';
  streamType: ValueStreamType;
  functionUnit?: FunctionalUnit;
  title: string;
  subtitle: string;
  approvalStatus: ApprovalStatus | 'open';
  updatedAt: string;
  href: string;
}

interface ProcessComment {
  id: string;
  engagementId: string;
  streamType: ValueStreamType;
  targetType: 'bpmn_element';
  targetId: string;
  targetLabel: string;
  functionUnit?: FunctionalUnit;
  body: string;
  resolved: boolean;
  createdAt: string;
}
```

**Implementation note:** Types live in `apps/web/lib/types/index.ts`. Mock stores under `apps/web/lib/mock/`; ontology via `apps/web/lib/api/ontology-service.ts`.

---

## 9. Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Next.js    │────▶│  FastAPI    │────▶│   Fuseki    │
│  (web)      │     │  (api)      │     │  (OWL/RDF)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       ▼                    ▼
  mock services         SPARQL + GSP
  (A,B,D,E)            (iteration C+)
```

### Fuseki named graphs

```
urn:ots:engagement:{engagementId}:stream:{streamId}
```

Baseline TTL from `data/baselines/{stream}.ttl` loaded on stream pick. Each file defines:

- Stream root OWL class (e.g. `ots:OrderToCash`)
- Step classes with `rdfs:subClassOf` to root
- Process flow via `ots:precedes` object property chain
- `ots:functionUnit` and optional `ots:linkedBpmnElement` on classes

BPMN↔OWL links stored as additional `ots:linkedBpmnElement` triples at runtime.

### Mock service layer

TypeScript services in `apps/web/lib/mock/services/` mirror future FastAPI contracts. UI imports services, not fixtures directly. Swap implementation post-E without UI rewrites.

| Service | Responsibility |
|---------|----------------|
| `engagementService` | CRUD engagements |
| `streamService` | Load baseline, get/save BPMN |
| `ontologyService` | Graph CRUD via FastAPI (classes, edges, BPMN links) |
| `teleologyService` | Matrix read/write, function rows, approvals |
| `processService` / `commentService` | BPMN state, threaded comments (`resolved` flag) |
| `connectorService` | Connect, field map, preview, apply (mock) |
| `reviewService` | Approval queue, stream submit, feedback resolve |
| `aiGapService` | Debounced gap suggestions (mock) |

---

## 10. UX & Visual Design (SaaS)

OTS must look and behave like a modern B2B SaaS product — polished, consistent, and easy to navigate without training.

### Visual direction (approved)

| Decision | Choice |
|----------|--------|
| Mood | Data-dense pro — Datadog/Palantir-inspired, info-rich |
| Theme | **Dark default**; light mode toggle in header |
| Accent | Enterprise blue (`primary`) — actions, active nav, current step |
| Sidebar | **Collapsible** — icon rail collapsed ↔ icons + labels expanded |
| Density | Balanced — dense data without cramped tables |
| Typography | **Geist Sans** (UI) + **Geist Mono** (data, SPARQL, IDs) |
| Surfaces | Soft radius (6–8px), subtle elevation, zinc/slate dark surfaces |
| Branding | App icon + **Ontology-Teleology Studio** wordmark in header |
| Stepper | **Horizontal numbered steps** (1–5) with connecting line |
| Function units | **Unique color per function** + fixed legend on BPMN views |

### Design tokens

```css
/* Dark (default) */
--background: zinc-950
--surface: zinc-900
--border: zinc-800
--foreground: zinc-50
--muted: zinc-400
--primary: blue-600          /* enterprise blue accent */
--primary-foreground: white
--radius: 0.5rem             /* 8px — soft cards/panels */
```

Light mode inverts surfaces while keeping the same accent and function-unit colors (adjusted for contrast).

Implement with Tailwind CSS variables in `globals.css`, shadcn/ui theme, and `next-themes` for dark/light toggle.

### Function unit color map

Fixed legend on every BPMN canvas and filter bar:

| Function | Token | Hue |
|----------|-------|-----|
| Sales | `fn-sales` | Blue |
| Marketing | `fn-marketing` | Violet |
| Customer care | `fn-customer-care` | Cyan |
| Finance | `fn-finance` | Emerald |
| Procurement / SCM | `fn-procurement` | Amber |
| Production | `fn-production` | Orange |
| Operations | `fn-operations` | Rose |
| Human Resources | `fn-hr` | Lime |
| Products | `fn-products` | Pink |
| IT | `fn-it` | Indigo |
| Networks | `fn-networks` | Teal |

Each BPMN step shows a color chip + legend entry; filters use the same tokens.

### Visual language

| Principle | Implementation |
|-----------|----------------|
| Professional tone | Dark zinc surfaces, enterprise blue accent, no decorative clutter |
| Data density | Multi-panel layouts; tables with compact row height; monospace for technical fields |
| Components | shadcn/ui for buttons, forms, dialogs, tables, badges, toasts |
| Motion | `transition-all duration-200` on interactive elements; skeleton loaders while data loads |
| Responsive | Collapsible sidebar → sheet drawer on mobile; stepper scrolls horizontally on narrow viewports |

### Intuitive flow

```
Engagements list  →  Engagement dashboard  →  Guided stepper (1–5)
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ▼                               ▼                               ▼
              1. Streams                      2. Process / Ontology            3. Teleology
              (pick + load)                 (BPMN + OWL per stream)          (goals matrix)
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    ▼
                              4. Connectors  →  5. Review & approve
```

**Navigation rules**

- Collapsible left sidebar; active route highlighted with enterprise blue.
- Breadcrumbs on every sub-page (`Engagements / Acme Corp / O2C / Process`).
- **Horizontal numbered stepper** in page header — circles 1–5, connecting line, checkmarks on complete, blue ring on current.
- One primary CTA per screen (e.g. "Load baseline", "Continue to ontology", "Submit for review").
- Empty states: muted illustration + one clear next action on dark surface.
- Status badges on streams and artefacts: `Draft` · `In review` · `Approved` · `Rejected`.

**Role-aware UX**

- Consultant: full edit controls, secondary actions in dropdown menus.
- Stakeholder: read-only artefact views, comment panel and approve/reject bar always visible; edit controls hidden (not disabled grey boxes).

**Accessibility**

- Semantic HTML (`nav`, `main`, `aside`, `section`).
- WCAG AA contrast on dark surfaces; function colors tested for distinguishability.
- Keyboard-navigable sidebar, stepper, and BPMN legend.
- ARIA labels on canvas controls and approval actions.

### Iteration A deliverables include shell

Iteration A ships the full themed app shell — dark/light toggle, collapsible sidebar, icon + wordmark header, numbered stepper, breadcrumbs, role switcher, design tokens, and function-unit legend component — so every later iteration inherits the data-dense pro look from day one.

---

## 11. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 App Router, React 19, TypeScript strict |
| UI | Tailwind CSS, shadcn/ui (base-ui), next-themes (dark default) |
| OWL graph | `@xyflow/react`, `dagre` |
| Fonts | Geist Sans + Geist Mono |
| BPMN | bpmn-js |
| API | FastAPI (Python 3.12) |
| OWL store | Apache Jena Fuseki 5.1 |
| Dev infra | docker-compose (fuseki + api) |

---

## 12. Repository Layout

```
OTS/
├── README.md
├── docker-compose.yml
├── apps/web/                  # Next.js frontend
│   ├── app/engagements/       # All routes including teleology, connectors, review
│   ├── components/            # shell, bpmn, ontology, teleology, connectors, review
│   └── lib/api/               # ontology-service (FastAPI)
│   └── lib/mock/              # stores + services for mock data
├── services/api/              # FastAPI + Fuseki client
├── data/baselines/            # TTL per stream (OWL hierarchy + precedes edges)
└── docs/superpowers/specs/    # Design specs
```

---

## 13. Error Handling

| Failure | UX |
|---------|-----|
| Fuseki unavailable | Banner on ontology page; retry; other pages unaffected |
| FastAPI timeout | Toast; show last cached graph |
| Empty SPARQL result / stale graph (classes, no edges) | Auto-reload baseline on GET; optional `?force=true` on initialize |
| BPMN missing function tag | Block save; inline validation |
| Connector preview error | Error state; no merge |
| AI gap service fail | Empty drawer; editing continues |

---

## 14. Testing Strategy

| Phase | Coverage |
|-------|----------|
| A–E | Manual walkthrough; `npm run build` on each iteration |
| C | FastAPI + Fuseki integration (docker compose) |
| Post-E | Vitest component smoke; Playwright E2E; PDF golden files; FastAPI unit tests in CI |

---

## 15. Post-UI Infrastructure Roadmap

UI iterations A–E are shipped. Next priorities:

1. Postgres for engagements, BPMN, teleology, comments, connectors, review
2. Event-sourced audit
3. Watermarked PDF export
4. Real Salesforce + Jira connectors
5. Live LLM gap analysis
6. SSO
7. Playwright E2E
8. Standards crawl agent (quarterly baseline refresh)

---

## 16. Phase 2 Preview

Autonomous agents connect to enterprise systems (databases, Slack, Teams, Confluence, Jira, etc.) to draft ontologies, process maps, and recommendations. Workshops become verification-only.
