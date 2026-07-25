/**
 * EmptyState: shared placeholder for "no scans yet", "no findings", "no attack
 * paths", and any other list that came back empty.
 *
 * Responsibility: one consistent empty visual. Presentational only.
 *
 * A *failed* load is ErrorState, not this — that one has a Retry button and knows
 * it is reporting a problem. The `error` tone here is only for the in-between case
 * of a list that is empty for a reason worth flagging, and it is deliberately NOT
 * red: frontend-refs/collisions.md reserves red/orange/amber/grey for the severity
 * ramp and forbids other components borrowing them for states, so it reads as a
 * stronger neutral instead.
 *
 * DoD: every list in the app renders this instead of blank space when empty.
 */

import type { LucideIcon } from 'lucide-react'
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  tone?: 'neutral' | 'error'
  className?: string
}

export function EmptyState({
  icon: Icon = ShieldCheck,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center',
        className
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted',
          tone === 'error' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
