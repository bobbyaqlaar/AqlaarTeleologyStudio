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
- [ ] Postgres remaining: connectors state — API + Postgres live; web mock store removed (2026-07-12).
- [x] Engagement delete endpoint (2026-07-12): `DELETE /api/v1/engagements/{id}` + web confirm dialog + E2E teardown.
- [x] Live LLM gap analysis (2026-07-09, commit d6dbff4): services/api/gaps_router.py — heuristics always (missing fn tags + unmapped systems), Claude claude-opus-4-8 w/ adaptive thinking + JSON-schema output when credentials present (env ANTHROPIC_API_KEY or `ant auth` profile), graceful degrade. Web aiGapService fetch-first. Model override: OTS_GAP_MODEL env.
- [x] OpenRouter primary LLM (2026-07-12): `llm.py` tries OpenRouter first (`OTS_LLM_MODEL` / `OPENROUTER_API_KEY`); Claude (`OTS_LLM_FALLBACK_MODEL`) on failure. Gap analysis source: `heuristic+llm` (OpenRouter) or `heuristic+llm(claude)`.
- [x] Audit trail (2026-07-10): append-only audit_events table (Alembic rev daa6408d5d07) written atomically (same session/commit) from every mutating router — engagement.created, stream.baseline_loaded, stream.approval_changed, process.xml_saved, process.element_tagged, comment.created/resolved, teleology.row_added/row_updated/status_changed. Actor from optional X-OTS-User-Id/-Name/-Role headers (demo consultant fallback; comments use payload author; SSO will supply real identity). Read side: GET /api/v1/audit/{engagement_id} (JSON, desc) + /export.csv (chronological). E2E-verified via curl: 4 mutations → 4 events w/ correct actors + CSV download.
- [x] Watermarked PDF export (2026-07-10): GET /api/v1/engagements/{id}/export.pdf (reportlab) — engagement meta, streams/approvals, process snapshot, teleology matrix; watermark + footer; audit-logged.
- [x] PDF download in web UI (2026-07-12): engagement overview **Exports & audit** card → `engagementExportService.downloadPdf()`; `apiDownload` blob helper.
- [x] Audit trail UI (2026-07-12): `/engagements/[id]/audit` — event table + CSV export; sidebar nav; `auditService`.
- [x] Playwright E2E (2026-07-10): apps/web/e2e/consultant-flow.spec.ts + playwright.config.ts — full consultant flow against the real stack (create telecom engagement → load O2C → tag task w/ function+system → thesaurus map → teleology goal + submit → switch role to stakeholder → approve in review queue). Run: `cd apps/web && npm run test:e2e` (needs `docker compose up -d postgres fuseki`; web on :3100 + API on :8000 auto-started/reused via webServer). Gotchas: only one `next dev` per dir (stop other dev servers first); after picking a Base UI dropdown item, wait for `[data-base-ui-inert]` count 0 before clicking anything else (portal overlay intercepts pointer events); role is client-side state — switch roles after navigating, not before. Passed twice consecutively.
- [x] SSO/OIDC — API side (2026-07-10): Keycloak 26 dev IdP in docker-compose (port 8081, realm "ots" auto-imported from infra/keycloak/ots-realm.json; users alex/alex = consultant, jordan/jordan = stakeholder; client ots-web public+PKCE+password-grant). services/api/auth.py verifies RS256 bearer tokens against the issuer JWKS (PyJWT); audit.get_actor prefers token identity (sub/name/realm-role) over X-OTS-* headers. Modes via OTS_AUTH_MODE: off (default, no issuer), optional (default w/ OTS_OIDC_ISSUER set — token wins, no token still works), required (mutations 401 without valid token). E2E-verified: jordan's Keycloak token → audit actor "Jordan Lee/stakeholder"; garbage token → 401; required mode → 401 w/o token, 200 w/ alex's token.
- [x] SSO — web login flow (2026-07-11): OIDC code+PKCE in apps/web; Bearer on apiFetch; role from token; Keycloak realm `http://localhost:8081/realms/ots`, client `ots-web`.
- [x] Connectors web service API-only (2026-07-12): removed `connector-store.ts` mock fallback; `simulateError` stays client-side demo toggle.

## Post-review fixes + Phase 2 kickoff (2026-07-11)

