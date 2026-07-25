"""Multi-Agent LLM Coordinator.

Responsibilities:
Coordinates Agent 3 (Security Expert - Gemini) and Agent 4 (Security Advisor - Grok)
in sequence to populate technical and executive prose fields.

Pipeline:
Findings + Risk + Attack Paths
  │
  ├─► Agent 3 (Gemini): explanation, remediation, technical_notes
  │
  └─► Agent 4 (Grok): executive_summary, key_risks, recommendations
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List

from core.gemini import run_gemini_expert_agent
from core.grok import run_grok_advisor_agent
from models import AttackPath, Finding, Risk

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMResult:
    """Enriched data structures with prose fields populated by Agent 3 & Agent 4."""

    findings: List[Finding]
    attack_paths: List[AttackPath]
    risk: Risk
    errors: List[str]


def enrich_with_llm(
    findings: List[Finding],
    attack_paths: List[AttackPath],
    risk: Risk,
) -> LLMResult:
    """Coordinate Agent 3 (Gemini Security Expert) and Agent 4 (Grok Security Advisor)."""

    errors: List[str] = []

    updated_findings = findings
    updated_risk = risk

    # ------------------------------------------------------------------
    # Agent 3: Gemini Security Expert
    # ------------------------------------------------------------------
    logger.info("Coordinating Agent 3 [Security Expert Agent - Gemini]...")

    try:
        updated_findings, gemini_errors = run_gemini_expert_agent(findings)
        errors.extend(gemini_errors)

    except Exception as exc:
        logger.exception("Gemini Expert Agent crashed")
        errors.append(f"Gemini unavailable: {exc}")

        # Continue using deterministic findings
        updated_findings = findings

    # ------------------------------------------------------------------
    # Agent 4: Grok Security Advisor
    # ------------------------------------------------------------------
    logger.info("Coordinating Agent 4 [Security Advisor Agent - Grok]...")

    try:
        updated_risk, grok_errors = run_grok_advisor_agent(
            risk,
            updated_findings,
            attack_paths,
        )
        errors.extend(grok_errors)

    except Exception as exc:
        logger.exception("Grok Advisor Agent crashed")
        errors.append(f"Grok unavailable: {exc}")

        # Continue using deterministic risk score
        updated_risk = risk

    return LLMResult(
        findings=updated_findings,
        attack_paths=attack_paths,
        risk=updated_risk,
        errors=errors,
    )