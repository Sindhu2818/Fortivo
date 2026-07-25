"""Map raw Trivy and Semgrep JSON into the common models.Finding shape.

Responsibility
--------------
The single translation layer between scanner-specific vocabulary and CONTRACT.md.
Owns:
  * severity mapping (Trivy CRITICAL/HIGH/... and Semgrep ERROR/WARNING/INFO -> our
    five-value Severity enum)
  * category assignment (dependency / secret / code / config / license)
  * absolute -> repo-relative POSIX file paths
  * code_snippet extraction, truncated to 400 chars
  * cvss, cwe, references extraction where the scanner provides them

Findings come out unranked and unnumbered: rank, id, and occurrences are assigned
later by core.reduce. Every field name read here must be verified against the
files in /fixtures. Never guess.

Definition of done
------------------
Every Finding produced validates against models.Finding, and file_path is never
absolute.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from models import Category, Finding, Package, Severity, Source

MAX_SNIPPET_LEN = 400

_TRIVY_SEVERITY: dict[str, Severity] = {
    "CRITICAL": "critical",
    "HIGH": "high",
    "MEDIUM": "medium",
    "LOW": "low",
    "UNKNOWN": "info",
}

_SEMGREP_SEVERITY: dict[str, Severity] = {
    "ERROR": "high",
    "WARNING": "medium",
    "INFO": "info",
}

_CWE_CODE_PATTERN = re.compile(r"^(CWE-\d+)")


class _ProvisionalIdFactory:
    """Generate unique placeholder ids until core.reduce assigns f_XXX."""

    def __init__(self) -> None:
        self._counter = 0

    def next_id(self, source: Source) -> str:
        self._counter += 1
        return f"{source}_{self._counter:06d}"


def normalize_findings(
    trivy_report: dict[str, Any] | None,
    semgrep_report: dict[str, Any] | None,
    repo_root: str | Path,
) -> list[Finding]:
    """Merge Trivy and Semgrep raw reports into unranked Finding objects."""
    root = Path(repo_root).resolve()
    id_factory = _ProvisionalIdFactory()
    findings: list[Finding] = []
    findings.extend(_normalize_trivy(trivy_report or {}, root, id_factory))
    findings.extend(_normalize_semgrep(semgrep_report or {}, root, id_factory))
    return findings


def _normalize_trivy(
    report: dict[str, Any],
    repo_root: Path,
    id_factory: _ProvisionalIdFactory,
) -> list[Finding]:
    findings: list[Finding] = []
    for result in report.get("Results") or []:
        if not isinstance(result, dict):
            continue
        target = result.get("Target") or ""
        file_path = _to_repo_relative_path(str(target), repo_root)
        result_class = result.get("Class") or ""

        for vulnerability in result.get("Vulnerabilities") or []:
            if isinstance(vulnerability, dict):
                finding = _trivy_vulnerability_finding(
                    vulnerability, file_path, result_class, repo_root, id_factory
                )
                if finding is not None:
                    findings.append(finding)

        for secret in result.get("Secrets") or []:
            if isinstance(secret, dict):
                finding = _trivy_secret_finding(
                    secret, file_path, id_factory
                )
                if finding is not None:
                    findings.append(finding)
    return findings


def _normalize_semgrep(
    report: dict[str, Any],
    repo_root: Path,
    id_factory: _ProvisionalIdFactory,
) -> list[Finding]:
    findings: list[Finding] = []
    for item in report.get("results") or []:
        if not isinstance(item, dict):
            continue
        finding = _semgrep_result_finding(item, repo_root, id_factory)
        if finding is not None:
            findings.append(finding)
    return findings


def _trivy_vulnerability_finding(
    vulnerability: dict[str, Any],
    file_path: str,
    result_class: str,
    repo_root: Path,
    id_factory: _ProvisionalIdFactory,
) -> Finding | None:
    rule_id = vulnerability.get("VulnerabilityID")
    if not rule_id:
        return None

    title = _clean_title(str(vulnerability.get("Title") or rule_id))
    severity = _map_trivy_severity(vulnerability.get("Severity"))
    category = _trivy_category(result_class, vulnerability)

    fixed_version = vulnerability.get("FixedVersion")
    package = Package(
        name=str(vulnerability.get("PkgName") or "unknown"),
        installed_version=str(vulnerability.get("InstalledVersion") or "unknown"),
        fixed_version=str(fixed_version) if fixed_version else None,
    )

    snippet = _dependency_snippet(
        repo_root,
        file_path,
        package.name,
        package.installed_version,
    )

    return Finding(
        id=id_factory.next_id("trivy"),
        rank=1,
        source="trivy",
        rule_id=str(rule_id),
        title=title,
        severity=severity,
        cvss=_extract_trivy_cvss(vulnerability.get("CVSS")),
        category=category,
        file_path=file_path,
        line_start=None,
        line_end=None,
        package=package if category == "dependency" else None,
        code_snippet=snippet,
        cwe=_normalize_cwe_list(vulnerability.get("CweIDs") or []),
        references=_string_list(vulnerability.get("References")),
        occurrences=1,
        duplicate_of=None,
        score_contribution=0.0,
        explanation=None,
    )


def _trivy_secret_finding(
    secret: dict[str, Any],
    file_path: str,
    id_factory: _ProvisionalIdFactory,
) -> Finding | None:
    rule_id = secret.get("RuleID")
    if not rule_id:
        return None

    title = _clean_title(str(secret.get("Title") or rule_id))
    severity = _map_trivy_severity(secret.get("Severity"))
    line_start = _positive_int(secret.get("StartLine"))
    line_end = _positive_int(secret.get("EndLine")) or line_start

    return Finding(
        id=id_factory.next_id("trivy"),
        rank=1,
        source="trivy",
        rule_id=str(rule_id),
        title=title,
        severity=severity,
        cvss=None,
        category="secret",
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        package=None,
        code_snippet=_trivy_secret_snippet(secret),
        cwe=[],
        references=[],
        occurrences=1,
        duplicate_of=None,
        score_contribution=0.0,
        explanation=None,
    )


def _semgrep_result_finding(
    result: dict[str, Any],
    repo_root: Path,
    id_factory: _ProvisionalIdFactory,
) -> Finding | None:
    rule_id = result.get("check_id")
    if not rule_id:
        return None

    extra = result.get("extra") or {}
    metadata = extra.get("metadata") or {}
    message = str(extra.get("message") or rule_id)
    file_path = _to_repo_relative_path(str(result.get("path") or ""), repo_root)
    line_start = _positive_int((result.get("start") or {}).get("line"))
    line_end = _positive_int((result.get("end") or {}).get("line")) or line_start

    snippet = _read_line_snippet(repo_root, file_path, line_start)
    if snippet is None:
        snippet = _truncate_snippet(str(extra.get("lines") or ""))
        if snippet == "requires login":
            snippet = None

    return Finding(
        id=id_factory.next_id("semgrep"),
        rank=1,
        source="semgrep",
        rule_id=str(rule_id),
        title=_title_from_message(message),
        severity=_map_semgrep_severity(extra.get("severity")),
        cvss=None,
        category=_semgrep_category(str(rule_id), metadata),
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        package=None,
        code_snippet=snippet,
        cwe=_normalize_cwe_list(metadata.get("cwe") or []),
        references=_semgrep_references(metadata),
        occurrences=1,
        duplicate_of=None,
        score_contribution=0.0,
        explanation=None,
    )


def _map_trivy_severity(raw: Any) -> Severity:
    if raw is None:
        return "info"
    return _TRIVY_SEVERITY.get(str(raw).upper(), "info")


def _map_semgrep_severity(raw: Any) -> Severity:
    if raw is None:
        return "info"
    return _SEMGREP_SEVERITY.get(str(raw).upper(), "info")


def _trivy_category(result_class: str, vulnerability: dict[str, Any]) -> Category:
    if result_class == "secret":
        return "secret"
    if result_class == "lang-pkgs" or vulnerability.get("PkgName"):
        return "dependency"
    return "dependency"


def _semgrep_category(rule_id: str, metadata: dict[str, Any]) -> Category:
    technologies = metadata.get("technology") or []
    tech_set = {str(item).lower() for item in technologies}
    rule_lower = rule_id.lower()
    if "secret" in rule_lower or "secrets" in tech_set:
        return "secret"
    if "dockerfile" in tech_set or rule_lower.startswith("dockerfile."):
        return "config"
    return "code"


def _to_repo_relative_path(raw_path: str, repo_root: Path) -> str:
    """Convert scanner paths to repo-relative POSIX strings."""
    if not raw_path:
        return ""

    path = Path(raw_path.replace("\\", "/"))
    if path.is_absolute():
        try:
            return path.resolve().relative_to(repo_root).as_posix()
        except ValueError:
            return path.as_posix().lstrip("/")

    normalized = raw_path.replace("\\", "/").lstrip("./")
    prefix = f"{repo_root.name}/"
    if normalized.startswith(prefix):
        normalized = normalized[len(prefix) :]
    return normalized


def _extract_trivy_cvss(raw: Any) -> float | None:
    if not isinstance(raw, dict):
        return None
    scores: list[float] = []
    for source in raw.values():
        if not isinstance(source, dict):
            continue
        for key in ("V3Score", "V40Score", "V2Score"):
            value = source.get(key)
            if isinstance(value, (int, float)):
                scores.append(float(value))
    return max(scores) if scores else None


def _normalize_cwe_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    codes: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        match = _CWE_CODE_PATTERN.match(item.strip())
        if match:
            codes.append(match.group(1))
        elif item.startswith("CWE-"):
            codes.append(item.split(":", 1)[0].strip())
    return codes


def _string_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if item]


def _semgrep_references(metadata: dict[str, Any]) -> list[str]:
    refs = _string_list(metadata.get("references"))
    for key in ("shortlink", "source", "source-rule-url"):
        value = metadata.get(key)
        if value and str(value) not in refs:
            refs.append(str(value))
    return refs


def _positive_int(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value >= 1 else None


def _clean_title(title: str) -> str:
    cleaned = " ".join(title.split())
    return cleaned[:-1] if cleaned.endswith(".") else cleaned


def _title_from_message(message: str) -> str:
    first_line = message.splitlines()[0].strip()
    sentence = re.split(r"(?<=[.!?])\s+", first_line, maxsplit=1)[0]
    cleaned = _clean_title(sentence)
    if len(cleaned) > 160:
        cleaned = cleaned[:157].rstrip() + "..."
    return cleaned


def _truncate_snippet(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return None
    if len(stripped) <= MAX_SNIPPET_LEN:
        return stripped
    return stripped[: MAX_SNIPPET_LEN - 3].rstrip() + "..."


def _trivy_secret_snippet(secret: dict[str, Any]) -> str | None:
    match = secret.get("Match")
    if isinstance(match, str) and match.strip():
        return _truncate_snippet(match)

    code = secret.get("Code") or {}
    lines = code.get("Lines") or []
    for line in lines:
        if not isinstance(line, dict):
            continue
        if line.get("IsCause") and line.get("Highlighted"):
            return _truncate_snippet(str(line["Highlighted"]))
    return None


def _read_line_snippet(
    repo_root: Path,
    file_path: str,
    line_number: int | None,
) -> str | None:
    if line_number is None or not file_path:
        return None
    full_path = repo_root / Path(file_path)
    if not full_path.is_file():
        return None
    try:
        lines = full_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    if line_number < 1 or line_number > len(lines):
        return None
    return _truncate_snippet(lines[line_number - 1])


def _dependency_snippet(
    repo_root: Path,
    file_path: str,
    package_name: str,
    installed_version: str,
) -> str | None:
    if not file_path:
        return None
    full_path = repo_root / Path(file_path)
    if not full_path.is_file():
        return None
    try:
        lines = full_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None

    needles = (
        f"{package_name}=={installed_version}",
        f"{package_name}>=",
        f"{package_name}@",
        package_name,
    )
    for line in lines:
        stripped = line.strip()
        for needle in needles:
            if needle in stripped:
                return _truncate_snippet(stripped)
    return None