Holistic review (journey/redundancy/efficiency) done in-session; fixes shipped in order, each E2E-verified:

- [x] **Guided journey fixed** (98dc3f8): GET /api/v1/engagements/{id}/progress derives real per-step completion (streams loaded / tagged elements / Fuseki mappings / teleology content / all-approved) + firstLoadedStream. Stepper renders checkmarks from that state, allows forward navigation once a baseline is loaded, no longer hardcodes o2c. New CTAs: ontology → "Continue to teleology", teleology → "Continue to review". E2E now navigates via CTAs and asserts 4 stepper checkmarks. (Correction to the review: the sidebar always had engagement nav; the stepper + missing CTAs were the real gap.)
- [x] **Dead code removed** (79efc68): review-store.ts (unreferenced), Engagement.current_step/currentStep everywhere incl. DB column (migration a0f728e4421a), check-bpmn.mjs → scripts/, tsbuildinfo ignored.
- [x] **Real Salesforce + Jira connectors** (fd6f425): /api/v1/connectors — Postgres state (migration 6bf9aa68a23f, auto-seeded per engagement), live credential validation on connect (Jira basic auth /myself; Salesforce OAuth client-credentials), live sample values on preview (real ready/conflict/unmapped), apply writes into element_meta.connectorData; all audit-logged. Server creds: OTS_JIRA_EMAIL/OTS_JIRA_API_TOKEN, OTS_SF_CLIENT_ID/OTS_SF_CLIENT_SECRET (none in .env yet — connect returns 503 hint until set; verified live 401 from Atlassian surfaces in the UI status line). Web connector-service is fetch-first; BackendApiError reasons surface instead of mock-pretending.
- [x] **Phase 2 — first drafting agent** (923506f): POST /api/v1/agents/{id}/{stream}/draft-teleology reads the tagged BPMN map + connectorData + open comments + ontology labels and drafts the teleology matrix (stream row + per-function drill-downs) via shared llm.py (Claude primary → OpenRouter fallback). Never touches in_review/approved rows; refreshes draft rows; audit event agent.teleology_drafted w/ source. Web: "Draft with AI" button in teleology workspace (consultant only, API-only, failures surfaced). Verified: API draft for globex (grounded gaps naming real steps), UI draft on an E2E engagement — approved stream row skipped, sales drill-down created.

## Phase 2 — Alignment, gap-bridge, initiatives, Workshop mode (2026-07-11) ✅

Design spec: `docs/superpowers/specs/2026-07-11-workshop-alignment-gap-bridge-design.md`

- [x] **gaps_router → llm.py** — shared `generate_json()`; gaps_router imports it (no duplicated fallback logic).
- [x] **Alignment API** — `GET /api/v1/alignment/{eng}` joins teleology (Postgres) + process/ontology evidence (Postgres + Fuseki) + `ots:supportsGoal` links; deterministic 0–100 score per function unit. Feeds agents + UI.
- [x] **Alignment UI** — `/engagements/[id]/alignment`: heatmap, current vs teleology drill-down, score breakdown.
- [x] **Goal traceability** — `POST /api/v1/ontology/{eng}/{stream}/goal-links` (`ots:supportsGoal`); GoalLinkPanel in ontology workspace.
- [x] **Gap-bridge agent (tier 1)** — `POST /api/v1/agents/{eng}/{stream}/bridge-gaps` → `solution_options` table (draft/accepted/dismissed); accept appends title to draft teleology ambitions. UI: option cards on alignment view.
- [x] **Initiative candidates (tier 2)** — `POST /api/v1/agents/{eng}/draft-initiatives` → `initiatives` table (≥2 streams); cross-stream linkage visual. UI: `/engagements/[id]/initiatives`.
- [x] **Solutions lifecycle** — `GET/POST /api/v1/solutions/{eng}/options` + `/initiatives`; accepted items surface in review queue.
- [x] **Workshop mode** — `/engagements/[id]/workshop`: full-screen presenter, agenda rail, step spotlight (function tag, systems, linked ontology, comments), ontology + teleology slides, parking lot (persisted as comments), wrap-up alignment scores. Same-screen v1.
- [x] **Web SSO** — OIDC PKCE login, Bearer on apiFetch, role from token (see Phase 4 SSO web item).
- [x] **Alembic** — revision `b3d1c04f9e21` adds `solution_options` + `initiatives` tables.
- [x] **Engagement dashboard** — Consultant toolkit cards (Workshop / Alignment / Initiatives); teleology → "View alignment" CTA.

