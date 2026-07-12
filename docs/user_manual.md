# Ontology-Teleology Studio — User Manual

**Audience:** Consultants running client workshops, stakeholders approving artefacts, and platform admins operating agents and infrastructure.

**Prerequisites:** Full stack running (see §1). For UI-only exploration, `npm run dev` alone works with mock data — agents, alignment, ontology, and connectors require the API.

---

## 1. Starting the system (admin)

### 1.1 Infrastructure

From the repo root:

```bash
docker compose up -d postgres fuseki keycloak
```

Wait ~30 seconds for Keycloak to import the `ots` realm.

| Service | URL | Login |
|---------|-----|-------|
| Web app | http://localhost:3000 | — |
| API | http://localhost:8000/health | — |
| Fuseki admin | http://localhost:3030 | admin / admin |
| Keycloak admin | http://localhost:8081 | admin / admin |
| Postgres | localhost:5434 | ots / ots |

### 1.2 API server

Run from **repo root** (not `services/api` — uv cwd issue):

```bash
OTS_DATABASE_URL=postgresql+psycopg://ots:ots@localhost:5434/ots \
FUSEKI_URL=http://localhost:3030 \
OTS_BASELINE_DIR=data/baselines \
OTS_THESAURUS_DIR=data/thesaurus \
uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel \
  --with "psycopg[binary]" --with anthropic --with python-dotenv \
  --with httpx --with alembic --with reportlab --with "pyjwt[crypto]" \
  python -m uvicorn main:app --app-dir services/api --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","fuseki":true}`.

### 1.3 Web app

```bash
cd apps/web && npm install && npm run dev
```

