/**
 * Dashboard (/dashboard/[scanId]): the main demo screen.
 *
 * Responsibility: load one ScanResult via lib/api, then compose RiskScore,
 * ScoreBreakdown, StatsBar, AttackGraph, FindingsTable and FindingDrawer.
 * Owns the selected-finding state that the table and graph both drive and the
 * drawer consumes. No fetching logic of its own beyond the one call.
 *
 * DoD: renders the risk score, the four components, up to 30 ranked findings,
 * and the attack graph for a given scan_id.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { RiskScore } from '@/components/RiskScore'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { StatsBar } from '@/components/StatsBar'
import { AttackGraph } from '@/components/AttackGraph'
import { FindingsTable } from '@/components/FindingsTable'
import { FindingDrawer } from '@/components/FindingDrawer'
import { EmptyState } from '@/components/EmptyState'
import { getResult } from '@/lib/api'
import type { ScanResult } from '@/lib/types'

export default function DashboardPage({ params }: { params: { scanId: string } }) {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
  }, [params.scanId])

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
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          tone="error"
          icon={AlertTriangle}
          title="Couldn't load this scan"
          description={error}
          action={
            <Link href="/" className="text-sm text-primary hover:underline">
              Back to home
            </Link>
          }
        />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-32 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading scan results…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All scans
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RiskScore risk={result.risk} />
        </div>
        <div className="lg:col-span-2">
          <ScoreBreakdown components={result.risk.components} />
        </div>
      </div>

      <div className="mt-6">
        <StatsBar stats={result.stats} />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Attack paths</h2>
        <AttackGraph
          attackPaths={result.attack_paths}
          findingsById={findingsById}
          onSelect={setSelectedId}
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Ranked findings{' '}
          <span className="text-muted-foreground/70">({result.findings.length})</span>
        </h2>
        <FindingsTable findings={result.findings} onSelect={setSelectedId} />
      </div>

      <FindingDrawer finding={selectedFinding} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  )
}
