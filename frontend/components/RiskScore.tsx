/**
 * RiskScore: the hero 0-100 gauge with its band label and LLM summary sentence.
 *
 * Responsibility: display risk.score, risk.band and risk.summary. Presentational
 * only — it computes nothing.
 *
 * DoD: score and band render with band-appropriate color at a glance from across
 * a room.
 */

import { BAND_STYLES } from '@/lib/severity'
import type { Risk } from '@/lib/types'
import { cn } from '@/lib/utils'

const RADIUS = 78
const STROKE = 12
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Gauge sweeps 270 degrees (3/4 circle), starting bottom-left.
const SWEEP = 0.75

interface RiskScoreProps {
  risk: Risk
}

export function RiskScore({ risk }: RiskScoreProps) {
  const band = BAND_STYLES[risk.band]
  const arcLength = CIRCUMFERENCE * SWEEP
  const progress = (risk.score / 100) * arcLength

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[200px] w-[200px] shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-[135deg]">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${CIRCUMFERENCE}`}
          />
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke={band.hex}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${CIRCUMFERENCE}`}
            style={{
              filter: `drop-shadow(0 0 6px ${band.hex}88)`,
              transition: 'stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-semibold tabular-nums text-foreground">
            {risk.score}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">
            / 100
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Overall risk score
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide',
                band.bg,
                band.text,
                band.border
              )}
            >
              {band.label}
            </span>
          </div>
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{risk.summary}</p>
      </div>
    </div>
  )
}
