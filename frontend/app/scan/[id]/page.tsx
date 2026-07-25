/**
 * Scan page (/scan/<id>): poll the pipeline, run the funnel moment, then hand
 * off to the dashboard.
 *
 * Responsibility: own the polling loop and the three top-level states —
 * in-flight, failed, done. The progress visual is ProgressStages; the done state
 * is the dashboard — RiskGauge and ReductionStat in a header row, FindingsTable
 * below. It holds the selected-finding id that B4's drawer will consume.
 *
 * DoD: with DEMO_MODE on, opening this page walks the six stages, collapses the
 * counter at the reducing stage, and swaps in the dashboard afterwards.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { FindingDrawer } from '@/components/FindingDrawer'
import { FindingsTable } from '@/components/FindingsTable'
import { ProgressStages } from '@/components/ProgressStages'
import { ReductionStat } from '@/components/ReductionStat'
import { RiskGauge } from '@/components/RiskGauge'
import { Button } from '@/components/ui/button'
import { getResults, getStatus } from '@/lib/api'
import type { ScanCounts, ScanProgress, ScanResult } from '@/lib/types'

const POLL_MS = 800
/** How long the settled "412 → 30" reads before the dashboard replaces it. */
const REVEAL_HOLD_MS = 1600

const INITIAL_COUNTS: ScanCounts = { total_raw: 0, after_dedupe: null, analyzed: null }

export default function ScanProgressPage({ params }: { params: { id: string } }) {
  const scanId = params.id
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  // Selected row; FindingDrawer consumes it.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      try {
        const next = await getStatus(scanId)
        if (cancelled) return
        setProgress(next)

        if (next.status === 'failed') {
          setError('The scan pipeline stopped before it finished.')
          return
        }
        if (next.status === 'complete') {
          const doc = await getResults(scanId)
          if (cancelled) return
          setResult(doc)
          return
        }
        timer = setTimeout(poll, POLL_MS)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Lost contact with the scan.')
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [scanId])

  // Hold on the collapsed counter for a beat before the dashboard takes over —
  // this also covers a backend fast enough that we never polled mid-reduction,
  // since the collapse still needs its 1.2s.
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => setShowResult(true), REVEAL_HOLD_MS)
    return () => clearTimeout(t)
  }, [result])

  const stage = progress?.stage ?? 'cloning'
  const counts = progress?.counts ?? INITIAL_COUNTS

  // The table hands back an id, not a finding, so resolve it here. Falls back to
  // null for an id that no longer resolves, which closes the drawer rather than
  // rendering an empty one.
  const selectedFinding = useMemo(
    () => result?.findings.find((f) => f.id === selectedId) ?? null,
    [result, selectedId]
  )

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Header scanId={scanId} />
        {/* Not red: collisions.md reserves the severity ramp's colours for severity. */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-base font-medium text-foreground">Scan failed</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground/70">
                {scanId} · stopped at {stage}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Try another repository</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 opacity-60">
          <ProgressStages stage={stage} counts={counts} failed />
        </div>
      </div>
    )
  }

  if (result && showResult) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Header scanId={scanId} repoName={result.repo_name} />

        {/* Header row: the score on the left, the reduction story on the right. */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8 lg:col-span-2">
            <RiskGauge score={result.risk.score} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 lg:col-span-3">
            <ReductionStat stats={result.stats} />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Ranked findings{' '}
            <span className="text-muted-foreground/70">({result.findings.length})</span>
          </h2>
          <FindingsTable
            findings={result.findings}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        </div>

        <FindingDrawer
          finding={selectedFinding}
          risk={result.risk}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Header scanId={scanId} />
      <div className="mt-8">
        <ProgressStages stage={stage} counts={counts} />
      </div>
    </div>
  )
}

function Header({ scanId, repoName }: { scanId: string; repoName?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        {repoName ?? 'Scanning repository'}
      </h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground/70">{scanId}</p>
    </div>
  )
}
