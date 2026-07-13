# OTS — Manual Test Script

Step-by-step script to run the stack locally and verify every shipped
feature by hand. Written 2026-07-12 (main @ latest). All paths are
relative to the repo root.

> **Documentation:** [Specs.md](./Specs.md) · [user_manual.md](./user_manual.md) · [DemoScript.md](./DemoScript.md) (recording script, E2E-validated)

> **TL;DR run order:** docker infra → API → web app → walk the consultant
> flow → check PDF/audit/gaps endpoints → (optional) SSO → automated E2E.

---

## 1. Start the infrastructure (Docker)

```bash
cd /Users/mac/Documents/Bobby/Aqlaar/Apps/OTS
docker compose up -d postgres fuseki keycloak
```

Keycloak needs ~30 s on first boot (it imports the `ots` realm). Sanity checks:

| Check | Command | Expected |
|---|---|---|
| Keycloak realm | `curl -s http://localhost:8081/realms/ots/.well-known/openid-configuration \| head -c 100` | JSON starting with `{"issuer":"http://localhost:8081/realms/ots"` |
| Fuseki | `curl -s http://localhost:3030/$/ping` | a timestamp |
| Postgres | `docker exec ots-postgres-1 pg_isready -U ots` | `accepting connections` |

## 2. Start the API

```bash
cd /Users/mac/Documents/Bobby/Aqlaar/Apps/OTS
OTS_DATABASE_URL=postgresql+psycopg://ots:ots@localhost:5434/ots \
FUSEKI_URL=http://localhost:3030 \
OTS_BASELINE_DIR=data/baselines OTS_THESAURUS_DIR=data/thesaurus \
uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel --with "psycopg[binary]" \
  --with anthropic --with python-dotenv --with httpx --with alembic --with reportlab \
  --with "pyjwt[crypto]" python -m uvicorn main:app --app-dir services/api --port 8000
```

- [ ] `curl http://localhost:8000/health` → `{"status":"ok","fuseki":true}`
- On startup the API runs Alembic migrations automatically (stamps
  pre-Alembic databases, then `upgrade head`).

## 3. Start the web app

In a **new terminal**:

```bash
cd apps/web
npm run dev
```

Port **3001** is the OTS default (`npm run dev` binds `-p 3001`). Port 3000 is used by AgenticFramework.

---

## 4. Consultant flow (browser)

Mirrors the automated Playwright E2E, so a manual pass covers the same ground.

### 4.1 Create an engagement
- [ ] Open `/engagements`, click **New engagement**.
- [ ] Fill *Engagement name* and *Client*; set *Industry baseline* to
      **Telecom (TM Forum eTOM)**; click **Create and open streams**.
- [ ] You land on `/engagements/<id>/streams` with five value-stream cards.

### 4.2 Load the O2C baseline
- [ ] In the *O2C · Order to Cash* card click **Load baseline**.
- [ ] Badge flips to **Loaded**; buttons change to **Edit process** / **View stream**.
- [ ] Click **Edit process** → BPMN editor renders ~20 eTOM tasks in lanes.

### 4.3 Tag a task with function + system
- [ ] In the *Process steps* list (right panel) click **Develop Sales Proposal**.
- [ ] *Selected step* panel appears; set *Function unit* → **Sales**.
- [ ] The task list entry now shows a **Sales** tag (colored dot).
- [ ] In *Systems*, use "Add system…" → pick **Salesforce**; a Salesforce badge appears.
- [ ] **Reload the page** — tags survive (persisted in Postgres, not client state).

### 4.4 AI gap analysis (OpenRouter fallback)
- [ ] The *Gap suggestions* drawer below the canvas refreshes after tagging.
- [ ] With no Anthropic credits you should still see **rich, sentence-level
      suggestions** (missing steps, hand-off risks) from the OpenRouter
      fallback — not only "missing function tag" heuristics.

### 4.5 Thesaurus concept mapping
- [ ] Click **Ontology** (top right of the process page).
- [ ] Wait for the graph + class tree (Fuseki-backed); a class is auto-selected.
- [ ] In *Thesaurus*, type `order` in "Search concepts…" (framework: APQC PCF).
- [ ] Click **Map** on any result → status shows *"Mapped … to thesaurus concept."*

### 4.6 Teleology
- [ ] Go to `/engagements/<id>/teleology`.
- [ ] The O2C stream row is auto-created and selected.
- [ ] Type a goal in "Add goal…" and press Enter → item appears in the list.
- [ ] Click **Save row** → *"Teleology row saved."*
- [ ] Click **Submit for review** → *"Submitted for stakeholder review."*
      (badge flips to *in review*).

