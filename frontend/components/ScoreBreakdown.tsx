/**
 * ScoreBreakdown: the four weighted factors that produce risk.score.
 *
 * Responsibility: make the composite score auditable. Each factor is a 0-100
 * component multiplied by its weight, so it can contribute at most `weight × 100`
 * points to the final 100. Bars are drawn on a *shared point scale* — a row's
 * track is only as wide as that factor's maximum — so severity's 40-point track
 * is visibly more than twice blast radius's 15-point one, and bar lengths compare
 * directly in points rather than each as a percentage of itself.
 *
 * Every number here is arithmetic on values Python produced. The weights mirror
 * `_COMPONENT_WEIGHTS` in backend/core/score.py, which is their source of truth;
 * the total shown is `risk.score` itself and never our own sum, so a rounding
 * difference can't make the UI disagree with the scorer.
 *
 * These four components are computed once per scan across all findings, not per
 * finding — the contract gives a Finding no component decomposition. When this
 * renders inside FindingDrawer the caller passes `contribution`, the one honest
 * per-finding number the contract carries, under a heading that keeps the two
 * scopes apart.
 *
 * DoD: all four factors render with their weighted contribution and their max.
 */

import { SEVERITY_STYLES } from '@/lib/severity'
import type { RiskComponents } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Factor {
  key: keyof RiskComponents
  label: string
  /** Mirrors backend/core/score.py `_COMPONENT_WEIGHTS`. Sums to 1.0. */
  weight: number
  hint: string
}

const FACTORS: Factor[] = [
  { key: 'severity', label: 'Severity', weight: 0.4, hint: 'How bad the worst findings are' },
  {
    key: 'exploitability',
    label: 'Exploitability',
    weight: 0.25,
    hint: 'Public exploits, low attack complexity',
  },
  { key: 'exposure', label: 'Exposure', weight: 0.2, hint: 'Reachable from outside vs. internal' },
  {
    key: 'blast_radius',
    label: 'Blast radius',
    weight: 0.15,
    hint: 'How much is reachable after compromise',
  },
]

/** Widest track, in points. Every row is measured against this. */
const SCALE = Math.max(...FACTORS.map((f) => f.weight * 100))

/** Bars borrow the severity ramp so no colour is defined outside lib/severity.ts. */
function barColor(value: number): string {
  if (value >= 75) return SEVERITY_STYLES.critical.dot
  if (value >= 50) return SEVERITY_STYLES.high.dot
  if (value >= 25) return SEVERITY_STYLES.medium.dot
  return SEVERITY_STYLES.low.dot
}

/** A missing or malformed component must not render as a `NaN%` width. */
function clamp100(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0
}

interface ScoreBreakdownProps {
  components: RiskComponents | null | undefined
  /** `risk.score`. Displayed verbatim as the total. */
  score: number | null | undefined
  /** One finding's `score_contribution`, when this sits inside the drawer. */
  contribution?: number | null
  /** Drops the per-factor hint text, for the narrower drawer column. */
  dense?: boolean
  className?: string
}

export function ScoreBreakdown({
  components,
  score,
  contribution,
  dense = false,
  className,
}: ScoreBreakdownProps) {
  const total = typeof score === 'number' && Number.isFinite(score) ? score : 0
  const showContribution = typeof contribution === 'number' && Number.isFinite(contribution)

  return (
    <div className={cn('rounded-xl border border-border bg-card p-6', className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Scoring model
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Four weighted components, this scan
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-3xl leading-none tabular-nums text-foreground">
            {total}
          </span>
          <span className="font-mono text-sm text-muted-foreground/70">/100</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {FACTORS.map(({ key, label, weight, hint }) => {
          const value = clamp100(components?.[key])
          const max = weight * 100
          const points = value * weight

          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2 text-sm font-medium text-foreground">
                  {label}
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                    {value} × {weight.toFixed(2)}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                  {points.toFixed(1)}
                  <span className="text-muted-foreground/70"> / {max}</span>
                </span>
              </div>

              {/* The track is this factor's own maximum, drawn to scale against
                  the widest one, so the four bars share a single point ruler. */}
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                style={{ width: `${(max / SCALE) * 100}%` }}
              >
                <div
                  className={cn(
                    'h-full rounded-full duration-700 animate-in fade-in slide-in-from-left-4',
                    barColor(value)
                  )}
                  style={{ width: `${value}%` }}
                />
              </div>

              {!dense && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
            </div>
          )
        })}
      </div>

      {showContribution && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">This finding contributed</span>
            <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
              +{contribution.toFixed(2)}
              <span className="text-muted-foreground/70"> of {total}</span>
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${total > 0 ? Math.min((contribution / total) * 100, 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
