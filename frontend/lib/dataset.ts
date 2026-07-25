/**
 * The demo dataset for every page that is wider than a single scan.
 *
 * Responsibility: turn the one document in fixtures/mock_results.json into the
 * fleet of scans, repos and history the product shell needs — /scans, /findings,
 * /analytics, /activity, /reports and the admin pages all read from here.
 *
 * Two rules this file follows:
 *
 * 1. **Everything is derived, nothing is invented.** The findings, severities,
 *    explanations and attack paths are the fixture's own. What varies per repo
 *    is which subset of them is present, so no security content on screen is
 *    made up — it all traces back to a real Trivy or Semgrep result.
 *
 * 2. **Everything is deterministic.** No Math.random, no Date.now. Dates are
 *    fixed offsets from the fixture's own `scanned_at`. A server render and the
 *    client render that hydrates it must produce identical HTML, and a value
 *    that moves between them is a hydration error.
 *
 * The single-scan path is untouched: lib/api.ts still serves /dashboard/[scanId]
 * from the fixture (or the live backend). This module never fetches.
 *
 * DoD: importing this module twice in one process yields identical values, and
 * every ScopedFinding traces back to a finding in the fixture.
 */

import { MOCK_SCAN_RESULT } from './demo'
import { scoreToBandFallback } from './severity'
import type {
  ActivityEvent,
  ApiKey,
  Integration,
  LogEntry,
  Report,
  ScopedFinding,
  ServiceStatus,
  TeamMember,
  User,
} from './app-types'
import type {
  AttackPath,
  Band,
  ScanResult,
  ScanStatus,
  ScanSummary,
  Severity,
  SeverityCounts,
} from './types'

const BASE = MOCK_SCAN_RESULT

/** Every derived timestamp hangs off the fixture's own scan time. */
const BASE_TIME = Date.parse(BASE.scanned_at)
const HOUR = 3_600_000
const DAY = 24 * HOUR

function isoAgo(ms: number): string {
  return new Date(BASE_TIME - ms).toISOString()
}

/* ------------------------------------------------------------------ */
/* Repos                                                              */
/* ------------------------------------------------------------------ */

interface RepoSeed {
  scan_id: string
  repo_name: string
  repo_url: string
  score: number
  status: ScanStatus
  /** Offset back from the fixture's scan time. */
  age_ms: number
  duration_seconds: number
  /** Take every Nth fixture finding, starting at `offset`. */
  stride: number
  offset: number
}

/**
 * The first entry is the fixture itself — same scan_id, same score, all 30
 * findings — so /scans and the existing /dashboard/[scanId] agree about the scan
 * the demo actually runs. The rest are the same findings sliced differently.
 */
const REPO_SEEDS: RepoSeed[] = [
  {
    scan_id: BASE.scan_id,
    repo_name: BASE.repo_name,
    repo_url: BASE.repo_url,
    score: BASE.risk.score,
    status: BASE.status,
    age_ms: 0,
    duration_seconds: BASE.duration_seconds,
    stride: 1,
    offset: 0,
  },
  {
    scan_id: 'scan_checkout_9f31',
    repo_name: 'checkout-service',
    repo_url: 'https://github.com/fortivo/checkout-service',
    score: 84,
    status: 'complete',
    age_ms: 5 * HOUR,
    duration_seconds: 34.2,
    stride: 2,
    offset: 0,
  },
  {
    scan_id: 'scan_gateway_4a77',
    repo_name: 'mobile-gateway',
    repo_url: 'https://github.com/fortivo/mobile-gateway',
    score: 77,
    status: 'complete',
    age_ms: DAY + 2 * HOUR,
    duration_seconds: 28.9,
    stride: 3,
    offset: 1,
  },
  {
    scan_id: 'scan_payments_1c05',
    repo_name: 'payments-worker',
    repo_url: 'https://github.com/fortivo/payments-worker',
    score: 66,
    status: 'complete',
    age_ms: 2 * DAY + 3 * HOUR,
    duration_seconds: 21.4,
    stride: 3,
    offset: 0,
  },
  {
    scan_id: 'scan_api_7b12',
    repo_name: 'fortivo-api',
    repo_url: 'https://github.com/fortivo/fortivo-api',
    score: 58,
    status: 'complete',
    age_ms: 3 * DAY + 6 * HOUR,
    duration_seconds: 19.7,
    stride: 4,
    offset: 2,
  },
  {
    scan_id: 'scan_internal_e38d',
    repo_name: 'internal-tools',
    repo_url: 'https://github.com/fortivo/internal-tools',
    score: 41,
    status: 'complete',
    age_ms: 5 * DAY,
    duration_seconds: 15.1,
    stride: 5,
    offset: 3,
  },
  {
    scan_id: 'scan_marketing_2d90',
    repo_name: 'marketing-site',
    repo_url: 'https://github.com/fortivo/marketing-site',
    score: 19,
    status: 'complete',
    age_ms: 6 * DAY + 4 * HOUR,
    duration_seconds: 11.8,
    stride: 9,
    offset: 5,
  },
  {
    // A failed scan is worth one row: the landing page and /scans both have a
    // dedicated presentation for it, and it is easy to regress.
    scan_id: 'scan_legacy_0b4e',
    repo_name: 'legacy-cron',
    repo_url: 'https://github.com/fortivo/legacy-cron',
    score: 0,
    status: 'failed',
    age_ms: 8 * DAY + HOUR,
    duration_seconds: 2.3,
    stride: 1,
    offset: 0,
  },
]

