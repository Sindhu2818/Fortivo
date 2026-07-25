/**
 * The only module in the app that knows about DEMO_MODE.
 *
 * Responsibility: three calls — startScan, getStatus, getResults — with one
 * signature each, whichever mode we are in. When NEXT_PUBLIC_DEMO_MODE ===
 * 'true' they resolve from a scripted timeline and fixtures/mock_results.json;
 * otherwise they hit NEXT_PUBLIC_API_BASE. No component branches on the mode.
 *
 * DoD: with DEMO_MODE on and no backend running, polling getStatus walks
 * cloning -> scanning -> normalizing -> reducing -> reasoning -> complete over
 * 42 seconds, and getResults resolves to the mock ScanResult.
 */

import mockResults from '../../fixtures/mock_results.json'
import type {
  ScanAccepted,
  ScanProgress,
  ScanResult,
  ScanStage,
  ScanSummary,
} from './types'

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000'

const MOCK_RESULT: ScanResult = mockResults as ScanResult

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ------------------------------------------------------------------ */
/* Demo timeline                                                       */
/* ------------------------------------------------------------------ */

/** Stage boundaries in seconds. Each entry runs until `until`. */
const DEMO_STAGES: { stage: ScanStage; until: number }[] = [
  { stage: 'cloning', until: 6 },
  { stage: 'scanning', until: 20 },
  { stage: 'normalizing', until: 25 },
  { stage: 'reducing', until: 30 },
  { stage: 'reasoning', until: 42 },
]

const DEMO_DURATION = 42

// The funnel numbers come from the fixture rather than being hardcoded, so the
// progress screen and the dashboard always agree — including after Sindhu swaps
// in the realistic 30-finding mock.
const DEMO_RAW = MOCK_RESULT.stats.raw_findings
const DEMO_DEDUPED = MOCK_RESULT.stats.after_dedup
const DEMO_ANALYZED = MOCK_RESULT.stats.reported_findings

/** Module-level clock. The first read starts it; startScan restarts it. */
let demoStartedAt: number | null = null

function demoElapsed(): number {
  if (demoStartedAt === null) demoStartedAt = Date.now()
  return (Date.now() - demoStartedAt) / 1000
}

/** Linear 0 -> target across [from, to] seconds, clamped at both ends. */
function ramp(t: number, from: number, to: number, target: number): number {
  if (t <= from) return 0
  if (t >= to) return target
  return Math.round(target * ((t - from) / (to - from)))
}

/**
 * The scripted timeline as a pure function of elapsed seconds. Exported so a
 * throwaway harness can step through it without waiting 42 real seconds.
 */
export function demoStatusAt(elapsed: number): ScanProgress {
  const stage = DEMO_STAGES.find((s) => elapsed < s.until)?.stage ?? 'complete'
  const done = stage === 'complete'

  return {
    status: done ? 'complete' : 'running',
    stage,
    counts: {
      // Ticks up while the scanners run, then holds.
      total_raw: ramp(elapsed, 6, 20, DEMO_RAW),
      // Appears when reducing starts.
      after_dedupe: elapsed >= 25 ? DEMO_DEDUPED : null,
      // Fills in across the reasoning stage.
      analyzed: elapsed >= 30 ? ramp(elapsed, 30, DEMO_DURATION, DEMO_ANALYZED) : null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Kicks off a scan for a repo URL (or local path). */
export async function startScan(repoUrl: string): Promise<ScanAccepted> {
  if (DEMO_MODE) {
    demoStartedAt = Date.now()
    return { scan_id: MOCK_RESULT.scan_id, status: 'running' }
  }
  return fetchJSON<ScanAccepted>('/scan', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  })
}

/** Polls one in-flight scan for its stage and running counts. */
export async function getStatus(scanId: string): Promise<ScanProgress> {
  if (DEMO_MODE) {
    return demoStatusAt(demoElapsed())
  }
  return fetchJSON<ScanProgress>(`/scan/${scanId}/status`)
}

/** Fetches one full scan result by id. */
export async function getResults(scanId: string): Promise<ScanResult> {
  if (DEMO_MODE) {
    return MOCK_RESULT
  }
  return fetchJSON<ScanResult>(`/results/${scanId}`)
}

/** Alias kept for the dashboard page, which was written against the old name. */
export const getResult = getResults

/** Fetches the scan history list for the landing page. */
export async function listResults(): Promise<ScanSummary[]> {
  if (DEMO_MODE) {
    return [
      {
        scan_id: MOCK_RESULT.scan_id,
        repo_name: MOCK_RESULT.repo_name,
        scanned_at: MOCK_RESULT.scanned_at,
        status: MOCK_RESULT.status,
        score: MOCK_RESULT.risk.score,
        band: MOCK_RESULT.risk.band,
      },
    ]
  }
  return fetchJSON<ScanSummary[]>('/results')
}
