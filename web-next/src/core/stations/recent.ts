/**
 * Station-picker memory in localStorage: the last station (opened when a link
 * has no `?s=`), the five most recent stations, and whether the desktop
 * drawer is open. Pure over an injected storage; every value is re-validated
 * on read (HOUSE-STYLE §4: another app or an old version may have written it).
 */

/** Last station id. */
export const STATION_KEY = 'mco-dashboard-station'
/** Recent station ids, newest first, comma-separated. */
export const RECENT_KEY = 'mco-dashboard-recent'
/** Desktop drawer: `open` | `closed`. */
export const DRAWER_KEY = 'mco-dashboard-drawer'

export const MAX_RECENT = 5

/** The slice of `Storage` used here; calls may throw (private mode, blocked site data). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const ID = /^[a-z0-9_]{2,32}$/

/** True for a plausible catalog id (lower-case letters, digits, `_`). */
export const isStationId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

function read(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function write(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* not persisted; the page still works */
  }
}

/** The remembered station id, or null when absent or invalid. */
export function readStation(storage: StorageLike): string | null {
  const v = read(storage, STATION_KEY)
  return isStationId(v) ? v : null
}

/** Recent ids, newest first: valid, de-duplicated, at most MAX_RECENT. */
export function readRecent(storage: StorageLike): string[] {
  const raw = read(storage, RECENT_KEY) ?? ''
  return [...new Set(raw.split(',').filter(isStationId))].slice(0, MAX_RECENT)
}

/** `id` first, then the others in order, de-duplicated, capped at MAX_RECENT. */
export const pushRecent = (list: readonly string[], id: string): string[] =>
  [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT)

/** Remember `id` as the last station and the newest recent one (invalid ids are ignored). */
export function rememberStation(storage: StorageLike, id: string): void {
  if (!isStationId(id)) return
  write(storage, STATION_KEY, id)
  write(storage, RECENT_KEY, pushRecent(readRecent(storage), id).join(','))
}

/** Saved desktop drawer state: true/false, or null when never set (or junk). */
export function readDrawerOpen(storage: StorageLike): boolean | null {
  const v = read(storage, DRAWER_KEY)
  return v === 'open' ? true : v === 'closed' ? false : null
}

export function saveDrawerOpen(storage: StorageLike, open: boolean): void {
  write(storage, DRAWER_KEY, open ? 'open' : 'closed')
}

/**
 * Should the picker start open? With no station it always does (first visit:
 * the picker is the page). Otherwise only the desktop drawer reopens, and only
 * if it was left open; the phone sheet and tablet drawer start closed.
 */
export function pickerStartsOpen(hasStation: boolean, desktop: boolean, saved: boolean | null): boolean {
  if (!hasStation) return true
  return desktop && saved === true
}
