/**
 * FindingsTable: the ranked list of up to 30 findings.
 *
 * Responsibility: render rank, severity, title, location, category, score and
 * occurrences, sorted by score_contribution descending. Clicking a row calls
 * onSelect(findingId) — it owns no drawer state itself. No filter or search UI:
 * 30 rows is a list you read, not one you query.
 *
 * The location cell truncates from the *left* so the filename and line survive:
 * `direction: rtl` puts the overflow (and the ellipsis) at the start of the
 * string, and `unicode-bidi: plaintext` keeps the path itself rendering
 * left-to-right so `:1420` cannot get reordered away from its filename.
 *
 * DoD: 30 rows render in score order under a header that stays put while they
 * scroll, and a click surfaces the id to the parent.
 */

'use client'

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { Finding } from '@/lib/types'
import { cn } from '@/lib/utils'

interface FindingsTableProps {
  findings: Finding[]
  onSelect: (findingId: string) => void
  /** Highlights the row whose finding is open in FindingDrawer. */
  selectedId?: string | null
}

function formatLocation(f: Finding): string {
  if (f.line_start == null) return f.file_path
  if (f.line_end != null && f.line_end !== f.line_start) {
    return `${f.file_path}:${f.line_start}-${f.line_end}`
  }
  return `${f.file_path}:${f.line_start}`
}

const HEADER_CELL =
  'sticky top-0 z-10 border-b border-border bg-card px-3 py-3 font-medium'

export function FindingsTable({ findings, onSelect, selectedId }: FindingsTableProps) {
  const rows = useMemo(
    () => [...findings].sort((a, b) => b.score_contribution - a.score_contribution),
    [findings]
  )

  // Longest bar in the table, so the widths compare against the top finding
  // rather than against an absolute scale nobody can see.
  const maxScore = useMemo(
    () => rows.reduce((m, f) => Math.max(m, f.score_contribution), 0) || 1,
    [rows]
  )

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No findings reported"
        description="This scan didn't surface anything worth ranking. That's a good sign."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground/70">
              <th className={cn(HEADER_CELL, 'w-12 pl-5')}>#</th>
              <th className={cn(HEADER_CELL, 'w-28')}>Severity</th>
              <th className={HEADER_CELL}>Finding</th>
              <th className={cn(HEADER_CELL, 'hidden md:table-cell')}>Location</th>
              <th className={cn(HEADER_CELL, 'hidden w-28 sm:table-cell')}>Type</th>
              <th className={cn(HEADER_CELL, 'w-32 pr-5 text-right')}>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const style = SEVERITY_STYLES[f.severity]
              const barPct = Math.max((f.score_contribution / maxScore) * 100, 3)
              const selected = selectedId === f.id

              return (
                <tr
                  key={f.id}
                  tabIndex={0}
                  onClick={() => onSelect(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(f.id)
                    }
                  }}
                  className={cn(
                    'cursor-pointer border-b border-border/60 outline-none transition-colors last:border-0 hover:bg-muted focus-visible:bg-muted',
                    selected && 'bg-muted'
                  )}
                >
                  <td className="py-3 pl-5 pr-3 font-mono tabular-nums text-muted-foreground/70">
                    {f.rank}
                  </td>

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

                  <td className="max-w-sm px-3 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{f.title}</span>
                      {f.occurrences > 1 && (
                        <span
                          title={`${f.occurrences} raw findings collapsed into this one`}
                          className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground"
                        >
                          ×{f.occurrences}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="hidden max-w-[220px] px-3 py-3 md:table-cell">
                    <span
                      title={formatLocation(f)}
                      dir="rtl"
                      style={{ unicodeBidi: 'plaintext' }}
                      className="block truncate text-left font-mono text-xs text-muted-foreground"
                    >
                      {formatLocation(f)}
                    </span>
                  </td>

                  <td className="hidden px-3 py-3 sm:table-cell">
                    <span className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] lowercase text-muted-foreground">
                      {f.category}
                    </span>
                  </td>

                  <td className="py-3 pl-3 pr-5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums text-foreground">
                        {f.score_contribution.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
