/**
 * ProgressStages: the six-stage pipeline rail plus the funnel counter above it.
 *
 * Responsibility: turn one ScanProgress into the demo's key moment. The counter
 * slot-machines up toward `counts.total_raw` while the scanners run, then — the
 * instant the reducing stage lands — visibly COLLAPSES 412 -> 180 -> 30 over
 * 1.2s and settles on "412 findings -> 30 that matter". Presentational only: it
 * never polls, it is handed a stage and counts.
 *
 * The collapse is scripted rather than driven frame-by-frame off the polled
 * counts, because the polls arrive every 800ms and spread the funnel over ~17
 * real seconds — which reads as drift, not as a cut. The numbers are still the
 * backend's: peak comes from total_raw, the midpoint from after_dedupe, the
 * landing from analyzed (falling back to the contract's 30-finding ceiling
 * until the reasoning stage reports it).
 *
 * DoD: watching a scan, the number climbs fast, drops in two deliberate steps
 * with a beat between them, and ends reading "412 findings → 30 that matter".
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { MAX_REPORTED_FINDINGS } from '@/lib/types'
import type { ScanCounts, ScanStage } from '@/lib/types'

const STAGES: { id: ScanStage; label: string }[] = [
  { id: 'cloning', label: 'Cloning repository' },
  { id: 'scanning', label: 'Running Trivy + Semgrep' },
  { id: 'normalizing', label: 'Normalizing findings' },
  { id: 'reducing', label: 'Deduplicating & ranking' },
  { id: 'reasoning', label: 'Explaining with Gemini' },
  { id: 'complete', label: 'Complete' },
]

const REDUCING_INDEX = STAGES.findIndex((s) => s.id === 'reducing')

/** Whole collapse. Long enough to read as deliberate, short enough to feel sharp. */
const COLLAPSE_MS = 1200
/** peak -> mid lands at this fraction; the beat holds until HOLD_END; then mid -> final. */
const DROP_END = 0.46
const HOLD_END = 0.62

/** Heavy in, heavy out — the drop reads as a cut rather than a slide. */
const easeInOutQuart = (t: number) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
/** Fast then long settle, so the final number arrives and stays. */
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type Phase = 'counting' | 'collapsing' | 'settled'

interface Funnel {
  peak: number
  mid: number
  final: number
}

interface FunnelCounterProps {
  counts: ScanCounts
  /** True once the pipeline has reached reducing (or anything after it). */
  collapse: boolean
  complete: boolean
  /** Stops every animation dead — used when the scan failed. */
  frozen: boolean
}

