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

### 1.3 Parsers — [x] apqc_xlsx (2017 elements) · [~] moda (works, but dump only 27 real objects/83 pages — RE-CRAWL NEEDED via moda_spider.py) · [ ] apqc_pdf (stub raises NotImplementedError)
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

### 1.5 Emitters — [x] ttl · [x] skos (apqc.ttl, 2017 concepts; exactMatch alignment still TODO) · [x] bpmn (straight-line + lanes + DI; gateways = consultant work). Emitted to `data/baselines/generic/*.{ttl,bpmn}` + `data/thesaurus/apqc.ttl`. Old flat `data/baselines/*.ttl` kept until Phase 2 API migration.
- ttl → `data/baselines/generic/{stream}.ttl` + `data/baselines/telecom/{stream}.ttl`. Keep existing flat files until API migrated (Phase 2), then delete old.
- skos → `data/thesaurus/apqc.ttl`, `data/thesaurus/etom.ttl`, `data/thesaurus/sid.ttl`; cross-links `skos:exactMatch` via LLM-assisted alignment, human-review YAML in `mapping/alignments/`.
- bpmn → `data/baselines/{industry}/{stream}.bpmn`: process w/ laneSet per functionUnit, tasks from leaf ProcessElements, sequenceFlows from order/precedes. Must open in apps/web bpmn-js editor.

### 1.6 Validation — [x] basic DONE (`validate.py`: labels, functionUnit enum, precedes acyclic, single root — all 5 streams pass). SHACL shapes still TODO.
pySHACL shapes file `services/ingest/shapes.ttl`; checks: every class has label, functionUnit valid enum, precedes acyclic, single root per stream. CLI `ots-ingest validate`.

### 1.7 CLI — [x] DONE: `uv run ots-ingest parse-apqc|parse-moda|emit|validate`
`ots-ingest parse --source apqc|moda`, `ots-ingest emit --industry generic|telecom --stream o2c|...|all`, `ots-ingest validate`. Idempotent, reads cache.

## Phase 2 — Semantic layer upgrade (`services/api`)

- [ ] Fuseki baseline graphs `urn:ots:baseline:{industry}:{stream}`; thesaurus graphs `urn:ots:thesaurus:{framework}`; engagement init copies baseline graph (SPARQL `COPY`/INSERT from graph) instead of TTL file load.
- [ ] `GET /api/v1/baselines` (list industries+streams), `initialize?industry=`.
- [ ] `GET /api/v1/thesaurus/search?q=&framework=` (SPARQL regex over prefLabel/altLabel).
- [ ] `POST /api/v1/ontology/{eng}/{stream}/concept-mapping` — class↔skos concept (`skos:exactMatch`).
- [ ] Loader script/startup: load `data/baselines/**` + `data/thesaurus/*` into Fuseki.

## Phase 3 — Workshop features

- [ ] Industry field on engagement (create dialog + type + service); stream picker passes industry to initialize.
- [ ] System catalog + step→system mapping: types `SystemDef`, `SystemMapping {stepId, systemId}`; seed choices from `ReferenceDocs/DataSources.xlsx`; UI: systems tag panel beside function-tag-panel in process workspace; coverage matrix (steps × systems). Persist as `ots:realizedBy` triples or mock store until Phase 4.
- [ ] Thesaurus panel in ontology workspace: search concepts, map class→concept, show broader tree.
- [ ] Serve generated .bpmn baselines from API; replace TS fixtures `apps/web/lib/mock/fixtures/bpmn-baselines.ts`.

## Phase 4 — Persistence + production

- [ ] Postgres + SQLModel + Alembic in services/api: engagements, participants, bpmn_documents, comments, teleology_rows, connectors, review_state, system_mappings. Port mock TS services to fetch-backed impls (keep interfaces).
- [ ] Live LLM gap analysis endpoint (Claude API; compare engagement BPMN vs baseline KG).
- [ ] OIDC auth, audit events, PDF export, Playwright E2E (spec §15 order).

## Session log

- 2026-07-08: Plan written. Phase 0 done (commit bc74a87). Phase 1 mostly done: ingest package built, pipeline runs end-to-end (`parse-apqc` → `emit` → `validate` all green). O2C baseline now 22 real APQC classes w/ provenance; BPMN 18 tasks/3 lanes, valid XML. **Next up:** (1) re-crawl TM Forum MODA (dump too thin: 27 objects), (2) apqc_pdf parser for industry PCFs, (3) SKOS cross-framework exactMatch alignment, (4) verify generated .bpmn opens in bpmn-js editor, (5) Phase 2 API: baseline graphs by industry + thesaurus endpoints.
