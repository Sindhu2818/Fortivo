"""Run Semgrep over a local directory via subprocess and return its parsed JSON.

Responsibility
--------------
Build and run `semgrep --config auto --json --quiet <path>`, parse stdout, and
return the raw dict. Semgrep exits 1 when it finds results — that is success, not
failure. On real failure, return an empty result plus an error string.

Do not interpret fields here. Field mapping belongs in normalize.py, and the
authoritative field names live in fixtures/semgrep_sample.json — read it, never guess.

Definition of done
------------------
Returns a dict with the same top-level shape as fixtures/semgrep_sample.json when
run against /demo-app.
"""