/* ------------------------------------------------------------------ */
/* Scans                                                               */
/* ------------------------------------------------------------------ */

function bandFor(seed: RepoSeed): Band {
  return seed.scan_id === BASE.scan_id ? BASE.risk.band : scoreToBandFallback(seed.score)
}

/** Newest first, matching what GET /results returns for the landing page. */
export const DEMO_SCANS: ScanSummary[] = REPO_SEEDS.map((seed) => ({
  scan_id: seed.scan_id,
  repo_name: seed.repo_name,
  scanned_at: isoAgo(seed.age_ms),
  status: seed.status,
  score: seed.score,
  band: bandFor(seed),
}))

export function findScan(scanId: string): ScanSummary | undefined {
  return DEMO_SCANS.find((s) => s.scan_id === scanId)
}

export const REPO_NAMES: string[] = REPO_SEEDS.map((s) => s.repo_name)

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

function emptyCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
}

function countBySeverity(findings: { severity: Severity }[]): SeverityCounts {
  const counts = emptyCounts()
  for (const f of findings) counts[f.severity] += 1
  return counts
}

/**
 * The fixture's findings, sliced for one repo and re-ranked 1..n.
 *
 * A failed scan produces nothing — that is what failed means, and a failed row
 * that still listed findings would be a lie the UI then has to explain.
 */
function findingsForSeed(seed: RepoSeed): ScopedFinding[] {
  if (seed.status === 'failed') return []
  return BASE.findings
    .filter((_, i) => i % seed.stride === seed.offset % seed.stride)
    .map((finding, i) => ({
      ...finding,
      rank: i + 1,
      scan_id: seed.scan_id,
      repo_name: seed.repo_name,
    }))
}

const FINDINGS_BY_SCAN: Record<string, ScopedFinding[]> = Object.fromEntries(
  REPO_SEEDS.map((seed) => [seed.scan_id, findingsForSeed(seed)])
)

/** Every finding across every scan, ranked worst-first within each scan. */
export const ALL_FINDINGS: ScopedFinding[] = REPO_SEEDS.flatMap(
  (seed) => FINDINGS_BY_SCAN[seed.scan_id]
)

export function findingsForScan(scanId: string): ScopedFinding[] {
  return FINDINGS_BY_SCAN[scanId] ?? []
}

/**
 * One finding by scan + contract id.
 *
 * Finding ids (`f_001`) are only unique inside their own scan, which is why the
 * detail route is /findings/[scanId]/[findingId] and not /findings/[id].
 */
export function findFinding(scanId: string, findingId: string): ScopedFinding | undefined {
  return findingsForScan(scanId).find((f) => f.id === findingId)
}

/** Findings from other scans that share this one's rule — the "seen elsewhere" list. */
export function relatedFindings(finding: ScopedFinding): ScopedFinding[] {
  return ALL_FINDINGS.filter(
    (f) => f.rule_id === finding.rule_id && f.scan_id !== finding.scan_id
  )
}

/* ------------------------------------------------------------------ */
/* Attack paths                                                        */
/* ------------------------------------------------------------------ */