- [x] **Draft process tags + ontology links** (2026-07-12): `draft-process-tags` (persisted `aiSuggestion` + accept/dismiss UI), `draft-ontology-links` (stateless proposals + Apply/Dismiss panel). OpenRouter-verified.

**Next tasks, in recommended order:**
1. ~~**Agent triggers**~~ — done 2026-07-12: `agent-trigger-service` fires on baseline load + ontology graph ready (debounced 60s).
2. ~~**Anthropic credits**~~ — OpenRouter is primary LLM route (`llm.py`); Claude optional fallback via `OTS_LLM_FALLBACK_MODEL`.
3. ~~**Playwright E2E**~~ — extended consultant-flow: P2P load → alignment → bridge gaps → initiatives → workshop (2026-07-12).
4. ~~**Connectors mock cleanup**~~ — web `connector-service` API-only; `connector-store.ts` removed (2026-07-12).

## RESUME HERE — Documentation pack shipped (2026-07-12)

**Status:** `main` — [Specs.md](./Specs.md), [user_manual.md](./user_manual.md), [DemoScript.md](./DemoScript.md) + `e2e/demo-script.spec.ts` validate the recording flow.

**Next tasks (reordered 2026-07-13 to prioritise the "generic across all industries" objective):**

### P1 — Multi-industry genericity (delivers the core objective)

The architecture is already industry-parameterised (engagement `industry` free-string column;
catalog-driven baseline discovery in `fuseki_client.list_baselines`; per-industry `streams_{industry}.yaml`
in ingest), but only 2 industries (generic APQC + telecom eTOM) were delivered. Progress below.

1. **[x] DONE 2026-07-13 — Wire `emit` to industry PDF caches.** `services/ingest/cli.py`:
   `_load_apqc_cache(industry)` now loads `cache/apqc_{industry}.jsonl` for self-contained industry PCFs
   (retail, utilities, …); `generic`/`telecom` keep the cross-industry cache. Added
   `mapping/streams_retail.yaml` + `mapping/streams_utilities.yaml` (prefixes pinned to each industry's own
   PCF numbering — they differ from cross-industry). Emitted `data/baselines/{retail,utilities}/*.{ttl,bpmn}`
   — all 5 streams each, `validate` OK, BPMN parse clean (0 warnings, correct function-unit lanes). Also
   emits per-industry thesauri `data/thesaurus/apqc_{industry}.ttl`. **Bonus fix:** `apqc.ttl` was polluted
   with ~3200 eTOM concepts (emit passed the combined element list to the SKOS emitter) — now emitted from
   the APQC-only set (2016 concepts), so the "apqc" ontology search no longer returns eTOM processes.
   Verified end-to-end on the live stack: `POST …/verify-retail-001/o2c/initialize?industry=retail` → 200
   triples in Fuseki; retail O2C BPMN serves 27 tasks; `apqc_retail` thesaurus search returns retail terms.

   **Follow-on [x] DONE 2026-07-13 — industry-standards agent (`services/ingest/industry_agent/`).** Rather
   than hand-parse the other PDFs, built an agent (Bobby's ask: part of the repo, runs periodically to track
   evolving standards). Pipeline per industry: parse PDF → cache → propose value-stream mapping (keyword
   heuristics over the industry's own level-1/2 categories → **draft** `streams_{slug}.yaml`) → derive
   profile (`data/profiles/{slug}.json`) → emit TTL+BPMN+thesaurus → validate. CLI `ots-industry-agent
   list|check|sync` (`check` exits non-zero on drift for schedulers; `sync` is hash-idempotent via
   `data/baselines/.industry_manifest.json`). Never clobbers human-curated mappings (files without the
   `AGENT-GENERATED DRAFT` marker) or existing profiles; emits from the on-disk YAML so curated overrides win.
   Ran across all 11 industry PDFs → **13 industries now have baselines** (generic + telecom + 11 APQC:
   consumer_products/_electronics, downstream/upstream_petroleum, education, healthcare_provider,
   health_insurance_payor, life_sciences, property_casualty_insurance, retail, utilities). All validate OK,
   all BPMN parse with 0 warnings, API `/baselines` serves 13, web dropdown renders all 13. Fixed a latent
   `bpmn.py` crash on empty streams (`lanes[0]` when a stream matched no subtree — now emits a minimal
   Start→End). Excluded: telecom PDF (uses eTOM) + NACE (not an industry PCF). Mappings are drafts for
   consultant review — Education's c2m/t2r matched nothing (bespoke terminology) and need manual subtrees;
   optional LLM refinement via `llm.py` is a documented extension. See
   `services/ingest/industry_agent/README.md` for periodic-run (cron/CI/routine) guidance.
2. **[x] DONE 2026-07-13 — Web industry list is catalog-driven.** `Industry` widened to `string`
   (`apps/web/lib/types/index.ts`); `industries.ts` adds friendly labels for retail/utilities + an
   `industryLabel()` fallback that title-cases unknown slugs; `ontologyService.listBaselines()` added; the
   create-engagement dialog fetches `GET /api/v1/ontology/baselines` on open and renders options from it,
   falling back to the static list when the API is unreachable. `tsc` clean. Verified in the browser: the
   dropdown lists all 4 industries; with the API up the order matches the catalog's sorted keys (distinct
   from the static fallback order — proving the dynamic path drives it). New industries now need zero web
   changes.
