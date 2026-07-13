# Industry-standards agent

Keeps the per-industry process baselines in `data/baselines/{industry}/` in sync
with their APQC industry PCF source PDFs in `ReferenceDocs/Industries/`.

For each recognised industry PDF the agent:

1. **parses** the PDF → `ProcessElement` tree (reuses `services.ingest.parsers.apqc_pdf`),
   cached to `services/ingest/cache/apqc_{slug}.jsonl`;
2. **proposes** a value-stream → PCF-subtree mapping by keyword-matching each
   stream's buckets against the industry's own level-1/level-2 category names
   (its top-level numbering differs per industry) → a **draft**
   `services/ingest/mapping/streams_{slug}.yaml`;
3. **derives** an engagement profile (`data/profiles/{slug}.json`: the
   industry-appropriate function-unit subset + value streams);
4. **emits** OWL TTL + BPMN baselines (all 5 streams) + a SKOS thesaurus
   (`data/thesaurus/apqc_{slug}.ttl`) — identical to `ots-ingest emit`;
5. **validates** every emitted TTL.

The mapping and profile are **drafts for consultant review**, not final. The
agent never overwrites a human-curated `streams_{slug}.yaml` (any file lacking
the `AGENT-GENERATED DRAFT` marker) or an existing profile — remove the marker
once a mapping is reviewed to protect it from future agent runs. Baselines are
always emitted from the on-disk YAML, so a curated override wins.

## CLI

```bash
uv run ots-industry-agent list                 # discovered industry PDFs
uv run ots-industry-agent check                # drift report (no writes); exits 1 on drift
uv run ots-industry-agent sync --all           # sync every changed industry
uv run ots-industry-agent sync --all --force   # re-emit everything
uv run ots-industry-agent sync --industry healthcare_provider --force
```

`sync` is idempotent: it skips an industry whose source-PDF hash matches the
manifest (`data/baselines/.industry_manifest.json`) and whose outputs exist,
unless `--force`.

## Running periodically

The agent is designed to run on a schedule so baselines track evolving
standards (a new/updated PCF PDF dropped into `ReferenceDocs/Industries/`).
`check` exits non-zero when any industry is new/changed, so a scheduler can gate
a `sync` and open a review PR for the agent-drafted mappings.

**cron** (weekly drift check, e.g. in an ops box with the repo + `uv`):

```cron
0 6 * * 1  cd /path/to/OTS && uv run ots-industry-agent check || \
             (uv run ots-industry-agent sync --all && \
              git checkout -b industry-sync-$(date +%F) && \
              git add data/ services/ingest/ && \
              git commit -m "chore: industry-standards agent sync" )
```

**CI** (GitHub Actions, scheduled): run `uv run ots-industry-agent check`; on
non-zero, run `sync --all` and open a PR with the diff for human review of the
drafted `streams_{slug}.yaml` mappings before merge.

**Claude Code routine**: `/schedule` a cloud routine that runs `check` and, on
drift, `sync --all` + PR — same contract as CI.

## Known limitations

- Mappings are keyword heuristics — good for PCFs that mirror the cross-industry
  structure, thinner for industries with bespoke terminology (e.g. Education's
  `c2m`/`t2r` came up empty and need manual subtree selection). Streams with no
  matched subtree still emit a valid minimal `Start → End` BPMN.
- `telecom` (uses TM Forum eTOM baselines) and `NACE corrosion` (not an industry
  PCF) are excluded from discovery.
- An optional LLM refinement pass over the draft mapping (via the shared
  `services/api/llm.py`) is a natural extension; heuristics are the always-on default.
