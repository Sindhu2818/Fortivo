# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | Backend verification and integration | Task 15 — integration, frontend half done |
| **Next** | Gemini integration → Golden run | Task 17 — Video, then task 19 — pitch |
| **Blocked on** | a working Gemini key — see blockers | nothing |

Backend architecture has been implemented. Scanner wrappers, normalization,
pipeline orchestration, storage, models and API endpoints are present.
Remaining work is validating the complete pipeline, integrating Gemini,
verifying attack-path generation and producing the final golden demo result.

The frontend already runs independently in demo mode using
`fixtures/mock_results.json`.

**Task 15, frontend half: done and verified in a browser 2026-07-25.** With
`NEXT_PUBLIC_DEMO_MODE=false` against a live backend, `../demo-app` scans
end-to-end in 17.8s and the dashboard renders the real document — score 92,
`55 → 50 → 30`, 30 ranked findings, 5 attack paths. `next build`, `next lint`
and `tsc --noEmit` all clean. The remaining half is Gemini: the run above
emitted `GEMINI_API_KEY not configured; using fallback prose.`, so every
`explanation` is template text. See the blockers section for what changed and
what is left for Sindhu.

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

## Running it for real (not demo mode)

Added 2026-07-25 after the first live end-to-end run. Fedora is a normal Linux
box, so — unlike Sindhu's Windows machine — Trivy and Semgrep run on it
natively; no WSL needed on this side.

**Backend venv:** lives at `backend/.venv` (gitignored, not committed — each
machine creates its own). Built with Python **3.11** specifically (`main.py`
targets 3.11; the system default `python3` may be newer and untested here):

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install semgrep        # not in requirements.txt — it's a CLI tool, not a
                            # Python dependency of our code, but semgrep's own
                            # PyPI package is how you get the binary on Linux
```

**Run the backend** — from inside `backend/`, not the repo root:

```bash
cd backend && source .venv/bin/activate
uvicorn main:app --port 8000
```

**This section is out of date as of 2026-07-26 — `clone.py` changed underneath
it.** Commit `9108a87` made `clone.py` resolve relative paths against the
**project root** instead of the process cwd, which inverted the demo path:
`./demo-app` is now the correct one and `../demo-app` points outside the repo.
`utils/validators.py` did not get the same change, so right now **no relative
path works at all** — the two layers disagree and their valid inputs are
disjoint. See "Relative local paths are broken on both sides" in the blockers
section for the measurements and the one-line backend fix.

**The demo path is `./demo-app`**, and that is what the landing page now
prefills. Relative, not absolute, so it works on Sindhu's WSL too.

**Run the frontend:**

```bash
cd frontend && npm run dev
```

**The `NEXT_PUBLIC_DEMO_MODE` switch** — `frontend/.env.local` (gitignored,
copied from `.env.example`):

- `NEXT_PUBLIC_DEMO_MODE=true` — the default for normal frontend work. No
  backend needed; every `lib/api.ts` call resolves from
  `fixtures/mock_results.json` instead.
- `NEXT_PUBLIC_DEMO_MODE=false` — hits the real backend at
  `NEXT_PUBLIC_API_BASE` (`http://localhost:8000`). Only flip this when the
  backend is actually running, and expect the gaps documented in the blockers
  section below.

Flip it back to `true` before going back to normal frontend-only work — it's
not something any component branches on at runtime, so leaving it `false`
with no backend running just breaks everything silently.

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
- [x] **10. Scan page** — landing + `/scan/[id]` progress with the funnel counter.
  *Superseded during task 15: the progress page is gone and `/` submits straight
  to the dashboard. See Blockers.*
- [x] **11. Dashboard** — RiskScore + ScoreBreakdown header row, StatsBar,
  attack graph, ranked FindingsTable below
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

<!-- STALE as of 2026-07-25 — the line below was written before anyone ran the
     real backend against the real frontend. It's wrong. See the section
     immediately below for what a real run actually found. -->
~~Currently no blocking issues between frontend and backend.~~

