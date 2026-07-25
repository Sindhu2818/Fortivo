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

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

TRIVY_BINARY = "trivy"
TRIVY_SCANNERS = "vuln,secret,misconfig"
# Trivy uses exit code 1 when vulnerabilities are present; that is still success.
_TRIVY_OK_EXIT_CODES = frozenset({0, 1})


class TrivyError(Exception):
    """Raised when Trivy cannot be run or its output cannot be used."""


def _resolve_scan_directory(repo_path: str | Path) -> Path:
    """Return an existing directory path for the filesystem scan target."""
    path = Path(repo_path)
    if not path.is_dir():
        raise TrivyError(f"Scan path is not a directory: {repo_path}")
    return path.resolve()


def _build_trivy_command(scan_dir: Path) -> list[str]:
    """Argv for a JSON filesystem scan matching fixtures/trivy_sample.json capture."""
    return [
        TRIVY_BINARY,
        "fs",
        "--format",
        "json",
        "--scanners",
        TRIVY_SCANNERS,
        str(scan_dir),
    ]


def _parse_trivy_json(stdout: str) -> dict[str, Any]:
    """Parse Trivy stdout into a dict."""
    text = stdout.strip()
    if not text:
        raise TrivyError("Trivy produced empty stdout")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TrivyError(f"Trivy stdout is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise TrivyError("Trivy JSON root must be an object")
    return parsed


def run_trivy(repo_path: str | Path) -> dict[str, Any]:
    """Run Trivy against a local repo tree and return the raw report dict."""
    scan_dir = _resolve_scan_directory(repo_path)
    command = _build_trivy_command(scan_dir)

    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise TrivyError(
            f"{TRIVY_BINARY} executable not found on PATH; install Trivy to scan"
        ) from exc

    if completed.returncode not in _TRIVY_OK_EXIT_CODES:
        detail = (completed.stderr or completed.stdout or "").strip()
        message = f"Trivy scan failed (exit {completed.returncode})"
        if detail:
            message = f"{message}: {detail}"
        raise TrivyError(message)

    return _parse_trivy_json(completed.stdout)
