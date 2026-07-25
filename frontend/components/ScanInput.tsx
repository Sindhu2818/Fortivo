/**
 * ScanInput: the landing page's one interaction — repo URL in, scan out.
 *
 * Responsibility: collect a repo_url, POST it via startScan, and route to
 * /dashboard/<scan_id>. Prefilled with the demo repo so the live demo is one
 * click. This is the only client component on the landing page, which keeps the
 * page itself a server component.
 *
 * This is the app's only scan entry point — the header's "New scan" links here.
 *
 * POST /scan is synchronous: it runs the whole pipeline before it answers, so
 * the result document already exists by the time we navigate. There is nothing
 * to poll for, which is why this goes straight to the dashboard rather than
 * through a progress page.
 *
 * DoD: pressing Scan navigates to /dashboard/<scan_id>; a failed start, or a
 * 202 whose body says status "failed", shows a readable message and leaves the
 * form usable.
 */

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startScan } from '@/lib/api'

/**
 * Relative to the backend process's cwd, not the repo root — scanners/clone.py
 * resolves a local repo_url with a bare Path(). The documented way to start the
 * backend is `uvicorn main:app --port 8000` from inside `backend/`, so the demo
 * repo one level up is `../demo-app`. Staying relative keeps it working on both
 * machines; `./demo-app` fails in ~0.02s.
 */
const DEMO_REPO_URL = '../demo-app'

export function ScanInput() {
  const router = useRouter()
  const [repoUrl, setRepoUrl] = useState(DEMO_REPO_URL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = repoUrl.trim()
    if (!trimmed) {
      setError('Enter a repo URL or local path to scan.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { scan_id, status } = await startScan(trimmed)
      // POST /scan answers 202 even when the pipeline already failed — the
      // backend is synchronous, so `status` is final by the time we read it.
      // Navigating on the 2xx alone lands the user on a scan that never ran.
      if (status === 'failed') {
        setSubmitting(false)
        setError(
          `The scan failed before it produced any findings. Check that "${trimmed}" is reachable from the backend.`
        )
        return
      }
      // Deliberately stays disabled through the route change so the button does
      // not flash back to its idle state mid-navigation.
      router.push(`/dashboard/${scan_id}`)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Could not start the scan.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => {
            setRepoUrl(e.target.value)
            if (error) setError(null)
          }}
          placeholder="https://github.com/org/repo or ./local-path"
          disabled={submitting}
          aria-label="Repository URL or local path"
          className="h-12 flex-1 rounded-lg border border-border bg-card px-4 font-mono text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-border/80 focus-visible:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button type="submit" size="lg" disabled={submitting} className="h-12 shrink-0">
          {submitting ? (
            <>
              {/* Not "Starting…": the request is the scan, and it is held open
                  for the whole pipeline. */}
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4" /> Scan
            </>
          )}
        </Button>
      </div>

      {/* Not red: collisions.md reserves the severity ramp's colours for severity. */}
      {error && <p className="mt-3 text-xs font-medium text-foreground">{error}</p>}
    </form>
  )
}
