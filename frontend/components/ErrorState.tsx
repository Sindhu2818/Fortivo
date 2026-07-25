/**
 * ErrorState: the one card the app shows when a scan could not be loaded or the
 * pipeline died.
 *
 * Responsibility: title, the message the caller was given, an optional mono
 * detail line (scan id, stage), a Retry button, and an escape hatch back to the
 * landing page. It owns no retry logic — `onRetry` is the caller's, because only
 * the caller knows what to re-run. When `onRetry` is omitted the button is not
 * rendered rather than rendered dead.
 *
 * Colour: deliberately NOT red. docs/frontend-refs/collisions.md reserves
 * red / orange / amber / grey for the severity ramp and forbids other components
 * from borrowing them for states, so a failure reads as a stronger neutral — the
 * icon and the wording carry it, which is also how it survives a projector that
 * crushes saturation. Same reasoning as EmptyState's `error` tone.
 *
 * DoD: a failed scan shows why, and Retry re-runs the load without a page reload.
 */

'use client'

import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  /** The error message. Shown verbatim — callers already humanise it. */
  message: string
  /** Mono footnote: scan id, the stage it stopped at, anything diagnostic. */
  detail?: string
  /** Omit to hide the Retry button entirely. */
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  detail,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-border bg-card p-6', className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</p>
          {detail && (
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground/70">{detail}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onRetry && (
          <Button type="button" size="sm" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to all scans</Link>
        </Button>
      </div>
    </div>
  )
}
