/**
 * Legacy share links. The Dash dashboard saved layouts server-side and shared
 * them as `?state=<hash>`; there is no way to resolve that hash client-side,
 * so the app drops it (nuqs keeps the other params), tells the user, and
 * links to the saved layout on the old dashboard.
 */

export const LEGACY_STATE_PARAM = 'state'

/** Read a usable legacy `state` hash from a query string, or null. */
export function legacyStateHash(search: string): string | null {
  const v = new URLSearchParams(search).get(LEGACY_STATE_PARAM)
  return v && v.trim() ? v.trim() : null
}

/** URL that opens the saved layout on the legacy dashboard at `base`. */
export function legacyStateUrl(base: string, hash: string): string {
  return `${base.replace(/\/+$/, '')}/?${LEGACY_STATE_PARAM}=${encodeURIComponent(hash)}`
}