3. **[x] DONE 2026-07-13 — Per-engagement configuration, industry-defaulted.** Decision (Bobby, 2026-07-13):
   function units + value streams become **per-engagement config, seeded from an industry profile**.
   - **Industry profiles** = source of truth in `data/profiles/{industry}.json` (+ `_default.json` fallback):
     `{ label, functionUnits: [...], valueStreams: [{type,label}] }`. Function-unit **colors are compiled
     Tailwind tokens** (`fn-sales`…`fn-networks` in globals.css), so units are a fixed **library**; a profile
     selects an industry-appropriate **subset** (retail drops networks/production; telecom/utilities keep
     networks). Genuinely new units = library growth (add token + code). `valueStreams[].type` is an open
     string (extensible) — today all industries use o2c/p2p/c2m/h2r/t2r; the industry-standards agent (item 1
     follow-on) can introduce new stream ids + baselines later.
   - **Engagement config** resolved from the profile at create time and **stored on the engagement** (JSONB
     `function_units` + `value_streams` columns) so evolving industry standards don't silently mutate existing
     engagements; editable later. Value-stream rows seed from the profile's stream list (not the hardcoded 5).
   - API: `services/api/profiles.py` loader + `GET /api/v1/profiles[/{industry}]`; engagement create resolves +
     persists; `EngagementModel` exposes `functionUnits` + `valueStreams`. Old rows fall back to the profile on read.
   - Web: engagement config drives which function units + value streams render (full library as fallback when no
     engagement in scope).

_Data-depth note (not a blocker): generic baselines are shallow (P2P only 11 classes). Full 2,017-element
APQC parse is already in `cache/apqc.jsonl`; deeper subtrees are a `streams.yaml` mapping tweak, not new parsing._

### P2 — Remaining plan items

4. Connector creds in `.env` for live Salesforce/Jira.
5. APQC↔eTOM candidate review; SHACL shapes (`services/ingest/shapes.ttl` — §1.6 never written); standards crawl agent.
6. Agent scheduling/trigger rather than button-only (spec §16) — orthogonal to genericity.

### Housekeeping — stale entries to reconcile

- Plan line ~106 still lists "connectors state (mock-only, lowest value)" as remaining, but real
  Postgres-backed Salesforce/Jira connectors shipped 2026-07-11 (`fd6f425`) and web went API-only 2026-07-12.
- Legacy flat `data/baselines/*.ttl` files were meant to be deleted after the Phase 2 API migration
  (plan line ~71) but are still present alongside `data/baselines/{generic,telecom}/`.

**How to run the stack locally:**
- `docker compose up -d postgres fuseki keycloak`
- API (from repo root — `services/api` cwd fails silently with uv):  
  `uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel --with "psycopg[binary]" --with anthropic --with python-dotenv --with httpx --with alembic --with reportlab --with "pyjwt[crypto]" python -m uvicorn main:app --app-dir services/api --port 8000`  
  Env: `OTS_DATABASE_URL=postgresql+psycopg://ots:ots@localhost:5434/ots`, `FUSEKI_URL=http://localhost:3030`, baseline/thesaurus dirs under `data/`.