### Relative local paths were broken on both sides (2026-07-26) — FIXED, both sides

This is Sindhu's issues 1, 2, 4 and 5. Diagnosed from the Fedora side, backend
running natively. **Root cause: two layers resolve a relative `repo_url`
against different bases, and their valid inputs no longer overlap.**

- `scanners/clone.py` — resolves against the **project root**
  (`Path(__file__).resolve().parents[2]`), since commit `9108a87`.
- `utils/validators.py` — resolves against the **process cwd**, via a bare
  `Path(repo_url).exists()`. Never got the matching change.

With uvicorn started from `backend/` (the documented way), measured today:

```
{"repo_url":"../demo-app"}   -> 202 {"status":"failed"}   0.007s
   passes validators.py (../demo-app exists relative to backend/)
   then dies in clone.py: "Local repository path is not a directory: ../demo-app"
   because project_root/../demo-app = ~/Projects/demo-app, outside the repo

{"repo_url":"./demo-app"}    -> 400 "Local path './demo-app' does not exist."
   rejected by validators.py before clone.py is ever reached
   (cwd is backend/), even though clone.py would have resolved it correctly

{"repo_url":"/abs/path/to/Fortivo/demo-app"} -> 202 {"status":"complete"} 3.7s
```

So only an **absolute** path works today, which is not portable across our two
machines. That is the whole of "Agent 1 stops before scanning" — nothing is
wrong with Trivy, Semgrep, the pipeline or the frontend.

**Fixed 2026-07-26 (Charvitha, with Sindhu's tree touched by agreement — see
"Note on file ownership" below).** Rather than patch the duplicated logic in two
places, the resolution now lives in one function:

- `scanners/clone.py` — new `resolve_local_path()`, the single source of truth.
  `_prepare_local_path()` calls it.
- `utils/validators.py` — imports and calls the same function, so it can no
  longer validate a different path than the one that gets scanned.
- Rejections now name the resolved path: `Local path '../demo-app' does not
  exist (resolved to /home/charvitha/Projects/demo-app).` That one line would
  have made this a five-minute bug instead of a six-issue report.

Verified after the fix:

```
./demo-app     -> accepted
../demo-app    -> rejected, and says what it resolved to
demo-app       -> rejected (no ./ prefix; see below)
/nope          -> rejected
```

Keep the `./` prefix — `validators.py` only takes its local-path branch for
inputs starting with `.` or `/`, so a bare `demo-app` is parsed as a URL and
rejected. The landing page prefills `./demo-app` accordingly.

### `.env` was never loaded — this is the real issue 6 (2026-07-26) — FIXED

`python-dotenv` has been in `requirements.txt` since the first commit and
**nothing ever called `load_dotenv()`**. `core/gemini.py` and `core/grok.py`
read `os.environ` directly, so the `.env` at the repo root was inert: the keys
could be filled in correctly and both agents would still log "API_KEY not set"
and fall back to template prose. Filling in `.env` would have fixed nothing.

`main.py` now calls `load_dotenv()` against the repo-root `.env` explicitly
(not by walking up from the cwd, so it loads the same file whether uvicorn
starts from `backend/` or the repo root). Confirmed: `GEMINI_MODEL` now arrives
from `.env` as `gemini-2.0-flash`.

**This changed the failure mode, and the new one is not ours to fix in code** —
see the next section.

### Both LLM keys are wrong — BLOCKED, needs Sindhu (2026-07-26)

With `.env` actually loading, the real API errors finally surfaced. Neither is a
code bug.

**Gemini — key has zero quota.** Three attempts, all
`429 RESOURCE_EXHAUSTED`, and the significant part is `limit: 0`:

```
Quota exceeded for metric: generativelanguage.googleapis.com/
  generate_content_free_tier_requests, limit: 0, model: gemini-2.0-flash
```

`limit: 0` is not "we used up the quota" — it is "this project has no free-tier
allowance at all". The key authenticates (429, not 401), so it is a real
credential attached to a project that cannot call the model. It also does not
have the `AIza…` shape an AI Studio key normally has. **Get a fresh key from
https://aistudio.google.com/app/apikey**, or enable billing on the existing
project. This is the last thing standing between us and Task 7.

