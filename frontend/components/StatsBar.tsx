/**
 * StatsBar: the reduction story — "412 raw -> 260 deduped -> 30 reported", plus
 * severity and per-scanner counts.
 *
 * Responsibility: display stats. This is the component that sells the core idea,
 * so the raw -> reported funnel must be the visually dominant element.
 *
 * DoD: renders every field of stats, including all five severity buckets.
 */

import { SEVERITY_ORDER, SEVERITY_STYLES } from '@/lib/severity'
import type { Stats } from '@/lib/types'

interface StatsBarProps {
  stats: Stats
}

const FUNNEL_LABELS: { key: keyof Stats; label: string }[] = [
  { key: 'raw_findings', label: 'Raw findings' },
  { key: 'after_dedup', label: 'After dedup' },
  { key: 'reported_findings', label: 'Reported' },
]

export function StatsBar({ stats }: StatsBarProps) {
  const max = stats.raw_findings || 1

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Signal, not noise
      </p>

      {/* The funnel — the pitch, made visual. */}
      <div className="flex flex-col gap-3">
        {FUNNEL_LABELS.map(({ key, label }, i) => {
          const value = stats[key] as number
          const widthPct = Math.max((value / max) * 100, 4)
          const isLast = i === FUNNEL_LABELS.length - 1
          return (
            <div key={key} className="flex items-center gap-4">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
              <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className={`h-full origin-left animate-in rounded-md fade-in slide-in-from-left-4 duration-700 ${
                    isLast ? 'bg-primary shadow-lg shadow-primary/20 ring-1 ring-primary/25' : 'bg-border'
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span
                className={`w-14 shrink-0 text-right font-mono text-lg font-semibold tabular-nums ${
                  isLast ? 'text-primary' : 'text-foreground'
                }`}
              >
                {value}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground/70">By severity</p>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_ORDER.map((sev) => {
              const style = SEVERITY_STYLES[sev]
              const count = stats.by_severity[sev]
              return (
                <span
                  key={sev}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs ${style.bg} ${style.border} ${style.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {style.label} <span className="tabular-nums">{count}</span>
                </span>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground/70">By scanner</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_source).map(([source, count]) => (
              <span
                key={source}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs capitalize text-muted-foreground"
              >
                {source} <span className="tabular-nums text-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
