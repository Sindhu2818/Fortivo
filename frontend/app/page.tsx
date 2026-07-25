/**
 * Landing page (/): product one-liner, a link into /scan, and a list of past
 * scans from GET /results.
 *
 * Responsibility: entry point and scan history. No analysis rendering.
 *
 * DoD: localhost:3000 shows the pitch line and a working link to /scan.
 */

import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="mx-auto max-w-6xl px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <span
          className={`${EYEBROW} rounded-full border border-border px-3 py-1 text-primary`}
        >
          AI Security Engineer
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          AI that reasons like a security engineer —{' '}
          <span className="text-primary">not just a scanner.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Fortivo scans your repository with Trivy and Semgrep, cuts hundreds of raw
          findings down to the handful that matter, correlates them into attack
          paths, and explains every one of them in plain English.
        </p>
        <Button asChild size="lg">
          <Link href="/scan">
            Scan a repository <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section className="mt-16">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground/70" />
          <h2 className={EYEBROW}>Recent scans</h2>
        </div>

        {scans.length === 0 ? (
          <EmptyState
            title="No scans yet"
            description="Run your first scan to see a risk score, ranked findings, and attack paths here."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/scan">Run a scan</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {scans.map((scan) => {
              const band = BAND_STYLES[scan.band]
              return (
                <Link
                  key={scan.scan_id}
                  href={`/dashboard/${scan.scan_id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{scan.repo_name}</p>
                    <p className="font-mono text-xs text-muted-foreground/70">
                      {formatDate(scan.scanned_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-xs uppercase tracking-wide ${band.bg} ${band.text} ${band.border}`}
                  >
                    {band.label} · {scan.score}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/70" />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
