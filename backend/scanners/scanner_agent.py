"""Agent 1: Security Scanner Agent.

Responsibilities:
- Clone/prepare repository path (via scanners.clone)
- Run Trivy scanner (via scanners.trivy)
- Run Semgrep scanner (via scanners.semgrep)
- Return raw scanner outputs & metadata
- Pure static scanner execution, no LLM
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from scanners.clone import CloneError, CloneResult, prepare_repo
from scanners.semgrep import SemgrepError, run_semgrep
from scanners.trivy import TrivyError, run_trivy

logger = logging.getLogger(__name__)


@dataclass
class ScannerAgentResult:
    """Raw outputs from Agent 1: Security Scanner Agent."""

    repo_url: str
    repo_name: str
    scan_path: str
    trivy_report: Dict[str, Any] | None
    semgrep_report: Dict[str, Any] | None
    errors: List[str]
    clone_result: CloneResult


def run_scanner_agent(repo_url: str) -> ScannerAgentResult:
    """Execute Agent 1: Clone repo and run raw security scanners.

    Args:
        repo_url: Repository URL or local filesystem path.

    Returns:
        ScannerAgentResult containing raw Trivy and Semgrep JSON dicts.
    """
    logger.info("Agent 1 [Security Scanner]: Preparing repository %s", repo_url)
    errors: List[str] = []

    clone_res = prepare_repo(repo_url)
    repo_name = clone_res.repo_name
    scan_path = clone_res.scan_path

    # Run Trivy
    trivy_report: Dict[str, Any] | None = None
    try:
        logger.info("Agent 1 [Security Scanner]: Running Trivy on %s", scan_path)
        trivy_report = run_trivy(scan_path)
    except TrivyError as exc:
        logger.warning("Agent 1 [Security Scanner]: Trivy failed: %s", exc)
        errors.append(str(exc))

    # Run Semgrep
    semgrep_report: Dict[str, Any] | None = None
    try:
        logger.info("Agent 1 [Security Scanner]: Running Semgrep on %s", scan_path)
        semgrep_report = run_semgrep(scan_path)
    except SemgrepError as exc:
        logger.warning("Agent 1 [Security Scanner]: Semgrep failed: %s", exc)
        errors.append(str(exc))

    return ScannerAgentResult(
        repo_url=repo_url,
        repo_name=repo_name,
        scan_path=scan_path,
        trivy_report=trivy_report,
        semgrep_report=semgrep_report,
        errors=errors,
        clone_result=clone_res,
    )
