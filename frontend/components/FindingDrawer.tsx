/**
 * FindingDrawer: shadcn Sheet showing one finding in full.
 *
 * Responsibility: render code_snippet, package versions (installed -> fixed),
 * cvss, cwe, references, score_contribution, and the LLM explanation
 * (what / why_it_matters / fix / confidence). Handles explanation === null with
 * a quiet fallback rather than a blank panel.
 *
 * DoD: opens for any finding and shows explanation text when present.
 */

'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { Finding } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ArrowRight, ExternalLink, Sparkles } from 'lucide-react'

const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

interface FindingDrawerProps {
  finding: Finding | null
  onOpenChange: (open: boolean) => void
}

export function FindingDrawer({ finding, onOpenChange }: FindingDrawerProps) {
  return (
    <Sheet open={finding != null} onOpenChange={onOpenChange}>
      {finding && <SheetContent>{finding && <DrawerBody finding={finding} />}</SheetContent>}
    </Sheet>
  )
}

function DrawerBody({ finding }: { finding: Finding }) {
  const style = SEVERITY_STYLES[finding.severity]

  return (
    <div className="flex flex-col gap-6 p-6 pt-14">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide',
              style.bg,
              style.border,
              style.text
            )}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {finding.category}
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {finding.source}
          </span>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{finding.title}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground/70">{finding.rule_id}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Stat label="Rank" value={`#${finding.rank}`} />
        <Stat label="CVSS" value={finding.cvss != null ? finding.cvss.toFixed(1) : '—'} />
        <Stat label="Occurrences" value={String(finding.occurrences)} />
        <Stat label="Score impact" value={`+${finding.score_contribution.toFixed(1)}`} />
      </div>

      <div>
        <p className={cn(EYEBROW, 'mb-2')}>Location</p>
        <p className="break-all rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
          {finding.file_path}
          {finding.line_start != null && `:${finding.line_start}`}
          {finding.line_end != null && finding.line_end !== finding.line_start && `-${finding.line_end}`}
        </p>
      </div>

      {finding.code_snippet && (
        <div>
          <p className={cn(EYEBROW, 'mb-2')}>Code</p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
            <code>{finding.code_snippet}</code>
          </pre>
        </div>
      )}

      {finding.package && (
        <div>
          <p className={cn(EYEBROW, 'mb-2')}>Package</p>
          {/* installed -> fixed reads as old/new, not as severity: no red or green here. */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs">
            <span className="text-foreground">{finding.package.name}</span>
            <span className="text-muted-foreground line-through">
              {finding.package.installed_version}
            </span>
            {finding.package.fixed_version && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground/70" />
                <span className="text-primary">{finding.package.fixed_version}</span>
              </>
            )}
          </div>
        </div>
      )}

      {finding.cwe.length > 0 && (
        <div>
          <p className={cn(EYEBROW, 'mb-2')}>CWE</p>
          <div className="flex flex-wrap gap-1.5">
            {finding.cwe.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className={cn(EYEBROW, 'text-primary')}>AI security reasoning</p>
        </div>
        {finding.explanation ? (
          <div className="flex flex-col gap-3 text-sm">
            <Field label="What it is">{finding.explanation.what}</Field>
            <Field label="Why it matters">{finding.explanation.why_it_matters}</Field>
            <Field label="How to fix it">{finding.explanation.fix}</Field>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
              Confidence:{' '}
              <span className="text-muted-foreground">{finding.explanation.confidence}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Reasoning hasn&apos;t been generated for this finding yet. The score and location above are
            still accurate.
          </p>
        )}
      </div>

      {finding.references.length > 0 && (
        <div>
          <p className={cn(EYEBROW, 'mb-2')}>References</p>
          <div className="flex flex-col gap-1.5">
            {finding.references.map((ref) => (
              <a
                key={ref}
                href={ref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{ref}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      <p className="leading-relaxed text-foreground">{children}</p>
    </div>
  )
}
