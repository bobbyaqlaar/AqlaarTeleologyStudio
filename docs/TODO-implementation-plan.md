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
- [x] System mapping: `SystemDef` + `systems[]` on BpmnElementMeta, static catalog constants/systems.ts (DataSources.xlsx was APQC links, not systems), SystemTagPanel beside function panel, processService.setSystems. Coverage matrix view still TODO (nice-to-have). Persisted mock-only until Phase 4.
- [x] ThesaurusPanel in ontology workspace: framework select (apqc/etom/sid), debounced search, map/unmap class→concept via API (`ots:mapsToConcept`), mapped chips on class. E2E-tested against live Fuseki.
- [x] Generated .bpmn served from API (`GET /baselines/{industry}/{stream}/bpmn`); process-store loadProcessState fetches it (fixture fallback when API offline); task lists parsed from XML. Verified: telecom o2c renders 20 eTOM tasks in bpmn-js.
- [x] Fixed: process/ontology pages no longer 404 on client-loaded baselines (server mock store can't see client loads — real fix is Postgres, Phase 4). CORS widened to any localhost port (dev).
- KNOWN pre-existing bug: Base UI "MenuGroupContext is missing" error from role-switcher dropdown (components/ui/dropdown-menu.tsx:64) — surfaces in dev console, fix separately.

## Phase 4 — Persistence + production

- [x] Postgres core (2026-07-09): docker-compose postgres:17 (host port 5434 — 5432/5433 taken by other projects). services/api: db.py (create_all + seed Acme/Globex), db_models.py, engagements_router (list/create/get/load-baseline/approval), process_router (state seeds from industry .bpmn, PUT xml, PATCH element meta functionUnit+systems). Web: lib/api/backend.ts helper; engagement/stream/process services fetch-first w/ mock fallback (UI-only mode preserved); all 8 server pages read via engagementService. E2E-verified: engagement created via API appears in UI, function tag survives full reload from Postgres. API needs `uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel --with "psycopg[binary]"` locally (system pip is PEP-668 locked) or docker.
- [ ] Postgres remaining: comments, teleology_rows, connectors, review_state tables + routers + service swaps; Alembic migrations (create_all only today); engagement delete/archive endpoint.
- [ ] Live LLM gap analysis endpoint (Claude API; compare engagement BPMN vs baseline KG).
- [ ] OIDC auth, audit events, PDF export, Playwright E2E (spec §15 order).

## Session log

- 2026-07-09: Role-switcher dropdown bug fixed (label moved into RadioGroup, commit 3856849). Phase 4 core Postgres landed + E2E-verified (see Phase 4 section). **Next:** remaining Postgres tables (comments/teleology/connectors/review), live LLM gap analysis endpoint, systems coverage matrix, Alembic, auth/audit/PDF/Playwright.

- 2026-07-08 (late night): Phase 3 complete. Industry picker, thesaurus panel, system tagging, API-served BPMN — all E2E-verified in running app (telecom flow: load O2C → 20 eTOM tasks render → tag Salesforce on step → ontology shows 25 eTOM classes → map class to APQC 9.2.2 concept, chip persists in Fuseki). `npm run build` green. **Next: Phase 4** — Postgres persistence (fixes server/client mock-store split), live LLM gap analysis, coverage matrix, auth/audit/PDF/E2E.

- 2026-07-08: Plan written. Phase 0 done (commit bc74a87). Phase 1 mostly done: ingest package built, pipeline runs end-to-end (`parse-apqc` → `emit` → `validate` all green). O2C baseline now 22 real APQC classes w/ provenance; BPMN 18 tasks/3 lanes, valid XML. **Next up:** (1) re-crawl TM Forum MODA (dump too thin: 27 objects), (2) apqc_pdf parser for industry PCFs, (3) SKOS cross-framework exactMatch alignment, (4) Phase 2 API: baseline graphs by industry + thesaurus endpoints.
- 2026-07-08 (night): Telecom baselines emitted from eTOM (streams_telecom.yaml + selection.py refactor of emitters) — validated, BPMN parses clean. APQC↔eTOM alignment pass done (21 exact auto-approved, 13 candidates awaiting Bobby's review in mapping/alignments/apqc-etom.yaml) → data/thesaurus/alignments.ttl. Phase 1 COMPLETE except candidate review. **Next: Phase 3 UI** — industry picker on engagement create, system-mapping panel, thesaurus search panel in ontology workspace, serve generated .bpmn from API.
- 2026-07-08 (evening): MODA fully crawled (18,257 pages) + breadcrumb parser → eTOM 3198 / SID 5124; thesauri emitted (apqc/etom/sid TTL, live-search-tested via API: multi-word regex works). Phase 2 API done + integration-tested (baselines catalog, initialize?industry=, thesaurus search, concept-mapping w/ mappedConcepts on classes). apqc_pdf parser done (3 industries tested). **Next:** telecom baseline emit from eTOM subtrees (needs etom entries in streams.yaml + emitter support for etom cache), SKOS exactMatch alignment, Phase 3 UI (industry picker, system mapping, thesaurus panel), Phase 4 persistence.
- 2026-07-08 (later): Bobby approved `hr` function unit → added across web enum/colors, ingest validator, streams.yaml (h2r 7.x → hr), spec, README. Re-emitted baselines, validation green. Verified all 5 generated .bpmn parse clean via bpmn-moddle (0 warnings; h2r lanes hr+finance). `npx tsc --noEmit` clean.