**Grok — that is a Groq key, not an xAI key.** `GROK_API_KEY` starts with
`gsk_`, which is Groq Cloud's prefix (groq.com, the inference company). `grok.py`
posts to `https://api.x.ai/v1/chat/completions` (xAI, Elon's Grok). Different
companies, near-identical names. Confirmed directly against xAI:

```
GET https://api.x.ai/v1/models -> 400
{"code":"invalid-argument","error":"Incorrect API key provided.
 You can obtain an API key from https://console.x.ai."}
```

Two ways out, Sindhu's call:

1. Get a real xAI key from https://console.x.ai (`xai-…`). Nothing else changes.
2. Keep the Groq key and repoint Agent 4 at Groq — its API is OpenAI-compatible,
   the same shape `grok.py` already speaks, so it is a base-URL and model-name
   change (`https://api.groq.com/openai/v1/chat/completions`, e.g.
   `llama-3.3-70b-versatile`). I did **not** do this: it swaps a vendor, and
   CLAUDE.md's stack section does not list either Grok or Groq, so it is a team
   decision, not a bug fix. I could not verify the Groq key works — the check
   was blocked from this session.

Separately, `DEFAULT_GROK_MODEL` was `grok-2`, which xAI has retired (`400
"Model not found: grok-2"`). Bumped to `grok-4` to match `.env.example`. **Your
local `.env` still says `GROK_MODEL=grok-2` and env wins over the default — fix
that line too.** Unverified against the live API for lack of a valid key.

Note Agent 4 (Grok) is not in CLAUDE.md's stack, which names Gemini only. Worth
a conversation about whether it earns its place before the demo, given it is
currently pure fallback prose.

### GitHub `repo_name` keeps its `.git` — not a bug (2026-07-26)

Flagged this earlier as cosmetic. Checked CONTRACT.md before touching it:
`repo_name` is defined as "Last path segment of `repo_url`", and for
`…/juice-shop.git` that segment literally is `juice-shop.git`. Current behaviour
conforms. **Left alone** — the contract is frozen, so stripping the suffix would
put the code out of spec, not into it.

### GitHub URL scanning — could NOT reproduce a failure (2026-07-26)

Sindhu's issue 3. Ran it here against a real public repo:

```
{"repo_url":"https://github.com/juice-shop/juice-shop.git"}
   -> 202 {"status":"complete"} in 70.5s, 3 findings, score 26
```

Clone, scanners and the full pipeline all completed. So the failure is not in
`clone.py`'s git path, at least not on Linux. Two things worth checking before
assuming a backend bug:

- **It takes ~70s and the UI shows only a spinner.** `POST /scan` is
  synchronous and `lib/api.ts` sets no timeout, so the browser's own limit
  (~300s in Chrome) is the only bound. A large repo on WSL could plausibly read
  as a hang rather than a failure. If that is what happened, it is not a bug.
- **`derive_repo_name` returns `juice-shop.git`** for a URL ending in `.git` —
  the `.git` suffix is not stripped. Cosmetic, shows up in the dashboard
  header. Sindhu's call whether to fix; the contract does not forbid it.

**Sindhu: please paste the backend stdout for a failing GitHub scan.** Without
it there is nothing more to diagnose from this side — git clone in WSL failing
on a proxy or on credentials would look identical from the frontend.

### Scanner and key gaps seen on this machine (2026-07-26)

Sindhu's issue 6, plus one more. Every scan run here reported:

```
semgrep executable not found on PATH; install Semgrep to scan
Agent 3 [Gemini Expert]: GEMINI_API_KEY not set; using fallback technical analysis.
Agent 4 [Grok Advisor]: GROK_API_KEY not set; using fallback executive summary.
```

The Semgrep one is local to this Fedora box — `semgrep` is installed inside
`backend/.venv` but was not on PATH because uvicorn was launched as
`.venv/bin/uvicorn` without activating first. `source .venv/bin/activate` first
and it is found. Not a code bug, but worth knowing it degrades **silently**:
the scan still returns `status: "complete"` with Trivy-only findings, and
`stats.by_source` was `{"trivy": 30}` with no semgrep key. Easy to mistake for
a real result during the demo — check `by_source` has both before recording.

The two API keys are **set** in `.env` — they were just never being read, and
once they were, both turned out to be wrong. See the LLM blocker section above.

### Full end-to-end run — PASSES (2026-07-26)

Sindhu's issues 5 and 7. After the two fixes above, `./demo-app` from a cold
start, both scanners on PATH:

```
POST /scan {"repo_url":"./demo-app"} -> 202 {"status":"complete"} in 34.7s

raw -> dedup -> reported   55 -> 50 -> 30
by_source                  {"trivy": 19, "semgrep": 11}
by_severity                {"critical": 5, "high": 22, "medium": 3}
risk.score                 92 (critical)
risk.components            severity 90, exploitability 100, exposure 91,
                           blast_radius 86
attack_paths               5
explanation non-null       30 / 30   (fallback prose — see LLM blocker)
occurrences > 1            3 findings
```

Every stage in the chain is confirmed working: Trivy, Semgrep, normalization,
dedup, ranking, scoring, attack-path generation, persistence and the API
response. The `55 -> 50 -> 30` and score 92 match the numbers from the
2026-07-25 run, so nothing regressed. **The only thing still fake is the LLM
prose**, and that is a credentials problem, not a pipeline problem.

Task 4, 5, 6 and 8 DoD conditions are all met by this run.

### Note on file ownership (2026-07-26)

CLAUDE.md says frontend sessions do not touch `/backend`. **Charvitha
explicitly asked for the backend fixes to be done in the same session**, so
`utils/validators.py`, `scanners/clone.py`, `core/grok.py` and `main.py` were
edited from the frontend side. Flagging it here rather than leaving Sindhu to
find it in a diff.

Sindhu — two things to know before you pull:

- A **second Claude Code session was running a backend on port 8000 on this
  machine at the same time** and issuing its own scans. Early in this session a
  `pkill -f "uvicorn main:app"` was run to clean up a test server; if your
  backend died around 01:44 IST, that is why. Sorry.
- `results/` picked up five throwaway scan documents from this debugging. It is
  gitignored, so they will not follow the commit, but clear them before the
  golden run so `results/golden.json` is unambiguous.

### Real integration gap — found running a live scan (2026-07-25) — RESOLVED, frontend side

First time the backend ran for real (previously frontend-only / demo-mode-only
testing). Running `NEXT_PUBLIC_DEMO_MODE=false` against a live backend surfaced
actual blockers, not just the two flagged fields below:

- **No `GET /scan/{id}/status` endpoint exists on the backend.** The entire
  `/scan/[id]` progress page — `ScanProgress`/`ScanStage`/`ScanCounts`, the whole
  polling loop in `lib/api.ts`'s `getStatus()` — depended on it and got a 404 in
  real mode. That broke the landing page's only reachable "start a scan" flow,
  and every link in "Recent scans" (they all pointed at `/scan/<id>`).
- **Backend `POST /scan` is synchronous** — `run_scan()` (`core/pipeline.py`)
  runs the whole pipeline before it responds, so the `status` it returns is
  always already `"complete"` or `"failed"`, **never `"queued"` or `"running"`**.
  Anything polling for those two states is waiting on something this backend
  will never send.
- Neither `ScanInput.tsx` nor `app/scan/page.tsx` checked the `status` field
  they got back from `POST /scan` — both navigated forward on any 2xx response,
  even `{"status":"failed"}`.

**Decision taken 2026-07-25: keep the backend synchronous, delete the polling
UI.** Not building the status endpoint — a real async pipeline is a bigger
change than the demo needs, and the deadline is 2026-07-26. The frontend now
matches the backend it actually has:

- `/` → `ScanInput` → `startScan()` → **`/dashboard/<scan_id>`**, no polling.
  This is the flow that was already verified end-to-end in a browser; it just
  used to be orphaned behind `/scan`, which nothing linked to.
- `ScanInput` checks `status` and refuses to navigate on `"failed"`, showing
  the repo path it could not reach instead.
- "Recent scans" links point at `/dashboard/<id>` too, so a completed scan
  opens from history.
- **Deleted:** `app/scan/` entirely (both the form page and the `[id]` polling
  page), `components/ScanForm.tsx`, `components/ProgressStages.tsx`,
  `getStatus()` + the scripted demo timeline in `lib/api.ts`, and
  `ScanStage`/`ScanCounts`/`ScanProgress` in `lib/types.ts`. There are now
  exactly two routes: `/` and `/dashboard/[scanId]`.
- **Also deleted, orphaned by the above:** `components/RiskGauge.tsx` and
  `components/ReductionStat.tsx`. Both were the progress page's variants of
  things the dashboard already has — `RiskScore` and `StatsBar` respectively —
  and nothing imported them once `app/scan/` went. Not a design change: the
  dashboard's versions are the ones that were always on screen at the end.

Nothing here needs backend work. **Sindhu: no action required** — but note the
frontend no longer has any code path that would consume a status endpoint, so
don't build one for us.

The one cost: the `412 → 30 that matter` funnel animation went with
`ProgressStages`. The reduction story still lands on the dashboard statically
via `StatsBar`. The component is recoverable from git history if we want to
replay it over the dashboard's loading state later.

### Failed scans no longer masquerade as clean ones (2026-07-25)

A scan whose `repo_url` does not resolve still saves a full document with
`status: "failed"`, `risk.score: 0`, `risk.band: "low"` — correct per the
contract, the band really is derived from the score. But both the history list
and the dashboard read only the band, so a scan that never ran rendered as a
tidy `LOW · 0`, indistinguishable from a genuinely clean repo. There are three
such documents in `results/` right now, which is how it was caught.

Status now outranks the band in both places: `/` shows a neutral `FAILED` pill
instead of the band badge, `/dashboard/[scanId]` shows a `SCAN FAILED` pill in
the header. Neutral rather than red, per `collisions.md` — the severity ramp
keeps its colours.

### `FindingsTable` printed a rank it had just re-sorted away from

The table sorted rows by `score_contribution` descending, then printed each
row's `rank`, which had been assigned backend-side before that re-sort. The `#`
column therefore counted `1, 2, 3, 6, 7, ... 4, 5` on data that was perfectly
ordered — it read as corrupted output but was purely a display bug. Confirmed
against the live scan: `ranks` came back `1..30` in order, `score_contribution`
order was `1,2,3,6,7,8,9,10,11,12,13,4,5,...`.

Fixed by sorting on `rank`, which CONTRACT.md already guarantees the array
arrives in. No change to the underlying data or to the contract.

### Backend notes for Sindhu — not blocking, not touched from this side

Two things a live run surfaced that live in `/backend`, so per the ownership
rule they are written down here rather than fixed from a frontend session:

1. **`./demo-app` cwd bug.** `scanners/clone.py:82` resolves a local `repo_url`
   with a bare `Path(repo_url).is_dir()`, i.e. against the process cwd, which is
   `backend/`. `main.py`'s own docstring (lines 17-19) tells you to run from
   `backend/` and then POST `./demo-app` — those two instructions contradict
   each other. The frontend prefill now says `../demo-app` and works, so this is
   not blocking the demo; the real fix is resolving against the repo root.
2. **`scan_id` collides within the same second.** Ids are
   `scan_YYYYMMDD_HHMMSS`, so two scans started in the same second get the same
   id and the second overwrites the first. Hit it by accident on 2026-07-25
   running a failing scan and a succeeding one back to back — both came back as
   `scan_20260725_170336` and only one document survived. Only reachable with
   sub-second submissions, so low priority, but worth knowing before the golden
   run.

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

> Historical record, written before task 15. The `/scan` and `/scan/[id]` routes
> it mentions no longer exist — everything else below still holds.

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