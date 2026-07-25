/**
 * FindingsTable: the ranked list of up to 30 findings.
 *
 * Responsibility: render rank, severity badge, title, file_path:line, source and
 * occurrences. Supports filtering by severity and source. Clicking a row calls
 * onSelect(findingId) — it owns no drawer state itself.
 *
 * DoD: 30 rows render in rank order and a click surfaces the id to the parent.
 */

'use client'

import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { SEVERITY_ORDER, SEVERITY_STYLES } from '@/lib/severity'
import type { Finding, Severity, Source } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ListFilter, Search } from 'lucide-react'

interface FindingsTableProps {
  findings: Finding[]
  onSelect: (findingId: string) => void
}

function formatLocation(f: Finding): string {
  if (f.line_start == null) return f.file_path
  if (f.line_end != null && f.line_end !== f.line_start) {
    return `${f.file_path}:${f.line_start}-${f.line_end}`
  }
  return `${f.file_path}:${f.line_start}`
}

export function FindingsTable({ findings, onSelect }: FindingsTableProps) {
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all')

  const sources = useMemo(
    () => Array.from(new Set(findings.map((f) => f.source))) as Source[],
    [findings]
  )

  const filtered = useMemo(() => {
    return findings.filter(
      (f) =>
        (severityFilter === 'all' || f.severity === severityFilter) &&
        (sourceFilter === 'all' || f.source === sourceFilter)
    )
  }, [findings, severityFilter, sourceFilter])

  if (findings.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No findings reported"
        description="This scan didn't surface anything worth ranking. That's a good sign."
      />
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <ListFilter className="h-4 w-4 text-muted-foreground/70" />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')}>
            All severities
          </FilterChip>
          {SEVERITY_ORDER.filter((s) => findings.some((f) => f.severity === s)).map((sev) => (
            <FilterChip
              key={sev}
              active={severityFilter === sev}
              onClick={() => setSeverityFilter(sev)}
              dotClass={SEVERITY_STYLES[sev].dot}
            >
              {SEVERITY_STYLES[sev].label}
            </FilterChip>
          ))}
        </div>
        {sources.length > 1 && (
          <div className="ml-auto flex gap-1.5">
            <FilterChip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>
              All sources
            </FilterChip>
            {sources.map((src) => (
              <FilterChip key={src} active={sourceFilter === src} onClick={() => setSourceFilter(src)}>
                {src}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground/70">
              <th className="w-12 px-5 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Severity</th>
              <th className="px-3 py-3 font-medium">Finding</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Location</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Source</th>
              <th className="px-3 py-3 pr-5 text-right font-medium">Occ.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const style = SEVERITY_STYLES[f.severity]
              return (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted"
                >
                  <td className="px-5 py-3 font-mono tabular-nums text-muted-foreground/70">{f.rank}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase',
                        style.bg,
                        style.border,
                        style.text
                      )}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-3 font-medium text-foreground">
                    <span className="line-clamp-1">{f.title}</span>
                  </td>
                  <td className="hidden max-w-[220px] px-3 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    <span className="line-clamp-1">{formatLocation(f)}</span>
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-xs capitalize text-muted-foreground sm:table-cell">
                    {f.source}
                  </td>
                  <td className="px-3 py-3 pr-5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {f.occurrences}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-10">
            <EmptyState title="No findings match these filters" />
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  dotClass,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  dotClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
        active
          ? 'border-primary/50 bg-primary/15 text-primary'
          : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {dotClass && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </button>
  )
}
