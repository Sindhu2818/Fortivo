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

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

SEMGREP_BINARY = "semgrep"
SEMGREP_CONFIG = "auto"
# Semgrep uses exit code 1 when findings are present; that is still success.
_SEMGREP_OK_EXIT_CODES = frozenset({0, 1})


class SemgrepError(Exception):
    """Raised when Semgrep cannot be run or its output cannot be used."""


def _resolve_scan_directory(repo_path: str | Path) -> Path:
    """Return an existing directory path for the filesystem scan target."""
    path = Path(repo_path)
    if not path.is_dir():
        raise SemgrepError(f"Scan path is not a directory: {repo_path}")
    return path.resolve()


def _build_semgrep_command(scan_dir: Path) -> list[str]:
    """Argv for a JSON scan matching fixtures/semgrep_sample.json capture."""
    return [
        SEMGREP_BINARY,
        "--config",
        SEMGREP_CONFIG,
        "--json",
        "--quiet",
        str(scan_dir),
    ]


def _parse_semgrep_json(stdout: str) -> dict[str, Any]:
    """Parse Semgrep stdout into a dict."""
    text = stdout.strip()
    if not text:
        raise SemgrepError("Semgrep produced empty stdout")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise SemgrepError(f"Semgrep stdout is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise SemgrepError("Semgrep JSON root must be an object")
    return parsed


def run_semgrep(repo_path: str | Path) -> dict[str, Any]:
    """Run Semgrep against a local repo tree and return the raw report dict."""
    scan_dir = _resolve_scan_directory(repo_path)
    command = _build_semgrep_command(scan_dir)

    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise SemgrepError(
            f"{SEMGREP_BINARY} executable not found on PATH; install Semgrep to scan"
        ) from exc

    if completed.returncode not in _SEMGREP_OK_EXIT_CODES:
        detail = (completed.stderr or completed.stdout or "").strip()
        message = f"Semgrep scan failed (exit {completed.returncode})"
        if detail:
            message = f"{message}: {detail}"
        raise SemgrepError(message)

    return _parse_semgrep_json(completed.stdout)
