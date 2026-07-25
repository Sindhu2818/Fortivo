/**
 * Mock account layer.
 *
 * Responsibility: sign in, sign up, sign out and edit the current user, all
 * against localStorage. No React here — components go through
 * providers/SessionProvider.
 *
 * **This is not authentication and does not pretend to be.** CLAUDE.md fixes the
 * stack at "No database. No auth.", so there is no server to authenticate
 * against: any email and any password of a sane length is accepted, and the
 * "session" is a JSON blob the user could edit by hand. It exists so the product
 * has the account surface a real one would — profile, team, preferences — not to
 * keep anyone out. Do not put anything behind it that actually needs protecting.
 *
 * One deliberate consequence: **a fresh browser is already signed in** as
 * DEMO_USER. The demo runs landing → scan → dashboard on a projector with no
 * time to type credentials, and a login wall in front of that flow is a way to
 * lose the demo. /login and /signup are real, reachable pages that work; they
 * are just not a gate. Signing out is what makes them appear.
 *
 * DoD: signOut() then a reload lands on the signed-out marketing view; signIn()
 * with any well-formed email restores an account.
 */

import { DEMO_USER } from './dataset'
import { STORAGE_KEYS, clearKey, readKey, writeKey } from './storage'
import type { Role, User } from './app-types'

export interface Credentials {
  email: string
  password: string
}

/** Field-level validation errors, keyed by input name. */
export type FieldErrors = Record<string, string>

const MIN_PASSWORD = 8

export function validateEmail(email: string): string | null {
  const trimmed = email.trim()
  if (!trimmed) return 'Enter your email address.'
  // Deliberately loose: one @, something either side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'That does not look like an email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.'
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  return null
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Enter your name.'
  if (name.trim().length < 2) return 'That name is too short.'
  return null
}

/** "Ada Lovelace" → "AL"; "sindhu" → "S". */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * The stored user, or DEMO_USER when nothing is stored.
 *
 * Returns null only after an explicit signOut, which writes a tombstone. That is
 * how "signed in by default" and "sign out actually works" coexist.
 */
export function loadUser(): User | null {
  const stored = readKey<User | 'signed-out' | null>(STORAGE_KEYS.user, null)
  if (stored === 'signed-out') return null
  if (stored === null) return DEMO_USER
  return stored
}

export function signIn({ email, password }: Credentials): { user: User } | { errors: FieldErrors } {
  const errors: FieldErrors = {}
  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  if (Object.keys(errors).length > 0) return { errors }

  const trimmed = email.trim().toLowerCase()
  // Signing back in as the demo account restores its full profile; any other
  // address gets a new account derived from the local part of the email.
  const user: User =
    trimmed === DEMO_USER.email
      ? DEMO_USER
      : {
          ...DEMO_USER,
          id: `u_${trimmed.split('@')[0]}`,
          name: prettifyLocalPart(trimmed),
          email: trimmed,
          initials: initialsFor(prettifyLocalPart(trimmed)),
        }

  writeKey(STORAGE_KEYS.user, user)
  return { user }
}

export interface SignUpInput {
  name: string
  email: string
  password: string
}

export function signUp({
  name,
  email,
  password,
}: SignUpInput): { user: User } | { errors: FieldErrors } {
  const errors: FieldErrors = {}
  const nameError = validateName(name)
  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  if (nameError) errors.name = nameError
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  if (Object.keys(errors).length > 0) return { errors }

  const user: User = {
    ...DEMO_USER,
    id: `u_${email.trim().split('@')[0].toLowerCase()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    initials: initialsFor(name),
    role: 'owner',
    plan: 'free',
    created_at: new Date().toISOString(),
  }
  writeKey(STORAGE_KEYS.user, user)
  return { user }
}

export function signOut(): void {
  // A tombstone, not a delete: clearing the key would fall back to DEMO_USER
  // and sign the user straight back in.
  writeKey(STORAGE_KEYS.user, 'signed-out')
}

export function saveUser(user: User): void {
  writeKey(STORAGE_KEYS.user, user)
}

/** Wipes the stored account so the next load is a first-run browser again. */
export function resetAccount(): void {
  clearKey(STORAGE_KEYS.user)
}

export function canManageTeam(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

/** "ada.lovelace@x.com" → "Ada Lovelace". */
function prettifyLocalPart(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}
