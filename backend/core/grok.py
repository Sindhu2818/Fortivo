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

import logging
import os
import time
from typing import List

import requests
from pydantic import BaseModel, Field

from models import AttackPath, Finding, Risk

logger = logging.getLogger(__name__)

# xAI retired grok-2 — the live API answers 400 "Model not found: grok-2".
# grok-4 is what .env.example already specifies; this default was just stale.
DEFAULT_GROK_MODEL = "grok-4"
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
            logger.info(
                "Sending %d findings and %d attack paths to Grok Advisor Agent.",
                len(findings),
                len(attack_paths),
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
            logger.info(
                "Grok generated %d key risks and %d recommendations.",
                len(updated_risk.key_risks),
                len(updated_risk.recommendations),
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

    return f"""You are the Chief Information Security Officer (CISO) of a cybersecurity consulting firm.

Your audience consists of:
- Engineering Managers
- CTOs
- Startup Founders
- Hackathon Judges

Repository Security Summary

Overall Risk Score:
- {risk.score}/100
- Risk Band: {risk.band.upper()}

Risk Components:
- Severity: {risk.components.severity}/100
- Exploitability: {risk.components.exploitability}/100
- Exposure: {risk.components.exposure}/100
- Blast Radius: {risk.components.blast_radius}/100

Top Findings:
{findings_str or "No major findings detected."}

Attack Paths:
{paths_str or "No attack paths generated."}

Generate JSON only.

executive_summary
- Write 2–3 professional paragraphs.
- Explain the overall security posture.
- Mention the most important risks.
- Mention potential business impact.
- Avoid unnecessary technical jargon.

key_risks
- Return 3–5 concise bullet-style statements.
- Prioritize the most important security risks.

recommendations
- Return 3–5 actionable recommendations.
- Order them by priority.
- Include both immediate fixes and long-term improvements.

Rules
- Never invent vulnerabilities.
- Base everything only on the supplied findings.
- Keep the tone professional.
- Return ONLY valid JSON.
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
                "content": (
    "You are an experienced Chief Information Security Officer (CISO). "
    "Always return valid JSON matching the requested schema. "
    "Do not include markdown, code fences, or additional text."
),
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
    high_count = sum(
        1 for f in findings if f.severity in ("critical", "high")
    )

    exec_summary = (
        f"The repository received an overall security score of {risk.score}/100 "
        f"({risk.band.upper()} risk). "
        f"The scan identified {len(findings)} findings, including "
        f"{high_count} high or critical vulnerabilities requiring priority attention. "
        f"Addressing these issues will significantly improve the application's security posture."
    )

    key_risks = [
        f"{high_count} high or critical findings require immediate remediation.",
        "Unresolved vulnerabilities could increase the application's attack surface.",
        "Security weaknesses may impact confidentiality, integrity, and availability.",
    ]

    recommendations = [
        "Remediate all Critical and High severity findings first.",
        "Integrate automated security scanning into the CI/CD pipeline.",
        "Perform periodic dependency updates and vulnerability reviews.",
        "Conduct regular secure code reviews before production releases.",
    ]

    return risk.model_copy(
        update={
            "executive_summary": exec_summary,
            "key_risks": key_risks,
            "recommendations": recommendations,
        }
    )