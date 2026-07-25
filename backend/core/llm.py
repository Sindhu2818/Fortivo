"""Gemini client: write the prose fields, and only the prose fields.

Responsibility
--------------
Fill exactly three things, using already-computed structure as input:

  * ``findings[].explanation`` — what / why_it_matters / fix / confidence
  * ``attack_paths[].title`` and ``.narrative``
  * ``risk.summary``

The LLM never ranks, never scores, never reorders, and never invents a number the
scorer did not produce. If a call fails or GEMINI_API_KEY is missing, fill
deterministic fallback prose and record the non-fatal failure in ``errors``.

Pinned usage:
    from google import genai
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

Model: Gemini 2.0 Flash (structured JSON output mode).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from models import (
    AttackPath,
    Confidence,
    Explanation,
    Finding,
    Risk,
)


# ---------------------------------------------------------------------------
# Pydantic Schemas for Gemini Structured JSON Output
# ---------------------------------------------------------------------------


class FindingExplanationSchema(BaseModel):
    id: str = Field(description="Finding ID matching f_001, f_002, etc.")
    what: str = Field(description="Plain-language description of the vulnerability.")
    why_it_matters: str = Field(description="Impact in this repository context.")
    fix: str = Field(description="Concrete remediation step.")
    confidence: Confidence = Field(description="Confidence level: high, medium, or low.")


class AttackPathProseSchema(BaseModel):
    id: str = Field(description="Attack path ID matching ap_001, ap_002, etc.")
    title: str = Field(description="Concise 1-line title for the attack path.")
    narrative: str = Field(
        description="2-4 sentence past-to-future narrative describing the attack steps."
    )


class ScanProseResponseSchema(BaseModel):
    risk_summary: str = Field(
        description="1-3 sentence summary of repository risk. Never contains uncomputed numbers."
    )
    explanations: List[FindingExplanationSchema] = Field(
        description="Explanations for each finding."
    )
    attack_path_prose: List[AttackPathProseSchema] = Field(
        description="Titles and narratives for each attack path."
    )


@dataclass(frozen=True)
class LLMResult:
    """Enriched data structures with prose fields populated."""

    findings: List[Finding]
    attack_paths: List[AttackPath]
    risk: Risk
    errors: List[str]


# ---------------------------------------------------------------------------
# Public Entry Point
# ---------------------------------------------------------------------------


def enrich_with_llm(
    findings: List[Finding],
    attack_paths: List[AttackPath],
    risk: Risk,
) -> LLMResult:
    """Populate prose fields in risk, findings, and attack_paths via Gemini 2.0 Flash.

    If GEMINI_API_KEY is not set or API invocation fails, falls back to
    deterministic prose generation and records the error in the returned errors list.
    """
    errors: List[str] = []
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        errors.append("GEMINI_API_KEY not configured; using fallback prose.")
        return _apply_fallback(findings, attack_paths, risk, errors)

    try:
        prompt = _build_prompt(findings, attack_paths, risk)
        llm_response = _call_gemini_api(prompt, api_key)
        return _apply_llm_response(llm_response, findings, attack_paths, risk, errors)
    except Exception as exc:
        errors.append(f"LLM generation failed: {exc}; using fallback prose.")
        return _apply_fallback(findings, attack_paths, risk, errors)


# ---------------------------------------------------------------------------
# Prompt Construction (Separate from API execution)
# ---------------------------------------------------------------------------


def _build_prompt(
    findings: List[Finding],
    attack_paths: List[AttackPath],
    risk: Risk,
) -> str:
    """Build structured context prompt for Gemini 2.0 Flash."""
    findings_summary = []
    for f in findings:
        pkg_str = f" ({f.package.name} v{f.package.installed_version})" if f.package else ""
        findings_summary.append(
            f"- ID: {f.id}, Rank: {f.rank}, Rule: {f.rule_id}, Title: '{f.title}', "
            f"Severity: {f.severity}, Category: {f.category}{pkg_str}, File: {f.file_path}"
        )

    paths_summary = []
    for ap in attack_paths:
        step_labels = [f"Step {s.order}: {s.label} ({s.technique})" for s in ap.steps]
        paths_summary.append(
            f"- ID: {ap.id}, Severity: {ap.severity}, Likelihood: {ap.likelihood}, "
            f"Steps: [{', '.join(step_labels)}]"
        )

    prompt = f"""You are a security expert writing explanations for a static code analysis report.
Do NOT invent new numbers or change scores, ranks, or IDs. Write concise prose for the requested fields.

REPOSITORY RISK CONTEXT:
- Overall Score: {risk.score}/100
- Risk Band: {risk.band}
- Severity Component: {risk.components.severity}/100
- Exploitability Component: {risk.components.exploitability}/100
- Exposure Component: {risk.components.exposure}/100
- Blast Radius Component: {risk.components.blast_radius}/100

