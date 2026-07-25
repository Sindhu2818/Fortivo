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
    """Coordinate Agent 3 (Gemini Security Expert) and Agent 4 (Grok Security Advisor).

    Args:
        findings: Ranked Finding models.
        attack_paths: AttackPath models.
        risk: Risk model computed by Agent 2.

    Returns:
        LLMResult containing enriched findings, risk model, and accumulated errors.
    """
    errors: List[str] = []

    # 1. Execute Agent 3: Security Expert Agent (Gemini)
    logger.info("Coordinating Agent 3 [Security Expert Agent - Gemini]...")
    updated_findings, gemini_errors = run_gemini_expert_agent(findings)
    errors.extend(gemini_errors)

    # 2. Execute Agent 4: Security Advisor Agent (Grok)
    logger.info("Coordinating Agent 4 [Security Advisor Agent - Grok]...")
    updated_risk, grok_errors = run_grok_advisor_agent(risk, updated_findings, attack_paths)
    errors.extend(grok_errors)

    return LLMResult(
        findings=updated_findings,
        attack_paths=attack_paths,
        risk=updated_risk,
        errors=errors,
    )
