/**
 * ReductionStat: the pitch as three numbers — raw findings, what survived dedup,
 * what we prioritised — plus the severity split of what is left.
 *
 * Responsibility: display stats. The field names are the contract's
 * (raw_findings / after_dedup / reported_findings); the labels are the demo's.
 *
 * The breakdown shows four severities. `info` joins them only when it is
 * non-zero, so a clean scan reads as four pills but we never silently drop a
 * count the backend reported.
 *
 * DoD: the three funnel numbers and every non-zero severity bucket render.
 */

import { ArrowRight } from 'lucide-react'
import { SEVERITY_ORDER, SEVERITY_STYLES } from '@/lib/severity'
import type { Severity, Stats } from '@/lib/types'

interface ReductionStatProps {
  stats: Stats
}

/** critical / high / medium / low, in ramp order. */
const HEADLINE_SEVERITIES = SEVERITY_ORDER.filter((s) => s !== 'info')

export function ReductionStat({ stats }: ReductionStatProps) {
  const steps: { label: string; value: number }[] = [
    { label: 'Raw findings', value: stats.raw_findings },
    { label: 'After dedupe', value: stats.after_dedup },
    { label: 'Prioritized', value: stats.reported_findings },
  ]

  const shown: Severity[] =
    stats.by_severity.info > 0 ? [...HEADLINE_SEVERITIES, 'info'] : HEADLINE_SEVERITIES

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-2">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <div key={step.label} className="flex flex-1 items-start gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className={`font-mono text-3xl font-semibold tabular-nums leading-none ${
                    isLast ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {step.value.toLocaleString()}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{step.label}</p>
              </div>
              {!isLast && (
                <ArrowRight
                  aria-hidden
                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-auto border-t border-border pt-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          By severity
        </p>
        <div className="flex flex-wrap gap-2">
          {shown.map((sev) => {
            const style = SEVERITY_STYLES[sev]
            return (
              <span
                key={sev}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${style.bg} ${style.border} ${style.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {style.label}
                <span className="font-semibold tabular-nums">{stats.by_severity[sev]}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
