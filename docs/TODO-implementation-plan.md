# OTS Implementation TODO — Resumable Plan

**Created:** 2026-07-08. **Owner:** Bobby. **Purpose:** Full plan to finish Ontology-Teleology Studio. Written so any new session can resume without prior context. Update checkboxes + "Session log" at bottom as work proceeds.

## Context (read first in new session)

- App = consultant platform: show standard business processes (O2C, P2P, H2R, C2M, T2R) to customer stakeholders (sales/marketing/finance/…), capture inputs: process customization, step→system mapping, data/class→thesaurus mapping.
- **Already built (do not redo):** UI iterations A–E per `docs/superpowers/specs/2026-06-11-ots-phase1-design.md` (approved spec — follow it). Next.js app in `apps/web` (mock services in `lib/mock/services/`, ontology live via `lib/api/ontology-service.ts`). FastAPI+Fuseki in `services/api` (graph per engagement/stream, class CRUD, BPMN↔OWL links). Toy TTL baselines in `data/baselines/*.ttl` (~5 classes each).
- **Raw source material in `ReferenceDocs/`:**
  - `General/K016808_...Excel Version 8.0.xlsx` — APQC PCF v8 cross-industry hierarchy (primary machine-readable source).
  - `General/K0125xx_*.pdf` — APQC per-category definitions/measures (categories 1.0–13.0).
  - `Industries/*.pdf` — 14 industry PCFs (Telecom, Utilities, Retail, Healthcare Provider, Life Sciences, Insurance, Petroleum up/downstream, Consumer Products/Electronics, Education, Health Payor, NACE).
  - `Industries/Telecom-TMForum/` + `moda_dump.jsonl` (83 crawled pages, HTML per line: eTOM process elements + SID domains) + `moda_spider.py` (scrapy spider — re-run if coverage thin).
  - `DataSources.xlsx` — seed list for system catalog.
- Repo root has uv project (`pyproject.toml`, `main.py` — empty skeleton, use for ingest service).

## Phase 0 — Repo hygiene ✅ DONE 2026-07-08

- [x] Extended `.gitignore`: crawler-env, .DS_Store, ingest cache. moda_dump.jsonl (3.4MB) tracked.
- [x] Branch renamed `main`.
- [x] Initial commit `bc74a87` (176 files).

## Phase 1 — Ingestion agent (`services/ingest/`) — CORE ASK

Goal: parse ReferenceDocs → canonical model → emit (a) OWL TTL knowledge graphs, (b) SKOS thesaurus, (c) BPMN 2.0 workflow diagrams. Deterministic where possible; LLM only for fuzzy alignment/cleanup; cache everything.

### 1.1 Scaffold — [x] DONE 2026-07-08 (structure below built + pipeline runs end-to-end)
```
services/ingest/
├── __init__.py
├── models.py        # ProcessElement, DataEntity, Framework enums, StreamMapping
├── cli.py           # ots-ingest entrypoint (argparse/typer)
├── parsers/
│   ├── apqc_xlsx.py # openpyxl over PCF Excel → ProcessElement tree
│   ├── apqc_pdf.py  # pdfplumber industry+definitions PDFs → JSONL cache
│   └── moda.py      # BeautifulSoup over moda_dump.jsonl → eTOM/SID entities
├── mapping/
│   └── streams.yaml # value stream → framework subtree map (human-editable)
├── emitters/
│   ├── ttl.py       # OWL baseline TTL (subClassOf, ots:precedes, functionUnit, dcterms:source)
│   ├── skos.py      # thesaurus TTL (Concept, prefLabel, broader, exactMatch)
│   └── bpmn.py      # BPMN 2.0 XML (lanes per functionUnit, sequence from precedes)
├── validate.py      # pySHACL shapes + precedes-cycle + orphan checks
└── cache/           # gitignored parse caches (JSONL)
```
Root `pyproject.toml`: add deps `openpyxl, pdfplumber, beautifulsoup4, lxml, rdflib, pyshacl, typer, pydantic, anthropic, pyyaml, httpx`. Set `requires-python = ">=3.12"`. Script entry `ots-ingest = "services.ingest.cli:app"`.

