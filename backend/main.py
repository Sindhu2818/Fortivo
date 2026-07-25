"""FastAPI app: the only HTTP surface of Fortivo.

Responsibility
--------------
Define the app, CORS for localhost:3000, and four routes. Nothing else — all real
work is delegated to core.pipeline. This file owns no business logic.

    GET  /health              -> {"ok": true}
    POST /scan                -> ScanAccepted   (kicks off core.pipeline.run_scan)
    GET  /results             -> list[ScanSummary]
    GET  /results/{scan_id}   -> ScanResult

Also provides a CLI entry point for running scans directly from the terminal.

Definition of done
------------------
`uvicorn main:app --port 8000` starts, and
`curl -X POST localhost:8000/scan -d '{"repo_url":"./demo-app"}' -H 'content-type: application/json'`
returns a scan_id whose document later loads from GET /results/{scan_id}.
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict, List

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

import storage
from core.pipeline import run_scan
from models import (
    ScanAccepted,
    ScanRequest,
    ScanResult,
    ScanSummary,
)

# ---------------------------------------------------------------------------
# FastAPI Application Initialization & CORS Configuration
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Fortivo Security Scanner API",
    description="Static analysis and risk scoring API for code repositories.",
    version="1.0.0",
)

# Enable CORS for local frontend development (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# HTTP Route Handlers
# ---------------------------------------------------------------------------


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, bool]:
    """Health check endpoint to verify backend service status."""
    return {"ok": True}


@app.post(
    "/scan",
    response_model=ScanAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_scan(request: ScanRequest) -> ScanAccepted:
    """Initiate a repository scan and return a ScanAccepted response.

    Args:
        request: ScanRequest body containing repo_url.

    Returns:
        ScanAccepted containing scan_id and final scan status.
    """
    repo_url = request.repo_url.strip()
    if not repo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="repo_url cannot be empty",
        )

    try:
        result = run_scan(repo_url)
        return ScanAccepted(scan_id=result.scan_id, status=result.status)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute scan: {exc}",
        ) from exc


@app.get("/results", response_model=List[ScanSummary], status_code=status.HTTP_200_OK)
def get_scan_summaries() -> List[ScanSummary]:
    """List summary records for all completed scans, newest first."""
    return storage.list_summaries()


@app.get(
    "/results/{scan_id}",
    response_model=ScanResult,
    status_code=status.HTTP_200_OK,
)
def get_scan_result(scan_id: str) -> ScanResult:
    """Retrieve full ScanResult document for a specific scan ID.

    Args:
        scan_id: Scan ID string (e.g. scan_20260725_142301).

    Returns:
        Full ScanResult object matching CONTRACT.md.
    """
    try:
        return storage.load(scan_id)
    except FileNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan result not found: {scan_id}",
        ) from err
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Corrupted scan document: {val_err}",
        ) from val_err


# ---------------------------------------------------------------------------
# Command-Line Interface (CLI) Entry Point
# ---------------------------------------------------------------------------


def _cli_main() -> None:
    """CLI entry point for running scans directly from the terminal."""
    parser = argparse.ArgumentParser(
        description="Fortivo Security Scanner CLI — Scan code repos and compute risk."
    )
    parser.add_argument(
        "repo_url",
        help="Repository URL (e.g. https://github.com/example/repo) or local path (e.g. ./demo-app)",
    )
    args = parser.parse_args()

    repo_url = args.repo_url.strip()
    if not repo_url:
        print("Error: repo_url argument cannot be empty.", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Starting Fortivo scan for: {repo_url}")
    try:
        result = run_scan(repo_url)
        print(f"[+] Scan finished: {result.scan_id}")
        print(f"    Status:      {result.status}")
        print(f"    Risk Score:  {result.risk.score}/100 ({result.risk.band})")
        print(f"    Findings:    {result.stats.reported_findings} reported")
        print(f"    Duration:    {result.duration_seconds}s")
        if result.errors:
            print(f"    Warnings/Errors ({len(result.errors)}):")
            for err in result.errors:
                print(f"      - {err}")

        if result.status == "failed":
            sys.exit(1)
        sys.exit(0)
    except Exception as exc:
        print(f"[-] Scan execution failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    _cli_main()

