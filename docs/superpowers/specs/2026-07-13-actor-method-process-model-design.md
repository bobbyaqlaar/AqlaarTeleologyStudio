# Actor–Method Process Model — Design Spec

**Created:** 2026-07-13. **Owner:** Bobby. **Status:** approved architecture, phased build.

Re-design of how OTS builds process diagrams + ontology so processes are
**flexible, configurable, and validated**. Decisions locked with Bobby 2026-07-13:

1. **DB steps are the source of truth** — the ordered method-invocation sequence
   in Postgres is authoritative; the BPMN diagram is **generated from it**.
2. **Parameters are typed by the ontology** — each input/output parameter
   references an ontology concept (OWL class / SKOS thesaurus concept).
3. **Actor is a first-class entity**, and **every actor is tagged to one of the
   11 function units** (so lanes/colours and the existing function-unit model
   keep working).

## Motivation (the five requirements)

1. Each process step is a **function/method that belongs to an actor**, stored in the DB.
2. A method has **typed input and output parameters**.
3. The **sequence** of method invocations in a process is stored in the DB.
4. The sequence is **validated**: each step's required inputs must be satisfied by
   an earlier step's output or an initialised process global, with matching
   ontology types — otherwise a precise error is raised with a correction path.
5. This makes **adding steps/methods in workshops** safe and configurable.

## Data model (Postgres)

```
actors                         methods                       method_parameters
------                         -------                       -----------------
id            (pk)             id            (pk)            id            (pk)
engagement_id (null=catalog)   actor_id      (fk actors)     method_id     (fk methods)
name                           engagement_id (null=catalog)  direction     input|output
kind          role|system|…    name                          name          (variable name)
function_unit (1 of 11) *      description                   concept_uri   (ontology type)
description                                                  concept_label (denormalised)
                                                             required      (bool)
                                                             seq           (int)

process_steps                                    process_globals
-------------                                    ---------------
id             (pk)                              id            (pk)
engagement_id  (fk)  stream_type                 engagement_id (fk)  stream_type
method_id      (fk methods)                       name          (variable name)
seq            (int, order in the process)        concept_uri   (ontology type)
input_bindings  JSONB  {inputParam: sourceVar}    concept_label
output_bindings JSONB  {outputParam: newVar}      initial_value (nullable)
label          (optional BPMN task name)
```

`*` **actor.function_unit is required** — every actor carries one of the 11
function-unit tags. Lanes in the generated BPMN = distinct actor function units.

Actors + methods default to **catalog** rows (`engagement_id = NULL`) forming a
reusable library; engagements may add engagement-scoped actors/methods.
`process_steps` and `process_globals` are always engagement+stream scoped.

## Variable space + validation (requirement 4)

A process's **variable space** is a name → ontology-concept map. Validation walks
steps in `seq` order:

```
available = { g.name: g.concept_uri for g in globals }          # initialised space
for step in steps (by seq):
    for p in method.inputs where p.required:
        src = step.input_bindings.get(p.name)
        if not src:                    → error UNBOUND      (input not wired)
        elif src not in available:     → error UNAVAILABLE  (no earlier output / global)
        elif not is_a(available[src], p.concept_uri):
                                       → error TYPE_MISMATCH
    for o in method.outputs:
        available[ step.output_bindings.get(o.name, o.name) ] = o.concept_uri
```

`is_a(actual, expected)` = exact URI match, or `actual rdfs:subClassOf* expected`
(Fuseki) / `skos:broader*` (thesaurus). Falls back to exact match when Fuseki is
down. Each problem carries `{stepId, seq, method, input, kind, suggestions}` where
suggestions are actionable: *bind to an existing variable of the right type*,
*initialise a global of that type*, or *insert an upstream step whose output
produces it*. Empty problem list = the process is executable/consistent.

## BPMN generation (requirement 1 — steps drive the diagram)

`GET /process-model/{eng}/{stream}/bpmn` regenerates BPMN from the steps:
lanes = distinct actor function units (existing colour tokens), one task per step
(name = `label` or method name), sequence flow in `seq` order, start/end events.
Reuses the `services/ingest/emitters/bpmn` layout approach. The bpmn-js canvas
becomes a **generated view**; editing happens on the step list, not raw XML.

## API (services/api/process_model_router.py)

- Actors:   `GET/POST /api/v1/process-model/actors`, `PATCH/DELETE /actors/{id}`
- Methods:  `GET/POST /methods` (+ params), `PATCH/DELETE /methods/{id}`
- Steps:    `GET /process-model/{eng}/{stream}` (steps + globals + validation),
            `POST /steps`, `PATCH/DELETE /steps/{id}`, `POST /steps/reorder`
- Globals:  `POST /globals`, `DELETE /globals/{id}`
- Validate: `GET /process-model/{eng}/{stream}/validate` → problem list
- BPMN:     `GET /process-model/{eng}/{stream}/bpmn` → generated XML

## Coexistence + migration

