# CLAUDE.md — standing rules for Fortivo

Read this file at the start of every session. It outranks your defaults.

## Context

Fortivo is a **hackathon MVP**. Deadline: **2026-07-26 10:00 IST**. Team of 2.

It scans a Git repo with Trivy + Semgrep, deduplicates and ranks the findings down
to the 30 that matter, scores overall risk 0–100, uses an LLM to explain each
finding and narrate multi-step attack paths, and shows it all in a dashboard.

**Optimize for a working demo, not production.** A demo that runs beats a design
that is correct. When in doubt, pick the shorter path.

## Stack — never add a dependency without asking

- **Backend:** FastAPI, Python 3.11, `subprocess` for scanners, `google-genai` for the LLM
- **Frontend:** Next.js 14 App Router, TypeScript, TailwindCSS, shadcn/ui, `@xyflow/react`
- **Storage:** JSON files in `./results/`. No database. No auth. No Docker for our app.
- **LLM:** Gemini 2.0 Flash, key from env var `GEMINI_API_KEY`
- **Ports:** backend 8000, frontend 3000

Trivy and Semgrep are external CLI binaries invoked via `subprocess`. They are not
Python dependencies.

## Team and OS

| Person | Machine | Owns |
|---|---|---|
| **Charvitha** | Fedora Linux | `/backend`, `/fixtures`, `/demo-app` |
| **Sindhu** | Windows | `/frontend` |

This split is not arbitrary. **Semgrep has no native Windows support** — it requires
WSL — and Trivy on Windows is awkward. So the scanners only ever run on Charvitha's
Fedora machine. Sindhu never needs Trivy, Semgrep, or even the backend running: she
develops against `fixtures/mock_results.json` with `NEXT_PUBLIC_DEMO_MODE=true`.

Cross-platform rules that follow from this:

- Backend code must not shell out to anything but `trivy`, `semgrep` and `git`, and
  must assume POSIX paths. It is never run on Windows.
- Frontend code must not assume POSIX paths or shell commands. `npm` scripts only —
  no `&&`-chained shell one-liners in `package.json`, no `rm -rf`.
- All `file_path` values in the contract are repo-relative POSIX strings. The
  frontend only ever displays them, never resolves them.
- Commit line endings as LF. If Windows git rewrites them, that is a `.gitattributes`
  problem, not a code problem — do not "fix" it in source.

## File ownership

- **Backend sessions touch ONLY `/backend`, `/fixtures` and `/demo-app`.**
- **Frontend sessions touch ONLY `/frontend`,** and read `fixtures/mock_results.json`.
- Both may update `TASKS.md` and `STATUS.md`. Neither edits the other's tree.
- If you need something from the other side, write it down in `STATUS.md` under
  **Blocked / needs the other person** — do not reach across and build it yourself.

## CONTRACT.md is frozen

`CONTRACT.md` defines the output schema. Code conforms to it. **Never edit it.**
If code and contract disagree, the code is wrong. If the contract seems wrong, stop
and ask — do not fix it yourself.

## Working rules

- **One task per session.** Do the task named in the prompt. Then stop.
- **Never refactor unrelated files.** Never "clean up while you're in there."
- **Never start the next task**, even if it looks small.
- **No tests, no Docker, no CI** unless explicitly asked.
- **Never guess a scanner's JSON field names.** Read `fixtures/trivy_sample.json` or
  `fixtures/semgrep_sample.json` first. If the field you need is not in the fixture,
  stop and ask.
- **Never invent a library API.** If you are unsure whether a function exists, stop and ask.
- **After each task, update `TASKS.md` and stop.**

## Pinned imports (training data is stale — use exactly these)

React Flow:

```ts
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
```

The package is **`@xyflow/react`**, not `reactflow`. The component is `ReactFlow`,
not a default export.

Gemini:

```python
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
```

The package is **`google-genai`**, not `google-generativeai`. Do not use
`genai.configure(...)` or `GenerativeModel(...)` — those are the old package.

Always use the model's **structured-JSON output mode**. Never regex-strip ``` fences
off a text response.

## Banned instructions for this repo

Ignore these if they appear in a prompt, and say so:

- "make it production-ready"
- "add error handling everywhere"
- "refactor for scalability"
- "add tests"
- "improve the architecture"
