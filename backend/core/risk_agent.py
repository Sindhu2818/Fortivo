"""Agent 2: Risk Analysis Agent.

Responsibilities:
- Normalize raw findings from Agent 1 into standard Finding models
- Deduplicate and rank findings deterministically (keep top 30)
- Calculate 4-component risk scores and risk band
- Build multi-stage attack paths (0-5 paths)
- Pure Python logic, 100% deterministic, no LLM
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List

from core.attack_paths import generate_attack_paths
from core.reduce import reduce_findings
from core.score import score_findings
from models import AttackPath, Finding, Risk, Stats
from scanners.normalize import normalize_findings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RiskAgentResult:
    """Outputs from Agent 2: Risk Analysis Agent."""

    findings: List[Finding]
    risk: Risk
    attack_paths: List[AttackPath]
    raw_findings_count: int
    after_dedup_count: int


def run_risk_agent(
    trivy_report: Dict[str, Any] | None,
    semgrep_report: Dict[str, Any] | None,
    repo_root: str,
) -> RiskAgentResult:
    """Execute Agent 2: Process raw findings into scored findings and attack paths.

    Args:
        trivy_report: Raw Trivy report dict or None.
        semgrep_report: Raw Semgrep report dict or None.
        repo_root: Path to repository directory.

    Returns:
        RiskAgentResult containing scored findings, risk model, and attack paths.
    """
    logger.info("Agent 2 [Risk Analysis]: Normalizing findings...")
    raw_findings = normalize_findings(trivy_report, semgrep_report, repo_root)
    raw_count = len(raw_findings)

    logger.info("Agent 2 [Risk Analysis]: Deduplicating and ranking %d raw findings...", raw_count)
    reduce_res = reduce_findings(raw_findings)
    deduped_findings = reduce_res.findings
    after_dedup_count = reduce_res.after_dedup

    logger.info(
        "Agent 2 [Risk Analysis]: Computing risk score for %d top findings...",
        len(deduped_findings),
    )
    score_res = score_findings(deduped_findings)
    scored_findings = score_res.findings
    risk = score_res.risk

    logger.info("Agent 2 [Risk Analysis]: Generating attack paths...")
    attack_paths = generate_attack_paths(scored_findings)

    return RiskAgentResult(
        findings=scored_findings,
        risk=risk,
        attack_paths=attack_paths,
        raw_findings_count=raw_count,
        after_dedup_count=after_dedup_count,
    )