### 1.2 Canonical model — [x] DONE (`services/ingest/models.py`)
`ProcessElement {id, frameworkId(PCF hierarchy id e.g. "3.2.1" / eTOM id), framework, level(1-5), name, description?, parentId?, order, functionUnit?}`. `DataEntity {id, name, domain, framework(sid), description?, parentId?}`. `StreamMapping` from streams.yaml.

### 1.3 Parsers — ALL DONE 2026-07-08
- [x] apqc_xlsx (2017 elements)
- [x] apqc_pdf (two-column industry PDFs; telecom 1649 / retail 1708 / utilities 2069 elements, 0 orphans; `ots-ingest parse-industry <pdf> --industry <slug>`)
- [x] moda: full re-crawl (crawl_moda.py, 18,257/18,261 pages → cache/moda_full.jsonl, 293MB gitignored — RE-RUN CRAWL in new clone before re-parsing). Breadcrumb-based parser: eTOM 3198 elements (8 domains, levels 1–7, 0 orphans) + SID 5124 entities (1000 ABEs). Noise filtered (deleted/zTemplate/$diagram/unused).
- NOTE: minor dup concepts (element page + diagram page share name) in etom/sid thesauri — dedup pass optional.
- xlsx: PCF Excel has rows w/ hierarchy number + name + optional metrics. Parse hierarchy number to build tree. Verify sheet layout first (openpyxl, print head).
- moda: each jsonl line `{url, title, html}`. Extract EA-exported tables: process element names, ids, descriptions, parent links; SID domains/ABEs from "SID Domains.html" style pages. Coverage check: 83 pages likely partial → re-run `ReferenceDocs/moda_spider.py` (needs scrapy) if key eTOM L2s missing.
- pdf: extract per-category definitions text; LLM cleanup pass optional/deferred; cache to `cache/apqc_pdf/*.jsonl`.

### 1.4 Stream mapping — [x] DONE first pass (`mapping/streams.yaml`, pinned to real PCF v8 ids; HR-less function enum → h2r defaults `operations`; review with Bobby)
`mapping/streams.yaml` initial content:
- o2c: apqc [3.5 (manage sales orders area), 4.x deliver, 9.2 revenue/AR], etom [Operations-Fulfillment, Billing]
- p2p: apqc [4.2 procure], etom [Supplier/Partner]
- h2r: apqc [7.0], etom []
- c2m: apqc [2.0], etom [SIP-Product Lifecycle]
- t2r: apqc [6.0 customer service], etom [Operations-Assurance]
(Exact PCF ids TBD from parsed xlsx — verify then pin.)

### 1.5 Emitters — [x] ttl · [x] skos (apqc.ttl 2017 + etom.ttl 3198 + sid.ttl 5124 concepts) · [x] bpmn · [x] alignments (align.py: 21 exact + 13 candidates in mapping/alignments/apqc-etom.yaml — REVIEW CANDIDATES, set status approved/rejected; emit writes data/thesaurus/alignments.ttl; LLM semantic pass optional later)
### 1.5b Telecom baselines — [x] DONE: streams_telecom.yaml (eTOM root_name subtrees; h2r stays APQC), selection.py (prefix|root_name, duplicate-name resolution via largest subtree), data/baselines/telecom/*.{ttl,bpmn} emitted+validated; BPMN parse clean (t2r lanes customer_care/operations/networks). apps/web/check-bpmn.mjs = dev checker. (straight-line + lanes + DI; gateways = consultant work). Emitted to `data/baselines/generic/*.{ttl,bpmn}` + `data/thesaurus/apqc.ttl`. Old flat `data/baselines/*.ttl` kept until Phase 2 API migration.
- ttl → `data/baselines/generic/{stream}.ttl` + `data/baselines/telecom/{stream}.ttl`. Keep existing flat files until API migrated (Phase 2), then delete old.
- skos → `data/thesaurus/apqc.ttl`, `data/thesaurus/etom.ttl`, `data/thesaurus/sid.ttl`; cross-links `skos:exactMatch` via LLM-assisted alignment, human-review YAML in `mapping/alignments/`.
- bpmn → `data/baselines/{industry}/{stream}.bpmn`: process w/ laneSet per functionUnit, tasks from leaf ProcessElements, sequenceFlows from order/precedes. Must open in apps/web bpmn-js editor.