### 4.7 Review & approve as stakeholder
- [ ] Go to `/engagements/<id>/review`; the queue shows **O2C stream teleology**
      as *in_review*.
- [ ] In the header, open the role switcher (says *consultant*) → pick
      **Stakeholder**. (Role is client-side state — switch it *on* the review
      page; a full page reload resets it to consultant.)
- [ ] Click **Approve** on the teleology row → *"O2C stream teleology approved."*
      and the badge turns *approved*.

---

## 5. API features (browser or curl)

### 5.1 Watermarked PDF export
- [ ] Open `http://localhost:8000/api/v1/engagements/eng-acme-001/export.pdf`.
- [ ] Expect: engagement meta + participants, value-streams/approvals table,
      process snapshot table (for engagements with a loaded stream),
      teleology matrix, **diagonal watermark** on every page, footer with
      timestamp + page number.
- [ ] Custom watermark: append `?watermark=ACME%20CONFIDENTIAL`.
- [ ] Try your engagement from §4: `/api/v1/engagements/<id>/export.pdf` —
      the tagged task shows its function unit + system in the snapshot.

### 5.2 Audit trail
- [ ] `http://localhost:8000/api/v1/audit/<engagement-id>` — every mutation
      from §4 is there (engagement.created, stream.baseline_loaded,
      process.element_tagged, teleology.*, stream.approval_changed,
      engagement.exported…), newest first, with actor + detail.
- [ ] CSV download: `.../api/v1/audit/<engagement-id>/export.csv`.

### 5.3 Gap analysis endpoint directly
```bash
curl -s -X POST http://localhost:8000/api/v1/gaps/eng-globex-002/o2c/analyze | python3 -m json.tool
```
- [ ] `"source": "heuristic+llm"` (OpenRouter primary) or `"heuristic+llm(claude)"` if Claude fallback used. Heuristic suggestions always present.

---

## 6. SSO — web + API (optional)

Keycloak must be running (`docker compose up -d keycloak`). Demo users: `alex/alex` (consultant), `jordan/jordan` (stakeholder).

### 6.1 Web login (PKCE)

- [ ] Header role switcher → **Sign in with SSO** → Keycloak login → redirect back.
- [ ] Header shows **Alex Morgan** (consultant) or **Jordan Lee** (stakeholder).
- [ ] Token exchange uses `/api/auth/token` proxy (no browser CORS to Keycloak).

Automated: `npm run test:e2e -- e2e/sso-login.spec.ts`

### 6.2 API bearer token (optional)

- [ ] Strict mode: restart API with `OTS_OIDC_ISSUER=http://localhost:8081/realms/ots OTS_AUTH_MODE=required` → tokenless mutations return **401**.

```bash
TOKEN=$(curl -s -X POST http://localhost:8081/realms/ots/protocol/openid-connect/token \
  -d grant_type=password -d client_id=ots-web -d username=jordan -d password=jordan \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

curl -s -X PATCH http://localhost:8000/api/v1/engagements/eng-acme-001/streams/p2p/approval \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"approvalStatus":"in_review"}'
```

- [ ] Audit trail shows actor **Jordan Lee / stakeholder**.

---

## 7. Automated E2E (any time)

```bash
cd apps/web && npm run test:e2e
```

- Needs `docker compose up -d postgres fuseki` (+ `keycloak` for SSO tests).
- **Stop any manually running `npm run dev` first.**
- [ ] Expected: **4 passed** — `consultant-flow`, `demo-script`, 2× `sso-login` (~40–90 s total).

Demo script only: `npm run test:e2e -- e2e/demo-script.spec.ts`

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Ontology page: "Ontology service unavailable" | Fuseki or API down — `docker compose up -d fuseki` and restart step 2 |
| Engagements page shows only mock data / changes don't survive reload | API not running (web falls back to in-memory mocks) — check step 2 |
| Gap drawer shows only "missing function tag" lines | Both LLM paths failed — check `OPENROUTER_API_KEY` in root `.env` |
| `npm run test:e2e` fails at startup: "Another next dev server is already running" | Kill the manual dev server (PID printed in the error) |
| API 401 on every mutation | You started it with `OTS_AUTH_MODE=required` — send a Bearer token or restart without it |
| Keycloak realm 404 | First boot not finished or import failed — `docker logs ots-keycloak-1` |
