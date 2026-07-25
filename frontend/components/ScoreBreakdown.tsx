/**
 * ScoreBreakdown: four labelled 0-100 bars for severity, exploitability,
 * exposure and blast_radius.
 *
 * Responsibility: make the composite score legible. Presentational only.
 *
 * DoD: all four components render with their numeric value.
 */

import { SEVERITY_STYLES } from '@/lib/severity'
import type { RiskComponents } from '@/lib/types'

const COMPONENTS: { key: keyof RiskComponents; label: string; hint: string }[] = [
  { key: 'severity', label: 'Severity', hint: 'How bad the worst findings are' },
  { key: 'exploitability', label: 'Exploitability', hint: 'Public exploits, low attack complexity' },
  { key: 'exposure', label: 'Exposure', hint: 'Reachable from outside vs. internal only' },
  { key: 'blast_radius', label: 'Blast radius', hint: 'How much is reachable after compromise' },
]

/** Bars borrow the severity ramp so no colour is defined outside lib/severity.ts. */
function barColor(value: number): string {
  if (value >= 75) return SEVERITY_STYLES.critical.dot
  if (value >= 50) return SEVERITY_STYLES.high.dot
  if (value >= 25) return SEVERITY_STYLES.medium.dot
  return SEVERITY_STYLES.low.dot
}

interface ScoreBreakdownProps {
  components: RiskComponents
}

export function ScoreBreakdown({ components }: ScoreBreakdownProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Score components
      </p>
      <div className="flex flex-col gap-4">
        {COMPONENTS.map(({ key, label, hint }) => {
          const value = components[key]
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{value}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full origin-left animate-in rounded-full fade-in slide-in-from-left-4 duration-700 ${barColor(value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
