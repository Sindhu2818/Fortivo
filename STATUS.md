# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | Backend verification and integration | Task 14 — Polish |
| **Next** | Gemini integration → Golden run | Video, pitch |
| **Blocked on** | nothing | nothing |

Backend architecture has been implemented. Scanner wrappers, normalization,
pipeline orchestration, storage, models and API endpoints are present.
Remaining work is validating the complete pipeline, integrating Gemini,
verifying attack-path generation and producing the final golden demo result.

The frontend already runs independently in demo mode using
`fixtures/mock_results.json`.

---

## One-time setup (do this first, both of you)

### Sindhu (Windows + WSL)

- [ ] WSL2 with Linux installed
- [ ] Create virtual environment
- [ ] Install backend requirements
- [ ] Install Trivy
- [ ] Install Semgrep
- [ ] Configure `.env`
- [ ] Add Gemini API key
- [ ] Verify both scanners work

### Charvitha (Fedora)

- [ ] Install Node 20 LTS
- [ ] Copy `.env.local`
- [ ] Keep `NEXT_PUBLIC_DEMO_MODE=true`

---

## Pending work

### Sindhu — backend chain

- [x] **1. Fixtures** — sample Trivy and Semgrep JSON added
- [x] **2. Demo app** — vulnerable demo application completed
- [x] **3. Scan endpoint + normalizer** — backend endpoints and normalizer implemented
- [~] **4. Reduction** — implementation present, needs validation
- [~] **5. Scoring** — implementation present, needs validation
- [~] **6. Attack paths** — implementation present, needs validation
- [ ] **7. LLM reasoning** — Gemini integration remaining
- [~] **8. Pipeline wire-up** — pipeline exists, end-to-end testing remaining
- [ ] **16. Golden run**
- [ ] **18. DECISIONS.md**

### Charvitha — frontend chain

- [x] **9. Scaffold + DEMO_MODE**
- [x] **10. Scan page** — landing + `/scan/[id]` progress with the funnel counter
- [x] **11. Dashboard** — RiskGauge + ReductionStat header row, ranked FindingsTable below
- [x] **12. Finding drawer** — Sheet with code snippet, ScoreBreakdown, reasoning and DiffViewer
- [x] **13. Attack graph** — `AttackPathGraph` + `AttackPathNode`, tabbed when a scan has more than one path, hidden entirely when it has none
- [ ] **14. Polish**
- [ ] **17. Video**
- [ ] **19. Pitch**

### Together

- [ ] **15. Integration**

Backend will expose the live scan endpoint and frontend will switch
`NEXT_PUBLIC_DEMO_MODE=false` for the final demo.

---

## Current backend status

Implemented:

- FastAPI backend
- Scan API endpoints
- Scanner wrappers
- Result storage
- Data models
- Finding normalization
- Pipeline orchestration
- Demo application
- Sample scanner fixtures

Remaining:

- Validate reduction
- Validate scoring
- Validate attack paths
- Gemini reasoning
- Golden demo artifact
- Final integration

---

## Blockers

Currently no blocking issues between frontend and backend.

### Needs a decision from Sindhu — two fields the contract does not have

`fixtures/mock_results.json` carries two fields on every attack path that
**CONTRACT.md does not define**:

- `attack_paths[].steps[].kind` — `entry` \| `pivot` \| `impact`
- `attack_paths[].edges[].label` — the caption drawn on the connector

The contract is frozen, so I have not added them to it. `frontend/lib/types.ts`
types both as **optional** and `AttackPathGraph` degrades without them: it derives
`kind` from the edge topology (nothing points at it → entry, it points nowhere →
impact, otherwise pivot) and omits the caption on an unlabelled edge. A
contract-only document therefore still renders correctly, and the richer fixture
document renders better.

Sindhu: if the backend is going to keep emitting these — and it already does —
they should be written into CONTRACT.md properly, which is a call for whoever owns
the contract, not something I should do from the frontend. If they are going away
instead, nothing on the frontend breaks.

### Note — attack-path nodes depart from collisions.md rules 1 and 3

Task 13 specified node colour by step *kind*: entry amber, pivot blue, impact red.
`docs/frontend-refs/collisions.md` rule 1 reserves amber and red for the severity
ramp, and rule 3 says the node border carries the *finding's severity* and the icon
stays neutral. The built component follows the task, not the doc.

Mitigations already in the code: pivot blue is the Primary token rather than a new
blue, impact red is the ramp's own critical red rather than a sixth red, and every
node still shows its severity as a **labelled pill with a dot**, so hue is never
the only carrier of severity. The residual collision is that an `entry` node's
amber border sits near a `high`/`medium` severity pill in a similar hue.

If we would rather keep the doc: `KIND_STYLES` in
`frontend/components/AttackPathNode.tsx` is the single place to change — set all
three `hex` values to a neutral (`hsl(var(--muted-foreground))`) and the kind then
reads from the icon and label alone.

### Dead file

`frontend/components/AttackGraph.tsx` is the earlier attack-graph attempt and is
now unimported — `AttackPathGraph.tsx` replaced it. Left in place rather than
deleted because removing it was outside task 13; safe to delete in task 14.

Note for task 15: the drawer's ScoreBreakdown shows `risk.components` weighted by
the same 0.40 / 0.25 / 0.20 / 0.15 used in `backend/core/score.py`. Those weights
are duplicated in `frontend/components/ScoreBreakdown.tsx` for display — if the
backend ones change, that file has to change with them.