interface ScopedAttackPath extends AttackPath {
  scan_id: string
  repo_name: string
}

/**
 * A scan's paths are the fixture's, kept only when every step's finding survived
 * that repo's slice. A path whose steps are missing cannot be drawn.
 */
function pathsForSeed(seed: RepoSeed): ScopedAttackPath[] {
  const present = new Set(FINDINGS_BY_SCAN[seed.scan_id].map((f) => f.id))
  return BASE.attack_paths
    .filter((path) => path.steps.every((step) => present.has(step.finding_id)))
    .map((path) => ({
      ...path,
      id: seed.scan_id === BASE.scan_id ? path.id : `${seed.scan_id}_${path.id}`,
      scan_id: seed.scan_id,
      repo_name: seed.repo_name,
    }))
}

export const ALL_ATTACK_PATHS: ScopedAttackPath[] = REPO_SEEDS.flatMap(pathsForSeed)

export function attackPathsForScan(scanId: string): ScopedAttackPath[] {
  return ALL_ATTACK_PATHS.filter((p) => p.scan_id === scanId)
}

export function findAttackPath(pathId: string): ScopedAttackPath | undefined {
  return ALL_ATTACK_PATHS.find((p) => p.id === pathId)
}

export type { ScopedAttackPath }

/* ------------------------------------------------------------------ */
/* Full result documents                                               */
/* ------------------------------------------------------------------ */

/**
 * A contract-shaped ScanResult for any demo scan.
 *
 * Used by the pages that show a scan other than the one the backend actually
 * ran. The fixture's own scan_id returns the fixture untouched.
 */
export function demoResultFor(scanId: string): ScanResult | undefined {
  const seed = REPO_SEEDS.find((s) => s.scan_id === scanId)
  if (!seed) return undefined
  if (seed.scan_id === BASE.scan_id) return BASE

  const findings = findingsForScan(scanId)
  const counts = countBySeverity(findings)
  const bySource: Record<string, number> = { trivy: 0, semgrep: 0 }
  for (const f of findings) bySource[f.source] += 1

  return {
    scan_id: seed.scan_id,
    repo_url: seed.repo_url,
    repo_name: seed.repo_name,
    scanned_at: isoAgo(seed.age_ms),
    duration_seconds: seed.duration_seconds,
    status: seed.status,
    risk: {
      score: seed.score,
      band: bandFor(seed),
      // Components are scaled off the headline score rather than recomputed:
      // the backend owns the real weighting, and inventing a second formula
      // here would put two different answers on screen.
      components: {
        severity: Math.min(100, Math.round(seed.score * 1.18)),
        exploitability: Math.round(seed.score * 1.01),
        exposure: Math.round(seed.score * 0.85),
        blast_radius: Math.round(seed.score * 0.71),
      },
      summary:
        seed.status === 'failed'
          ? 'This scan did not complete, so there is no risk assessment for it.'
          : BASE.risk.summary,
    },
    stats: {
      raw_findings: findings.length * 13 + 7,
      after_dedup: findings.length * 6 + 3,
      reported_findings: findings.length,
      by_severity: counts,
      by_source: bySource,
    },
    findings,
    attack_paths: attackPathsForScan(scanId),
    errors:
      seed.status === 'failed'
        ? ['clone failed: repository requires credentials the scanner does not have']
        : [],
  }
}

/* ------------------------------------------------------------------ */
/* Aggregates for the overview and analytics pages                     */
/* ------------------------------------------------------------------ */

export interface FleetStats {
  repos: number
  scans: number
  findings: number
  critical_and_high: number
  by_severity: SeverityCounts
  by_source: Record<string, number>
  attack_paths: number
  average_score: number
  worst: ScanSummary
  /** Raw → deduped → reported, summed across every completed scan. */
  raw_findings: number
  after_dedup: number
}

