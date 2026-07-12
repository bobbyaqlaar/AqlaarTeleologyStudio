# OTS — Demo Recording Script

**Purpose:** Step-by-step script for a 6–8 minute product demo (LinkedIn, Substack, conference reel).

**Validated by:** `apps/web/e2e/demo-script.spec.ts` (mirrors this script against the live stack).

**Before recording:** Complete [User Manual §1](./user_manual.md#1-starting-the-system-admin). Stack must show `health` OK and `OPENROUTER_API_KEY` set for AI moments.

---

## Pre-flight (off-camera, 5 min)

```bash
# Terminal 1
docker compose up -d postgres fuseki keycloak

# Terminal 2 — repo root
OTS_DATABASE_URL=postgresql+psycopg://ots:ots@localhost:5434/ots \
FUSEKI_URL=http://localhost:3030 \
OTS_BASELINE_DIR=data/baselines OTS_THESAURUS_DIR=data/thesaurus \
uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel \
  --with "psycopg[binary]" --with python-dotenv --with httpx \
  --with alembic --with reportlab --with "pyjwt[crypto]" \
  python -m uvicorn main:app --app-dir services/api --port 8000

# Terminal 3
cd apps/web && npm run dev
```

- Browser: http://localhost:3000 — zoom 100%, dark mode (default), hide bookmarks bar.
- Close other tabs. Only one `next dev` instance.
- Optional: sign in as **alex** via SSO for a polished header (“Alex Morgan”).

---

## Scene 1 — Hook (0:00–0:30)

**Say:**

> “Enterprise transformation fails when process maps, data models, and strategic goals live in separate decks. Ontology-Teleology Studio connects all three — and AI drafts the artefacts; your team verifies them.”

**Show:** Engagements list → quick pan of sidebar labels (Streams, Process, Ontology, Teleology, Alignment, Workshop).

---

## Scene 2 — New client engagement (0:30–1:00)

**Do:**

1. Click **New engagement**.
2. Name: `Globex Digital Transformation` (or your client name).
3. Client: `Globex Telecom`.
4. Industry: **Telecom (TM Forum eTOM)**.
5. **Create and open streams**.

**Say:**

> “We pick the industry baseline — here TM Forum eTOM — so process and ontology names match what telecom stakeholders already know.”

**Show:** Five value-stream cards (O2C, P2P, C2M, H2R, T2R).

---

## Scene 3 — Load baselines + AI trigger (1:00–1:45)

**Do:**

1. On **O2C · Order to Cash** → **Load baseline**. Wait for **Loaded** badge.
2. If **AI draft ready** banner appears, point at it — do not dismiss yet.
3. Load **P2P · Procure to Pay** as well (needed later for initiatives).
4. Click **Open process map** (from banner or O2C card).

**Say:**

> “Baselines are real APQC and eTOM content — not empty templates. The moment we load, agents can draft function tags and system hints; consultants accept or dismiss, never blind-apply.”

**Show:** BPMN canvas with ~20 eTOM tasks in lanes.

---

## Scene 4 — Process discovery (1:45–2:30)

**Do:**

1. In **Process steps**, click **Develop Sales Proposal** (or first visible sales task).
2. Set **Function unit** → **Sales**.
3. **Systems** → Add **Salesforce**.
4. Open **Gap suggestions** drawer — scroll one LLM suggestion.

**Say:**

> “Every step gets an enterprise function tag and system map. Gap analysis compares your map to the baseline and surfaces hand-off risks — grounded in the actual BPMN, not generic chat advice.”

**Show:** Colored function tag on task; Salesforce chip; gap drawer content.

---

## Scene 5 — Ontology + thesaurus (2:30–3:15)

**Do:**

1. Click sidebar **Ontology (OWL)**.
2. Wait for graph + class tree.
3. If **AI draft ready** banner for links, mention it.
4. **Thesaurus** panel → search `order` → **Map** on a concept.
5. Briefly show a mapped chip on the selected class.

**Say:**

> “The ontology graph is live in Fuseki — SPARQL-backed, not a static diagram. We map OWL classes to APQC or eTOM thesaurus concepts so IT and business speak one vocabulary.”

---

## Scene 6 — Teleology (3:15–3:45)

**Do:**

1. **Continue to teleology** (or sidebar Teleology).
2. Add goal: `Cut order cycle time by 30%` → Enter.
3. **Save row** → **Submit for review**.

**Say:**

> “Teleology captures what ‘good’ looks like — goals, gaps, ambitions — tied to revenue, cost, customer experience, and time-to-market themes.”

**Show:** Goal in list; status *in review*.

---

## Scene 7 — Alignment + bridge gaps (3:45–4:30)

**Do:**

1. Sidebar **Alignment**.
2. Pan the heatmap — click one cell to open drill-down.
3. **Bridge gaps with AI** — wait for status line (`AI drafted N solution option(s)`).
4. Scroll one solution option card.

**Say:**

> “Alignment scores are deterministic — they join teleology, tagged process, and ontology evidence. The gap-bridge agent proposes stream-scoped solution options; accept to fold into the transformation story.”

---

## Scene 8 — Transformation initiatives (4:30–5:00)

**Do:**

1. Sidebar **Initiatives**.
2. **Draft initiatives with AI**.
3. Select one initiative card; show cross-stream linkage panel.

**Say:**

> “Initiatives are the roadmap layer — one program linking O2C, P2P, and more. This is where discovery becomes a prioritized transformation portfolio.”

---

## Scene 9 — Workshop mode (5:00–5:45)

**Do:**

1. Sidebar **Workshop mode** (full screen).
2. Show welcome slide (`Stakeholder workshop` + client name).
3. Click **Next** twice — stream intro (**Order to Cash** heading).
4. Toggle **Parking lot** — type one question → add.
5. **Exit** workshop.

**Say:**

> “Workshop mode is the same-screen facilitator view — process steps, ontology, teleology, alignment wrap-up — with a parking lot that persists as review comments.”

**Show:** Slide counter (`2 / N`), agenda rail on wide screen.

---

## Scene 10 — Stakeholder approval (5:45–6:15)

**Do:**

1. Sidebar **Review**.
2. Role switcher → **Stakeholder** (or show jordan SSO sign-in if recording SSO variant).
3. **Approve** on **O2C stream teleology**.
4. Switch back to **Consultant**.

**Say:**

> “Stakeholders don’t edit the maps — they verify and approve. Role-aware review keeps governance clean.”

---

## Scene 11 — Exports + audit (6:15–6:45)

**Do:**

1. Engagement **Overview** (dashboard).
2. **Exports & audit** → **Download PDF** — open PDF briefly (watermark visible).
3. **Audit trail** → scroll 3–4 events (baseline load, tag, agent, approval).

**Say:**

> “Every mutation is audit-logged. PDF export is client-ready with watermark — board packs, not screenshots.”

---

## Scene 12 — Close (6:45–7:00)

**Say:**

> “Ontology-Teleology Studio: industry baselines, workshop-first UX, AI that drafts and humans verify, alignment scoring, and a transformation roadmap — one platform from discovery to approval.”

**Show:** Dashboard or engagements list. Fade out.

---

## Optional B-roll shots (insert anywhere)

| Shot | URL / action |
|------|----------------|
| Fuseki graph | http://localhost:3030 → dataset `ots` (admin/admin) |
| API health | http://localhost:8000/health |
| SSO sign-in | Role switcher → Sign in with SSO → alex/alex |
| Connectors | `/engagements/{id}/connectors` — preview panel (if creds set) |

---

## Recording tips

- **Pace:** Pause 2s after each AI button for LLM response.
- **Failures:** If drafting fails, say “OpenRouter key missing” and show gap **heuristics** still working — do not fake success.
- **Resolution:** 1920×1080; capture browser window only.
- **Audio:** Record narration separately if needed; cut to click sounds in edit.

---

## Automated validation

This script is enforced by Playwright:

```bash
cd apps/web && npm run test:e2e -- e2e/demo-script.spec.ts
```

Also covered by `consultant-flow.spec.ts` and `sso-login.spec.ts`.

---

## Demo engagement shortcut (no create step)

Pre-seeded **Acme Corp** (`eng-acme-001`) — O2C loaded, review items pending:

| Step | URL |
|------|-----|
| Dashboard | `/engagements/eng-acme-001` |
| Process | `/engagements/eng-acme-001/streams/o2c/process` |
| Workshop | `/engagements/eng-acme-001/workshop` |

Use for a shorter 4-minute demo; skip Scenes 2–3 (create/load) and open Acme directly.

---

## Related documents

- [Specs.md](./Specs.md) — architecture
- [user_manual.md](./user_manual.md) — full usage guide
