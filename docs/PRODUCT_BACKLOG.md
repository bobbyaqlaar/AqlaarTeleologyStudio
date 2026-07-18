# Ontology-Teleology Studio — Product Backlog

**Purpose:** Remaining (open) product work.  
**Completed work:** [PRODUCT_ARCHIVE.md](./PRODUCT_ARCHIVE.md)

---

## Governance (mandatory)

1. **Open items only** live in this file.
2. When an item is **completed**, move it from **this file → [PRODUCT_ARCHIVE.md](./PRODUCT_ARCHIVE.md)**  
   (record completion date + short evidence).  
   Do **not** move archive → backlog.
3. Prefer small, testable IDs (`PB-###`). Update status in place while in progress; move only when done.
4. Design detail may still live under `docs/superpowers/specs/`; this file is the product queue.

---

## Priority bands

| Band | Meaning |
|------|---------|
| **P0** | Blocks demos / production-like use |
| **P1** | Core product objective / high user value |
| **P2** | Quality, depth, polish |
| **P3** | Post-v1 / research |

---

## P0 — Environment & connectors

| ID | Item | Status | Notes |
|----|------|--------|-------|
| PB-001 | Set live Salesforce / Jira credentials in `.env` | Open | `OTS_SF_*`, `OTS_JIRA_*` — connect returns 503 hint until set |
| PB-002 | Document ops runbook for shared Postgres with other local apps | Open | Host port 5434 already; avoid volume collisions |

---

## P1 — Data quality & standards depth

| ID | Item | Status | Notes |
|----|------|--------|-------|
| PB-010 | Human review of APQC↔eTOM alignment candidates | Open | `mapping/alignments/apqc-etom.yaml` — 13 candidates; set approved/rejected |
| PB-011 | Curate Education `c2m` / `t2r` stream subtrees | Open | Agent draft matched nothing; edit `streams_education.yaml` |
| PB-012 | Review all `AGENT-GENERATED DRAFT` stream mappings | Open | Promote curated files (remove draft marker) after consultant OK |
| PB-013 | Deepen generic APQC baselines via `streams.yaml` | Open | Full parse in `cache/apqc.jsonl`; mapping tweak, not new parser |
| PB-014 | Optional LLM refinement in industry-standards agent | Open | Documented extension via `llm.py` |

---

## P1 — Product features

| ID | Item | Status | Notes |
|----|------|--------|-------|
| PB-020 | Agent scheduling (cron/periodic) beyond event triggers | Open | Spec §16; event triggers already shipped |
| PB-021 | Optional BPMN customization drafting agent | Open | Post workshop automation |
| PB-022 | Make Actor–Method process model the default process UX | Open | Today optional alongside classic BPMN editor |
| PB-023 | Engagement-level edit UI for functionUnits / valueStreams config | Open | Seeded from profile at create; later edit path thin |

---

## P2 — Quality & platform

| ID | Item | Status | Notes |
|----|------|--------|-------|
| PB-030 | SHACL shapes + `ots-ingest validate` SHACL pass | Open | Plan §1.6 — `shapes.ttl` never written |
| PB-031 | Delete legacy flat `data/baselines/*.ttl` after confirming no consumers | Open | Superseded by `{industry}/` layout |
| PB-032 | Dedup minor eTOM/SID thesaurus duplicate concepts | Open | Optional cleanup |
| PB-033 | Extend Playwright for Actor–Method process-model path | Open | Seed → bind → validate → Apply fix |
| PB-034 | SSO-required mode E2E (`OTS_AUTH_MODE=required`) | Open | Optional mode covered |
| PB-035 | Reconcile legacy `TODO-implementation-plan.md` into archive/backlog only | Open | Keep plan as session log or freeze |

---

## P3 — Post-v1

| ID | Item | Status | Notes |
|----|------|--------|-------|
| PB-040 | Live crawl of standards bodies (vs local PCF PDFs) | Open | Industry agent today syncs local `ReferenceDocs` |
| PB-041 | Additional vertical frameworks (BIAN, Microsoft CDM, …) | Open | Beyond APQC + eTOM/SID seed |
| PB-042 | Unsupervised autonomous agents (non draft-then-verify) | Open | Explicitly out of current scope |
| PB-043 | Multi-tenant hosted deployment + hardened auth | Open | Dev Keycloak only today |

---

## Suggested next slice

1. **PB-001** — connector creds if demo needs live CRM/tickets.  
2. **PB-011 / PB-012** — harden education + draft mappings.  
3. **PB-010** — finish APQC↔eTOM candidate review.  
4. **PB-022 / PB-033** — promote Actor–Method UX + E2E.

---

## Related

- [PRODUCT_ARCHIVE.md](./PRODUCT_ARCHIVE.md) — done items  
- [OPERATIONS.md](./OPERATIONS.md) — how to run / maintain  
- [SPECS.md](./SPECS.md) — architecture  
- [UserManual.md](./UserManual.md) — usage  
