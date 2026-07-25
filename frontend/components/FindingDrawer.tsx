/**
 * FindingDrawer: shadcn Sheet showing one finding in full.
 *
 * Responsibility: read-only detail panel for a single Finding, in the order a
 * reader needs it — what and where, the code, how it scored, why it matters,
 * how to fix it — with the supporting metadata (package, CWE, references)
 * underneath. Owns no selection state; the page passes the finding in and gets
 * a close callback back. Esc and backdrop click come from Radix Dialog.
 *
 * Every optional contract field is defended, not assumed: `explanation`, `cvss`,
 * `line_start`/`line_end`, `package`, `code_snippet` and `duplicate_of` are all
 * nullable, and `cwe`/`references` are guarded as arrays even though the contract
 * promises them, because a half-finished backend run is the likeliest way this
 * panel ever sees bad data.
 *
 * ScoreBreakdown here shows the *scan's* four weighted components — the contract
 * gives a Finding no component decomposition, only `score_contribution` — so it
 * is labelled as the scan's model and the finding's own points are shown beneath
 * it. See ScoreBreakdown's header comment.
 *
 * DoD: opens for any finding, highlights the vulnerable line, and degrades to
 * quiet fallbacks instead of blank boxes when the LLM stage hasn't run.
 */

'use client'

import { ArrowRight, ExternalLink, Sparkles, Wrench } from 'lucide-react'
import { DiffViewer } from '@/components/DiffViewer'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { Finding, Risk } from '@/lib/types'
import { cn } from '@/lib/utils'

const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

interface FindingDrawerProps {
  finding: Finding | null
  /** The scan's risk object, for the scoring model. Optional so a page that
   *  hasn't loaded results yet can still mount the drawer. */
  risk?: Risk | null
  onOpenChange: (open: boolean) => void
}

export function FindingDrawer({ finding, risk, onOpenChange }: FindingDrawerProps) {
  return (
    <Sheet open={finding != null} onOpenChange={onOpenChange}>
      {finding && (
        <SheetContent className="max-w-[600px]" aria-describedby={undefined}>
          <DrawerBody finding={finding} risk={risk ?? null} />
        </SheetContent>
      )}
    </Sheet>
  )
}

function formatLocation(finding: Finding): string {
  const path = finding.file_path || '—'
  if (finding.line_start == null) return path
  if (finding.line_end != null && finding.line_end !== finding.line_start) {
    return `${path}:${finding.line_start}-${finding.line_end}`
  }
  return `${path}:${finding.line_start}`
}

