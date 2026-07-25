"""Agent 3: Security Expert Agent (Gemini).

Model: Gemini 2.0 Flash (configurable via GEMINI_MODEL)
API Key: GEMINI_API_KEY

Responsibilities:
For every finding:
- Explain vulnerability (what, why_it_matters, fix, confidence)
- Provide developer-focused remediation guide (remediation)
- Provide technical notes and secure coding practices (technical_notes)

Resilience:
- Exponential backoff retries for transient API failures
- Timeout handling
- Non-fatal fallbacks if API is unavailable or fails
"""

from __future__ import annotations

import logging
import os
import time
from typing import List, Optional

from pydantic import BaseModel, Field

from models import Confidence, Explanation, Finding

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
MAX_RETRIES = 2
INITIAL_BACKOFF_SECONDS = 1.0


class FindingExpertAnalysisSchema(BaseModel):
    id: str = Field(description="Finding ID matching f_001, f_002, etc.")
    what: str = Field(description="Developer explanation of what the vulnerability is.")
    why_it_matters: str = Field(description="Why it is dangerous in this repository context.")
    fix: str = Field(description="Concrete code fix step.")
    confidence: Confidence = Field(description="Confidence level: high, medium, or low.")
    remediation: str = Field(description="Detailed step-by-step remediation guide for developers.")
    technical_notes: str = Field(description="Technical notes and secure coding best practices.")


class SecurityExpertResponseSchema(BaseModel):
    explanations: List[FindingExpertAnalysisSchema] = Field(
        description="Developer security analysis for each finding."
    )


def run_gemini_expert_agent(findings: List[Finding]) -> tuple[List[Finding], List[str]]:
    """Execute Agent 3: Security Expert Agent (Gemini).

    Args:
        findings: List of ranked Finding models.

    Returns:
        Tuple of (updated_findings, error_messages).
    """
    if not findings:
        return findings, []

    api_key = os.environ.get("GEMINI_API_KEY")
    model_name = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    errors: List[str] = []

    if not api_key:
        msg = "Agent 3 [Gemini Expert]: GEMINI_API_KEY not set; using fallback technical analysis."
        logger.warning(msg)
        errors.append(msg)
        return _apply_fallback_expert_analysis(findings), errors

    prompt = _build_expert_prompt(findings)

    for attempt in range(1, MAX_RETRIES + 2):
        try:
            logger.info(
                "Agent 3 [Gemini Expert]: Requesting analysis (attempt %d/%d) via %s...",
                attempt,
                MAX_RETRIES + 1,
                model_name,
            )
            response_schema = _call_gemini_api(prompt, api_key, model_name)
            updated_findings = _apply_expert_response(response_schema, findings)
            logger.info("Agent 3 [Gemini Expert]: Successfully generated expert analysis.")
            return updated_findings, errors
        except Exception as exc:
            logger.warning(
                "Agent 3 [Gemini Expert]: Attempt %d failed: %s", attempt, exc
            )
            if attempt <= MAX_RETRIES:
                sleep_time = INITIAL_BACKOFF_SECONDS * (2 ** (attempt - 1))
                time.sleep(sleep_time)

    error_msg = f"Agent 3 [Gemini Expert]: All API attempts failed; using fallback technical analysis."
    logger.error(error_msg)
    errors.append(error_msg)
    return _apply_fallback_expert_analysis(findings), errors


def _build_expert_prompt(findings: List[Finding]) -> str:
    findings_context = []
    for f in findings:
        pkg_str = f" ({f.package.name} v{f.package.installed_version})" if f.package else ""
        findings_context.append(
            f"- ID: {f.id}, Title: '{f.title}', Severity: {f.severity}, "
            f"Category: {f.category}{pkg_str}, File: {f.file_path}:{f.line_start or 1}"
        )

    return f"""You are a Senior Security Engineer conducting code review.
Provide developer-focused technical analysis for each of the following findings.

FINDINGS:
{chr(10).join(findings_context)}

INSTRUCTIONS FOR EACH FINDING:
1. `what`: Explain the technical flaw clearly.
2. `why_it_matters`: Explain how an attacker exploits this and its severity impact.
3. `fix`: Concrete line-level fix instruction.
4. `confidence`: High, medium, or low.
5. `remediation`: Detailed step-by-step developer remediation workflow.
6. `technical_notes`: Secure coding best practices, OWASP/CWE references, and prevention tips.
"""


def _call_gemini_api(
    prompt: str, api_key: str, model_name: str
) -> SecurityExpertResponseSchema:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SecurityExpertResponseSchema,
            temperature=0.2,
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned empty text response")

    return SecurityExpertResponseSchema.model_validate_json(response.text)


def _apply_expert_response(
    resp: SecurityExpertResponseSchema, findings: List[Finding]
) -> List[Finding]:
    analysis_map = {item.id: item for item in resp.explanations}
    updated = []
    for f in findings:
        item = analysis_map.get(f.id)
        if item:
            explanation = Explanation(
                what=item.what.strip(),
                why_it_matters=item.why_it_matters.strip(),
                fix=item.fix.strip(),
                confidence=item.confidence,
            )
            remediation = item.remediation.strip()
            technical_notes = item.technical_notes.strip()
        else:
            explanation, remediation, technical_notes = _fallback_for_single_finding(f)

        updated.append(
            f.model_copy(
                update={
                    "explanation": explanation,
                    "remediation": remediation,
                    "technical_notes": technical_notes,
                }
            )
        )
    return updated


def _apply_fallback_expert_analysis(findings: List[Finding]) -> List[Finding]:
    updated = []
    for f in findings:
        expl, rem, notes = _fallback_for_single_finding(f)
        updated.append(
            f.model_copy(
                update={
                    "explanation": expl,
                    "remediation": rem,
                    "technical_notes": notes,
                }
            )
        )
    return updated


def _fallback_for_single_finding(f: Finding) -> tuple[Explanation, str, str]:
    cat_desc = f"{f.category} vulnerability" if f.category != "secret" else "hardcoded credential"
    expl = Explanation(
        what=f"Identified {cat_desc} ({f.rule_id}) in {f.file_path}.",
        why_it_matters=f"Severity '{f.severity}'. Could pose security risk if exploited.",
        fix=f"Review and remediate {f.title} in {f.file_path}.",
        confidence="medium",
    )
    rem = f"1. Locate file {f.file_path}.\n2. Remove or fix {f.title}.\n3. Validate fix."
    notes = f"Follow OWASP secure coding guidelines for {f.category} vulnerabilities."
    return expl, rem, notes
