/**
 * DiffViewer: renders `explanation.fix` as a patch.
 *
 * Responsibility: parse a unified diff into typed lines and render them with
 * old/new line-number gutters, a `-`/`+` marker column, and a tint per line kind.
 *
 * The contract calls `fix` a "concrete remediation step" and says nothing about
 * its format, and the golden fixture proves both shapes occur: the first five
 * findings carry a real `--- / +++ / @@` patch, the rest carry a prose sentence
 * ("Upgrade jinja2 to 3.1.6 …"). So the format is sniffed rather than assumed —
 * prose run through a diff parser would render every sentence as a context line
 * behind a fake gutter, which is worse than just showing the sentence.
 *
 * Colours follow docs/frontend-refs/collisions.md §2: low-opacity tint plus a 2px
 * left border, never a saturated fill, so a removed line cannot be mistaken for a
 * critical severity chip.
 *
 * DoD: a patch renders with line numbers and per-line tints; a null fix renders
 * "No automated fix available" rather than an empty box.
 */

import { cn } from '@/lib/utils'

type DiffLine =
  | { kind: 'meta'; text: string }
  | { kind: 'hunk'; text: string }
  | { kind: 'add'; text: string; newNo: number | null }
  | { kind: 'del'; text: string; oldNo: number | null }
  | { kind: 'context'; text: string; oldNo: number | null; newNo: number | null }

const HUNK_RE = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/

/**
 * True only for text that carries unified-diff structure: a hunk header, or the
 * `---`/`+++` file pair. A prose fix that happens to start a line with "-" is
 * not enough.
 */
function isUnifiedDiff(text: string): boolean {
  return /^@@[ \t]/m.test(text) || (/^--- /m.test(text) && /^\+\+\+ /m.test(text))
}

function parseUnifiedDiff(text: string): DiffLine[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
  // Line numbers stay null until a hunk header tells us where we are.
  let oldNo: number | null = null
  let newNo: number | null = null

  return raw.split('\n').map<DiffLine>((line) => {
    const hunk = HUNK_RE.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      return { kind: 'hunk', text: line }
    }

    if (
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('\\ ')
    ) {
      return { kind: 'meta', text: line }
    }

    if (line.startsWith('-')) {
      const at = oldNo
      if (oldNo != null) oldNo += 1
      return { kind: 'del', text: line.slice(1), oldNo: at }
    }

    if (line.startsWith('+')) {
      const at = newNo
      if (newNo != null) newNo += 1
      return { kind: 'add', text: line.slice(1), newNo: at }
    }

    // Context lines carry a leading space; a bare empty line is one too.
    const at = { oldNo, newNo }
    if (oldNo != null) oldNo += 1
    if (newNo != null) newNo += 1
    return { kind: 'context', text: line.startsWith(' ') ? line.slice(1) : line, ...at }
  })
}

/** Tint + 2px left border only — collisions.md §2 forbids solid fills here. */
const LINE_STYLES: Record<DiffLine['kind'], string> = {
  meta: 'border-l-2 border-transparent bg-muted/40 text-muted-foreground/70',
  hunk: 'border-l-2 border-transparent bg-muted/60 text-muted-foreground',
  add: 'border-l-2 border-[#3FB950]/60 bg-[#3FB950]/[0.08] text-foreground',
  del: 'border-l-2 border-[#E5484D]/60 bg-[#E5484D]/[0.08] text-foreground',
  context: 'border-l-2 border-transparent text-muted-foreground',
}

const MARKER_STYLES: Record<DiffLine['kind'], string> = {
  meta: 'text-muted-foreground/40',
  hunk: 'text-muted-foreground/40',
  add: 'text-[#3FB950]',
  del: 'text-[#E5484D]',
  context: 'text-muted-foreground/40',
}

function marker(kind: DiffLine['kind']): string {
  if (kind === 'add') return '+'
  if (kind === 'del') return '-'
  return ' '
}

const GUTTER = 'w-8 shrink-0 select-none px-1 text-right tabular-nums text-muted-foreground/40'

interface DiffViewerProps {
  /** `explanation.fix`, or null when there is no explanation at all. */
  fix: string | null | undefined
  className?: string
}

export function DiffViewer({ fix, className }: DiffViewerProps) {
  if (typeof fix !== 'string' || fix.trim() === '') {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground',
          className
        )}
      >
        No automated fix available
      </div>
    )
  }

  if (!isUnifiedDiff(fix)) {
    // Prose remediation. Same container, ordinary typography.
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground',
          className
        )}
      >
        {fix}
      </div>
    )
  }

  const lines = parseUnifiedDiff(fix)

  return (
    <div
      className={cn('overflow-x-auto rounded-lg border border-border bg-background', className)}
    >
      <div className="w-max min-w-full font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          const oldNo = line.kind === 'del' || line.kind === 'context' ? line.oldNo : null
          const newNo = line.kind === 'add' || line.kind === 'context' ? line.newNo : null

          return (
            <div key={i} className={cn('flex items-start', LINE_STYLES[line.kind])}>
              <span className={GUTTER}>{oldNo ?? ''}</span>
              <span className={GUTTER}>{newNo ?? ''}</span>
              <span
                className={cn('w-4 shrink-0 select-none text-center', MARKER_STYLES[line.kind])}
              >
                {marker(line.kind)}
              </span>
              {/* whitespace-pre keeps indentation; the parent scrolls, not this. */}
              <span className="whitespace-pre pr-3">{line.text || ' '}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