function DrawerBody({ finding, risk }: { finding: Finding; risk: Risk | null }) {
  // An unexpected severity string must not crash on a missing style entry.
  const style = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.info
  const explanation = finding.explanation ?? null
  const cwe = Array.isArray(finding.cwe) ? finding.cwe : []
  const references = Array.isArray(finding.references) ? finding.references : []
  const contribution =
    typeof finding.score_contribution === 'number' && Number.isFinite(finding.score_contribution)
      ? finding.score_contribution
      : null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 1 — Identity: severity, title, location. `pr-12` clears the Sheet's close
             button, which is 32px wide at right-4 — that is what lets the body use
             a plain p-6 instead of the off-scale pt-14 it used to need. */}
      <div className="pr-12">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide',
              style.bg,
              style.border,
              style.text
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
            {style.label}
          </span>
          {finding.category && (
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {finding.category}
            </span>
          )}
          {finding.source && (
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {finding.source}
            </span>
          )}
        </div>

        <SheetTitle className="text-lg font-semibold leading-snug text-foreground">
          {finding.title || finding.rule_id || 'Untitled finding'}
        </SheetTitle>

        <p className="mt-1.5 break-all font-mono text-xs text-muted-foreground">
          {formatLocation(finding)}
        </p>
        {finding.rule_id && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">{finding.rule_id}</p>
        )}
      </div>

      {/* 2 — The code itself, with the flagged line called out. The section stays
             put when there is no snippet so the drawer's running order never
             changes between findings — a dependency finding and a code finding
             read the same top to bottom. */}
      <section>
        <p className={cn(EYEBROW, 'mb-2')}>Code</p>
        {finding.code_snippet ? (
          <CodeBlock
            snippet={finding.code_snippet}
            lineStart={finding.line_start}
            lineEnd={finding.line_end}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {finding.category === 'dependency'
              ? 'No snippet — this is a dependency finding, not a line of your code.'
              : 'No code snippet was captured for this finding.'}
          </p>
        )}
      </section>

      {/* 3 — How the score was built. */}
      {risk && (
        <ScoreBreakdown
          components={risk.components}
          score={risk.score}
          contribution={contribution}
          dense
          className="bg-background"
        />
      )}

      {/* 4 — Reasoning. */}
      <section className="rounded-lg border border-primary/25 bg-primary/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <p className={cn(EYEBROW, 'text-primary')}>AI security reasoning</p>
          </div>
          {explanation?.confidence && <ConfidenceBadge confidence={explanation.confidence} />}
        </div>

        {explanation ? (
          <div className="flex flex-col gap-3 text-sm">
            {explanation.what && <Field label="What it is">{explanation.what}</Field>}
            {explanation.why_it_matters && (
              <Field label="Why it matters">{explanation.why_it_matters}</Field>
            )}
            {!explanation.what && !explanation.why_it_matters && (
              <p className="text-sm text-muted-foreground">
                No reasoning text came back for this finding.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Reasoning hasn&apos;t been generated for this finding yet. The score and location above
            are still accurate.
          </p>
        )}
      </section>

      {/* 5 — The patch. */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className={EYEBROW}>Suggested fix</p>
        </div>
        <DiffViewer fix={explanation?.fix} />
      </section>

      {/* Supporting metadata. */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-4">
        <Stat label="Rank" value={finding.rank != null ? `#${finding.rank}` : '—'} />
        <Stat
          label="CVSS"
          value={
            typeof finding.cvss === 'number' && Number.isFinite(finding.cvss)
              ? finding.cvss.toFixed(1)
              : '—'
          }
        />
        <Stat
          label="Occurrences"
          value={
            typeof finding.occurrences === 'number' && Number.isFinite(finding.occurrences)
              ? String(finding.occurrences)
              : '—'
          }
        />
        <Stat
          label="Score impact"
          value={contribution != null ? `+${contribution.toFixed(1)}` : '—'}
        />
      </div>

      {finding.package && (
        <section>
          <p className={cn(EYEBROW, 'mb-2')}>Package</p>
          {/* installed -> fixed reads as old/new, not as severity: no red or green here. */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
            <span className="text-foreground">{finding.package.name || '—'}</span>
            <span className="text-muted-foreground line-through">
              {finding.package.installed_version || '—'}
            </span>
            {finding.package.fixed_version ? (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground/70" />
                <span className="text-primary">{finding.package.fixed_version}</span>
              </>
            ) : (
              <span className="text-muted-foreground/70">no fixed version</span>
            )}
          </div>
        </section>
      )}

      {cwe.length > 0 && (
        <section>
          <p className={cn(EYEBROW, 'mb-2')}>CWE</p>
          <div className="flex flex-wrap gap-1.5">
            {cwe.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {references.length > 0 && (
        <section>
          <p className={cn(EYEBROW, 'mb-2')}>References</p>
          <div className="flex flex-col gap-1.5">
            {references.map((ref) => (
              <a
                key={ref}
                href={ref}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit max-w-full items-center gap-1.5 rounded text-xs text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{ref}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * The snippet is verbatim repo text starting at `line_start`, so the gutter is
 * that number plus the offset. With no line info there is nothing to number and
 * nothing to highlight — the block still renders, just plain.
 */
function CodeBlock({
  snippet,
  lineStart,
  lineEnd,
}: {
  snippet: string
  lineStart: number | null
  lineEnd: number | null
}) {
  const lines = snippet.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  // line_end >= line_start per the contract; clamp anyway so bad data can't
  // produce an empty highlight range.
  const hlEnd = lineStart != null ? Math.max(lineStart, lineEnd ?? lineStart) : null

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <div className="w-max min-w-full font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          const no = lineStart != null ? lineStart + i : null
          const flagged = no != null && hlEnd != null && no >= lineStart! && no <= hlEnd

          return (
            <div
              key={i}
              className={cn(
                'flex items-start border-l-2',
                flagged ? 'border-primary bg-primary/10' : 'border-transparent'
              )}
            >
              <span className="w-10 shrink-0 select-none px-2 text-right tabular-nums text-muted-foreground/40">
                {no ?? ''}
              </span>
              <span
                className={cn(
                  'whitespace-pre pr-3',
                  flagged ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {line || ' '}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Neutral by design — collisions.md §1 reserves the ramp's colours for severity. */
function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      {confidence} confidence
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
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
