/**
 * TypeScript interfaces mirroring CONTRACT.md exactly.
 *
 * This is the one frontend file that is real code rather than a stub, because it
 * *is* the contract. CONTRACT.md is frozen — if these types disagree with it,
 * these types are wrong.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Band = 'low' | 'medium' | 'high' | 'critical'
export type Source = 'trivy' | 'semgrep'
export type Category = 'dependency' | 'secret' | 'code' | 'config' | 'license'
export type Confidence = 'high' | 'medium' | 'low'
export type Likelihood = 'likely' | 'possible' | 'unlikely'
export type ScanStatus = 'queued' | 'running' | 'complete' | 'failed'

export const MAX_REPORTED_FINDINGS = 30

export interface RiskComponents {
  severity: number
  exploitability: number
  exposure: number
  blast_radius: number
}

export interface Risk {
  score: number
  band: Band
  components: RiskComponents
  summary: string
}

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface Stats {
  raw_findings: number
  after_dedup: number
  reported_findings: number
  by_severity: SeverityCounts
  by_source: Record<string, number>
}

export interface Package {
  name: string
  installed_version: string
  fixed_version: string | null
}

export interface Explanation {
  what: string
  why_it_matters: string
  fix: string
  confidence: Confidence
}

export interface Finding {
  id: string
  rank: number
  source: Source
  rule_id: string
  title: string
  severity: Severity
  cvss: number | null
  category: Category
  file_path: string
  line_start: number | null
  line_end: number | null
  package: Package | null
  code_snippet: string | null
  cwe: string[]
  references: string[]
  occurrences: number
  duplicate_of: string | null
  score_contribution: number
  explanation: Explanation | null
}

/**
 * `kind` and `AttackEdge.label` below are NOT in CONTRACT.md. They are present on
 * every step and edge in fixtures/mock_results.json, so the backend is already
 * emitting them, but the frozen contract does not promise them. They are typed
 * optional and every consumer must degrade without them: AttackPathGraph derives
 * `kind` from the edge topology when it is absent and simply omits an unlabelled
 * edge's caption. Contract-only documents therefore still render correctly.
 * Flagged for Sindhu in STATUS.md — the contract is frozen, so we do not add them
 * to it ourselves.
 */
export type StepKind = 'entry' | 'pivot' | 'impact'

export interface AttackStep {
  order: number
  finding_id: string
  label: string
  technique: string
  kind?: StepKind
}

export interface AttackEdge {
  from: string
  to: string
  label?: string
}

export interface AttackPath {
  id: string
  title: string
  severity: Severity
  likelihood: Likelihood
  narrative: string
  steps: AttackStep[]
  edges: AttackEdge[]
}

export interface ScanResult {
  scan_id: string
  repo_url: string
  repo_name: string
  scanned_at: string
  duration_seconds: number
  status: ScanStatus
  risk: Risk
  stats: Stats
  findings: Finding[]
  attack_paths: AttackPath[]
  errors: string[]
}

export interface ScanRequest {
  repo_url: string
}

export interface ScanAccepted {
  scan_id: string
  status: ScanStatus
}

/**
 * Progress types. CONTRACT.md is frozen and describes the *result* document; it
 * says nothing about the in-flight status endpoint, so these live here and are
 * the frontend's proposal to the backend. See STATUS.md.
 */
export type ScanStage =
  | 'cloning'
  | 'scanning'
  | 'normalizing'
  | 'reducing'
  | 'reasoning'
  | 'complete'

export interface ScanCounts {
  /** Raw findings emitted so far. Ticks up while the scanners run. */
  total_raw: number
  /** Survivors after dedup. `null` until the reducing stage. */
  after_dedupe: number | null
  /** Findings the LLM has explained. `null` until the reasoning stage. */
  analyzed: number | null
}

export interface ScanProgress {
  status: ScanStatus
  stage: ScanStage
  counts: ScanCounts
}

export interface ScanSummary {
  scan_id: string
  repo_name: string
  scanned_at: string
  status: ScanStatus
  score: number
  band: Band
}
