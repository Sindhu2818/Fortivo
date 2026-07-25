# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | — | — |
| **Next** | Task 1 — capture real scanner fixtures | Task 9 — Next.js scaffold + DEMO_MODE |
| **Blocked on** | nothing | nothing |

Nothing is done yet. The tree exists; all code files are stubs.

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
- [ ] **9. Scaffold + DEMO_MODE** — *can start immediately, no backend needed*
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

Charvitha's work is only as good as `fixtures/mock_results.json`. The stub version in
the repo has **3 findings and 1 attack path** — enough to compile against, not enough
to reveal layout problems.

**Sindhu: after Task 1, replace it with a realistic 30-finding, 3-attack-path
document and tell Charvitha it landed.** Until then Charvitha should build for volume
she can't yet see: assume 30 rows, long titles, 4-step paths, and `explanation: null`.

Everything else is decoupled. The contract is frozen, so neither side waits on the
other for shape — only for realism.

---

## Blocked / needs the other person

*Write it here instead of reaching into the other person's tree.*

- **Frontend deps are pre-approved but NOT installed.** Charvitha approved the full
  list on 2026-07-25 and it is now frozen in `CLAUDE.md`. They could not be installed
  from a backend session: `frontend/` has no `package.json` yet (Task 9 unstarted), and
  `create-next-app` refuses to scaffold into a directory that already has one.
  **Charvitha — after the Task 9 scaffold, run these two and no approval turn is needed:**
  `npm i motion clsx tailwind-merge lucide-react @xyflow/react`
  `npx motion-primitives@latest add text-effect` (needs Tailwind + `components.json`
  + `lib/utils.ts` `cn()` in place first, i.e. run `shadcn init` before it).

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