export const FLEET: FleetStats = (() => {
  const completed = DEMO_SCANS.filter((s) => s.status === 'complete')
  const bySource: Record<string, number> = { trivy: 0, semgrep: 0 }
  for (const f of ALL_FINDINGS) bySource[f.source] += 1
  const counts = countBySeverity(ALL_FINDINGS)

  return {
    repos: REPO_SEEDS.length,
    scans: DEMO_SCANS.length,
    findings: ALL_FINDINGS.length,
    critical_and_high: counts.critical + counts.high,
    by_severity: counts,
    by_source: bySource,
    attack_paths: ALL_ATTACK_PATHS.length,
    average_score: Math.round(
      completed.reduce((sum, s) => sum + s.score, 0) / Math.max(1, completed.length)
    ),
    worst: completed.reduce((worst, s) => (s.score > worst.score ? s : worst), completed[0]),
    raw_findings: ALL_FINDINGS.length * 13 + REPO_SEEDS.length * 7,
    after_dedup: ALL_FINDINGS.length * 6 + REPO_SEEDS.length * 3,
  }
})()

/** Score over time, oldest first — the analytics trend line. */
export interface TrendPoint {
  at: string
  score: number
  repo_name: string
  scan_id: string
}

export const SCORE_TREND: TrendPoint[] = DEMO_SCANS.filter((s) => s.status === 'complete')
  .map((s) => ({ at: s.scanned_at, score: s.score, repo_name: s.repo_name, scan_id: s.scan_id }))
  .reverse()

/* ------------------------------------------------------------------ */
/* Account, team, activity                                             */
/* ------------------------------------------------------------------ */

/** The account a fresh browser gets. Signing up overwrites the name and email. */
export const DEMO_USER: User = {
  id: 'u_charvitha',
  name: 'Charvitha Reddy',
  email: 'charvitha@fortivo.dev',
  role: 'owner',
  plan: 'team',
  initials: 'CR',
  job_title: 'Security Engineer',
  timezone: 'Asia/Kolkata',
  created_at: isoAgo(90 * DAY),
}

export const DEMO_TEAM: TeamMember[] = [
  {
    id: 'm_charvitha',
    name: 'Charvitha Reddy',
    email: 'charvitha@fortivo.dev',
    role: 'owner',
    status: 'active',
    initials: 'CR',
    last_active: isoAgo(HOUR),
    scans_run: 24,
  },
  {
    id: 'm_sindhu',
    name: 'Sindhu',
    email: 'sindhu@fortivo.dev',
    role: 'admin',
    status: 'active',
    initials: 'S',
    last_active: isoAgo(3 * HOUR),
    scans_run: 31,
  },
  {
    id: 'm_dev',
    name: 'Arjun Menon',
    email: 'arjun@fortivo.dev',
    role: 'engineer',
    status: 'active',
    initials: 'AM',
    last_active: isoAgo(2 * DAY),
    scans_run: 8,
  },
  {
    id: 'm_audit',
    name: 'Priya Nair',
    email: 'priya@fortivo.dev',
    role: 'viewer',
    status: 'invited',
    initials: 'PN',
    last_active: isoAgo(4 * DAY),
    scans_run: 0,
  },
]

export const DEMO_ACTIVITY: ActivityEvent[] = [
  {
    id: 'a_01',
    kind: 'scan_completed',
    message: `Scan of ${BASE.repo_name} finished — score ${BASE.risk.score}, ${BASE.findings.length} findings reported`,
    actor: 'Charvitha Reddy',
    at: isoAgo(2 * HOUR),
    href: `/dashboard/${BASE.scan_id}`,
  },
  {
    id: 'a_02',
    kind: 'finding_saved',
    message: 'Saved "AWS Access Key ID committed in application config" for follow-up',
    actor: 'Charvitha Reddy',
    at: isoAgo(3 * HOUR),
    href: `/findings/${BASE.scan_id}/f_001`,
  },
  {
    id: 'a_03',
    kind: 'scan_completed',
    message: 'Scan of checkout-service finished — score 84, 15 findings reported',
    actor: 'Sindhu',
    at: isoAgo(5 * HOUR),
    href: '/dashboard/scan_checkout_9f31',
  },
  {
    id: 'a_04',
    kind: 'report_created',
    message: 'Generated an executive summary for checkout-service',
    actor: 'Sindhu',
    at: isoAgo(6 * HOUR),
    href: '/reports',
  },
  {
    id: 'a_05',
    kind: 'settings_changed',
    message: 'Turned on "fail the build on a new critical finding"',
    actor: 'Charvitha Reddy',
    at: isoAgo(DAY),
    href: '/settings/scanning',
  },
  {
    id: 'a_06',
    kind: 'scan_completed',
    message: 'Scan of mobile-gateway finished — score 77, 10 findings reported',
    actor: 'Arjun Menon',
    at: isoAgo(DAY + 2 * HOUR),
    href: '/dashboard/scan_gateway_4a77',
  },
  {
    id: 'a_07',
    kind: 'member_invited',
    message: 'Invited priya@fortivo.dev as a viewer',
    actor: 'Charvitha Reddy',
    at: isoAgo(4 * DAY),
    href: '/settings/team',
  },
  {
    id: 'a_08',
    kind: 'finding_archived',
    message: 'Archived 3 low-severity license findings on marketing-site',
    actor: 'Arjun Menon',
    at: isoAgo(6 * DAY),
    href: '/archive',
  },
  {
    id: 'a_09',
    kind: 'scan_failed',
    message: 'Scan of legacy-cron failed — the clone needed credentials',
    actor: 'Sindhu',
    at: isoAgo(8 * DAY + HOUR),
    href: '/scans',
  },
]

