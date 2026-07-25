# TASKS.md

One task per session. Update the Status cell when a task is done, then stop.

Status values: `todo` · `in-progress` · `done` · `blocked`

Owners: **C** = Charvitha (Fedora, backend) · **S** = Sindhu (Windows, frontend) · **C+S** = together

For the at-a-glance "what's left right now" view, see [STATUS.md](STATUS.md).

| # | Task | Owner | Status | DoD-command |
|---|---|---|---|---|
| 1 | Context + fixtures — real Trivy and Semgrep JSON captured into `/fixtures`, plus `mock_results.json` conforming to CONTRACT.md | C | todo | `python -c "import json;[json.load(open(f)) for f in ['fixtures/trivy_sample.json','fixtures/semgrep_sample.json','fixtures/mock_results.json']]"` |
| 2 | Demo app — small deliberately vulnerable repo in `/demo-app` that both scanners flag | C | todo | `trivy fs demo-app \| head` and `semgrep --config auto demo-app \| head` both report findings |
| 3 | Scan endpoint + normalizer — `POST /scan` runs both scanners via subprocess, `backend/scanners/normalize.py` maps raw output to `Finding` | C | todo | `curl -X POST localhost:8000/scan -d '{"repo_url":"./demo-app"}' -H 'content-type: application/json'` returns a `scan_id` |
| 4 | Reduction — dedup + rank down to 30 findings, `occurrences` populated | C | todo | `stats.after_dedup < stats.raw_findings` and `len(findings) <= 30` in the written results file |
| 5 | Scoring — 0–100 risk score, four components, band derivation | C | todo | `risk.score` is an int 0–100 and `risk.band` matches the CONTRACT.md bands |
| 6 | Attack paths — build 2–5 step chains + edges from ranked findings | C | todo | `attack_paths` non-empty and every `finding_id` resolves |
| 7 | LLM reasoning — Gemini structured JSON fills `explanation`, `narrative`, `risk.summary` | C | todo | every reported finding has non-null `explanation` |
| 8 | Pipeline wire-up — scan → normalize → reduce → score → paths → LLM → `results/<scan_id>.json`, plus `GET /results/{scan_id}` and `GET /results` | C | todo | `curl localhost:8000/results/<id>` returns a document that validates against `backend/models.py` |
| 9 | Frontend scaffold + DEMO_MODE — Next.js 14 App Router, Tailwind, shadcn/ui; `NEXT_PUBLIC_DEMO_MODE=true` serves `fixtures/mock_results.json` | S | todo | `npm run dev` and `localhost:3000` renders with the backend stopped |
| 10 | Scan page — repo URL input, submit, progress state | S | todo | submitting a repo navigates to the dashboard for that `scan_id` |
| 11 | Dashboard — risk gauge, four component bars, stats, ranked findings table | S | todo | `localhost:3000/dashboard/<scan_id>` shows score + 30 rows |
| 12 | Finding drawer — click a row, see snippet, package, CWE, refs, LLM explanation | S | todo | drawer opens with explanation text for any row |
| 13 | Attack graph — `@xyflow/react` node graph of `attack_paths`, clicking a node opens its finding | S | todo | graph renders all paths and node click opens the drawer |
| 14 | Polish — empty states, loading skeletons, severity colors, responsive layout | S | todo | no unstyled flash, no console errors |
| 15 | Integration — DEMO_MODE off, frontend against live backend end to end (**runs on Charvitha's Fedora box** — scanners can't run on Windows) | C+S | todo | fresh scan from the UI renders in the dashboard |
| 16 | Golden run — one scan of the demo app saved as the guaranteed-good demo artifact | C | todo | `results/golden.json` exists and loads in the UI |
| 17 | Video — screen recording of the golden run walkthrough | S | todo | video file exists, under the submission time limit |
| 18 | Decisions doc — fill in `DECISIONS.md` | C | todo | no empty sections in `DECISIONS.md` |
| 19 | Pitch — submission blurb + slides | S | todo | pitch text finalized and submitted |
