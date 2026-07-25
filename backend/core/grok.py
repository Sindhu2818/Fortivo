"""Agent 4: Security Advisor Agent (Grok).

Model: Grok / xAI (configurable via GROK_MODEL, e.g. grok-2)
API Key: GROK_API_KEY
Endpoint: https://api.x.ai/v1/chat/completions (OpenAI-compatible)

Responsibilities:
Read the complete report and generate:
- Executive Summary (risk.executive_summary)
- Highest Priority Risks (risk.key_risks)
- Recommended Next Actions (risk.recommendations)
Business-friendly language suitable for managers, executives, and hackathon judges.

Resilience:
- Exponential backoff retries for transient API failures
- Timeout handling
- Non-fatal fallbacks if API is unavailable or fails
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import List, Optional

import requests
from pydantic import BaseModel, Field

from models import AttackPath, Finding, Risk

logger = logging.getLogger(__name__)

DEFAULT_GROK_MODEL = "grok-2"
GROK_API_URL = "https://api.x.ai/v1/chat/completions"
MAX_RETRIES = 2
INITIAL_BACKOFF_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 15.0


class SecurityAdvisorResponseSchema(BaseModel):
    executive_summary: str = Field(
        description="Executive summary in business-friendly language for managers/judges."
    )
    key_risks: List[str] = Field(
        description="List of highest priority business and security risks."
    )
    recommendations: List[str] = Field(
        description="List of recommended strategic next actions and remediations."
    )


def run_grok_advisor_agent(
    risk: Risk,
    findings: List[Finding],
    attack_paths: List[AttackPath],
) -> tuple[Risk, List[str]]:
    """Execute Agent 4: Security Advisor Agent (Grok).

    Args:
        risk: Risk model computed by Agent 2.
        findings: List of ranked Finding models.
        attack_paths: List of AttackPath models.

    Returns:
        Tuple of (updated_risk, error_messages).
    """
    api_key = os.environ.get("GROK_API_KEY")
    model_name = os.environ.get("GROK_MODEL", DEFAULT_GROK_MODEL)
    errors: List[str] = []

    if not api_key:
        msg = "Agent 4 [Grok Advisor]: GROK_API_KEY not set; using fallback executive summary."
        logger.warning(msg)
        errors.append(msg)
        return _apply_fallback_advisor(risk, findings), errors

    prompt = _build_advisor_prompt(risk, findings, attack_paths)

    for attempt in range(1, MAX_RETRIES + 2):
        try:
            logger.info(
                "Agent 4 [Grok Advisor]: Requesting analysis (attempt %d/%d) via %s...",
                attempt,
                MAX_RETRIES + 1,
                model_name,
            )
            advisor_res = _call_grok_api(prompt, api_key, model_name)
            updated_risk = risk.model_copy(
                update={
                    "executive_summary": advisor_res.executive_summary.strip(),
                    "key_risks": [r.strip() for r in advisor_res.key_risks if r.strip()],
                    "recommendations": [
                        rec.strip() for rec in advisor_res.recommendations if rec.strip()
                    ],
                }
            )
            logger.info("Agent 4 [Grok Advisor]: Successfully generated executive assessment.")
            return updated_risk, errors
        except Exception as exc:
            logger.warning(
                "Agent 4 [Grok Advisor]: Attempt %d failed: %s", attempt, exc
            )
            if attempt <= MAX_RETRIES:
                sleep_time = INITIAL_BACKOFF_SECONDS * (2 ** (attempt - 1))
                time.sleep(sleep_time)

    error_msg = f"Agent 4 [Grok Advisor]: All API attempts failed; using fallback executive summary."
    logger.error(error_msg)
    errors.append(error_msg)
    return _apply_fallback_advisor(risk, findings), errors


def _build_advisor_prompt(
    risk: Risk,
    findings: List[Finding],
    attack_paths: List[AttackPath],
) -> str:
    top_findings = findings[:5]
    findings_str = "\n".join(
        f"- [{f.severity.upper()}] {f.title} ({f.category} in {f.file_path})"
        for f in top_findings
    )
    paths_str = "\n".join(
        f"- Path {ap.id}: {len(ap.steps)} steps, severity={ap.severity}, likelihood={ap.likelihood}"
        for ap in attack_paths
    )

    return f"""You are a Chief Information Security Officer (CISO) delivering an executive briefing to engineering managers and hackathon judges.

SECURITY ASSESSMENT REPORT CONTEXT:
- Risk Score: {risk.score}/100 ({risk.band.upper()} band)
- Severity Component: {risk.components.severity}/100
- Exploitability Component: {risk.components.exploitability}/100
- Exposure Component: {risk.components.exposure}/100
- Blast Radius Component: {risk.components.blast_radius}/100

TOP VULNERABILITIES ({len(findings)} total reported):
{findings_str or 'No critical findings.'}

ATTACK PATHS ({len(attack_paths)} identified):
{paths_str or 'No attack paths.'}

PROVIDE A JSON RESPONSE WITH THE FOLLOWING STRUCTURE:
1. `executive_summary`: A clear, compelling 2-3 sentence executive overview in professional business language explaining the organization's risk posture.
2. `key_risks`: A list of 3-5 high-priority business and security risks highlighted by this scan.
3. `recommendations`: A list of 3-5 strategic next steps for the management team to reduce risk effectively.
"""


def _call_grok_api(
    prompt: str, api_key: str, model_name: str
) -> SecurityAdvisorResponseSchema:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert CISO and Executive Security Advisor. Respond strictly in valid JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }

    response = requests.post(
        GROK_API_URL,
        headers=headers,
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    if response.status_code != 200:
        raise ValueError(
            f"Grok API returned HTTP status {response.status_code}: {response.text[:200]}"
        )

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise ValueError("Grok API response contained no choices")

    content = choices[0].get("message", {}).get("content", "")
    if not content:
        raise ValueError("Grok API returned empty message content")

    return SecurityAdvisorResponseSchema.model_validate_json(content)


def _apply_fallback_advisor(risk: Risk, findings: List[Finding]) -> Risk:
    exec_summary = (
        f"Executive Briefing: Repository risk score evaluated at {risk.score}/100 ({risk.band} severity band). "
        f"The security posture requires attention across {len(findings)} identified findings."
    )
    key_risks = [
        f"Overall security score is {risk.score}/100 in the {risk.band} band.",
        f"{len([f for f in findings if f.severity in ('critical', 'high')])} high/critical vulnerabilities identified.",
    ]
    recommendations = [
        "Prioritize remediation of critical and high-severity findings.",
        "Implement automated CI/CD security scanning to catch vulnerabilities early.",
    ]

    return risk.model_copy(
        update={
            "executive_summary": exec_summary,
            "key_risks": key_risks,
            "recommendations": recommendations,
        }
    )