### 1.6 Validation — [x] basic DONE (`validate.py`: labels, functionUnit enum, precedes acyclic, single root — all 5 streams pass). SHACL shapes still TODO.
pySHACL shapes file `services/ingest/shapes.ttl`; checks: every class has label, functionUnit valid enum, precedes acyclic, single root per stream. CLI `ots-ingest validate`.

### 1.7 CLI — [x] DONE: `uv run ots-ingest parse-apqc|parse-moda|emit|validate`
`ots-ingest parse --source apqc|moda`, `ots-ingest emit --industry generic|telecom --stream o2c|...|all`, `ots-ingest validate`. Idempotent, reads cache.

## Phase 2 — Semantic layer upgrade (`services/api`) — DONE 2026-07-08 (integration-tested vs live Fuseki)

- [x] Baselines load from `data/baselines/{industry}/{stream}.ttl` w/ legacy flat fallback; thesaurus graphs `urn:ots:thesaurus:{framework}` lazy-loaded from `data/thesaurus/*.ttl`.
- [x] `GET /api/v1/ontology/baselines` (industries+streams+thesauri), `initialize?industry=` (+ CLEAR SILENT fix for force on fresh dataset).
- [x] `GET /api/v1/ontology/thesaurus/{framework}/search?q=` (SPARQL regex on prefLabel).
- [x] `POST /api/v1/ontology/{eng}/{stream}/concept-mapping` (+ `/remove`) — `ots:mapsToConcept` triples; `mappedConcepts` on OwlClassModel.
- Note: decided against COPY-from-baseline-graph — direct TTL load per engagement is simpler and tested.

## Phase 3 — Workshop features — DONE 2026-07-08 (E2E-verified in running app)

