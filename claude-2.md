# CLAUDE.md — project context and known-verified facts

This file is read automatically by Claude Code at session start. It exists because a real
end-to-end scan (real backend, real browser, `NEXT_PUBLIC_DEMO_MODE=false`) surfaced several
mismatches between backend and frontend that are easy to re-break or re-discover if you don't
know they were already found. Treat everything below as verified fact, not a guess.

## Backend route contract (verified — do not assume more routes exist)

`main.py` defines exactly four routes:
- `GET /health`
- `POST /scan`
- `GET /results`
- `GET /results/{scan_id}`

**There is no `GET /scan/<id>/status` route.** The frontend calls it (`lib/api.ts:121`,
`getStatus()`), but it does not exist on the backend. Do not assume it exists, and do not
silently add it as a side effect of an unrelated fix — building it is an architecture decision,
not a bug fix (see next section).

## Backend is synchronous — this is the root cause of most mismatches

`run_scan()` (`core/pipeline.py:43`) runs clone → scan → reduce → score → attack_paths → llm
and only returns once everything is done. The `status` field in the `POST /scan` response is
always already `"complete"` or `"failed"` — it is never `"queued"` or `"running"`.

The frontend's `ScanProgress`/`ScanStage`/`ScanCounts` types (`lib/types.ts:148-169`) and the
funnel-counter progress UI assume a backend that reports live stage/count updates while a scan
is in flight. That backend does not exist yet. Per `lib/api.ts:143-147` and the (now-corrected)
`STATUS.md`, the polling endpoint was a frontend-side proposal that was never implemented
backend-side.

**Do not build a real async pipeline as a side effect of fixing something else.** Whether to
go sync-UI or build real async is an explicit decision to make with the project owner first.
Until that decision is made, assume synchronous and design frontend fixes accordingly.

## Two scan-submission flows exist — only one works, and it's not the one users can reach

- `/` → `ScanInput.tsx` → `POST /scan` → navigates to `/scan/<id>` → that page calls
  `getStatus()` → hits the nonexistent status route → 404. **This is broken**, and it's also
  how every entry in the "Recent scans" history list is linked (`app/page.tsx:77`), so clicking
  any past scan from the landing page hits the same 404 — even for scans that completed cleanly.
- `/scan` → `ScanForm.tsx` → `startScan()` → navigates straight to `/dashboard/<id>`, no
  polling. **This works end-to-end**, verified in a real browser. But nothing in the app links
  to `/scan` — it's only reachable by typing the URL directly.

Net effect: the working flow is orphaned, the broken flow is the only one reachable from the UI.
Any fix here should treat these as one decision (reconcile into one flow), not two separate patches.

## Neither entry point checks the `status` field before navigating

`ScanInput.tsx:40-43` and `app/scan/page.tsx:55-58` both destructure only `scan_id` from the
`POST /scan` response and navigate unconditionally — even when the body says
`"status":"failed"`. Confirmed directly: a real scan attempt against `./demo-app` returned
HTTP 202 with `{"scan_id":"...","status":"failed"}`. Any fix to either entry point must check
`status` before navigating, not just extract `scan_id`.

## `./demo-app` relative path fails due to a cwd mismatch — not a typo, a real bug

`main.py`'s own module docstring (`main.py:17-19`) instructs running
`uvicorn main:app --port 8000` from `/backend`, then hitting it with
`repo_url: "./demo-app"`. This does not work: `scanners/clone.py:82` resolves
`Path(repo_url).is_dir()` against the process's cwd, which is `/backend`, not the repo root —
so `./demo-app` (which lives at repo root) fails in ~0.02s with
"Local repository path is not a directory: ./demo-app".

This exact string (`./demo-app`) is prefilled in both `ScanInput.tsx:21` and `ScanForm.tsx:16`
— it's the one-click demo path. Fix by resolving relative to repo root (not process cwd), or
by changing the prefilled value to something that resolves correctly given documented startup
instructions. Don't fix only one of the two prefill sites.

## Failed scans are visually identical to real low-risk scans in the history list

When `repo_url` resolution fails, the backend still saves a full `ScanResult` with
`status: "failed"`, `risk.score: 0`, `risk.band: "low"` (the band is correctly derived from
score per the contract's own rule — this part is not a bug). But the history list
(`app/page.tsx:73-92`) only ever reads `scan.band`/`scan.score` for its badge, never
`scan.status` — so a scan that never ran renders as a "LOW · 0" badge, indistinguishable from
a genuine clean result. Any fix must surface `status` in the badge, not just style it differently.

## `FindingsTable` sorts one way, displays rank from another

`FindingsTable.tsx:46-49` sorts findings by `score_contribution` descending for row order, then
`FindingsTable.tsx:110` prints each row's `rank` field — which was assigned before this
re-sort. Net effect: the visible `#` column skips around (e.g. `1, 2, 3, 6, 7, 8, ... 4, 5`)
even though `CONTRACT.md`'s invariant that `findings` is rank-ordered is true of the underlying
JSON. This reads as corrupted data but isn't — it's a display bug only. Fix by either sorting
on `rank` for display, or re-deriving the printed number from post-sort position, not by
touching the underlying data contract.

## Explicitly out of scope — do not touch without being asked

- `kind` and `edges[].label` extension fields already degrade correctly and are tracked
  separately. Do not "fix" these as a side effect of other work.
- LLM-backed prose (`explanation.what/why_it_matters/fix`, `risk.summary`, attack-path
  title/narrative) is template fallback text when `GEMINI_API_KEY` is unset
  (`core/llm.py:100`, non-fatal by design). Generic/duplicate-looking prose in that case is
  expected behavior, not a bug — don't "fix" the templates without confirming the key situation
  first.

## Environment / running it for real

- Backend venv: `backend/.venv` (Python 3.11, gitignored). Created via
  `pip install -r requirements.txt` plus `pip install semgrep` into it.
- Run backend from `backend/`: `uvicorn main:app --port 8000` (cwd matters — see the
  `./demo-app` section above).
- Run frontend: `npm run dev` in `frontend/`, with `NEXT_PUBLIC_DEMO_MODE=false` to exercise
  the real backend instead of demo/mock mode.
- `NEXT_PUBLIC_DEMO_MODE` is read in `lib/api.ts` and nowhere else at runtime — don't assume
  other files branch on it.

## Before editing routing, submission flow, or the sync/async question

Show a plan first. Don't edit `ScanInput.tsx`, `ScanForm.tsx`, `lib/api.ts`, or the
`/scan`/`/scan/<id>`/`/dashboard/<id>` routing as a quick patch — these are all tangled
together (see above) and a fix to one in isolation tends to leave the other flow still broken.