"""Run Trivy over a local directory via subprocess and return its parsed JSON.

Responsibility
--------------
Build and run `trivy fs --format json --scanners vuln,secret,misconfig <path>`,
parse stdout, and return the raw dict. Raises nothing on scanner failure — returns
an empty result plus an error string for ScanResult.errors, so one dead scanner
never kills the scan.

Do not interpret fields here. Field mapping belongs in normalize.py, and the
authoritative field names live in fixtures/trivy_sample.json — read it, never guess.

Definition of done
------------------
Returns a dict with the same top-level shape as fixtures/trivy_sample.json when run
against /demo-app.
"""
