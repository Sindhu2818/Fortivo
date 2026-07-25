import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outline'
}

export function Badge({ className, variant = 'outline', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide',
        variant === 'outline' && 'border bg-transparent',
        className
      )}
      {...props}
    />
  )
}
