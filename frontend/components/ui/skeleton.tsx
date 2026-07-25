import { cn } from '@/lib/utils'

/**
 * Skeleton: one shimmering placeholder block.
 *
 * `bg-muted` and `animate-pulse` only — no new colour, no new animation. Callers
 * pass the size; this owns nothing but the fill and the pulse.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}
