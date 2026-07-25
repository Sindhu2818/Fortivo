/**
 * Logo: the Fortivo mark.
 *
 * Responsibility: draw the mark and nothing else — no link, no wordmark, no
 * layout. The header composes it with the product name; app/icon.svg is the same
 * two paths exported at 32px for the favicon, so the tab and the header always
 * agree.
 *
 * A shield (hardened) with a bolt through it (fast) — geometric enough to stay
 * legible at 16px, which is the size that actually decides a mark like this.
 * Both paths take `currentColor`, so the caller sets the colour with a text-*
 * class rather than the component hardcoding one.
 *
 * DoD: renders at 16px and at 32px without the bolt closing up.
 */

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      className={className}
    >
      <path
        d="M12 2.4 4.3 5.3v6.4c0 4.7 3.2 8.5 7.7 10.1 4.5-1.6 7.7-5.4 7.7-10.1V5.3L12 2.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.3 6.9 8.6 13.4h2.9l-.8 4.3 4.7-6.6h-2.9l.8-4.2Z" fill="currentColor" />
    </svg>
  )
}
