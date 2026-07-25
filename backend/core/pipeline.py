"""Orchestrate multi-agent scan pipeline end to end.

Multi-Agent Execution Pipeline
------------------------------
    Agent 1 (Security Scanner Agent: clone + trivy + semgrep)
          │ Raw scanner outputs
          ▼
    Agent 2 (Risk Analysis Agent: normalize + reduce + score + attack_paths)
          │ Deterministic Findings, Risk Scores, Attack Paths
          ▼
    Agent 3 (Security Expert Agent: Gemini)
          │ Developer technical explanations, remediation, technical notes
          ▼
    Agent 4 (Security Advisor Agent: Grok)
          │ Executive summary, key risks, recommendations
          ▼
    Storage (storage.save)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import List

import storage
from core.llm import enrich_with_llm
from core.risk_agent import run_risk_agent
from models import (
    Finding,
    Risk,
    RiskComponents,
    ScanResult,
    SeverityCounts,
    Stats,
)
from scanners.clone import CloneError, derive_repo_name
from scanners.scanner_agent import run_scanner_agent

logger = logging.getLogger(__name__)


def run_scan(repo_url: str) -> ScanResult:
    """Orchestrate a complete repository scan using the 4-agent architecture.

    Args:
        repo_url: Git repository URL or local filesystem path.

    Returns:
        Fully populated ScanResult model, persisted to results/<scan_id>.json.
    """
    start_time = time.perf_counter()
    scan_id = storage.new_scan_id()
    scanned_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    errors: List[str] = []

    logger.info("Starting Fortivo Multi-Agent Scan [ID: %s] for %s", scan_id, repo_url)

    # --- Agent 1: Security Scanner Agent ---
    try:
        scanner_res = run_scanner_agent(repo_url)
        errors.extend(scanner_res.errors)
    except CloneError as clone_err:
        logger.error("Agent 1 failed (CloneError): %s", clone_err)
        return _handle_fatal_clone_failure(
            scan_id=scan_id,
            repo_url=repo_url,
            scanned_at=scanned_at,
            start_time=start_time,
            error_message=str(clone_err),
        )

    with scanner_res.clone_result:
        repo_name = scanner_res.repo_name
        scan_path = scanner_res.scan_path

        # --- Agent 2: Risk Analysis Agent (Deterministic) ---
        risk_res = run_risk_agent(
            trivy_report=scanner_res.trivy_report,
            semgrep_report=scanner_res.semgrep_report,
            repo_root=scan_path,
        )

                # --- Agent 3 & Agent 4: LLM Coordinator (Gemini Expert & Grok Advisor) ---
        try:
            llm_res = enrich_with_llm(
                findings=risk_res.findings,
                attack_paths=risk_res.attack_paths,
                risk=risk_res.risk,
            )

            final_findings = llm_res.findings
            final_paths = llm_res.attack_paths
            final_risk = llm_res.risk
            errors.extend(llm_res.errors)

        except Exception as exc:
            logger.exception("LLM enrichment failed")

            errors.append(f"AI enrichment unavailable: {exc}")

            # Fall back to deterministic results from the Risk Agent
            final_findings = risk_res.findings
            final_paths = risk_res.attack_paths
            final_risk = risk_res.risk

        # --- Assemble Stats ---
        stats = _assemble_stats(
            raw_findings_count=risk_res.raw_findings_count,
            after_dedup_count=risk_res.after_dedup_count,
            reported_findings=final_findings,
        )

        # --- Compute Duration & Construct ScanResult ---
        duration_seconds = round(time.perf_counter() - start_time, 2)

        scan_result = ScanResult(
            scan_id=scan_id,
            repo_url=repo_url,
            repo_name=repo_name,
            scanned_at=scanned_at,
            duration_seconds=duration_seconds,
            status="complete",
            risk=final_risk,
            stats=stats,
            findings=final_findings,
            attack_paths=final_paths,
            errors=errors,
        )

        # --- Persist Document ---
        storage.save(scan_result)
        logger.info(
            "Scan %s complete in %.2fs. Risk Score: %d (%s)",
            scan_id,
            duration_seconds,
            final_risk.score,
            final_risk.band,
        )

        return scan_result


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _assemble_stats(
    raw_findings_count: int,
    after_dedup_count: int,
    reported_findings: List[Finding],
) -> Stats:
    severity_counts: dict[str, int] = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
    }
    source_counts: dict[str, int] = {}

    for finding in reported_findings:
        if finding.severity in severity_counts:
            severity_counts[finding.severity] += 1
        source_counts[finding.source] = source_counts.get(finding.source, 0) + 1

    return Stats(
        raw_findings=raw_findings_count,
        after_dedup=after_dedup_count,
        reported_findings=len(reported_findings),
        by_severity=SeverityCounts(**severity_counts),
        by_source=source_counts,
    )


def _handle_fatal_clone_failure(
    scan_id: str,
    repo_url: str,
    scanned_at: str,
    start_time: float,
    error_message: str,
) -> ScanResult:
    duration_seconds = round(time.perf_counter() - start_time, 2)

    try:
        repo_name = derive_repo_name(repo_url)
    except CloneError:
        repo_name = "unknown"

    failed_result = ScanResult(
        scan_id=scan_id,
        repo_url=repo_url,
        repo_name=repo_name,
        scanned_at=scanned_at,
        duration_seconds=duration_seconds,
        status="failed",
        risk=Risk(
            score=0,
            band="low",
            components=RiskComponents(
                severity=0, exploitability=0, exposure=0, blast_radius=0
            ),
            summary="Repository acquisition failed.",
            executive_summary="Repository acquisition failed.",
        ),
        stats=Stats(
            raw_findings=0,
            after_dedup=0,
            reported_findings=0,
            by_severity=SeverityCounts(),
            by_source={},
        ),
        findings=[],
        attack_paths=[],
        errors=[error_message],
    )

    storage.save(failed_result)
    return failed_result
