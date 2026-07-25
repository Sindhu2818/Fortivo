/**
 * Single source of truth for severity and band presentation.
 *
 * Responsibility: map Severity and Band values to Tailwind class strings, badge
 * labels, and sort order. Nothing else hardcodes a severity color.
 *
 * Colors are written as arbitrary Tailwind values rather than `sev-*` theme keys
 * so the ramp stays in this one file until it is locked into
 * docs/frontend-refs/design-tokens.md. Per frontend-refs/collisions.md the ramp
 * owns red / orange / amber / grey and nothing else in the app uses them — `low`
 * is grey, not blue, so it never reads as the cyan Primary accent.
 *
 * DoD: all five severities and all four bands have a distinct, legible style.
 */

import type { Band, Severity } from './types'

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

interface SeverityStyle {
  label: string
  text: string
  bg: string
  border: string
  dot: string
  hex: string
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  critical: {
    label: 'Critical',
    text: 'text-[#E5484D]',
    bg: 'bg-[#E5484D]/12',
    border: 'border-[#E5484D]/40',
    dot: 'bg-[#E5484D]',
    hex: '#E5484D',
  },
  high: {
    label: 'High',
    text: 'text-[#F2994A]',
    bg: 'bg-[#F2994A]/12',
    border: 'border-[#F2994A]/40',
    dot: 'bg-[#F2994A]',
    hex: '#F2994A',
  },
  medium: {
    label: 'Medium',
    text: 'text-[#E8C34A]',
    bg: 'bg-[#E8C34A]/12',
    border: 'border-[#E8C34A]/40',
    dot: 'bg-[#E8C34A]',
    hex: '#E8C34A',
  },
  low: {
    label: 'Low',
    text: 'text-[#6B7C86]',
    bg: 'bg-[#6B7C86]/12',
    border: 'border-[#6B7C86]/40',
    dot: 'bg-[#6B7C86]',
    hex: '#6B7C86',
  },
  info: {
    label: 'Info',
    text: 'text-[#47555E]',
    bg: 'bg-[#47555E]/12',
    border: 'border-[#47555E]/40',
    dot: 'bg-[#47555E]',
    hex: '#47555E',
  },
}

interface BandStyle {
  label: string
  text: string
  bg: string
  border: string
  hex: string
}

export const BAND_STYLES: Record<Band, BandStyle> = {
  low: {
    label: 'Low',
    text: 'text-[#6B7C86]',
    bg: 'bg-[#6B7C86]/12',
    border: 'border-[#6B7C86]/40',
    hex: '#6B7C86',
  },
  medium: {
    label: 'Medium',
    text: 'text-[#E8C34A]',
    bg: 'bg-[#E8C34A]/12',
    border: 'border-[#E8C34A]/40',
    hex: '#E8C34A',
  },
  high: {
    label: 'High',
    text: 'text-[#F2994A]',
    bg: 'bg-[#F2994A]/12',
    border: 'border-[#F2994A]/40',
    hex: '#F2994A',
  },
  critical: {
    label: 'Critical',
    text: 'text-[#E5484D]',
    bg: 'bg-[#E5484D]/12',
    border: 'border-[#E5484D]/40',
    hex: '#E5484D',
  },
}

export function severitySortIndex(sev: Severity): number {
  return SEVERITY_ORDER.indexOf(sev)
}

export function scoreToBandFallback(score: number): Band {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}