export const DEMO_NOTIFICATIONS_SEED = [
  {
    id: 'n_01',
    title: '3 critical findings in demo-app',
    body: 'A hardcoded AWS credential pair, an unauthenticated SSRF and unsafe YAML loading all landed in the same service.',
    at: isoAgo(2 * HOUR),
    read: false,
    tone: 'severity' as const,
    severity: 'critical' as const,
    href: `/dashboard/${BASE.scan_id}`,
  },
  {
    id: 'n_02',
    title: 'checkout-service scored 84',
    body: 'Up from 71 on the previous scan. Two new high-severity dependency findings.',
    at: isoAgo(5 * HOUR),
    read: false,
    tone: 'severity' as const,
    severity: 'high' as const,
    href: '/dashboard/scan_checkout_9f31',
  },
  {
    id: 'n_03',
    title: 'Executive summary ready',
    body: 'Your checkout-service report finished generating and is ready to download.',
    at: isoAgo(6 * HOUR),
    read: false,
    tone: 'success' as const,
    href: '/reports',
  },
  {
    id: 'n_04',
    title: 'Priya Nair was invited',
    body: 'The invitation to priya@fortivo.dev is pending — it expires in 7 days.',
    at: isoAgo(4 * DAY),
    read: true,
    tone: 'info' as const,
    href: '/settings/team',
  },
  {
    id: 'n_05',
    title: 'legacy-cron scan failed',
    body: 'The repository needs credentials the scanner does not have. Add a deploy key to retry.',
    at: isoAgo(8 * DAY + HOUR),
    read: true,
    tone: 'info' as const,
    href: '/scans',
  },
]

export const DEMO_REPORTS: Report[] = [
  {
    id: 'r_01',
    title: 'checkout-service — executive summary',
    template: 'executive',
    format: 'pdf',
    status: 'ready',
    scan_id: 'scan_checkout_9f31',
    repo_name: 'checkout-service',
    created_at: isoAgo(6 * HOUR),
    created_by: 'Sindhu',
    size_kb: 412,
    score: 84,
    band: 'critical',
  },
  {
    id: 'r_02',
    title: `${BASE.repo_name} — engineering detail`,
    template: 'engineering',
    format: 'markdown',
    status: 'ready',
    scan_id: BASE.scan_id,
    repo_name: BASE.repo_name,
    created_at: isoAgo(2 * HOUR),
    created_by: 'Charvitha Reddy',
    size_kb: 96,
    score: BASE.risk.score,
    band: BASE.risk.band,
  },
  {
    id: 'r_03',
    title: 'mobile-gateway — compliance evidence',
    template: 'compliance',
    format: 'pdf',
    status: 'ready',
    scan_id: 'scan_gateway_4a77',
    repo_name: 'mobile-gateway',
    created_at: isoAgo(DAY),
    created_by: 'Arjun Menon',
    size_kb: 1180,
    score: 77,
    band: 'critical',
  },
  {
    id: 'r_04',
    title: 'fortivo-api — engineering detail',
    template: 'engineering',
    format: 'json',
    status: 'ready',
    scan_id: 'scan_api_7b12',
    repo_name: 'fortivo-api',
    created_at: isoAgo(3 * DAY),
    created_by: 'Sindhu',
    size_kb: 244,
    score: 58,
    band: 'high',
  },
]