Open the URL printed in the terminal (usually http://localhost:3000).

### 1.4 LLM agents (admin)

Agents need `OPENROUTER_API_KEY` in the repo-root `.env` (loaded by the API). Optional Claude fallback: `ANTHROPIC_API_KEY`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | — | **Required** for AI drafting |
| `OTS_LLM_MODEL` | `openrouter/auto` | OpenRouter model |
| `OTS_LLM_FALLBACK_MODEL` | `claude-opus-4-8` | Claude if OpenRouter fails |

Without a key, gap analysis still returns heuristic suggestions; drafting buttons show errors.

### 1.5 SSO (optional)

**Dev users** (realm `ots`):

| Username | Password | Role |
|----------|----------|------|
| alex | alex | Consultant |
| jordan | jordan | Stakeholder |

In the web header, open the role switcher → **Sign in with SSO**. Unsigned sessions use the dev role switcher (consultant/stakeholder) with demo identity headers.

### 1.6 Ingestion pipeline (admin)

Regenerate baselines after updating `ReferenceDocs/`:

```bash
uv run ots-ingest parse-apqc
uv run ots-ingest parse-moda
uv run ots-ingest emit --industry telecom --stream all
uv run ots-ingest validate
```

Output lands in `data/baselines/` and `data/thesaurus/`.

---

## 2. Roles and permissions

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Consultant** | Edit BPMN, OWL, teleology; run agents and connectors; submit for review; resolve feedback | Approve own submissions |
| **Stakeholder** | Comment; approve/reject in review queue (scoped by function unit when configured) | Edit process/ontology/teleology |
| **Admin** | Operate stack, env, Keycloak, ingest; no separate UI — uses consultant + infrastructure tools | — |

Toggle role in the header **before** approving in Review. A full page reload resets to consultant unless SSO session is active.

---

## 3. Consultant — engagement setup

### 3.1 Create an engagement

1. Go to **Engagements** → **New engagement**.
2. Enter **Engagement name** and **Client**.
3. Choose **Industry baseline** (e.g. *Telecom (TM Forum eTOM)* for eTOM process names).
4. Click **Create and open streams**.

You land on the value-stream grid (O2C, P2P, C2M, H2R, T2R).

### 3.2 Load baselines

1. For each relevant stream, click **Load baseline** on the card.
2. Badge changes to **Loaded**.
3. When the API is up and you are a consultant, an **AI draft ready** banner may appear after load — auto-drafted process tags. Click **Open process map** to review.

**Tip:** Load at least **two streams** (e.g. O2C + P2P) before running **Draft initiatives with AI**.

### 3.3 Dashboard overview

`/engagements/{id}` shows client summary, baselines loaded count, and **Consultant toolkit** cards:

- **Workshop mode** — full-screen presenter
- **Alignment** — heatmap vs teleology
- **Initiatives** — cross-stream transformation candidates

**Exports & audit** card: download PDF, open audit trail.

---

## 4. Consultant — process discovery (BPMN)

### 4.1 Open the process map

From a loaded stream card → **Edit process**, or sidebar **Process (BPMN)**.

### 4.2 Customize and tag steps

1. Click a task in the canvas or **Process steps** list.
2. **Function unit** — pick one of 11 enterprise functions (Sales, Finance, Operations, …).
3. **Systems** — add systems from the catalog (e.g. Salesforce).
4. Changes persist to Postgres; reload the page to confirm.

### 4.3 AI assistance

| Action | How |
|--------|-----|
| Gap suggestions | **Gap suggestions** drawer — auto-refreshes; calls gap analysis API |
| Draft tags (manual) | **Draft tags with AI** on process workspace |
| Draft tags (auto) | Triggered on baseline load (banner on streams page) |

For each AI process-tag suggestion: **Accept** applies the tag; **Dismiss** clears `aiSuggestion`.

### 4.4 Stakeholder comments

Use the comment thread on a selected step. Comments appear in **Review** for resolution.

---

## 5. Consultant — ontology mapping (OWL)

### 5.1 Open ontology workspace

Sidebar **Ontology (OWL)** for the active stream.

### 5.2 Graph and class editor

- **React Flow graph** — `subClassOf` and `precedes` edges.
- **Class tree** — select a class; edit label and function unit in the panel.

### 5.3 Thesaurus mapping

1. In **Thesaurus**, choose framework (APQC / eTOM / SID).
2. Search concepts (e.g. `order`).
3. Click **Map** on a result — creates `ots:mapsToConcept` in Fuseki.

### 5.4 BPMN links and goal traceability

- **BPMN links** — connect class to process step.
- **Goal links** — `ots:supportsGoal` from class to teleology goal.

### 5.5 AI ontology links

| Action | How |
|--------|-----|
| Manual draft | **Draft links with AI** |
| Auto draft | On first graph load — banner + suggestions panel |

**Apply** or **Dismiss** each proposed BPMN link and concept mapping.

---

## 6. Consultant — teleology capture

1. Sidebar **Teleology** (or **Continue to teleology** from ontology).
2. Select stream row or function drill-down.
3. Add **goals**, **gaps**, **ambitions**; map to org themes (revenue, cost, CX, TTM).
4. **Save row** after edits.
5. Optional: **Draft with AI** — agent drafts from tagged process + ontology + comments.
6. **Submit for review** when ready — status becomes *in review*.

**View alignment** CTA jumps to the alignment heatmap.

---

## 7. Consultant — discovery analysis

### 7.1 Alignment heatmap

`/engagements/{id}/alignment`

- Per-stream tabs (O2C, P2P, … loaded streams).
- Heatmap: function units colored by alignment score (0–100).
- Drill-down: current evidence vs teleology ambitions.
- Scores join Postgres tags + Fuseki mappings + goal links.

### 7.2 Bridge gaps (stream-scoped)

1. Click **Bridge gaps with AI**.
2. Review **Solution options** cards.
3. **Accept** — folds title into draft teleology ambitions where applicable.
4. **Dismiss** — removes from active draft set.

Accepted options surface in **Review**.

---

## 8. Consultant — transformation roadmap

### 8.1 Initiative candidates (cross-stream)

`/engagements/{id}/initiatives`

**Requires ≥2 loaded baselines.**

1. Click **Draft initiatives with AI**.
2. Review cards — each spans multiple streams with linkage visual.
3. **Accept** or **Dismiss** per initiative.

Use initiatives for the “bigger picture” beyond single-stream solution options.

### 8.2 Workshop mode

`/engagements/{id}/workshop`

Full-screen presenter (no app sidebar):

| Slide type | Content |
|------------|---------|
| Welcome | Client + loaded streams |
| Stream intro | Per-stream overview |
| Step spotlight | Function tag, systems, ontology, inline comments |
| Ontology | Class summary for stream |
| Teleology | Goals and gaps |
| Wrap-up | Alignment scores |

**Navigation:** Agenda rail (desktop), progress strip, **Back** / **Next**, arrow keys.

**Parking lot** — open questions saved as comments for the review queue.

**Exit** returns to engagement dashboard.

---

## 9. Consultant — connectors (optional)

`/engagements/{id}/connectors`

1. **Connect** Salesforce or Jira (needs `OTS_SF_*` / `OTS_JIRA_*` in API `.env`).
2. Review **field mappings**; edit source/target fields.
3. **Preview import** — live sample values per mapped field.
4. **Apply** — writes `connectorData` into process element meta.

Without credentials, connect returns a clear error (no mock pretend-success).

---

## 10. Stakeholder — review and approval

1. Go to **Review** (`/engagements/{id}/review`).
2. Switch header role to **Stakeholder** (or sign in as jordan).
3. Queue shows: stream approvals, teleology rows, BPMN feedback, accepted options/initiatives.
4. **Approve** or **Reject** scoped items.
5. Consultant switches back to resolve feedback and resubmit.

---

## 11. Consultant — exports and governance

### 11.1 PDF export

Engagement dashboard → **Exports & audit** → **Download PDF**.

Or: `GET /api/v1/engagements/{id}/export.pdf?watermark=CUSTOM`

### 11.2 Audit trail

`/engagements/{id}/audit` — chronological events with actor, action, detail. **Export CSV** for compliance.

Every mutation (baseline load, tag, agent run, approval) is logged.

---

## 12. Admin — running and monitoring agents

### 12.1 Verify agents via API

```bash
# Gap analysis (heuristics + LLM)
curl -s -X POST http://localhost:8000/api/v1/gaps/eng-acme-001/o2c/analyze | python3 -m json.tool
# Expect source: "heuristic+llm" (OpenRouter) or "heuristic+llm(claude)" (fallback)

# Draft process tags
curl -s -X POST http://localhost:8000/api/v1/agents/eng-acme-001/o2c/draft-process-tags | python3 -m json.tool
```

### 12.2 Audit agent runs

```bash
curl -s http://localhost:8000/api/v1/audit/eng-acme-001 | python3 -m json.tool
```

Look for `agent.teleology_drafted`, `agent.process_tags_drafted`, `agent.ontology_links_drafted`, `agent.bridge_gaps`, `agent.initiatives_drafted` with `source` in detail.

### 12.3 Automated regression

```bash
cd apps/web && npm run test:e2e
```

Requires `docker compose up -d postgres fuseki` (+ `keycloak` for SSO tests). Stop manual `npm run dev` first.

### 12.4 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Ontology unavailable | Start Fuseki + API |
| Changes lost on reload | API not running — web using mocks |
| Drafting buttons fail | Set `OPENROUTER_API_KEY` in `.env`, restart API |
| Fuseki UI spins | Log in admin/admin at :3030 |
| SSO “Failed to fetch” | Use web token proxy (`/api/auth/token`) — already built in |
| Initiatives 409 | Load ≥2 stream baselines |

---

## 13. Quick reference — consultant day

| Time | Activity | Where |
|------|----------|-------|
| Morning | Load baselines, review auto-drafted tags | Streams, Process |
| Workshop AM | Walk process + ontology in Workshop mode | Workshop |
| Workshop PM | Capture teleology goals, parking-lot items | Teleology, Workshop |
| Analysis | Alignment heatmap, bridge gaps | Alignment |
| Roadmap | Draft initiatives across streams | Initiatives |
| Close | Submit for review; export PDF | Teleology, Review, Dashboard |

---

## 14. Related documents

- [Specs.md](./Specs.md) — architecture and integration
- [DemoScript.md](./DemoScript.md) — recorded demo walkthrough
- [manual-test-script.md](./manual-test-script.md) — hands-on QA checklist
