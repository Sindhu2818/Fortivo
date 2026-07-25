# fixtures

Ground truth for field names. **Never guess a scanner's JSON shape — read these.**

| File | What it is | Filled by |
|---|---|---|
| `trivy_sample.json` | Real, unedited output of `trivy fs --format json --scanners vuln,secret,misconfig demo-app` | Task 1 |
| `semgrep_sample.json` | Real, unedited output of `semgrep --config auto --json demo-app` | Task 1 |
| `mock_results.json` | A complete document conforming to `CONTRACT.md`, used by the frontend in `DEMO_MODE` | Task 1 |

The two scanner samples must be captured verbatim from a real run. Do not
hand-write them — the whole point is that they are authoritative.

`mock_results.json` currently holds a minimal placeholder document. Task 1 replaces
it with a full 30-finding, multi-attack-path example so the frontend can be built
against realistic volume.
