/**
 * Root layout: html/body shell, font, Tailwind globals, dark theme, fixed header.
 *
 * Responsibility: chrome only. No data fetching, no state.
 *
 * The header is `fixed`, not sticky, so it cannot be scrolled off a projector at
 * any point in the demo. Fixed takes the bar out of flow, so <main> carries an
 * explicit `pt-16` matching the header's `h-16` — those two numbers must move
 * together.
 *
 * The favicon is app/favicon.ico, generated from the same two paths as
 * components/Logo.tsx, so the tab icon and the header mark are one drawing.
 *
 * DoD: every page renders inside it with Tailwind styles applied and no
 * unstyled flash.
 */

import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
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
          <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-border bg-background/85 backdrop-blur">
            <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-6">
              <Link
                href="/"
                aria-label="Fortivo home"
                className="group flex items-center gap-3 rounded-md py-1 pr-2 transition-opacity hover:opacity-90"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors group-hover:border-primary/70 group-hover:bg-primary/20">
                  <Logo className="h-[18px] w-[18px]" />
                </span>
                <span className="font-mono text-sm font-semibold tracking-[0.14em] text-foreground">
                  FORTIVO
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-1">
                {/* The landing page owns the only scan form. There used to be a
                    second one at /scan that submitted to the same endpoint and
                    then skipped the progress page; it is gone. */}
                <Link
                  href="/"
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  New scan
                </Link>
              </nav>
            </div>
          </header>
          {/* pt-16 pays back the fixed header's h-16. */}
          <main className="flex-1 pt-16">{children}</main>
          <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground/70">
            Fortivo · AI Security Engineer · Hackathon MVP
          </footer>
        </div>
      </body>
    </html>
  )
}
