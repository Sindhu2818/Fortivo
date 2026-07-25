# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | — | Task 10 — scan page |
| **Next** | Task 1 — capture real scanner fixtures | Task 10, then Task 11 |
| **Blocked on** | nothing | nothing (see the status-endpoint note below) |

Backend is untouched — all files are stubs. `frontend/` runs: `npm run dev` boots, the
design tokens are wired, and with `NEXT_PUBLIC_DEMO_MODE=true` the landing page,
`/scan` and `/dashboard/<id>` all render off `fixtures/mock_results.json` with no
backend running.

---

## One-time setup (do this first, both of you)

**Sindhu (Windows + WSL) — do all of this inside WSL, not in Windows-native Python:**
- [ ] WSL2 with a Linux distro installed, repo cloned/accessible from inside it
- [ ] `python3.11 -m venv .venv && source .venv/bin/activate`
- [ ] `pip install -r backend/requirements.txt`
- [ ] Install Trivy (the official install script, or your distro's package manager)
- [ ] Install Semgrep (`pip install semgrep` — same venv is fine)
- [ ] `cp .env.example .env`, paste a real `GEMINI_API_KEY`
- [ ] Confirm `trivy --version` and `semgrep --version` both work **in the WSL shell**

**Charvitha (Fedora):**
- [ ] Node 20 LTS installed
- [ ] `cp .env.example frontend/.env.local` (keep `NEXT_PUBLIC_DEMO_MODE=true`)
- [ ] You do **not** need Trivy, Semgrep, Python, or a running backend. Everything
      you build reads `fixtures/mock_results.json` until Task 15.

---

## Pending work, in dependency order

### Sindhu — backend chain
- [ ] **1. Fixtures** — real Trivy + Semgrep JSON in `/fixtures`. *Unblocks everything, including Charvitha's realistic mock data. Do this first.*
- [x] **2. Demo app** — the vulnerable repo the whole demo scans
- [ ] **3. Scan endpoint + normalizer**
- [ ] **4. Reduction** — dedup + rank to 30
- [ ] **5. Scoring** — 0-100 + four components
- [ ] **6. Attack paths**
- [ ] **7. LLM reasoning** — Gemini structured JSON
- [ ] **8. Pipeline wire-up** — the first end-to-end `results/<scan_id>.json`
- [ ] **16. Golden run**
- [ ] **18. DECISIONS.md**

### Charvitha — frontend chain
- [x] **9. Scaffold + DEMO_MODE** — `lib/api.ts` is the only file that knows the mode
- [ ] **10. Scan page**
- [ ] **11. Dashboard** — risk gauge, breakdown, stats, findings table
- [ ] **12. Finding drawer**
- [ ] **13. Attack graph** (`@xyflow/react`, not `reactflow`)
- [ ] **14. Polish**
- [ ] **17. Video**
- [ ] **19. Pitch**

### Together
- [ ] **15. Integration** — must happen on Sindhu's machine, since it's the only one
      that can run the scanners. Backend runs inside WSL; start the frontend from the
      **same WSL shell** so `http://localhost:8000` resolves. Pull latest, set
      `NEXT_PUBLIC_DEMO_MODE=false`.

---

## The one hard sync point

Charvitha's work is only as good as `fixtures/mock_results.json`.

**Status 2026-07-25: the realistic fixture has landed** — as of this session the file
holds **30 findings and 2 attack paths** (raw 412 → dedupe 180 → 30), and the frontend
renders all 30 rows off it. It is still uncommitted in the working tree, so **Sindhu:
commit it.** The frontend reads the funnel numbers straight out of this file rather
than hardcoding them, so replacing it again costs the frontend nothing.

Still worth building for: long titles, 4-step paths, and `explanation: null`.

Everything else is decoupled. The contract is frozen, so neither side waits on the
other for shape — only for realism.

---

## Blocked / needs the other person

*Write it here instead of reaching into the other person's tree.*

- **Sindhu → Charvitha: one progress endpoint, needed for Task 15, not before.**
  CONTRACT.md is frozen and only describes the *result* document, so it says nothing
  about polling a scan that is still running. The frontend now calls:

  `GET /scan/{scan_id}/status` → `{ "status": ..., "stage": ..., "counts": {...} }`

  where `status` is the CONTRACT.md enum, `stage` is one of `cloning` | `scanning` |
  `normalizing` | `reducing` | `reasoning` | `complete`, and `counts` is
  `{ total_raw, after_dedupe, analyzed }` — `after_dedupe` and `analyzed` are `null`
  until their stage runs. The shape lives in `frontend/lib/types.ts` as `ScanProgress`.
  **This is a proposal, not a decision** — if the path or field names don't suit the
  pipeline, say so and the frontend changes, since only `lib/api.ts` touches it.
  Nothing is blocked meanwhile: DEMO_MODE scripts the whole timeline locally.

**Resolved 2026-07-25 — frontend deps are installed.** The list is frozen in
`CLAUDE.md`; no further dep-approval turn is needed. Sindhu needs no action.

---

## Cut list — drop these first if the clock runs out

In this order, top one goes first:

1. **Task 14 polish** — ship it plain
2. **Task 10 scan page** — demo straight from `/dashboard/golden`, skip live submission
3. **Task 7 LLM prose** — the UI handles `explanation: null`; the score and paths still work
4. **Task 13 attack graph** — fall back to rendering paths as a numbered list

**Never cut:** the reduction stat (412 → 260 → 30) and the risk score. That funnel
*is* the pitch — it's the one number that says why Fortivo exists.

---

## Demo-day insurance

- [ ] `results/golden.json` committed and loading in the UI **before you sleep on the 25th**
- [ ] Demo runs with `NEXT_PUBLIC_DEMO_MODE=true` so a dead backend, a rate-limited
      Gemini key, or venue wifi cannot break the presentation
- [ ] Both laptops can run the demo independently
