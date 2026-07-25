/**
 * EmptyState: shared placeholder for "no scans yet", "no findings", "no attack
 * paths", and error cases.
 *
 * Responsibility: one consistent empty/error visual. Presentational only.
 *
 * Note: the `error` tone is deliberately NOT red. frontend-refs/collisions.md
 * reserves red/orange/amber/grey for the severity ramp and forbids other
 * components from using them for states, so error reads as a stronger neutral.
 *
 * DoD: every list in the app renders this instead of blank space when empty.
 */

import type { LucideIcon } from 'lucide-react'
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  tone?: 'neutral' | 'error'
}

export function EmptyState({
  icon: Icon = ShieldCheck,
  title,
  description,
  action,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border ${
          tone === 'error'
            ? 'border-border bg-muted text-foreground'
            : 'border-border bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