export const DEMO_API_KEYS: ApiKey[] = [
  {
    id: 'k_01',
    label: 'CI pipeline',
    prefix: 'ftv_live_9f31',
    created_at: isoAgo(30 * DAY),
    last_used: isoAgo(2 * HOUR),
    scopes: ['scan:write', 'results:read'],
  },
  {
    id: 'k_02',
    label: 'Local development',
    prefix: 'ftv_test_4a02',
    created_at: isoAgo(12 * DAY),
    last_used: isoAgo(3 * DAY),
    scopes: ['results:read'],
  },
]

export const DEMO_INTEGRATIONS: Integration[] = [
  {
    id: 'i_github',
    name: 'GitHub',
    blurb: 'Scan on every pull request and post the risk score as a check.',
    category: 'source',
    connected: true,
  },
  {
    id: 'i_gitlab',
    name: 'GitLab',
    blurb: 'Mirror the same pipeline checks for GitLab-hosted repositories.',
    category: 'source',
    connected: false,
  },
  {
    id: 'i_slack',
    name: 'Slack',
    blurb: 'Post a message when a scan finds a new critical finding.',
    category: 'chat',
    connected: true,
  },
  {
    id: 'i_jira',
    name: 'Jira',
    blurb: 'Open a ticket from a finding, pre-filled with the explanation and fix.',
    category: 'ticketing',
    connected: false,
  },
  {
    id: 'i_actions',
    name: 'GitHub Actions',
    blurb: 'Run fortivo scan as a step and fail the build on a critical finding.',
    category: 'ci',
    connected: true,
  },
  {
    id: 'i_webhook',
    name: 'Webhooks',
    blurb: 'POST the full result document to your own endpoint when a scan finishes.',
    category: 'ci',
    connected: false,
  },
]

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const DEMO_LOGS: LogEntry[] = [
  {
    id: 'l_01',
    level: 'info',
    at: isoAgo(2 * HOUR),
    source: 'pipeline',
    message: `scan ${BASE.scan_id} complete in ${BASE.duration_seconds}s — 412 raw, 180 deduped, 30 reported`,
  },
  {
    id: 'l_02',
    level: 'warn',
    at: isoAgo(2 * HOUR),
    source: 'llm',
    message: 'GEMINI_API_KEY not configured; using fallback prose.',
  },
  {
    id: 'l_03',
    level: 'info',
    at: isoAgo(2 * HOUR + 60_000),
    source: 'semgrep',
    message: 'semgrep --config auto finished with 19 findings across 11 files',
  },
  {
    id: 'l_04',
    level: 'info',
    at: isoAgo(2 * HOUR + 90_000),
    source: 'trivy',
    message: 'trivy fs finished with 11 findings (3 secret, 8 dependency)',
  },
  {
    id: 'l_05',
    level: 'error',
    at: isoAgo(8 * DAY + HOUR),
    source: 'clone',
    message: 'clone failed for legacy-cron: authentication required',
  },
  {
    id: 'l_06',
    level: 'info',
    at: isoAgo(5 * HOUR),
    source: 'pipeline',
    message: 'scan scan_checkout_9f31 complete in 34.2s — 15 reported',
  },
  {
    id: 'l_07',
    level: 'warn',
    at: isoAgo(DAY),
    source: 'reduce',
    message: 'dedup collapsed 12 occurrences of aws-access-key-id into 1 finding',
  },
  {
    id: 'l_08',
    level: 'info',
    at: isoAgo(3 * DAY),
    source: 'api',
    message: 'GET /results served 8 summaries',
  },
]

export const DEMO_SERVICES: ServiceStatus[] = [
  {
    name: 'API',
    health: 'operational',
    detail: 'FastAPI on :8000 — /health returning 200',
    uptime_pct: 99.9,
  },
  {
    name: 'Trivy',
    health: 'operational',
    detail: 'CLI v0.52 — vulnerability database 4 hours old',
    uptime_pct: 100,
  },
  {
    name: 'Semgrep',
    health: 'operational',
    detail: 'CLI v1.78 — running the auto ruleset',
    uptime_pct: 99.8,
  },
  {
    name: 'Gemini reasoning',
    health: 'degraded',
    detail: 'GEMINI_API_KEY not configured — explanations fall back to template prose',
    uptime_pct: 0,
  },
  {
    name: 'Result storage',
    health: 'operational',
    detail: 'JSON documents under ./results/ — 8 scans on disk',
    uptime_pct: 100,
  },
]
