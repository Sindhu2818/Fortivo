/**
 * DEMO_MODE data source: serves fixtures/mock_results.json as a typed
 * ScanResult, with a small artificial delay so loading states are visible.
 *
 * Responsibility: keep every mock in one file. No component imports the fixture
 * directly.
 *
 * DoD: the exported mock type-checks as ScanResult with no casts.
 */

import mockData from '../../fixtures/mock_results.json'
import type { ScanResult, ScanSummary } from './types'

export const MOCK_SCAN_RESULT: ScanResult = mockData as ScanResult

const DEMO_DELAY_MS = 550

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Resolves to the mock ScanResult regardless of the requested scan_id. */
export async function demoGetResult(_scanId: string): Promise<ScanResult> {
  await wait(DEMO_DELAY_MS)
  return MOCK_SCAN_RESULT
}

/** A one-item scan history built from the single mock result. */
export async function demoListResults(): Promise<ScanSummary[]> {
  await wait(200)
  return [
    {
      scan_id: MOCK_SCAN_RESULT.scan_id,
      repo_name: MOCK_SCAN_RESULT.repo_name,
      scanned_at: MOCK_SCAN_RESULT.scanned_at,
      status: MOCK_SCAN_RESULT.status,
      score: MOCK_SCAN_RESULT.risk.score,
      band: MOCK_SCAN_RESULT.risk.band,
    },
  ]
}

/** In DEMO_MODE, submitting a scan just routes to the mock scan_id. */
export async function demoStartScan(): Promise<{ scan_id: string }> {
  await wait(1400)
  return { scan_id: MOCK_SCAN_RESULT.scan_id }
}