- Web: `cd apps/web && npm run dev` (port **3001** — 3000 reserved for AgenticFramework; CORS allows any localhost port).
- Fuseki admin UI: http://localhost:3030 — login **admin** / **admin** if datasets list spins.
- Playwright: `cd apps/web && npm run test:e2e` (one `next dev` per dir; API readiness on `/api/v1/engagements`).

## Session log

- 2026-07-13 (P1 item 3 + item-1 follow-on): (a) Per-engagement industry config — `data/profiles/*.json` source of truth, `services/api/profiles.py` + `/api/v1/profiles`, engagement JSONB `function_units`/`value_streams_config` seeded from profile at create (Alembic `c4e7a1b9d2f0`), old rows fall back to profile on read. Web: `Engagement.functionUnits`/`valueStreamConfig` types, `functionUnitsFor()` helper, function-tag picker + legend industry-scoped. Verified live: acme (generic) shows Production/no Networks; globex (telecom) shows Networks/no Production. (b) Industry-standards agent `services/ingest/industry_agent/` (`ots-industry-agent list|check|sync`) — parses the 11 industry PCF PDFs → draft mappings + profiles + baselines; 13 industries total now, all validate + BPMN-clean; API serves 13, dropdown renders 13. Fixed `bpmn.py` empty-stream crash. Manifest-based drift `check` for periodic runs (README documents cron/CI/routine). tsc clean.

- 2026-07-13 (P1 items 1–2): Multi-industry genericity — ingest `emit` now loads `cache/apqc_{industry}.jsonl` for self-contained industry PCFs; added `streams_retail.yaml` + `streams_utilities.yaml` (prefixes pinned to each industry's own numbering); emitted retail + utilities baselines (TTL+BPMN, all validate OK, BPMN parse clean) + per-industry thesauri. Fixed pre-existing `apqc.ttl` eTOM pollution (5216→2018 concepts). Web: `Industry` type widened to `string`, `industryLabel()` helper, `ontologyService.listBaselines()`, create dialog now catalog-driven (fetch-first, static fallback). `tsc` clean. Verified live: API `/baselines` returns 4 industries + 6 thesauri; retail O2C loads 200 triples into Fuseki, BPMN serves 27 tasks, `apqc_retail` search returns retail concepts; browser dropdown renders all 4 dynamically. Item 3 (de-telecom generic surfaces) still open.

- 2026-07-13 (review + replan): Reviewed codebase vs plan — Phase 1/4 done, Phase 2 underway, `tsc` clean, tree clean at `f213be5`. Verified genericity is architecturally present but only 2 industries delivered; identified 3 concrete blockers (ingest `emit` ignores `apqc_{industry}` caches; web `Industry` union + industries.ts hardcoded to 2; telecom leakage in "generic" function-unit/stream/thesaurus surfaces). Reordered RESUME HERE "Next tasks" to lead with P1 multi-industry work; logged 2 stale entries (connectors mock-only line, legacy flat baseline TTLs). No code changes.

- 2026-07-12 (docs): Specs.md, user_manual.md, DemoScript.md; demo-script E2E + shared demo-recording-flow.

- 2026-07-12 (night): OpenRouter primary in `llm.py`; agent-trigger banners; workshop slide E2E; SSO login E2E (`sso-login.spec.ts`).

- 2026-07-12 (evening, pushed `41d05a7`): PDF download + audit trail UI on engagement overview and `/audit` page.

- 2026-07-12 (day): Steps 0–4 — draft-process-tags + draft-ontology-links UI, engagement delete, E2E green (`f213be5`).

- 2026-07-12: WIP commit d1f0ef9 — API side of draft-process-tags (element_meta.aiSuggestion + PATCH clear support) and draft-ontology-links (stateless grounded proposals) agents written, syntax-checked, NOT verified. Web UI, verification, and engagement delete endpoint are next — detailed steps in RESUME HERE.

- 2026-07-11: Phase 2 alignment stack — alignment API/UI, gap-bridge + initiative agents, Workshop mode, web SSO, goal links, consultant toolkit on dashboard. Design spec `2026-07-11-workshop-alignment-gap-bridge-design.md`. `tsc` clean; migration `b3d1c04f9e21` applied.

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
