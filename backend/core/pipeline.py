"""Orchestrate one scan end to end. The only place stage order is defined.

Responsibility
--------------
    clone -> trivy + semgrep -> normalize -> reduce -> score -> attack_paths
          -> llm -> assemble ScanResult -> storage.save

Owns timing (``duration_seconds``), ``stats`` assembly, ``status`` transitions, and
collecting non-fatal failures into ``errors``. Every stage is skippable: a failed
scanner or a failed LLM call degrades the document, it does not fail the scan.

Definition of done
------------------
``run_scan("./demo-app")`` writes results/<scan_id>.json that validates against
models.ScanResult with a non-zero score and at least one attack path.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import storage
from core.attack_paths import generate_attack_paths
from core.llm import enrich_with_llm
from core.reduce import reduce_findings
from core.score import score_findings
from models import (
    Finding,
    Risk,
    RiskComponents,
    ScanResult,
    SeverityCounts,
    Stats,
)
from scanners.clone import CloneError, derive_repo_name, prepare_repo
from scanners.normalize import normalize_findings
from scanners.semgrep import SemgrepError, run_semgrep
from scanners.trivy import TrivyError, run_trivy


def run_scan(repo_url: str) -> ScanResult:
    """Orchestrate a complete repository scan end-to-end and persist the result.

    Args:
        repo_url: Git repository URL or local filesystem path.

    Returns:
        Fully populated ScanResult model, persisted to results/<scan_id>.json.
    """
    start_time = time.perf_counter()
    scan_id = storage.new_scan_id()
    scanned_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    errors: List[str] = []

    # 1. Clone / Access Local Path
    try:
        clone_result = prepare_repo(repo_url)
    except CloneError as clone_err:
        return _handle_fatal_clone_failure(
            scan_id=scan_id,
            repo_url=repo_url,
            scanned_at=scanned_at,
            start_time=start_time,
            error_message=str(clone_err),
        )

    with clone_result:
        repo_name = clone_result.repo_name
        scan_path = clone_result.scan_path

        # 2. Run Scanners (Non-fatal failures captured in errors)
        trivy_report, semgrep_report = _run_scanners(scan_path, errors)

        # 3. Normalize scanner outputs to Finding models
        raw_findings = normalize_findings(trivy_report, semgrep_report, scan_path)
        raw_count = len(raw_findings)

        # 4. Reduce (Deduplicate & Rank top 30)
        reduce_res = reduce_findings(raw_findings)
        deduped_findings = reduce_res.findings
        after_dedup_count = reduce_res.after_dedup

        # 5. Score (Compute Risk components & per-finding contribution)
        score_res = score_findings(deduped_findings)
        scored_findings = score_res.findings
        risk = score_res.risk

        # 6. Attack Paths Generation
        attack_paths = generate_attack_paths(scored_findings)

        # 7. LLM Prose Enrichment (Non-fatal failures captured in errors)
        llm_res = enrich_with_llm(scored_findings, attack_paths, risk)
        final_findings = llm_res.findings
        final_paths = llm_res.attack_paths
        final_risk = llm_res.risk
        errors.extend(llm_res.errors)

        # 8. Assemble Stats
        stats = _assemble_stats(
            raw_findings_count=raw_count,
            after_dedup_count=after_dedup_count,
            reported_findings=final_findings,
        )

        # 9. Compute Duration & Final ScanResult
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

        # 10. Persist to Disk
        storage.save(scan_result)

        return scan_result


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def _run_scanners(
    scan_path: str,
    errors: List[str],
) -> Tuple[Dict[str, Any] | None, Dict[str, Any] | None]:
    """Execute Trivy and Semgrep scanners, capturing non-fatal errors."""
    trivy_report: Dict[str, Any] | None = None
    try:
        trivy_report = run_trivy(scan_path)
    except TrivyError as trivy_err:
        errors.append(str(trivy_err))

    semgrep_report: Dict[str, Any] | None = None
    try:
        semgrep_report = run_semgrep(scan_path)
    except SemgrepError as semgrep_err:
        errors.append(str(semgrep_err))

    return trivy_report, semgrep_report


def _assemble_stats(
    raw_findings_count: int,
    after_dedup_count: int,
    reported_findings: List[Finding],
) -> Stats:
    """Assemble Stats model based on raw counts and final reported findings."""
    severity_counts: Dict[str, int] = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
    }
    source_counts: Dict[str, int] = {}

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
    """Handle fatal repository cloning/access failure by returning a failed ScanResult."""
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

