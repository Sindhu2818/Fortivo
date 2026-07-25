/**
 * DashboardSkeleton: what /dashboard/[scanId] shows while getResults resolves.
 *
 * Responsibility: hold the dashboard's exact shape so nothing jumps when the real
 * data lands. It mirrors the page's own structure block for block — title row,
 * the 3/2 hero grid, the stats card, the graph card, the findings table — using
 * the same container classes, so the two layouts stay in step by construction
 * rather than by memory. Presentational; it takes no props and knows no data.
 *
 * Deliberately not a spinner. A spinner tells you to wait; a skeleton tells you
 * what is coming, and on a projector the page also stops reflowing on arrival.
 *
 * The whole block is aria-hidden behind one polite live region, so a screen
 * reader hears "Loading scan results" once instead of reading forty empty divs.
 *
 * DoD: swapping between this and the loaded dashboard moves nothing above the
 * findings table.
 */

import { Skeleton } from '@/components/ui/skeleton'

/** Rows of fake findings. Enough to fill 1440x900 below the fold, not more. */
const ROW_COUNT = 8

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="sr-only" role="status" aria-live="polite">
        Loading scan results…
      </p>

      <div aria-hidden>
        {/* Back link. */}
        <Skeleton className="mb-6 h-4 w-24" />

        {/* Repo name + meta line. */}
        <div className="mb-8 flex flex-col gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-96" />
        </div>

        {/* Hero row: gauge card left, scoring model right. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center lg:col-span-3">
            <Skeleton className="mx-auto h-[200px] w-[200px] shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="flex flex-col gap-4">
              {/* Four factors, tracks at their real relative widths. */}
              {[100, 62, 50, 38].map((w, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2 rounded-full" style={{ width: `${w}%` }} />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats card: the reduction funnel. */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <Skeleton className="mb-4 h-3 w-32" />
          <div className="flex flex-col gap-3">
            {[100, 63, 12].map((w, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28 shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-8 rounded-md" style={{ width: `${w}%` }} />
                </div>
                <Skeleton className="h-6 w-14 shrink-0" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-4">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: col === 0 ? 5 : 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-20 rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attack path card. */}
        <div className="mt-8">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-2 border-b border-border px-6 py-4">
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex h-[380px] items-center gap-6 bg-background px-6">
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-24 w-[168px] shrink-0 rounded-lg"
                  style={{ marginTop: i % 2 === 0 ? 0 : 44 }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Findings table. */}
        <div className="mt-8">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 border-b border-border px-6 py-3">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            {Array.from({ length: ROW_COUNT }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border/60 px-6 py-3 last:border-0"
              >
                <Skeleton className="h-4 w-6 shrink-0" />
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-3 w-32 shrink-0 md:block" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
