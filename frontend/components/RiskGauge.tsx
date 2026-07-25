/**
 * RiskGauge: the dashboard's hero — a 0-100 semicircular arc with the score in
 * the middle.
 *
 * Responsibility: draw risk.score as a filled arc and a big number. Purely
 * presentational; it computes nothing except its own tier colour.
 *
 * The tier thresholds here (80 / 60 / 40) are the gauge's own and are
 * deliberately not risk.band, which the contract derives at 75 / 50 / 25. The
 * colours are the severity ramp's, via lib/severity — collisions.md gives that
 * ramp red / orange / amber / grey and nothing else in the app uses them, so the
 * calm tier is the ramp's grey rather than a green we do not have a token for.
 *
 * DoD: on mount the arc sweeps from empty to the score and the number counts up
 * with it, in the colour of its tier.
 */

'use client'

import { useEffect, useState } from 'react'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { Severity } from '@/lib/types'

/* Geometry. Half circle, centred on the bottom edge of the viewBox. */
const VIEW_W = 220
const VIEW_H = 128
const CX = 110
const CY = 112
const R = 92
const STROKE = 14
const ARC_LENGTH = Math.PI * R
const ARC_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

const SWEEP_MS = 1100

/** Score tiers, worst first. `severity` keys into the shared ramp. */
const TIERS: { min: number; severity: Severity }[] = [
  { min: 80, severity: 'critical' },
  { min: 60, severity: 'high' },
  { min: 40, severity: 'medium' },
  { min: 0, severity: 'low' },
]

function tierFor(score: number): Severity {
  return (TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]).severity
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface RiskGaugeProps {
  /** risk.score — 0-100. */
  score: number
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const target = Math.max(0, Math.min(100, Math.round(score)))
  const color = SEVERITY_STYLES[tierFor(target)].hex

  // The arc fills via a CSS transition on dashoffset; flipping this one frame
  // after mount is what gives it something to transition from.
  const [swept, setSwept] = useState(false)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSwept(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // The number rides the same curve as the arc so they land together.
  useEffect(() => {
    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SWEEP_MS)
      setDisplay(Math.round(target * easeOutCubic(t)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[260px]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Risk score ${target} out of 100`}
        >
          <path
            d={ARC_PATH}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={ARC_PATH}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={swept ? ARC_LENGTH * (1 - target / 100) : ARC_LENGTH}
            style={{
              filter: `drop-shadow(0 0 8px ${color}66)`,
              transition: `stroke-dashoffset ${SWEEP_MS}ms cubic-bezier(0.16,1,0.3,1)`,
            }}
          />
        </svg>

        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span
            className="font-mono text-[3.25rem] font-semibold leading-none tabular-nums"
            style={{ color }}
          >
            {display}
          </span>
        </div>

        {/* Scale ends, sitting just under the arc's feet. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 font-mono text-[10px] tabular-nums text-muted-foreground/50">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Risk Score
      </p>
    </div>
  )
}
