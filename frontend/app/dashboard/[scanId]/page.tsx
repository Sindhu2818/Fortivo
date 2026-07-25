/**
 * Dashboard (/dashboard/[scanId]): the main demo screen.
 *
 * Responsibility: load one ScanResult via lib/api, then compose RiskScore,
 * ScoreBreakdown, StatsBar, AttackPathGraph, FindingsTable and FindingDrawer.
 * Owns the selected-finding state that the table and graph both drive and the
 * drawer consumes. No fetching logic of its own beyond the one call.
 *
 * Three states, in the order they are checked: failed -> ErrorState with Retry,
 * in flight -> DashboardSkeleton, loaded -> the dashboard. `reloadKey` exists
 * only so Retry can re-enter the same effect; the fetch itself is unchanged.
 *
 * DoD: renders the risk score, the four components, up to 30 ranked findings,
 * and the attack graph for a given scan_id.
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { RiskScore } from '@/components/RiskScore'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { StatsBar } from '@/components/StatsBar'
import { AttackPathGraph } from '@/components/AttackPathGraph'
import { FindingsTable } from '@/components/FindingsTable'
import { FindingDrawer } from '@/components/FindingDrawer'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { getResult } from '@/lib/api'
import type { ScanResult } from '@/lib/types'

export default function DashboardPage({ params }: { params: { scanId: string } }) {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Bumped by Retry. Its only job is to re-run the effect below. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setError(null)
    getResult(params.scanId)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load scan.')
      })
    return () => {
      cancelled = true
    }
  }, [params.scanId, reloadKey])

  const retry = useCallback(() => setReloadKey((k) => k + 1), [])

  const findingsById = useMemo(() => {
    const map: Record<string, ScanResult['findings'][number]> = {}
    result?.findings.forEach((f) => {
      map[f.id] = f
    })
    return map
  }, [result])

  const selectedFinding = selectedId ? findingsById[selectedId] ?? null : null

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ErrorState
          title="Couldn't load this scan"
          message={error}
          detail={params.scanId}
          onRetry={retry}
          retryLabel="Try again"
        />
      </div>
    )
  }

  if (!result) return <DashboardSkeleton />

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/"
        className="group mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> All
        scans
      </Link>

      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{result.repo_name}</h1>
          <p className="font-mono text-xs text-muted-foreground/70">
            {result.repo_url} · {result.scan_id} · {result.duration_seconds.toFixed(1)}s
          </p>
        </div>
        {/* Neutral, not amber: collisions.md reserves the ramp's colours for severity. */}
        {result.errors.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> {result.errors.length} non-fatal warning
            {result.errors.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Both cards take h-full so the row's two bottom edges line up whichever
          one happens to be taller — at 1440x900 with a long risk summary that is
          the breakdown, with a short one it is the gauge. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RiskScore risk={result.risk} />
        </div>
        <div className="lg:col-span-2">
          <ScoreBreakdown
            components={result.risk.components}
            score={result.risk.score}
            className="h-full"
          />
        </div>
      </div>

      <div className="mt-8">
        <StatsBar stats={result.stats} />
      </div>

      {/* Renders nothing at all when attack_paths is empty — heading included —
          so the dashboard never shows an empty canvas. */}
      <div className="mt-8 empty:mt-0">
        <AttackPathGraph
          attackPaths={result.attack_paths}
          findingsById={findingsById}
          onSelect={setSelectedId}
        />
      </div>

      <div className="mt-8">
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
