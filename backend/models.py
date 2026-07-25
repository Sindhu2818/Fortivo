"""Pydantic models that mirror CONTRACT.md exactly.

This is the one file in the backend that is real code rather than a stub, because
it *is* the contract. Every other module produces or consumes these types.

CONTRACT.md is frozen: if a model here disagrees with it, the model is wrong.
"""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["critical", "high", "medium", "low", "info"]
Band = Literal["low", "medium", "high", "critical"]
Source = Literal["trivy", "semgrep"]
Category = Literal["dependency", "secret", "code", "config", "license"]
Confidence = Literal["high", "medium", "low"]
Likelihood = Literal["likely", "possible", "unlikely"]
ScanStatus = Literal["queued", "running", "complete", "failed"]

MAX_REPORTED_FINDINGS = 30

# risk.band is derived from risk.score, never set independently.
BAND_THRESHOLDS: list[tuple[int, Band]] = [
    (75, "critical"),
    (50, "high"),
    (25, "medium"),
    (0, "low"),
]


class RiskComponents(BaseModel):
    severity: int = Field(ge=0, le=100)
    exploitability: int = Field(ge=0, le=100)
    exposure: int = Field(ge=0, le=100)
    blast_radius: int = Field(ge=0, le=100)


class Risk(BaseModel):
    score: int = Field(ge=0, le=100)
    band: Band
    components: RiskComponents
    summary: str
    executive_summary: Optional[str] = None
    key_risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class SeverityCounts(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0


class Stats(BaseModel):
    raw_findings: int = Field(ge=0)
    after_dedup: int = Field(ge=0)
    reported_findings: int = Field(ge=0, le=MAX_REPORTED_FINDINGS)
    by_severity: SeverityCounts
    by_source: dict[str, int]


class Package(BaseModel):
    name: str
    installed_version: str
    fixed_version: Optional[str] = None


class Explanation(BaseModel):
    what: str
    why_it_matters: str
    fix: str
    confidence: Confidence


class Finding(BaseModel):
    id: str
    rank: int = Field(ge=1)
    source: Source
    rule_id: str
    title: str
    severity: Severity
    cvss: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    category: Category
    file_path: str
    line_start: Optional[int] = Field(default=None, ge=1)
    line_end: Optional[int] = Field(default=None, ge=1)
    package: Optional[Package] = None
    code_snippet: Optional[str] = Field(default=None, max_length=400)
    cwe: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    occurrences: int = Field(default=1, ge=1)
    duplicate_of: Optional[str] = None
    score_contribution: float = 0.0
    explanation: Optional[Explanation] = None
    remediation: Optional[str] = None
    technical_notes: Optional[str] = None


class AttackStep(BaseModel):
    order: int = Field(ge=1)
    finding_id: str
    label: str
    technique: str


class AttackEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str

    model_config = ConfigDict(populate_by_name=True)


class AttackPath(BaseModel):
    id: str
    title: str
    severity: Severity
    likelihood: Likelihood
    narrative: str
    steps: list[AttackStep] = Field(min_length=2, max_length=5)
    edges: list[AttackEdge] = Field(default_factory=list)


class ScanResult(BaseModel):
    scan_id: str
    repo_url: str
    repo_name: str
    scanned_at: str
    duration_seconds: float = Field(ge=0)
    status: ScanStatus
    risk: Risk
    stats: Stats
    findings: list[Finding] = Field(default_factory=list, max_length=MAX_REPORTED_FINDINGS)
    attack_paths: list[AttackPath] = Field(default_factory=list, max_length=5)
    errors: list[str] = Field(default_factory=list)


class ScanRequest(BaseModel):
    """Body of POST /scan."""

    repo_url: str


class ScanAccepted(BaseModel):
    """Response of POST /scan."""

    scan_id: str
    status: ScanStatus


class ScanSummary(BaseModel):
    """One row of GET /results."""

    scan_id: str
    repo_name: str
    scanned_at: str
    status: ScanStatus
    score: int = Field(ge=0, le=100)
    band: Band