function FunnelCounter({ counts, collapse, complete, frozen }: FunnelCounterProps) {
  const [display, setDisplay] = useState(0)
  const [phase, setPhase] = useState<Phase>('counting')
  const [funnel, setFunnel] = useState<Funnel | null>(null)

  // Mirrors, so the rAF loop below can stay mounted once and never close over
  // stale props.
  const countsRef = useRef(counts)
  countsRef.current = counts
  const frozenRef = useRef(frozen)
  frozenRef.current = frozen

  const phaseRef = useRef<Phase>('counting')
  const funnelRef = useRef<Funnel | null>(null)
  const valueRef = useRef(0)
  const peakRef = useRef(0)
  const settledTargetRef = useRef(0)
  const collapseStartRef = useRef(0)

  // Fires once, on the first render where the pipeline has reached reducing.
  useEffect(() => {
    if (!collapse || frozen || phaseRef.current !== 'counting') return

    const live = countsRef.current
    const peak = Math.max(peakRef.current, live.total_raw, Math.round(valueRef.current))
    // after_dedupe is populated by the time reducing starts; the fraction is
    // only a shape-preserving guard for a backend that reports it late.
    const mid = live.after_dedupe ?? Math.round(peak * 0.44)
    const final =
      live.analyzed !== null && live.analyzed > 0 ? live.analyzed : MAX_REPORTED_FINDINGS

    const next = { peak, mid, final }
    funnelRef.current = next
    setFunnel(next)
    valueRef.current = peak
    collapseStartRef.current = performance.now()
    phaseRef.current = 'collapsing'
    setPhase('collapsing')
  }, [collapse, frozen])

  // The landing number is a guess until the scan finishes; correct it then.
  // Guarded on `complete` because analyzed ramps up from 0 during reasoning.
  useEffect(() => {
    const analyzed = counts.analyzed
    if (!complete || analyzed === null || analyzed <= 0) return
    settledTargetRef.current = analyzed
    setFunnel((f) => (f && f.final !== analyzed ? { ...f, final: analyzed } : f))
  }, [complete, counts.analyzed])

  useEffect(() => {
    let raf = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (frozenRef.current) return

      if (phaseRef.current === 'counting') {
        const target = countsRef.current.total_raw
        if (target > peakRef.current) peakRef.current = target
        valueRef.current = lerp(valueRef.current, target, 0.12)
        if (target - valueRef.current < 0.5) valueRef.current = target

        // Slot machine: the leading digits track the real count, the ones digit
        // spins. Clamped so it never shows more than the scanners have found.
        const climbing = target - valueRef.current > 1
        const base = Math.floor(valueRef.current)
        setDisplay(
          climbing
            ? Math.min(target, base - (base % 10) + Math.floor(Math.random() * 10))
            : base
        )
        return
      }

      if (phaseRef.current === 'collapsing') {
        const f = funnelRef.current
        if (!f) return
        const t = Math.min(1, (now - collapseStartRef.current) / COLLAPSE_MS)

        let v: number
        if (t < DROP_END) {
          v = lerp(f.peak, f.mid, easeInOutQuart(t / DROP_END))
        } else if (t < HOLD_END) {
          v = f.mid // the beat: the eye gets to read 180
        } else {
          v = lerp(f.mid, f.final, easeOutQuint((t - HOLD_END) / (1 - HOLD_END)))
        }
        setDisplay(Math.round(v))

        if (t >= 1) {
          valueRef.current = f.final
          settledTargetRef.current = f.final
          phaseRef.current = 'settled'
          setPhase('settled')
        }
        return
      }

      // Settled: idle unless the real reported count came in and differs.
      const target = settledTargetRef.current
      if (Math.abs(target - valueRef.current) > 0.5) {
        valueRef.current = lerp(valueRef.current, target, 0.15)
        setDisplay(Math.round(valueRef.current))
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const settled = phase === 'settled'

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <motion.div
        key={settled ? 'settled' : 'live'}
        initial={settled ? { scale: 1.09 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className={`font-mono text-6xl font-semibold tabular-nums tracking-tight transition-colors duration-500 sm:text-7xl ${
          settled ? 'text-primary' : 'text-foreground'
        }`}
      >
        {display.toLocaleString()}
      </motion.div>

      {settled && funnel ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="font-mono text-sm text-muted-foreground"
        >
          <span className="text-foreground">{funnel.peak.toLocaleString()}</span> findings
          <span className="mx-2 text-primary">→</span>
          <span className="font-semibold text-primary">{funnel.final}</span> that matter
        </motion.p>
      ) : (
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {phase === 'collapsing'
            ? 'Cutting the noise'
            : 'Raw findings from Trivy + Semgrep'}
        </p>
      )}
    </div>
  )
}

/** Small right-aligned count on the rows that have produced a number. */
function hintFor(id: ScanStage, counts: ScanCounts): string | null {
  if (id === 'scanning' && counts.total_raw > 0) return `${counts.total_raw} raw`
  if (id === 'reducing' && counts.after_dedupe !== null) return `${counts.after_dedupe} unique`
  if (id === 'reasoning' && counts.analyzed !== null) return `${counts.analyzed} explained`
  return null
}

interface ProgressStagesProps {
  stage: ScanStage
  counts: ScanCounts
  /** Freezes the rail on the stage that died and marks it. */
  failed?: boolean
}

export function ProgressStages({ stage, counts, failed = false }: ProgressStagesProps) {
  const found = STAGES.findIndex((s) => s.id === stage)
  const currentIndex = found === -1 ? 0 : found
  const isComplete = stage === 'complete'

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <FunnelCounter
        counts={counts}
        collapse={currentIndex >= REDUCING_INDEX}
        complete={isComplete}
        frozen={failed}
      />

      <div className="mt-8 border-t border-border pt-4">
        <ol className="flex flex-col">
          {STAGES.map((s, i) => {
            // On 'complete' the last row is a result, not a step in flight.
            const done = i < currentIndex || (isComplete && !failed)
            const active = !done && i === currentIndex
            const hint = i <= currentIndex ? hintFor(s.id, counts) : null

            return (
              <li key={s.id}>
                <div className="flex items-center gap-3">
                  {done ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : active && failed ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  ) : active ? (
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full border border-primary"
                        animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                      />
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    </span>
                  )}

                  <span
                    className={`flex-1 text-sm ${
                      done || active ? 'text-foreground' : 'text-muted-foreground/50'
                    }`}
                  >
                    {s.label}
                  </span>

                  {hint && (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {hint}
                    </span>
                  )}
                </div>

                {i < STAGES.length - 1 && (
                  <div
                    aria-hidden
                    className={`ml-[13px] h-4 w-px ${done ? 'bg-primary/40' : 'bg-border'}`}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
