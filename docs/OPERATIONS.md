# Ontology-Teleology Studio — Operations Guide

**Audience:** Operators and admins who run, upgrade, and maintain OTS across its lifecycle.  
**Companion docs:** [SPECS.md](./SPECS.md) (architecture) · [UserManual.md](./UserManual.md) (day-to-day usage) · [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) (open work)

---

## 1. Lifecycle overview

```
┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐
│  Provision  │ → │  Bootstrap   │ → │  Operate    │ → │  Maintain    │
│  infra      │   │  data + API  │   │  workshops  │   │  standards   │
└─────────────┘   └──────────────┘   └─────────────┘   └──────────────┘
                                                                  │
                                                    ┌─────────────▼──────────┐
                                                    │  Verify / Export /     │
                                                    │  Retire engagements   │
                                                    └────────────────────────┘
```

| Phase | Goal | Primary tools |
|-------|------|---------------|
| **Provision** | Containers and credentials available | `docker compose`, `.env` |
| **Bootstrap** | Schema, baselines, API + web healthy | Alembic (auto), `ots-ingest` / `ots-industry-agent`, uvicorn, `npm run dev` |
| **Operate** | Consultants run engagements | Web :3001, agents via OpenRouter |
| **Maintain** | Keep industry baselines current | `ots-industry-agent check\|sync` |
| **Verify** | Regression + compliance artefacts | Playwright, audit CSV, PDF export |
| **Retire** | Remove test/demo engagements | `DELETE /api/v1/engagements/{id}` |

---

## 2. Provision

