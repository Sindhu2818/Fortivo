/**
 * Root layout: html/body shell, font, Tailwind globals, dark theme, top nav.
 *
 * Responsibility: chrome only. No data fetching, no state.
 *
 * DoD: every page renders inside it with Tailwind styles applied and no
 * unstyled flash.
 */

import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fortivo — Your AI Security Engineer',
  description:
    'AI that understands your software, reasons like a security engineer, and fixes vulnerabilities before hackers exploit them.',
}

/** Dark is the only theme we ship; `.dark` is what Tailwind switches on. */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#030f11',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
                  FORTIVO
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-1">
                <Link
                  href="/scan"
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  New scan
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground/70">
            Fortivo · AI Security Engineer · Hackathon MVP
          </footer>
        </div>
      </body>
    </html>
  )
}
