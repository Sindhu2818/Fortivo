"""Compute the 0-100 repository risk score and its four components.

Responsibility
--------------
Turn the reduced finding list into models.Risk:

  * ``components.severity``      — how bad the worst findings are
  * ``components.exploitability``— public exploit / low attack complexity
  * ``components.exposure``      — reachable from outside vs. internal only
  * ``components.blast_radius``  — how much is reachable after compromise

Combine the four into a weighted 0-100 integer, derive ``band`` from the
CONTRACT.md thresholds (never set it independently), and write
``score_contribution`` back onto each finding.  ``risk.summary`` is left as an
empty string here — the LLM fills it in a later pipeline stage.

Every number in the output document originates in this file.

Definition of done
------------------
``score`` is an int 0-100, ``band`` matches the thresholds, and the sum of
``score_contribution`` across all findings equals ``score``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from models import (
    Band,
    BAND_THRESHOLDS,
    Category,
    Finding,
    Risk,
    RiskComponents,
    Severity,
)


# ---------------------------------------------------------------------------
# Severity base points — raw contribution of a single finding to the severity
# component, before CVSS refinement or occurrence multiplier.
# ---------------------------------------------------------------------------

_SEVERITY_BASE: dict[Severity, float] = {
    "critical": 10.0,
    "high": 7.0,
    "medium": 4.0,
    "low": 1.5,
    "info": 0.5,
}

# ---------------------------------------------------------------------------
# Category hazard multiplier — amplifies or dampens a finding's raw weight
# based on its category.  Secrets and dependencies with known CVEs are more
# dangerous than licence findings.
# ---------------------------------------------------------------------------

_CATEGORY_MULTIPLIER: dict[Category, float] = {
    "secret": 1.4,
    "dependency": 1.2,
    "code": 1.0,
    "config": 0.8,
    "license": 0.4,
}

# ---------------------------------------------------------------------------
# CWE families that imply high exploitability — a curated list of CWEs
# commonly associated with publicly available exploits or trivially low
# attack complexity.
# ---------------------------------------------------------------------------

_HIGH_EXPLOIT_CWES: frozenset[str] = frozenset({
    "CWE-78",    # OS command injection
    "CWE-79",    # XSS
    "CWE-89",    # SQL injection
    "CWE-94",    # code injection
    "CWE-98",    # file inclusion
    "CWE-200",   # information exposure
    "CWE-276",   # incorrect default permissions
    "CWE-287",   # improper authentication
    "CWE-306",   # missing authentication
    "CWE-312",   # cleartext storage
    "CWE-327",   # broken crypto
    "CWE-352",   # CSRF
    "CWE-502",   # deserialization
    "CWE-611",   # XXE
    "CWE-798",   # hardcoded credentials
    "CWE-918",   # SSRF
    "CWE-1333",  # ReDoS
})

# ---------------------------------------------------------------------------
# File-path patterns that suggest external exposure (internet-facing code).
# Presence of these patterns raises the exposure component.
# ---------------------------------------------------------------------------

_EXPOSURE_PATH_KEYWORDS: tuple[str, ...] = (
    "api/",
    "routes/",
    "views/",
    "handlers/",
    "controller",
    "endpoint",
    "public/",
    "server",
    "gateway",
    "webhook",
    "graphql",
)

# ---------------------------------------------------------------------------
# Component weights for the final overall score.
# Sum = 1.0.  Severity is dominant; blast_radius is the weakest signal since
# it is the hardest to estimate without runtime data.
# ---------------------------------------------------------------------------

_COMPONENT_WEIGHTS: dict[str, float] = {
    "severity": 0.40,
    "exploitability": 0.25,
    "exposure": 0.20,
    "blast_radius": 0.15,
}


# ---------------------------------------------------------------------------
# Public result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ScoreResult:
    """Scored findings plus the Risk object for assembly into ScanResult."""

    findings: list[Finding]
    """Same findings as input, but with ``score_contribution`` populated."""

    risk: Risk
    """Fully populated Risk matching CONTRACT.md (summary is empty string)."""


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def score_findings(findings: list[Finding]) -> ScoreResult:
    """Score the ranked findings and return a Risk object.

    Args:
        findings: Ranked Finding objects produced by ``reduce.py``.  Must
                  already have ``id``, ``rank``, and ``occurrences`` set.
                  May be an empty list.

    Returns:
        A :class:`ScoreResult` whose ``findings`` have ``score_contribution``
        populated and whose ``risk`` is a fully valid ``models.Risk`` (with
        ``summary`` set to the empty string for the LLM stage to fill).
    """
    severity_score = _compute_severity(findings)
    exploitability_score = _compute_exploitability(findings)
    exposure_score = _compute_exposure(findings)
    blast_radius_score = _compute_blast_radius(findings)

    overall_score = _weighted_overall(
        severity_score,
        exploitability_score,
        exposure_score,
        blast_radius_score,
    )

    scored_findings = _assign_score_contributions(findings, overall_score)

    band = _derive_band(overall_score)

    risk = Risk(
        score=overall_score,
        band=band,
        components=RiskComponents(
            severity=severity_score,
            exploitability=exploitability_score,
            exposure=exposure_score,
            blast_radius=blast_radius_score,
        ),
        summary="",  # LLM fills this in a later pipeline stage
    )

    return ScoreResult(findings=scored_findings, risk=risk)


# ---------------------------------------------------------------------------
# Component 1 — Severity (0–100)
# "How bad the worst findings are."
#
# Strategy: accumulate base points per finding, scaled by CVSS when available
# and amplified by category multiplier.  Then apply a logarithmic saturation
# curve so a handful of critical findings can already push this toward 100
# without needing hundreds.
# ---------------------------------------------------------------------------


def _compute_severity(findings: list[Finding]) -> int:
    """Compute the severity component (0-100).

    Each finding contributes::

        base_points × cvss_factor × category_multiplier

    where ``base_points`` comes from the severity level, ``cvss_factor`` is
    ``cvss / 10`` (or 0.5 if no CVSS is available), and the category
    multiplier amplifies dangerous categories like secrets.

    The raw sum is passed through a logarithmic saturation curve that maps
    realistic accumulations into the 0–100 range.
    """
    if not findings:
        return 0

    raw_total = 0.0
    for finding in findings:
        base = _SEVERITY_BASE[finding.severity]
        cvss_factor = (finding.cvss / 10.0) if finding.cvss is not None else 0.5
        cat_mult = _CATEGORY_MULTIPLIER[finding.category]
        raw_total += base * cvss_factor * cat_mult

    return _saturate(raw_total, ceiling=80.0)


# ---------------------------------------------------------------------------
# Component 2 — Exploitability (0–100)
# "Public exploit / low attack complexity."
#
# Strategy: findings with high CVSS (≥ 7.0), CWEs in the known-dangerous set,
# or published references (implying public disclosure) each contribute to this
# score.  Secrets are always counted as trivially exploitable.
# ---------------------------------------------------------------------------


def _compute_exploitability(findings: list[Finding]) -> int:
    """Compute the exploitability component (0-100).

    Signals:
    - High CVSS (≥ 7.0) implies low attack complexity
    - CWEs in ``_HIGH_EXPLOIT_CWES`` imply public exploit patterns
    - Published references imply public disclosure
    - Secrets are trivially exploitable (no attack needed)
    """
    if not findings:
        return 0

    raw_total = 0.0
    for finding in findings:
        points = 0.0

        # High CVSS → likely exploitable
        if finding.cvss is not None and finding.cvss >= 7.0:
            points += finding.cvss * 1.2

        # Known-dangerous CWE families
        if _has_high_exploit_cwe(finding):
            points += 6.0

        # Published references → public disclosure
        if len(finding.references) >= 1:
            points += 2.0

        # Secrets are trivially exploitable
        if finding.category == "secret":
            points += 8.0

        raw_total += points

    return _saturate(raw_total, ceiling=60.0)


# ---------------------------------------------------------------------------
# Component 3 — Exposure (0–100)
# "Reachable from outside vs. internal only."
#
# Strategy: findings in internet-facing paths (API routes, controllers, public
# dirs) score higher.  Secrets in any path are always exposed (an attacker
# with the credential doesn't need network access).  Dependency findings with
# high CVSS in service code are assumed externally reachable.
# ---------------------------------------------------------------------------


def _compute_exposure(findings: list[Finding]) -> int:
    """Compute the exposure component (0-100).

    Signals:
    - File path contains internet-facing keywords (api/, routes/, etc.)
    - Secrets are always considered exposed
    - High-severity dependency findings in service paths
    """
    if not findings:
        return 0

    raw_total = 0.0
    for finding in findings:
        points = 0.0
        in_exposed_path = _is_exposed_path(finding.file_path)

        # Findings in internet-facing code paths
        if in_exposed_path:
            points += 5.0
            # Extra weight for critical/high findings in exposed paths
            if finding.severity in ("critical", "high"):
                points += 4.0

        # Secrets are always considered exposed
        if finding.category == "secret":
            points += 7.0

        # Dependencies with high CVSS in service code
        if (finding.category == "dependency"
                and finding.cvss is not None
                and finding.cvss >= 8.0):
            points += 3.0

        raw_total += points

    return _saturate(raw_total, ceiling=50.0)


# ---------------------------------------------------------------------------
# Component 4 — Blast radius (0–100)
# "How much is reachable after compromise."
#
# Strategy: a function of (a) how many distinct files are affected,
# (b) occurrence counts (widely spread issues = bigger blast), (c) whether
# secrets give pivoting opportunities, and (d) presence of critical findings
# that could enable lateral movement.
# ---------------------------------------------------------------------------


def _compute_blast_radius(findings: list[Finding]) -> int:
    """Compute the blast radius component (0-100).

    Signals:
    - Number of distinct affected files (spread)
    - Total occurrences across all findings (prevalence)
    - Secrets enable pivoting to other systems
    - Critical findings enable lateral movement
    """
    if not findings:
        return 0

    distinct_files: set[str] = set()
    total_occurrences = 0
    raw_total = 0.0

    for finding in findings:
        if finding.file_path:
            distinct_files.add(finding.file_path)
        total_occurrences += finding.occurrences

        # Secrets enable pivoting to other systems
        if finding.category == "secret":
            raw_total += 6.0

        # Critical findings enable lateral movement
        if finding.severity == "critical":
            raw_total += 4.0
        elif finding.severity == "high":
            raw_total += 2.0

    # File spread: more distinct files = broader blast
    file_spread_points = min(len(distinct_files) * 1.5, 25.0)
    raw_total += file_spread_points

    # Occurrence volume: many occurrences = systemic issue
    occurrence_points = min(math.log2(max(total_occurrences, 1)) * 3.0, 20.0)
    raw_total += occurrence_points

    return _saturate(raw_total, ceiling=60.0)


# ---------------------------------------------------------------------------
# Overall score & band derivation
# ---------------------------------------------------------------------------


def _weighted_overall(
    severity: int,
    exploitability: int,
    exposure: int,
    blast_radius: int,
) -> int:
    """Compute the weighted overall risk score (0-100).

    Component weights::

        severity:       0.40
        exploitability: 0.25
        exposure:       0.20
        blast_radius:   0.15

    The result is clamped to [0, 100] and rounded to the nearest integer.
    """
    raw = (
        severity * _COMPONENT_WEIGHTS["severity"]
        + exploitability * _COMPONENT_WEIGHTS["exploitability"]
        + exposure * _COMPONENT_WEIGHTS["exposure"]
        + blast_radius * _COMPONENT_WEIGHTS["blast_radius"]
    )
    return _clamp(round(raw))


def _derive_band(score: int) -> Band:
    """Derive the risk band from the overall score using CONTRACT.md thresholds.

    Thresholds (from ``models.BAND_THRESHOLDS``)::

        75–100 → critical
        50–74  → high
        25–49  → medium
        0–24   → low
    """
    for threshold, band in BAND_THRESHOLDS:
        if score >= threshold:
            return band
    return "low"


# ---------------------------------------------------------------------------
# Per-finding score contribution
# ---------------------------------------------------------------------------


def _assign_score_contributions(
    findings: list[Finding],
    overall_score: int,
) -> list[Finding]:
    """Set ``score_contribution`` on each finding so they sum to ``overall_score``.

    Strategy: compute a raw weight for each finding based on its severity,
    CVSS, category, and occurrences.  Normalise the weights so they sum to
    ``overall_score``, then distribute points proportionally.  A residual
    rounding correction is applied to the highest-ranked finding so the sum
    is exact.
    """
    if not findings:
        return []

    if overall_score == 0:
        return [
            f.model_copy(update={"score_contribution": 0.0})
            for f in findings
        ]

    raw_weights = [_finding_raw_weight(f) for f in findings]
    total_weight = sum(raw_weights)

    if total_weight == 0.0:
        # Pathological case: all weights zero but score > 0.  Distribute
        # evenly to maintain the sum invariant.
        even_share = round(overall_score / len(findings), 1)
        contributions = [even_share] * len(findings)
    else:
        # Proportional distribution, rounded to 1 decimal place.
        contributions = [
            round((w / total_weight) * overall_score, 1)
            for w in raw_weights
        ]

    # Rounding correction: adjust the first finding so the sum is exact.
    residual = round(overall_score - sum(contributions), 1)
    if residual != 0.0:
        contributions[0] = round(contributions[0] + residual, 1)

    return [
        finding.model_copy(update={"score_contribution": contrib})
        for finding, contrib in zip(findings, contributions)
    ]


def _finding_raw_weight(finding: Finding) -> float:
    """Compute a raw importance weight for proportional score distribution.

    Higher weight = this finding contributed more to the overall risk.
    Uses the same signals as the component scores: severity base, CVSS,
    category multiplier, and occurrence count.
    """
    base = _SEVERITY_BASE[finding.severity]
    cvss_factor = (finding.cvss / 10.0) if finding.cvss is not None else 0.5
    cat_mult = _CATEGORY_MULTIPLIER[finding.category]
    occurrence_mult = 1.0 + math.log2(max(finding.occurrences, 1)) * 0.15
    return base * cvss_factor * cat_mult * occurrence_mult


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _saturate(raw: float, ceiling: float) -> int:
    """Map *raw* through a log-saturation curve into [0, 100].

    Uses ``100 × (1 - e^(-raw / ceiling))`` which approaches 100 asymptotically.
    The *ceiling* parameter controls how quickly the curve saturates: lower
    values make it saturate faster (fewer findings needed to approach 100).

    The result is clamped to [0, 100] and rounded to the nearest integer.
    """
    if raw <= 0.0:
        return 0
    score = 100.0 * (1.0 - math.exp(-raw / ceiling))
    return _clamp(round(score))


def _clamp(value: int) -> int:
    """Clamp *value* to the [0, 100] range."""
    return max(0, min(100, value))


def _has_high_exploit_cwe(finding: Finding) -> bool:
    """Return ``True`` if any of *finding*'s CWEs are in the high-exploit set."""
    return bool(set(finding.cwe) & _HIGH_EXPLOIT_CWES)


def _is_exposed_path(file_path: str) -> bool:
    """Return ``True`` if *file_path* matches any internet-facing keyword."""
    lowered = file_path.lower()
    return any(keyword in lowered for keyword in _EXPOSURE_PATH_KEYWORDS)