FINDINGS ({len(findings)} total):
{chr(10).join(findings_summary) if findings_summary else "No findings."}

ATTACK PATHS ({len(attack_paths)} total):
{chr(10).join(paths_summary) if paths_summary else "No attack paths."}

INSTRUCTIONS:
1. `risk_summary`: Provide a 1-3 sentence executive summary explaining why the score is {risk.score} ({risk.band}).
2. `explanations`: For each finding, provide `what`, `why_it_matters`, `fix`, and `confidence` ("high", "medium", "low").
3. `attack_path_prose`: For each attack path, provide a clear 1-line `title` and a 2-4 sentence `narrative`.
"""
    return prompt


# ---------------------------------------------------------------------------
# API Execution Logic
# ---------------------------------------------------------------------------


def _call_gemini_api(prompt: str, api_key: str) -> ScanProseResponseSchema:
    """Invoke Gemini 2.0 Flash using google.genai structured outputs."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ScanProseResponseSchema,
            temperature=0.2,
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned empty response text")

    # Parse validated JSON against schema
    return ScanProseResponseSchema.model_validate_json(response.text)


# ---------------------------------------------------------------------------
# Response Mapping & Fallbacks
# ---------------------------------------------------------------------------


def _apply_llm_response(
    resp: ScanProseResponseSchema,
    findings: List[Finding],
    attack_paths: List[AttackPath],
    risk: Risk,
    errors: List[str],
) -> LLMResult:
    """Map validated LLM structured response onto domain models."""
    # 1. Update risk summary
    updated_risk = risk.model_copy(update={"summary": resp.risk_summary.strip()})

    # 2. Update finding explanations
    expl_map = {e.id: e for e in resp.explanations}
    updated_findings = []
    for f in findings:
        if f.id in expl_map:
            e = expl_map[f.id]
            explanation = Explanation(
                what=e.what.strip(),
                why_it_matters=e.why_it_matters.strip(),
                fix=e.fix.strip(),
                confidence=e.confidence,
            )
        else:
            explanation = _fallback_explanation(f)
        updated_findings.append(f.model_copy(update={"explanation": explanation}))

    # 3. Update attack path titles and narratives
    ap_map = {ap.id: ap for ap in resp.attack_path_prose}
    updated_paths = []
    for ap in attack_paths:
        if ap.id in ap_map:
            ap_prose = ap_map[ap.id]
            updated_ap = ap.model_copy(
                update={
                    "title": ap_prose.title.strip(),
                    "narrative": ap_prose.narrative.strip(),
                }
            )
        else:
            updated_ap = _fallback_attack_path_prose(ap)
        updated_paths.append(updated_ap)

    return LLMResult(
        findings=updated_findings,
        attack_paths=updated_paths,
        risk=updated_risk,
        errors=errors,
    )


def _apply_fallback(
    findings: List[Finding],
    attack_paths: List[AttackPath],
    risk: Risk,
    errors: List[str],
) -> LLMResult:
    """Generate deterministic fallback prose when LLM is unavailable."""
    fallback_summary = (
        f"Repository scan completed with risk score {risk.score}/100 ({risk.band} severity band). "
        f"Found {len(findings)} actionable security issue(s) across critical categories."
    )
    updated_risk = risk.model_copy(update={"summary": fallback_summary})

    updated_findings = [
        f.model_copy(update={"explanation": _fallback_explanation(f)})
        for f in findings
    ]

    updated_paths = [
        _fallback_attack_path_prose(ap) for ap in attack_paths
    ]

    return LLMResult(
        findings=updated_findings,
        attack_paths=updated_paths,
        risk=updated_risk,
        errors=errors,
    )


def _fallback_explanation(f: Finding) -> Explanation:
    """Generate deterministic fallback explanation for a finding."""
    cat_desc = f"{f.category} issue" if f.category != "secret" else "hardcoded secret"
    return Explanation(
        what=f"Identified {cat_desc} ({f.rule_id}) in {f.file_path}.",
        why_it_matters=f"Finding has severity '{f.severity}'. Addressing it mitigates exposure.",
        fix=f"Review and remediate {f.title} in {f.file_path}.",
        confidence="medium",
    )


def _fallback_attack_path_prose(ap: AttackPath) -> AttackPath:
    """Generate deterministic fallback title and narrative for an attack path."""
    entry_label = ap.steps[0].label if ap.steps else "Initial Access"
    target_label = ap.steps[-1].label if len(ap.steps) > 1 else "Target System"

    title = f"Attack path from {entry_label} to {target_label}"
    narrative = (
        f"An attacker exploits initial access via {entry_label}, pivoting through "
        f"intermediate flaws to reach {target_label}."
    )
    return ap.model_copy(update={"title": title, "narrative": narrative})

