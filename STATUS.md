# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | Backend verification and integration | — |
| **Next** | Gemini integration → Golden run | Task 17 — Video, then task 19 — pitch |
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
- [x] **14. Polish** — skeletons, error state with retry, empty states, one
  documented spacing scale, hover/focus everywhere, fixed header + logo, favicon
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

### Dead file — still there

`frontend/components/AttackGraph.tsx` is the earlier attack-graph attempt and is
now unimported — `AttackPathGraph.tsx` replaced it. Task 14 tried to delete it and
the sandbox refused the `rm`, so it is still in the tree. It is unreachable and
harmless (nothing imports it, `next build` and `next lint` are both clean), but it
is the only file left carrying off-scale spacing, so it will keep showing up in a
`p-5` / `py-2.5` grep of the spacing audit. Delete it by hand when convenient:

```
git rm frontend/components/AttackGraph.tsx
```

### Task 14 — what the polish pass actually changed

Nothing about logic or data flow, per the task. Specifics worth knowing:

- **Spacing scale is documented in `frontend/app/globals.css`**, above the base
  layer. That comment is the source of truth now: page shells are `px-6 py-10`,
  top-level cards are `rounded-xl p-6`, bands inside cards are `px-6 py-4`, nested
  panels are `rounded-lg p-4`, sections are `mt-8` apart. Cards used to be a mix of
  `p-6`/`rounded-xl` and `p-8`/`rounded-2xl` depending on which route you were on.
- **Keyboard focus is a single `outline` rule in globals.css**, wrapped in
  `:where()` so it has zero specificity and any component can override it. Do not
  reintroduce a bare `focus-visible:outline-none` — `ui/button.tsx` had one, which
  meant the primary CTA had no focus state at all.
- **`FindingDrawer` no longer needs `pt-14`** to clear the Sheet's close button;
  the identity block carries `pr-12` instead, so the body is a plain `p-6`.
- **The findings table now passes `selectedId` on `/dashboard/[scanId]`** as well
  as `/scan/[id]` — the prop already existed and was optional, the dashboard just
  was not using it. Selected rows tint `bg-primary/10` so they read differently
  from a hover.
- **Retry** on ErrorState re-enters the existing effect via a `reloadKey` /
  `retryKey` counter in the dependency array. The fetch and the poll themselves are
  untouched.
- **The favicon and the header mark are one drawing.** `components/Logo.tsx` holds
  the two paths; `app/favicon.ico` is those same paths rasterised at 16/32/48.
  Regenerate the .ico if the mark ever changes.
- Verified at 1440x900 in headless Chrome against `fixtures/mock_results.json`:
  landing, `/scan`, `/scan/[id]`, `/dashboard/[scanId]`, plus the skeleton and both
  error states. `npm run lint` and `tsc --noEmit` are clean and **no route logs a
  console error**.

Not verified by screenshot: the drawer's own layout, because driving a click needs
a browser automation dep we do not have. It typechecks and builds, and the changes
to it were small (`p-6 pt-14` -> `p-6` + `pr-12`, an empty state for the code block,
link hover). Worth one manual click before recording task 17.

Note for task 15: the drawer's ScoreBreakdown shows `risk.components` weighted by
the same 0.40 / 0.25 / 0.20 / 0.15 used in `backend/core/score.py`. Those weights
are duplicated in `frontend/components/ScoreBreakdown.tsx` for display — if the
backend ones change, that file has to change with them.