### 2.1 Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Node.js 20+ and npm (web)
- Python 3.12+ and [uv](https://github.com/astral-sh/uv) (API + ingest)
- Repo clone with `ReferenceDocs/` and `data/` present

### 2.2 Environment file

Create / update **repo-root** `.env` (gitignored). Minimum for AI drafting:

```bash
OPENROUTER_API_KEY=sk-or-...
# Optional Claude fallback
# ANTHROPIC_API_KEY=sk-ant-...
# OTS_LLM_MODEL=openrouter/auto
# OTS_LLM_FALLBACK_MODEL=claude-opus-4-8
```

Optional connectors / SSO:

```bash
OTS_JIRA_EMAIL=...
OTS_JIRA_API_TOKEN=...
OTS_SF_CLIENT_ID=...
OTS_SF_CLIENT_SECRET=...
OTS_OIDC_ISSUER=http://localhost:8081/realms/ots
# OTS_AUTH_MODE=optional   # or required
```

### 2.3 Start infrastructure

```bash
cd /path/to/OTS
docker compose up -d postgres fuseki keycloak
```

| Service | Host port | Credentials |
|---------|-----------|-------------|
| Postgres | 5434 | `ots` / `ots` / db `ots` |
| Fuseki | 3030 | `admin` / `admin` |
| Keycloak | 8081 | admin console `admin` / `admin`; realm `ots` |

Wait ~30 s for Keycloak realm import. Sanity:

```bash
curl -s http://localhost:3030/$/ping
curl -s http://localhost:8081/realms/ots/.well-known/openid-configuration | head -c 80
docker exec "$(docker ps -qf name=postgres)" pg_isready -U ots
```

---

## 3. Bootstrap

### 3.1 API (must run from **repo root**)

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

On startup: Alembic migrates / stamps, seeds demo engagements if empty.

```bash
curl -s http://localhost:8000/health
# expect: {"status":"ok","fuseki":true}
```

### 3.2 Web

```bash
cd apps/web && npm install && npm run dev
# binds http://localhost:3001 (3000 reserved for AgenticFramework)
```

### 3.3 Reference data (first clone or after PDF updates)

**Generic + telecom (manual ingest):**

```bash
uv run ots-ingest parse-apqc
uv run ots-ingest parse-moda   # needs moda cache if re-crawling
uv run ots-ingest emit --industry generic --stream all
uv run ots-ingest emit --industry telecom --stream all
uv run ots-ingest validate
```

**Industry PCFs (agent — preferred for the 11 APQC industries):**

```bash
uv run ots-industry-agent list
uv run ots-industry-agent sync          # idempotent; writes manifest
uv run ots-industry-agent check         # exit non-zero on drift
```

See `services/ingest/industry_agent/README.md`.

### 3.4 Bootstrap checklist

- [ ] `health` OK
- [ ] `GET /api/v1/ontology/baselines` lists expected industries
- [ ] Web opens at :3001 → `/engagements`
- [ ] Create engagement with a non-telecom industry (e.g. retail) → load O2C → BPMN renders

---

## 4. Operate (steady state)

Daily operator duties are thin; consultants use the UI ([UserManual.md](./UserManual.md)).

| Activity | Action |
|----------|--------|
| Keep stack up | Leave docker + API + web running; restart after reboot (§2–3) |
| LLM outages | Confirm `OPENROUTER_API_KEY`; gap analysis still returns heuristics |
| SSO issues | Keycloak up; web token proxy `/api/auth/token`; users `alex`/`jordan` |
| Fuseki UI spins | Authenticate admin/admin at :3030 |
| Port conflict web | OTS uses **3001**; do not bind OTS to 3000 |
| One Next.dev only | Stop other `npm run dev` in `apps/web` before Playwright |

---

## 5. Maintain — standards and profiles

### 5.1 Periodic industry sync

Schedule (cron / CI / routine):

```bash
uv run ots-industry-agent check || uv run ots-industry-agent sync
```

- Manifest: `data/baselines/.industry_manifest.json`
- Never overwrites human-curated `streams_*.yaml` lacking `AGENT-GENERATED DRAFT` marker
- Profiles: `data/profiles/{industry}.json` (+ `_default.json`)

### 5.2 Deeper generic baselines

Edit `services/ingest/mapping/streams.yaml` prefixes, then:

```bash
uv run ots-ingest emit --industry generic --stream all
uv run ots-ingest validate
```

### 5.3 Database migrations

New revision (from repo conventions):

```bash
cd services/api
OTS_DATABASE_URL=postgresql+psycopg://ots:ots@localhost:5434/ots \
  uv run --with alembic --with sqlmodel --with "psycopg[binary]" \
  alembic revision --autogenerate -m "describe change"
# review, then restart API (runs upgrade head)
```

### 5.4 Auth mode promotion

| Mode | When |
|------|------|
| `off` / unset | Local demo without Keycloak |
| `optional` | Default with issuer — token preferred, anonymous allowed |
| `required` | Staging/prod-like — mutations need Bearer JWT |

Restart API after changing `OTS_AUTH_MODE` / `OTS_OIDC_ISSUER`.

---

## 6. Verify

### 6.1 Automated E2E

```bash
# stop manual npm run dev in apps/web first
docker compose up -d postgres fuseki keycloak
cd apps/web && npm run test:e2e
```

Playwright starts web on **:3100** and API on **:8000**. Specs: `consultant-flow`, `demo-script`, `sso-login`.

### 6.2 Manual QA

See [manual-test-script.md](./manual-test-script.md).

### 6.3 Demo recording

See [DemoScript.md](./DemoScript.md) — validated by `e2e/demo-script.spec.ts`.

### 6.4 Compliance artefacts

| Artefact | How |
|----------|-----|
| Audit JSON | `GET /api/v1/audit/{engagementId}` |
| Audit CSV | UI `/audit` or `…/export.csv` |
| PDF pack | UI **Download PDF** or `GET …/export.pdf` |

---

## 7. Retire / cleanup

```bash
# Via UI: engagement card delete with confirm
# Via API:
curl -X DELETE http://localhost:8000/api/v1/engagements/{id}
```

Deletes Postgres rows (including process-model tables) and related Fuseki graphs.

**Do not** drop the shared Postgres volume without coordinating with other local apps using the same compose project.

Stop stack:

```bash
# leave data volumes
docker compose stop postgres fuseki keycloak
# or full teardown (destructive to containers, volumes depend on compose flags)
docker compose down
```

---

## 8. Incident quick reference

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Ontology unavailable | Fuseki/API down | `docker compose up -d fuseki`; restart API |
| Changes vanish on reload | API offline → mock mode | Start API from repo root |
| Drafting buttons fail | Missing OpenRouter key | Set `.env`, restart API |
| Initiatives 409 | &lt;2 streams loaded | Load second baseline |
| E2E "Another next dev" | Two Next processes | Kill PID shown; re-run |
| API silent fail | `cd services/api && uv run` | Run uvicorn with `--app-dir services/api` from **root** |
| Education c2m/t2r empty | Draft mapping miss | Curate `streams_education.yaml` |

---

## 9. Document governance

| Document | Role |
|----------|------|
| [README.md](../README.md) | Product introduction |
| [SPECS.md](./SPECS.md) | Formal architecture specification |
| [UserManual.md](./UserManual.md) | Usage + command reference |
| [OPERATIONS.md](./OPERATIONS.md) | This file — lifecycle procedures |
| [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) | Open backlog items |
| [PRODUCT_ARCHIVE.md](./PRODUCT_ARCHIVE.md) | Completed backlog items |

**Backlog rule:** When an item in [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) is finished, move it to [PRODUCT_ARCHIVE.md](./PRODUCT_ARCHIVE.md) (do not leave completed work in the open backlog).
