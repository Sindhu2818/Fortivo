/**
 * The only module that talks to the backend.
 *
 * Responsibility: wrap NEXT_PUBLIC_API_BASE with typed helpers —
 * startScan(repoUrl), getResult(scanId), listResults(). When
 * NEXT_PUBLIC_DEMO_MODE === 'true', every call short-circuits to lib/demo.ts
 * instead of hitting the network, so the UI demos with the backend stopped.
 *
 * DoD: with DEMO_MODE on and no backend running, getResult() resolves to the
 * mock ScanResult.
 */

import { demoGetResult, demoListResults, demoStartScan } from './demo'
import type { ScanAccepted, ScanResult, ScanSummary } from './types'

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000'

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

/** Kicks off a scan for a repo URL (or local path). */
export async function startScan(repoUrl: string): Promise<ScanAccepted> {
  if (DEMO_MODE) {
    const { scan_id } = await demoStartScan()
    return { scan_id, status: 'complete' }
  }
  return fetchJSON<ScanAccepted>('/scan', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  })
}

/** Fetches one full scan result by id. */
export async function getResult(scanId: string): Promise<ScanResult> {
  if (DEMO_MODE) {
    return demoGetResult(scanId)
  }
  return fetchJSON<ScanResult>(`/results/${scanId}`)
}

/** Fetches the scan history list for the landing page. */
export async function listResults(): Promise<ScanSummary[]> {
  if (DEMO_MODE) {
    return demoListResults()
  }
  return fetchJSON<ScanSummary[]>('/results')
}
