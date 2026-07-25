/**
 * The only module in the app that knows about DEMO_MODE.
 *
 * Responsibility: three calls — startScan, getResults, listResults — with one
 * signature each, whichever mode we are in. When NEXT_PUBLIC_DEMO_MODE ===
 * 'true' they resolve from fixtures/mock_results.json; otherwise they hit
 * NEXT_PUBLIC_API_BASE. No component branches on the mode.
 *
 * The backend exposes exactly four routes — /health, POST /scan, /results and
 * /results/{scan_id}. There is no status route and none is coming: POST /scan
 * runs the whole pipeline before it answers, so a scan is already terminal by
 * the time we can observe it. There used to be a getStatus() here that faked
 * the missing route; it is gone along with the progress page that polled it.
 * Do not add a call here for a route that does not exist.
 *
 * DoD: with DEMO_MODE on and no backend running, startScan and getResults
 * resolve to the mock ScanResult.
 */

import mockResults from '../../fixtures/mock_results.json'
import type { ScanAccepted, ScanResult, ScanSummary } from './types'

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
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Runs a scan for a repo URL (or local path).
 *
 * Named "start", but the request *is* the scan: the backend holds it open for
 * the whole pipeline, so the `status` that comes back is already final —
 * 'complete' or 'failed', never 'queued' or 'running'. Callers must read it
 * before they navigate, because a scan that failed still answers 202.
 */
export async function startScan(repoUrl: string): Promise<ScanAccepted> {
  if (DEMO_MODE) {
    // The fixture's own status, so demo mode comes back terminal like the real
    // thing rather than claiming a 'running' state nothing can observe.
    return { scan_id: MOCK_RESULT.scan_id, status: MOCK_RESULT.status }
  }
  return fetchJSON<ScanAccepted>('/scan', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  })
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