- [x] `hr` function unit added to enum (types, function-units.ts, globals.css lime token, validate.py, spec §5, README) — Bobby approved 2026-07-08. h2r subtrees now tagged `hr`.
- [x] Industry field: `Industry` type, engagement + create dialog select (constants/industries.ts), ontology initialize?industry= and BPMN load are industry-aware. Globex seed = telecom demo engagement (5 streams unloaded).
- [x] System mapping: `SystemDef` + `systems[]` on BpmnElementMeta, static catalog constants/systems.ts (DataSources.xlsx was APQC links, not systems), SystemTagPanel beside function panel, processService.setSystems. Now Postgres-persisted.
- [x] Systems coverage matrix (2026-07-09, commit 5416eef): collapsible steps×systems table on process page, unmapped steps flagged, rows click-select canvas elements.
- [x] ThesaurusPanel in ontology workspace: framework select (apqc/etom/sid), debounced search, map/unmap class→concept via API (`ots:mapsToConcept`), mapped chips on class. E2E-tested against live Fuseki.
- [x] Generated .bpmn served from API (`GET /baselines/{industry}/{stream}/bpmn`); process-store loadProcessState fetches it (fixture fallback when API offline); task lists parsed from XML. Verified: telecom o2c renders 20 eTOM tasks in bpmn-js.
- [x] Fixed: process/ontology pages no longer 404 on client-loaded baselines (server mock store can't see client loads — real fix is Postgres, Phase 4). CORS widened to any localhost port (dev).
- KNOWN pre-existing bug: Base UI "MenuGroupContext is missing" error from role-switcher dropdown (components/ui/dropdown-menu.tsx:64) — surfaces in dev console, fix separately.

## Phase 4 — Persistence + production

- [x] Postgres core (2026-07-09): docker-compose postgres:17 (host port 5434 — 5432/5433 taken by other projects). services/api: db.py (create_all + seed Acme/Globex), db_models.py, engagements_router (list/create/get/load-baseline/approval), process_router (state seeds from industry .bpmn, PUT xml, PATCH element meta functionUnit+systems). Web: lib/api/backend.ts helper; engagement/stream/process services fetch-first w/ mock fallback (UI-only mode preserved); all 8 server pages read via engagementService. E2E-verified: engagement created via API appears in UI, function tag survives full reload from Postgres. API needs `uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel --with "psycopg[binary]"` locally (system pip is PEP-668 locked) or docker.
- [x] Postgres comments + teleology (2026-07-09, commit 3d60321): process_comments + teleology_rows tables, routers, fetch-first services; review queue composed client-side from live services (stream approval via engagements API, teleology status, comment resolve). E2E-verified incl. Postgres write from Review page.
- [x] .env wiring (2026-07-09): Bobby's key lives in .env (extracted from his .env.ex); python-dotenv loads repo-root .env in API; docker-compose env_file; .env* gitignored. **Key valid but account has NO CREDITS** — Anthropic 400 "credit balance too low"; LLM gaps auto-activate once credits purchased.
- [x] Alembic migrations (2026-07-10): services/api/alembic.ini + migrations/ (env.py reads OTS_DATABASE_URL, targets SQLModel.metadata); initial revision fe20c1b639a4 covers all 5 tables. Startup (db.init_db → run_migrations) stamps head on pre-Alembic databases (tables exist, no alembic_version) then runs `upgrade head`. Verified both paths: fresh DB (schema + seed created via migration) and live DB (stamped, data intact). New revisions: `cd services/api && OTS_DATABASE_URL=... uv run --with alembic --with sqlmodel --with "psycopg[binary]" alembic revision --autogenerate -m "..."` — autogenerate against a scratch DB or the live DB depending on what you're diffing.
- [ ] Postgres remaining: connectors state (mock-only, lowest value); engagement delete/archive endpoint.
- [x] Live LLM gap analysis (2026-07-09, commit d6dbff4): services/api/gaps_router.py — heuristics always (missing fn tags + unmapped systems), Claude claude-opus-4-8 w/ adaptive thinking + JSON-schema output when credentials present (env ANTHROPIC_API_KEY or `ant auth` profile), graceful degrade. Web aiGapService fetch-first. Model override: OTS_GAP_MODEL env.
- [x] OpenRouter exception fallback (2026-07-10): when the Claude call raises (no credits/model down/no creds), gaps_router retries once via OpenRouter chat completions (`openrouter/auto`; override w/ OTS_GAP_FALLBACK_MODEL; key = OPENROUTER_API_KEY in .env). Prompt-enforced JSON + lenient parse (auto-routed models vary; `openrouter/free` returned empty content in testing — don't default to it). E2E-verified: POST /api/v1/gaps/eng-globex-002/o2c/analyze → `"source": "heuristic+llm(openrouter)"` with 6 Claude-quality suggestions. Anthropic stays primary once credits are topped up (→ `"heuristic+llm"`).
- [x] Audit trail (2026-07-10): append-only audit_events table (Alembic rev daa6408d5d07) written atomically (same session/commit) from every mutating router — engagement.created, stream.baseline_loaded, stream.approval_changed, process.xml_saved, process.element_tagged, comment.created/resolved, teleology.row_added/row_updated/status_changed. Actor from optional X-OTS-User-Id/-Name/-Role headers (demo consultant fallback; comments use payload author; SSO will supply real identity). Read side: GET /api/v1/audit/{engagement_id} (JSON, desc) + /export.csv (chronological). E2E-verified via curl: 4 mutations → 4 events w/ correct actors + CSV download.
- [x] Watermarked PDF export (2026-07-10): GET /api/v1/engagements/{id}/export.pdf (services/api/export_router.py, reportlab) — engagement meta + participants, value-streams/approvals table, per-loaded-stream process snapshot (task/function/systems from BPMN + element_meta), teleology matrix w/ bullets; diagonal watermark on every page (?watermark=..., default "CONFIDENTIAL - DRAFT"), footer w/ timestamp + page number; each export writes an engagement.exported audit event. Verified visually for globex (process snapshot) and acme (teleology matrix). Gotcha: expunge ORM rows before the audit commit or they detach (DetachedInstanceError).
- [x] Playwright E2E (2026-07-10): apps/web/e2e/consultant-flow.spec.ts + playwright.config.ts — full consultant flow against the real stack (create telecom engagement → load O2C → tag task w/ function+system → thesaurus map → teleology goal + submit → switch role to stakeholder → approve in review queue). Run: `cd apps/web && npm run test:e2e` (needs `docker compose up -d postgres fuseki`; web on :3100 + API on :8000 auto-started/reused via webServer). Gotchas: only one `next dev` per dir (stop other dev servers first); after picking a Base UI dropdown item, wait for `[data-base-ui-inert]` count 0 before clicking anything else (portal overlay intercepts pointer events); role is client-side state — switch roles after navigating, not before. Passed twice consecutively.
- [x] SSO/OIDC — API side (2026-07-10): Keycloak 26 dev IdP in docker-compose (port 8081, realm "ots" auto-imported from infra/keycloak/ots-realm.json; users alex/alex = consultant, jordan/jordan = stakeholder; client ots-web public+PKCE+password-grant). services/api/auth.py verifies RS256 bearer tokens against the issuer JWKS (PyJWT); audit.get_actor prefers token identity (sub/name/realm-role) over X-OTS-* headers. Modes via OTS_AUTH_MODE: off (default, no issuer), optional (default w/ OTS_OIDC_ISSUER set — token wins, no token still works), required (mutations 401 without valid token). E2E-verified: jordan's Keycloak token → audit actor "Jordan Lee/stakeholder"; garbage token → 401; required mode → 401 w/o token, 200 w/ alex's token.
- [ ] SSO — web login flow: OIDC code+PKCE login in apps/web against the Keycloak realm (issuer http://localhost:8081/realms/ots), send access token as Authorization header via apiFetch, drive useRole from the token's realm role instead of the dev role-switcher. NOTE this Next.js version has breaking changes — read node_modules/next/dist/docs before writing auth code.
- [ ] Optional polish: web UI download button for the PDF export; connectors persistence (demo-only, lowest value); engagement delete/archive endpoint.

## RESUME HERE (next session)

Read this file top to bottom first. Current state: **Phases 0–4 complete except the web login flow** — Postgres (Alembic-managed) for engagements/streams/process-state/comments/teleology/audit, LLM gap analysis w/ OpenRouter fallback, coverage matrix, audit trail + CSV export, watermarked PDF export, Playwright E2E for the consultant flow, API-side OIDC against a Keycloak dev realm. Everything E2E-verified.

**Next tasks, in recommended order:**
1. **SSO web login flow** — OIDC code+PKCE in apps/web against Keycloak (see the SSO item in Phase 4 above for what's already in place). Read node_modules/next/dist/docs first — this Next.js version has breaking changes.
2. **Optional polish** — PDF download button in the web UI; engagement delete/archive endpoint; connectors persistence (demo-only, lowest value).
3. **Anthropic credits** — once Bobby tops up, `POST /api/v1/gaps/eng-globex-002/o2c/analyze` should return `"source": "heuristic+llm"` (Claude primary). Today it returns `"heuristic+llm(openrouter)"` via the fallback.

**How to run the stack locally:**
- `docker compose up -d postgres fuseki keycloak` then from `services/api`: `uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel --with "psycopg[binary]" --with anthropic --with python-dotenv --with httpx --with alembic --with reportlab --with "pyjwt[crypto]" python -m uvicorn main:app --port 8000` (system pip is PEP-668 locked; or `docker compose up api`). Add `OTS_OIDC_ISSUER=http://localhost:8081/realms/ots` to enable SSO (optional mode; `OTS_AUTH_MODE=required` to enforce).
- Web: `cd apps/web && npm run dev` (port 3000 is taken by another project's container — dev server auto-ports; API CORS already allows any localhost port)
- Playwright: `cd apps/web && npm run test:e2e` (stops if another `next dev` is running in the same dir — kill it first).
- Anthropic key + OpenRouter key live in root `.env` (gitignored, loaded via python-dotenv). Anthropic account had zero credits on 2026-07-10 → gap analysis uses the OpenRouter fallback.
- MODA crawl cache (`services/ingest/cache/`, 293MB) is gitignored — in a fresh clone, re-run `uv run python services/ingest/crawl_moda.py` before re-parsing eTOM/SID.

## Session log

- 2026-07-10: Five tasks shipped, each E2E-verified before commit: OpenRouter gap-analysis fallback (303b584), Alembic migrations (d86de92), event-sourced audit trail (fe8f46b), watermarked PDF export (0d2de5e), Playwright consultant-flow E2E (9439f2b), API-side OIDC w/ Keycloak dev realm (this commit). Remaining: web login flow + polish items (see RESUME HERE).

- 2026-07-09 (wrap-up): README + this doc updated for handoff; context window exhausted. All work committed through `7af8f24`.

- 2026-07-09 (night): systems coverage matrix shipped + verified (commit 5416eef). Remaining Phase 4: Alembic, connectors persistence (low value), audit trail, PDF export, SSO, Playwright E2E.
- 2026-07-09 (evening): comments + teleology in Postgres, review queue live-composed (commit 3d60321). .env key checked: valid but **no credits on Anthropic account — Bobby to top up**; until then gap analysis = heuristics-only. Remaining Phase 4: connectors persistence (low value), Alembic, systems coverage matrix, auth/audit/PDF/Playwright.
- 2026-07-09 (later): LLM gap analysis endpoint live + UI-verified (drawer now API-driven, shows systems-coverage gaps). NOTE: no Anthropic credentials on this machine — heuristics-only in dev until Bobby sets ANTHROPIC_API_KEY (or `ant auth login`) for the API process; then Claude suggestions appear automatically. **Next:** Postgres for comments/teleology/connectors/review, systems coverage matrix, Alembic, auth/audit/PDF/Playwright.
- 2026-07-09: Role-switcher dropdown bug fixed (label moved into RadioGroup, commit 3856849). Phase 4 core Postgres landed + E2E-verified (see Phase 4 section). **Next:** remaining Postgres tables (comments/teleology/connectors/review), live LLM gap analysis endpoint, systems coverage matrix, Alembic, auth/audit/PDF/Playwright.

- 2026-07-08 (late night): Phase 3 complete. Industry picker, thesaurus panel, system tagging, API-served BPMN — all E2E-verified in running app (telecom flow: load O2C → 20 eTOM tasks render → tag Salesforce on step → ontology shows 25 eTOM classes → map class to APQC 9.2.2 concept, chip persists in Fuseki). `npm run build` green. **Next: Phase 4** — Postgres persistence (fixes server/client mock-store split), live LLM gap analysis, coverage matrix, auth/audit/PDF/E2E.

- 2026-07-08: Plan written. Phase 0 done (commit bc74a87). Phase 1 mostly done: ingest package built, pipeline runs end-to-end (`parse-apqc` → `emit` → `validate` all green). O2C baseline now 22 real APQC classes w/ provenance; BPMN 18 tasks/3 lanes, valid XML. **Next up:** (1) re-crawl TM Forum MODA (dump too thin: 27 objects), (2) apqc_pdf parser for industry PCFs, (3) SKOS cross-framework exactMatch alignment, (4) Phase 2 API: baseline graphs by industry + thesaurus endpoints.
- 2026-07-08 (night): Telecom baselines emitted from eTOM (streams_telecom.yaml + selection.py refactor of emitters) — validated, BPMN parses clean. APQC↔eTOM alignment pass done (21 exact auto-approved, 13 candidates awaiting Bobby's review in mapping/alignments/apqc-etom.yaml) → data/thesaurus/alignments.ttl. Phase 1 COMPLETE except candidate review. **Next: Phase 3 UI** — industry picker on engagement create, system-mapping panel, thesaurus search panel in ontology workspace, serve generated .bpmn from API.
- 2026-07-08 (evening): MODA fully crawled (18,257 pages) + breadcrumb parser → eTOM 3198 / SID 5124; thesauri emitted (apqc/etom/sid TTL, live-search-tested via API: multi-word regex works). Phase 2 API done + integration-tested (baselines catalog, initialize?industry=, thesaurus search, concept-mapping w/ mappedConcepts on classes). apqc_pdf parser done (3 industries tested). **Next:** telecom baseline emit from eTOM subtrees (needs etom entries in streams.yaml + emitter support for etom cache), SKOS exactMatch alignment, Phase 3 UI (industry picker, system mapping, thesaurus panel), Phase 4 persistence.
- 2026-07-08 (later): Bobby approved `hr` function unit → added across web enum/colors, ingest validator, streams.yaml (h2r 7.x → hr), spec, README. Re-emitted baselines, validation green. Verified all 5 generated .bpmn parse clean via bpmn-moddle (0 warnings; h2r lanes hr+finance). `npx tsc --noEmit` clean.
