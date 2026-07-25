/**
 * Landing page (/): the product name, the one-liner, and the scan box. Below
 * that, past scans from GET /results.
 *
 * Responsibility: entry point only. The input and its submit live in
 * ScanInput ('use client'); this page stays a server component so the history
 * list can be fetched during render.
 *
 * DoD: localhost:3000 shows the pitch and a prefilled input whose Scan button
 * lands on /scan/<scan_id>.
 */

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { ScanInput } from '@/components/ScanInput'
import { EmptyState } from '@/components/EmptyState'
import { BAND_STYLES } from '@/lib/severity'
import { listResults } from '@/lib/api'

const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default async function LandingPage() {
  const scans = await listResults().catch(() => [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="flex flex-col items-start gap-6">
        <span
          className={`${EYEBROW} rounded-full border border-border px-3 py-1 text-primary`}
        >
          AI Security Engineer
        </span>

        <h1 className="font-mono text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Fortivo
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Scans your repository with Trivy and Semgrep, then cuts hundreds of raw
          findings down to the handful that actually matter — and explains every one.
        </p>

        <div className="mt-2 w-full">
          <ScanInput />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground/70" />
          <h2 className={EYEBROW}>Recent scans</h2>
        </div>

        {scans.length === 0 ? (
          <EmptyState
            title="No scans yet"
            description="Run your first scan to see a risk score, ranked findings, and attack paths here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {scans.map((scan) => {
              const band = BAND_STYLES[scan.band]
              return (
                <Link
                  key={scan.scan_id}
                  href={`/scan/${scan.scan_id}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground transition-colors group-hover:text-primary">
                      {scan.repo_name}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground/70">
                      {formatDate(scan.scanned_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-xs uppercase tracking-wide ${band.bg} ${band.text} ${band.border}`}
                  >
                    {band.label} · {scan.score}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
