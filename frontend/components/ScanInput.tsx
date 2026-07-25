/**
 * ScanInput: the landing page's one interaction — repo URL in, scan out.
 *
 * Responsibility: collect a repo_url, POST it via startScan, and route to
 * /scan/<scan_id>. Prefilled with the demo repo so the live demo is one click.
 * This is the only client component on the landing page, which keeps the page
 * itself a server component.
 *
 * DoD: pressing Scan navigates to /scan/<scan_id>; a failed start shows a
 * readable message and leaves the form usable.
 */

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startScan } from '@/lib/api'

const DEMO_REPO_URL = './demo-app'

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
      const { scan_id } = await startScan(trimmed)
      // Deliberately stays disabled through the route change so the button does
      // not flash back to its idle state mid-navigation.
      router.push(`/scan/${scan_id}`)
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
              <Loader2 className="h-4 w-4 animate-spin" /> Starting…
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
