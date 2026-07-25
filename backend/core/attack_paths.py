"""Chain individual findings into 2-5 step multi-stage attack paths.

Responsibility
--------------
Deterministic, in Python: group ranked findings into plausible kill chains by
stage (entry point -> execution -> credential access -> lateral movement /
impact), using category, file locality, and severity. Emit models.AttackPath
objects with ordered `steps` and directed acyclic `edges`, at most 5 paths.

`title` and `narrative` are left empty here — the LLM writes those later. The
graph structure is never LLM-generated.

Definition of done
------------------
`attack_paths` is non-empty for repos with multi-stage findings, every step/edge
finding_id resolves to a reported finding, and no path contains a cycle.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple

from models import (
    AttackEdge,
    AttackPath,
    AttackStep,
    Category,
    Finding,
    Likelihood,
    Severity,
)

# Maximum attack paths to emit per scan (CONTRACT.md limit)
MAX_ATTACK_PATHS = 5

# Severity hierarchy for path severity calculation
_SEVERITY_ORDER: Dict[Severity, int] = {
    "critical": 5,
    "high": 4,
    "medium": 3,
    "low": 2,
    "info": 1,
}

_EXPOSED_PATH_KEYWORDS = (
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


@dataclass(frozen=True)
class FindingStage:
    """Stage metadata for building kill chain sequences."""

    stage: int
    """Kill chain stage index (1: Initial Access, 2: Execution, 3: Credential Access, 4: Impact)."""

    label: str
    """Short human-readable label for the step."""

    technique: str
    """MITRE ATT&CK style tactic/technique name."""


def generate_attack_paths(findings: List[Finding]) -> List[AttackPath]:
    """Generate 0 to 5 deterministic AttackPath objects from ranked findings.

    Args:
        findings: Ranked and scored Finding objects (max 30).

    Returns:
        List of 0-5 AttackPath objects matching CONTRACT.md specifications.
        Returns empty list if findings is empty or fewer than 2 findings exist.
    """
    if len(findings) < 2:
        return []

    # Map finding IDs to finding objects for quick lookup
    finding_map = {f.id: f for f in findings}

    # Assign attack chain stage to each finding
    staged_findings = [_classify_finding_stage(f) for f in findings]

    # Build candidate paths (sequences of finding IDs)
    candidate_chains = _build_candidate_chains(findings, staged_findings)

    if not candidate_chains:
        # Fallback generator if no natural multi-stage chain is formed
        candidate_chains = _build_fallback_chains(findings)

    # Convert candidate chains into AttackPath objects
    attack_paths: List[AttackPath] = []
    seen_signatures: Set[Tuple[str, ...]] = set()

    for chain in candidate_chains:
        sig = tuple(chain)
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)

        path_obj = _create_attack_path(
            path_index=len(attack_paths) + 1,
            finding_ids=chain,
            finding_map=finding_map,
        )
        if path_obj is not None:
            attack_paths.append(path_obj)
            if len(attack_paths) >= MAX_ATTACK_PATHS:
                break

    return attack_paths


# ---------------------------------------------------------------------------
# Stage Classification
# ---------------------------------------------------------------------------


def _classify_finding_stage(finding: Finding) -> FindingStage:
    """Classify a finding into an attack kill-chain stage (1..4)."""
    file_path = finding.file_path.lower()
    is_exposed = any(kw in file_path for kw in _EXPOSED_PATH_KEYWORDS)
    cwes = set(finding.cwe)

    # Stage 3: Credential Access / Secret Leak
    if finding.category == "secret" or "CWE-798" in cwes or "CWE-312" in cwes:
        return FindingStage(
            stage=3,
            label=_clean_label(finding.title, "Hardcoded credential or secret exposed"),
            technique="Credential Access",
        )

    # Stage 1: Initial Access / Public Endpoint Exposure
    if is_exposed or "CWE-79" in cwes or "CWE-352" in cwes or "CWE-287" in cwes or "CWE-306" in cwes:
        return FindingStage(
            stage=1,
            label=_clean_label(finding.title, "Public interface or entry point vulnerability"),
            technique="Initial Access",
        )

    # Stage 4: Impact / Lateral Movement / Data Exfiltration
    if "CWE-918" in cwes or "CWE-200" in cwes or finding.category == "config":
        return FindingStage(
            stage=4,
            label=_clean_label(finding.title, "Misconfiguration or exposure enabling lateral pivot"),
            technique="Impact",
        )

    # Stage 2: Execution / Code & Dependency Vulnerability (Default for SAST & Dependencies)
    return FindingStage(
        stage=2,
        label=_clean_label(finding.title, "Vulnerability allows unauthorized code execution"),
        technique="Execution",
    )


# ---------------------------------------------------------------------------
# Candidate Chain Construction
# ---------------------------------------------------------------------------


def _build_candidate_chains(
    findings: List[Finding],
    staged_findings: List[FindingStage],
) -> List[List[str]]:
    """Build candidate chains by matching findings across progressing stages."""
    chains: List[List[str]] = []

    # Group findings by stage
    by_stage: Dict[int, List[Finding]] = {1: [], 2: [], 3: [], 4: []}
    for f, staged in zip(findings, staged_findings):
        by_stage[staged.stage].append(f)

    # Strategy A: Same service/directory locality chain (Stage 1 -> Stage 2 -> Stage 3)
    locality_chains = _build_locality_chains(findings, by_stage)
    chains.extend(locality_chains)

    # Strategy B: Cross-category progression (Stage 1 -> Stage 2 -> Stage 3/4)
    if by_stage[1] and by_stage[2]:
        for entry in by_stage[1][:3]:
            for exec_f in by_stage[2][:3]:
                if entry.id == exec_f.id:
                    continue
                chain = [entry.id, exec_f.id]
                # Try adding Stage 3 or 4 if available
                targets = by_stage[3] or by_stage[4]
                for target in targets[:2]:
                    if target.id not in chain:
                        chain_3 = chain + [target.id]
                        chains.append(chain_3)
                if len(chain) >= 2:
                    chains.append(chain)

    # Strategy C: Entry / Execution -> Credential Access (Stage 1/2 -> Stage 3)
    if by_stage[3]:
        for secret in by_stage[3][:3]:
            precursors = by_stage[1] or by_stage[2]
            for pre in precursors[:3]:
                if pre.id != secret.id:
                    chains.append([pre.id, secret.id])

    return chains


def _build_locality_chains(
    findings: List[Finding],
    by_stage: Dict[int, List[Finding]],
) -> List[List[str]]:
    """Group findings by top-level service directory to find co-located flaws."""
    service_groups: Dict[str, List[Finding]] = {}
    for f in findings:
        prefix = _get_service_prefix(f.file_path)
        if prefix:
            service_groups.setdefault(prefix, []).append(f)

    locality_chains: List[List[str]] = []
    for prefix, group in service_groups.items():
        if len(group) >= 2:
            # Sort group findings by rank
            sorted_group = sorted(group, key=lambda f: f.rank)
            chain_ids = [f.id for f in sorted_group[:4]]
            if len(chain_ids) >= 2:
                locality_chains.append(chain_ids)

    return locality_chains


def _build_fallback_chains(findings: List[Finding]) -> List[List[str]]:
    """Fallback generator: create simple pairwise/triplet chains from top ranked findings."""
    chains: List[List[str]] = []
    top_findings = findings[:6]

    for i in range(len(top_findings) - 1):
        chain = [top_findings[i].id, top_findings[i + 1].id]
        if i + 2 < len(top_findings):
            chain.append(top_findings[i + 2].id)
        chains.append(chain)

    return chains


# ---------------------------------------------------------------------------
# Path Assembly & Validation
# ---------------------------------------------------------------------------


def _create_attack_path(
    path_index: int,
    finding_ids: List[str],
    finding_map: Dict[str, Finding],
) -> Optional[AttackPath]:
    """Assemble an AttackPath model object from a sequence of finding IDs."""
    # Ensure between 2 and 5 steps
    if len(finding_ids) < 2:
        return None
    ids = finding_ids[:5]

    path_findings = [finding_map[fid] for fid in ids if fid in finding_map]
    if len(path_findings) < 2:
        return None

    # Construct steps
    steps: List[AttackStep] = []
    for order, finding in enumerate(path_findings, start=1):
        staged = _classify_finding_stage(finding)
        step = AttackStep(
            order=order,
            finding_id=finding.id,
            label=staged.label,
            technique=staged.technique,
        )
        steps.append(step)

    # Construct sequential DAG edges: step[i] -> step[i+1]
    edges: List[AttackEdge] = []
    for i in range(len(steps) - 1):
        edge = AttackEdge(
            from_=steps[i].finding_id,
            to=steps[i + 1].finding_id,
        )
        edges.append(edge)

    # Derive overall path severity and likelihood
    max_sev = max(path_findings, key=lambda f: _SEVERITY_ORDER[f.severity]).severity
    likelihood = _determine_likelihood(path_findings)

    return AttackPath(
        id=f"ap_{path_index:03d}",
        title="",  # Populated by LLM stage
        severity=max_sev,
        likelihood=likelihood,
        narrative="",  # Populated by LLM stage
        steps=steps,
        edges=edges,
    )


def _determine_likelihood(findings: List[Finding]) -> Likelihood:
    """Determine path likelihood based on constituent findings."""
    has_critical = any(f.severity == "critical" for f in findings)
    has_secret = any(f.category == "secret" for f in findings)
    has_exposed = any(
        any(kw in f.file_path.lower() for kw in _EXPOSURE_PATH_KEYWORDS)
        for f in findings
    )

    if has_critical or (has_secret and has_exposed):
        return "likely"
    if any(f.severity == "high" for f in findings) or has_secret or has_exposed:
        return "possible"
    return "unlikely"


def _get_service_prefix(file_path: str) -> Optional[str]:
    """Extract top-level directory/service prefix from file path."""
    parts = file_path.replace("\\", "/").strip("/").split("/")
    if len(parts) >= 2:
        return f"{parts[0]}/{parts[1]}"
    if len(parts) == 1:
        return parts[0]
    return None


def _clean_label(title: str, fallback: str) -> str:
    """Sanitise step label to ensure clean string formatting."""
    cleaned = " ".join(title.split()).rstrip(".")
    if len(cleaned) > 80:
        cleaned = cleaned[:77].rstrip() + "..."
    return cleaned or fallback

