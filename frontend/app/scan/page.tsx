/**
 * Scan page (/scan): repo URL input -> POST /scan -> poll status -> redirect to
 * /dashboard/<scan_id> when complete.
 *
 * Responsibility: submission and progress UI only. Owns the "scanning..." state
 * with per-stage labels. In DEMO_MODE, skips the network and routes straight to
 * the mock scan_id.
 *
 * DoD: submitting a repo lands on the dashboard for that scan_id.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ScanForm } from '@/components/ScanForm'
import { startScan, DEMO_MODE } from '@/lib/api'

const STAGES = [
  'Cloning repository',
  'Running Trivy + Semgrep',
  'Deduplicating & ranking findings',
  'Scoring overall risk',
  'Correlating attack paths',
  'Generating AI explanations',
]

export default function ScanPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [stageIndex, setStageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function handleSubmit(repoUrl: string) {
    setSubmitting(true)
    setError(null)
    setStageIndex(0)

    timerRef.current = setInterval(
      () => {
        setStageIndex((i) => Math.min(i + 1, STAGES.length - 1))
      },
      DEMO_MODE ? 220 : 1400
    )

    try {
      const { scan_id } = await startScan(repoUrl)
      if (timerRef.current) clearInterval(timerRef.current)
      setStageIndex(STAGES.length - 1)
      router.push(`/dashboard/${scan_id}`)
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current)
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Scan failed to start.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">Scan a repository</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Point Fortivo at a Git URL or a local path. It runs Trivy and Semgrep, then
        reasons about what it finds.
      </p>

      <div className="mt-8">
        <ScanForm onSubmit={handleSubmit} submitting={submitting} />
      </div>

      {/* Neutral, not red: collisions.md reserves the ramp's colours for severity. */}
      {error && (
        <p className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {submitting && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Scan in progress
          </p>
          <div className="flex flex-col gap-3">
            {STAGES.map((stage, i) => {
              const done = i < stageIndex
              const active = i === stageIndex
              return (
                <div key={stage} className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-border" />
                  )}
                  <span
                    className={`text-sm ${done || active ? 'text-foreground' : 'text-muted-foreground/70'}`}
                  >
                    {stage}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
