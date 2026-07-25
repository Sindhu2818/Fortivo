/**
 * Types for the application shell — everything that is NOT the scan contract.
 *
 * Responsibility: model the product surface around a scan (accounts, saved
 * items, reports, notifications, team, admin). Deliberately a separate file from
 * lib/types.ts, which mirrors the frozen CONTRACT.md and must contain nothing
 * the backend does not actually emit. Nothing in here crosses the wire.
 *
 * DoD: no type in this file appears in a request or response body.
 */

import type { Band, Finding, Severity } from './types'

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export type Role = 'owner' | 'admin' | 'engineer' | 'viewer'
export type Plan = 'free' | 'team' | 'enterprise'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  plan: Plan
  /** Two letters, drawn in place of an avatar image. */
  initials: string
  job_title: string
  timezone: string
  created_at: string
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  viewer: 'Viewer',
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  team: 'Team',
  enterprise: 'Enterprise',
}

/* ------------------------------------------------------------------ */
/* Findings, widened with the scan they came from                      */
/* ------------------------------------------------------------------ */

/**
 * A contract Finding plus the scan it belongs to.
 *
 * The contract nests findings inside a ScanResult, so a finding on its own has
 * no idea which repo it came from. The cross-scan pages (/findings, /saved,
 * /search) list findings from many scans at once and need that back.
 */
export interface ScopedFinding extends Finding {
  scan_id: string
  repo_name: string
}

/** Where a finding sits in the triage lifecycle. Frontend-only state. */
export type TriageState = 'open' | 'saved' | 'archived' | 'trashed'

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export type ActivityKind =
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'finding_saved'
  | 'finding_archived'
  | 'report_created'
  | 'member_invited'
  | 'settings_changed'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  /** Human sentence, already written — the UI does not compose these. */
  message: string
  actor: string
  at: string
  href?: string
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationTone = 'info' | 'severity' | 'success'

export interface AppNotification {
  id: string
  title: string
  body: string
  at: string
  read: boolean
  tone: NotificationTone
  /** Present when the notification is about a specific finding or scan. */
  href?: string
  severity?: Severity
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export type ReportFormat = 'pdf' | 'markdown' | 'json'
export type ReportStatus = 'ready' | 'generating' | 'failed'
export type ReportTemplate = 'executive' | 'engineering' | 'compliance'

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  executive: 'Executive summary',
  engineering: 'Engineering detail',
  compliance: 'Compliance evidence',
}

export interface Report {
  id: string
  title: string
  template: ReportTemplate
  format: ReportFormat
  status: ReportStatus
  scan_id: string
  repo_name: string
  created_at: string
  created_by: string
  size_kb: number
  /** Score at the time the report was cut, so the row can show it. */
  score: number
  band: Band
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export type MemberStatus = 'active' | 'invited' | 'suspended'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: Role
  status: MemberStatus
  initials: string
  last_active: string
  scans_run: number
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type ScanDepth = 'fast' | 'balanced' | 'thorough'
export type Density = 'comfortable' | 'compact'

export interface Preferences {
  /** Email/in-app notification switches, keyed by the event they gate. */
  notify_scan_complete: boolean
  notify_critical_finding: boolean
  notify_weekly_digest: boolean
  notify_team_activity: boolean
  notify_product_updates: boolean
  /** Scan defaults applied to a new scan. */
  default_depth: ScanDepth
  fail_on_critical: boolean
  include_low_severity: boolean
  /** Presentation. */
  density: Density
  reduce_motion: boolean
  show_score_breakdown: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  notify_scan_complete: true,
  notify_critical_finding: true,
  notify_weekly_digest: false,
  notify_team_activity: true,
  notify_product_updates: false,
  default_depth: 'balanced',
  fail_on_critical: true,
  include_low_severity: false,
  density: 'comfortable',
  reduce_motion: false,
  show_score_breakdown: true,
}

/* ------------------------------------------------------------------ */
/* Integrations and API keys                                           */
/* ------------------------------------------------------------------ */

export interface Integration {
  id: string
  name: string
  blurb: string
  category: 'source' | 'chat' | 'ticketing' | 'ci'
  connected: boolean
}

export interface ApiKey {
  id: string
  label: string
  /** Prefix only — a real key is shown once at creation and never stored. */
  prefix: string
  created_at: string
  last_used: string | null
  scopes: string[]
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  level: LogLevel
  at: string
  source: string
  message: string
}

export type ServiceHealth = 'operational' | 'degraded' | 'down'

export interface ServiceStatus {
  name: string
  health: ServiceHealth
  detail: string
  uptime_pct: number
}
