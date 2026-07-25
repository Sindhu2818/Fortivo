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
from fastapi.middleware.cors import CORSMiddleware

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

import storage
from core.pipeline import run_scan
from error_handlers import register_exception_handlers
from models import (
    ScanAccepted,
    ScanRequest,
    ScanResult,
    ScanSummary,
)
from utils.validators import validate_repo_input

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

# python-dotenv was already a dependency but nothing ever called it, so `.env`
# was inert: GEMINI_API_KEY and GROK_API_KEY could be filled in and the LLM
# agents would still fall back to template prose. Pinned to the repo root
# rather than found by walking up from the cwd, so it loads the same file
# whether uvicorn was started from backend/ or from the repo root.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI Application Initialization & CORS Configuration
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Fortivo Security Scanner API",
    description="Static analysis and risk scoring API for code repositories.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fortivo-zeta.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
# ---------------------------------------------------------------------------
# HTTP Route Handlers
# ---------------------------------------------------------------------------


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, bool]:
    """Health check endpoint."""
    return {"ok": True}


@app.post(
    "/scan",
    response_model=ScanAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_scan(request: ScanRequest) -> ScanAccepted:
    """Run a repository scan."""

    repo_url = request.repo_url.strip()

    if not repo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="repo_url cannot be empty",
        )

    try:
        validate_repo_input(repo_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    result = run_scan(repo_url)

    return ScanAccepted(
        scan_id=result.scan_id,
        status=result.status,
    )


@app.get(
    "/results",
    response_model=List[ScanSummary],
    status_code=status.HTTP_200_OK,
)
def get_scan_summaries() -> List[ScanSummary]:
    """Return all scan summaries."""
    return storage.list_summaries()


@app.get(
    "/results/{scan_id}",
    response_model=ScanResult,
    status_code=status.HTTP_200_OK,
)
def get_scan_result(scan_id: str) -> ScanResult:
    """Return a full scan result."""
    return storage.load(scan_id)


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
        help="Repository URL (e.g. https://github.com/example/repo) "
        "or local path (e.g. ./demo-app)",
    )

    args = parser.parse_args()

    repo_url = args.repo_url.strip()

    if not repo_url:
        logger.error("repo_url argument cannot be empty.")
        sys.exit(1)

    try:
        validate_repo_input(repo_url)
    except ValueError as exc:
        logger.error(str(exc))
        sys.exit(1)

    logger.info("Starting Fortivo scan for: %s", repo_url)

    try:
        result = run_scan(repo_url)

        logger.info("Scan finished: %s", result.scan_id)
        logger.info("Status: %s", result.status)
        logger.info(
            "Risk Score: %s/100 (%s)",
            result.risk.score,
            result.risk.band,
        )
        logger.info(
            "Findings: %s reported",
            result.stats.reported_findings,
        )
        logger.info(
            "Duration: %.2fs",
            result.duration_seconds,
        )

        if result.errors:
            logger.warning(
                "Warnings/Errors (%d)",
                len(result.errors),
            )

            for err in result.errors:
                logger.warning("%s", err)

        if result.status == "failed":
            sys.exit(1)

        sys.exit(0)

    except Exception:
        logger.exception("Scan execution failed")
        sys.exit(1)


if __name__ == "__main__":
    _cli_main()