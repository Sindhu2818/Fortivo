/**
 * ScanForm: repo URL input + submit button + inline validation.
 *
 * Responsibility: collect a repo_url and hand it to the parent via onSubmit.
 * Ships a preset button for the demo repo so the live demo needs no typing.
 *
 * DoD: submits a non-empty repo_url and disables itself while a scan is running.
 */

'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ScanLine } from 'lucide-react'

const DEMO_REPO_URL = './demo-app'

interface ScanFormProps {
  onSubmit: (repoUrl: string) => void
  submitting: boolean
}

export function ScanForm({ onSubmit, submitting }: ScanFormProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = repoUrl.trim()
    if (!trimmed) {
      setError('Enter a repo URL or local path to scan.')
      return
    }
    setError(null)
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          className="h-12 flex-1 rounded-lg border border-border bg-card px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 disabled:opacity-60"
        />
        <Button type="submit" size="lg" disabled={submitting} className="shrink-0">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <ScanLine className="h-4 w-4" /> Run scan
            </>
          )}
        </Button>
      </div>

      {/* Not red: collisions.md reserves the severity ramp's colours for severity. */}
      {error && <p className="text-xs font-medium text-foreground">{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          setRepoUrl(DEMO_REPO_URL)
          setError(null)
          onSubmit(DEMO_REPO_URL)
        }}
        className="w-fit text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary disabled:opacity-60"
      >
        Use the demo repo ({DEMO_REPO_URL}) instead
      </button>
    </form>
  )
}
