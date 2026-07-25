/**
 * The one place that touches localStorage.
 *
 * Responsibility: typed, SSR-safe read/write for a fixed set of keys. Every
 * caller goes through readKey/writeKey so there is a single list of what we
 * persist and a single place that handles a quota error or disabled storage.
 *
 * Why localStorage at all: Fortivo has no database and no auth backend — see
 * CLAUDE.md, "JSON files in ./results/. No database. No auth." The product shell
 * still needs somewhere to keep an account, saved findings and preferences, so
 * it keeps them in the browser. Nothing here is a security boundary and nothing
 * here is sent to the backend.
 *
 * `window` is guarded on every path: these modules are imported by client
 * components that Next still renders once on the server.
 *
 * DoD: importing this file during SSR does not throw, and every read returns the
 * supplied fallback when storage is empty or unparseable.
 */

const PREFIX = 'fortivo:'

export const STORAGE_KEYS = {
  user: 'user',
  preferences: 'preferences',
  triage: 'triage',
  notifications: 'notifications',
  reports: 'reports',
  team: 'team',
  apiKeys: 'api-keys',
  integrations: 'integrations',
  recentSearches: 'recent-searches',
  onboarded: 'onboarded',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Fired after every successful write so open tabs and sibling hooks re-read. */
const CHANGE_EVENT = 'fortivo:storage'

export function readKey<T>(key: StorageKey, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // Corrupt JSON or storage blocked entirely (private mode, embedded webview).
    return fallback
  }
}

export function writeKey<T>(key: StorageKey, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }))
  } catch {
    // Over quota or blocked. The in-memory state has already been updated by
    // the caller, so the current page stays correct for this session.
  }
}

export function clearKey(key: StorageKey): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PREFIX + key)
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }))
  } catch {
    /* ignore */
  }
}

/** Subscribes to writes from this tab (CHANGE_EVENT) and from others (storage). */
export function subscribe(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
