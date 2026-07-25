"""Collapse hundreds of raw findings down to the 30 that matter.

Responsibility
--------------
Two stages, in order:

1. **Dedup.** Group findings that are the same issue seen more than once — same
   rule_id + package across files, or same rule_id + file across lines. Keep one
   representative and set its ``occurrences`` to the group size.
2. **Rank.** Sort the survivors by importance (severity, cvss, category weight,
   occurrences, fix availability), assign dense 1-based ``rank``, take the top 30,
   and assign ``f_001``-style ids in rank order.

This module decides what the user sees. The LLM never reorders its output.

Definition of done
------------------
``stats.after_dedup <= stats.raw_findings``, ``len(findings) <= 30``, ranks are
dense and start at 1, and ids match rank order.
"""

from __future__ import annotations

from dataclasses import dataclass

from models import Category, Finding, MAX_REPORTED_FINDINGS, Severity

# ---------------------------------------------------------------------------
# Weight tables — shared by dedup representative selection and ranking.
# Higher integer = higher importance.
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHT: dict[Severity, int] = {
    "critical": 5,
    "high": 4,
    "medium": 3,
    "low": 2,
    "info": 1,
}

_CATEGORY_WEIGHT: dict[Category, int] = {
    "secret": 5,       # credential leaks are highest priority
    "dependency": 4,   # known CVEs with CVSS scores
    "code": 3,         # SAST findings
    "config": 2,       # misconfigurations
    "license": 1,      # legal / compliance issues
}


# ---------------------------------------------------------------------------
# Public result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReduceResult:
    """Ranked findings plus the post-dedup count for stats assembly."""

    findings: list[Finding]
    """Up to MAX_REPORTED_FINDINGS items, sorted by rank ascending."""

    after_dedup: int
    """Total survivor count *before* the top-30 cutoff (feeds stats.after_dedup)."""


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def reduce_findings(findings: list[Finding]) -> ReduceResult:
    """Deduplicate, rank, assign ids, and return the top 30 findings.

    Args:
        findings: Raw, unranked Finding objects produced by ``normalize.py``.
                  May be an empty list.

    Returns:
        A :class:`ReduceResult` whose ``findings`` list contains at most
        ``MAX_REPORTED_FINDINGS`` items.  Each item has its final ``rank`` and
        ``id`` set and ``duplicate_of`` cleared to ``None``.
    """
    deduped = _deduplicate(findings)
    ranked = _rank_and_limit(deduped, MAX_REPORTED_FINDINGS)
    return ReduceResult(findings=ranked, after_dedup=len(deduped))


# ---------------------------------------------------------------------------
# Stage 1 — Deduplication
# ---------------------------------------------------------------------------


def _deduplicate(findings: list[Finding]) -> list[Finding]:
    """Group identical findings and collapse each group to one representative.

    Grouping strategy
    ~~~~~~~~~~~~~~~~~
    * **Package-scoped** (``finding.package is not None``):
      key = ``("package", source, rule_id, package.name, installed_version)``
      → the same CVE against the same package version collapses across files.
    * **File-scoped** (no package):
      key = ``("file", source, rule_id, file_path)``
      → the same rule firing on different lines of the same file collapses.

    Dict insertion order is preserved, so the output list is deterministic for
    a given input sequence.
    """
    groups: dict[tuple[str, ...], list[Finding]] = {}
    for finding in findings:
        key = _dedup_key(finding)
        groups.setdefault(key, []).append(finding)

    return [_merge_group(group) for group in groups.values()]


def _dedup_key(finding: Finding) -> tuple[str, ...]:
    """Return the canonical dedup key for *finding*.

    The leading literal ``"package"`` / ``"file"`` prevents key collisions
    between the two strategies even when field values happen to match.
    """
    if finding.package is not None:
        # Collapse the same CVE+package seen in multiple manifest files.
        return (
            "package",
            finding.source,
            finding.rule_id,
            finding.package.name,
            finding.package.installed_version,
        )
    # Collapse the same rule firing on multiple lines of the same file.
    return ("file", finding.source, finding.rule_id, finding.file_path)


