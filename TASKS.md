# TASKS.md

One task per session. Update the Status cell when a task is done, then stop.

Status values: `todo` · `in-progress` · `done` · `blocked`

Owners:

- **C** = Charvitha (Frontend)
- **S** = Sindhu (Backend)
- **C+S** = Together

For the at-a-glance view, see `STATUS.md`.

| # | Task | Owner | Status | DoD-command |
|---|---|---|---|---|
| 1 | Context + fixtures — real Trivy and Semgrep JSON captured into `/fixtures`, plus `mock_results.json` conforming to CONTRACT.md | S | done | `python -c "import json;[json.load(open(f)) for f in ['fixtures/trivy_sample.json','fixtures/semgrep_sample.json','fixtures/mock_results.json']]"` |
| 2 | Demo app — small deliberately vulnerable repo in `/demo-app` that both scanners flag | S | done | `trivy fs demo-app \| head` and `semgrep --config auto demo-app \| head` both report findings |
| 3 | Scan endpoint + normalizer — `POST /scan` runs both scanners via subprocess, `backend/scanners/normalize.py` maps raw output to `Finding` | S | done | `curl -X POST localhost:8000/scan -d '{"repo_url":"./demo-app"}' -H 'content-type: application/json'` returns a `scan_id` |
| 4 | Reduction — dedup + rank down to 30 findings, `occurrences` populated | S | in-progress | `stats.after_dedup < stats.raw_findings` and `len(findings) <= 30` |
| 5 | Scoring — 0–100 risk score, four components, band derivation | S | in-progress | `risk.score` is an int 0–100 |
| 6 | Attack paths — build 2–5 step chains + edges from ranked findings | S | in-progress | `attack_paths` non-empty |
| 7 | LLM reasoning — Gemini structured JSON fills `explanation`, `narrative`, `risk.summary` | S | todo | every finding has non-null explanation |
| 8 | Pipeline wire-up — scan → normalize → reduce → score → paths → LLM → results | S | in-progress | `/results/<id>` returns a valid document |
| 9 | Frontend scaffold + DEMO_MODE | C | done | frontend runs without backend |
| 10 | Scan page | C | done | submit navigates to dashboard |
| 11 | Dashboard | C | done | dashboard renders findings |
| 12 | Finding drawer | C | done | drawer opens correctly |
| 13 | Attack graph | C | done | graph renders |
| 14 | Polish | C | done | responsive, no console errors |
| 15 | Integration | C+S | todo | frontend works with live backend |
| 16 | Golden run | S | todo | `results/golden.json` exists |
| 17 | Video | C | todo | walkthrough recorded |
| 18 | Decisions document | S | todo | `DECISIONS.md` completed |
| 19 | Pitch | C | todo | slides finalized |