The current `process_states` (BPMN XML + element_meta) stays for engagements that
have not migrated. A **seed importer** bootstraps the new model from an existing
baseline: each BPMN task / ingest process element → a catalog method (owned by an
actor tagged to the task's function unit), the `precedes`/order chain → the step
`seq`; parameters start empty and are authored in workshops. Fuseki ontology
classes remain the concept registry that parameter types point at.

## Phased build

- **Phase 1 — [x] DONE 2026-07-13 (backend, verified).** Tables + Alembic
  migration `d5f8b2a1c3e4` (actors, methods, method_params, process_steps,
  process_globals); `process_model_router.py` (actor/method/param + step/global
  CRUD, validate, generated-BPMN); `process_validation.py` (pure dataflow engine,
  injectable `is_a`); `process_model_bpmn.py` (BPMN from steps). `delete_engagement`
  extended to clean the new child rows. Verified end-to-end via API: built an O2C
  (Sales Rep→Capture Order[customer→order], Credit Analyst→Run Credit Check
  [order→creditDecision]); **no global set → `unavailable` error w/ suggestions**;
  initialise `customer` global → valid; **rebind order-input to a Customer var →
  `type_mismatch` error**; rebind correctly → valid; **BPMN generated from steps**
  (tasks Capture Order/Run Credit Check, lanes sales/finance). Gotcha fixed:
  SQLModel parent/child in one commit needs `session.flush()` before the FK-linked
  child insert (no ORM relationship to order them).
- **Ontology subtype compatibility — [x] DONE 2026-07-13.** `is_a` now uses
  `FusekiClient.ancestor_map` (`rdfs:subClassOf+` / `skos:broader+` across graphs,
  best-effort, exact-match fallback), so a variable typed by a subtype satisfies an
  input expecting an ancestor. Verified: a 2-level subtype (`apqc/10_1_1_1`)
  satisfies an input expecting `apqc/10_1`; an unrelated concept → `type_mismatch`.
- **Phase 2 — [x] DONE 2026-07-13.** `POST …/{eng}/{stream}/seed-from-baseline`
  parses the generated baseline BPMN → engagement actors (one per function unit) +
  methods (one per task) + steps in order; idempotent (clears a prior seed).
  Verified: generic O2C → 18 steps, actors sales/operations/finance, 0 problems.
- **Phase 3.1 — [x] DONE 2026-07-13 (verified in-app).** (a) **Apply & check**
  button (available any time) → `GET …/validate`, surfaces a pass/fail banner;
  validation now also checks **outputs** — an output must be bound to a variable
  name (`output_unbound`) and re-publishing an existing variable with an
  incompatible type is an `output_conflict` (verified via API). (b) **BPMN view**:
  a Steps ⇄ BPMN toggle in the header; BPMN renders the generated diagram full-size
  (`BpmnEditor` read-only). Verified in-app: Apply shows the green "input and output
  variables check out" banner; BPMN toggle shows the lane diagram.
- **Phase 3.4 — [x] DONE 2026-07-15 (verified in-app).** **Input-side** errors are
  now one-click too. Each input problem carries `compatible` (existing variables
  whose type satisfies the input) + `expectedLabel`; the card renders a **"Bind to
  '…'"** button per compatible variable and an **"Initialise global (Type)"** button
  (creates a global of the expected concept + binds the input to it). Verified: an
  `unbound` input → "Bind to 'cust'" → green Consistent; and the initialise-global
  path → valid. Input errors that need an upstream producer still show text guidance.
- **Phase 3.3 — [x] DONE 2026-07-15 (verified in-app).** Corrections are
  **actionable in the GUI**. Output bindings are now editable inline (like inputs);
  each output problem carries its `output` param, and its card shows a one-click
  **"Apply fix: rename output to '…'"** button that rebinds the output to a free
  variable name (suggested from the used-name set). Verified: an `output_overwrite`
  warning → click Apply fix → output becomes `order_2`, badge returns to green
  Consistent. Fixed a Base UI uncontrolled-input warning by keying the binding
  fields to their committed value so they remount (and reflect the corrected value).
- **Phase 3.2 — [x] DONE 2026-07-15 (verified in-app).** Problem **severity**
  (`error` | `warning`). Overwriting an existing variable with a *compatible* type
  is now an `output_overwrite` **warning** (silent-overwrite guard), vs the
  incompatible-type `output_conflict` error. `/validate` returns `{valid, errors,
  warnings, problems}`; `valid` = no errors (warnings don't invalidate). UI: amber
  vs red throughout — header badge (green Consistent / amber "N warnings" / red "N
  issues"), Apply banner, and per-step cards tone by severity. Verified: a global +
  a step re-publishing the same variable → `valid:true, warnings:1`, amber
  "output overwrite" card + "1 warning" badge.
- **Phase 3 — [x] DONE 2026-07-13 (verified in-app).** Workshop step-editor at
  `/engagements/[id]/streams/[streamId]/process-model`: `process-model-service.ts`,
  `process-model-workspace.tsx` (seed, ordered step cards w/ actor-unit chips,
  reorder/remove, editable input bindings, add-step-from-method, **create
  method/actor with ontology-typed params** [req 5], globals add/remove via a
  `ConceptPicker`, live validation w/ suggestions, generated-BPMN preview via the
  existing `BpmnEditor`). Linked from the Process (BPMN) page. `tsc` clean; verified
  against the live stack (seed → 18 step cards w/ Sales/Operations/Finance lanes,
  delete round-trips 18→17).
```
```