def _merge_group(group: list[Finding]) -> Finding:
    """Collapse *group* into one representative Finding.

    The representative is the highest-importance member (determined by
    :func:`_importance_tuple`).  Its ``occurrences`` is set to the group size
    and ``duplicate_of`` is cleared to ``None`` (CONTRACT.md: "always null in
    output").
    """
    representative = max(group, key=_importance_tuple)
    return representative.model_copy(
        update={
            "occurrences": len(group),
            "duplicate_of": None,  # contract: always null in final output
        }
    )


# ---------------------------------------------------------------------------
# Stage 2 — Ranking, ID assignment, top-N limit
# ---------------------------------------------------------------------------


def _rank_and_limit(findings: list[Finding], limit: int) -> list[Finding]:
    """Sort *findings* by importance, assign rank+id, and return the top *limit*.

    Sorting is fully deterministic: primary key is the 5-dimension importance
    tuple (all negated so ``sorted`` places the most important first), then five
    stable string/int tiebreakers guarantee a total order with no ties.

    IDs are assigned in rank order: rank 1 → ``f_001``, …, rank 30 → ``f_030``.
    ``duplicate_of`` is always ``None`` in emitted output (CONTRACT.md §Finding).
    """
    ordered = sorted(findings, key=_rank_sort_key)
    top = ordered[:limit]
    return [
        finding.model_copy(
            update={
                "rank": rank,
                "id": _finding_id(rank),
                "duplicate_of": None,  # contract: always null in final output
            }
        )
        for rank, finding in enumerate(top, start=1)
    ]


def _finding_id(rank: int) -> str:
    """Return the CONTRACT.md-compliant id string for *rank* (e.g. ``f_001``)."""
    return f"f_{rank:03d}"


# ---------------------------------------------------------------------------
# Importance scoring helpers (shared by both pipeline stages)
# ---------------------------------------------------------------------------


def _importance_tuple(finding: Finding) -> tuple[int | float | str, ...]:
    """Return a comparable tuple where **higher** values mean greater importance.

    Dimensions (most to least significant):
    0. Severity weight    — critical=5 … info=1
    1. CVSS score         — 0.0–10.0; ``None`` becomes 0.0
    2. Category weight    — secret=5 … license=1
    3. Occurrences        — more prevalent = higher priority
    4. Fix availability   — 1 if ``package.fixed_version`` is non-empty, else 0
    5. Title              — lexicographic tiebreaker for fully deterministic order
    """
    return (
        _SEVERITY_WEIGHT[finding.severity],
        finding.cvss or 0.0,
        _CATEGORY_WEIGHT[finding.category],
        finding.occurrences,
        1 if _has_fix(finding) else 0,
        finding.title,
    )


def _rank_sort_key(finding: Finding) -> tuple[int | float | str, ...]:
    """Return a sort key where **lower** values sort earlier (more important).

    The five numeric/boolean dimensions from :func:`_importance_tuple` are
    negated so that ``sorted(..., key=_rank_sort_key)`` places rank-1 first.
    Five string/int tiebreakers follow to guarantee a stable total order:
    ``source``, ``rule_id``, ``file_path``, ``line_start``, ``title``.
    """
    importance = _importance_tuple(finding)
    return (
        -importance[0],            # severity      (higher → earlier)
        -importance[1],            # cvss          (higher → earlier)
        -importance[2],            # category      (higher → earlier)
        -importance[3],            # occurrences   (more   → earlier)
        -importance[4],            # fix available (yes    → earlier)
        finding.source,            # stable tiebreaker 1
        finding.rule_id,           # stable tiebreaker 2
        finding.file_path,         # stable tiebreaker 3
        finding.line_start or 0,   # stable tiebreaker 4
        finding.title,             # stable tiebreaker 5 (always unique enough)
    )


def _has_fix(finding: Finding) -> bool:
    """Return ``True`` iff *finding* has a non-empty ``fixed_version`` on its package."""
    if finding.package is None:
        return False
    fixed = finding.package.fixed_version
    return bool(fixed and fixed.strip())
