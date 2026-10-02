/**
 * Station-view router: the five `#hash` sections, which history operation a
 * navigation uses, and the boot-time mapping of legacy tab links. Pure;
 * `stores/url.ts` applies the results to `location`/`history`.
 *
 * Sections: #now (default) · #charts · #ag · #download · #about.
 * Legacy:   #latest     → #charts with cmp=1 (Compare; from/to/agg/vars/gridmet kept)
 *           #downloader → #download (dl_* keys kept; migrateLegacySearch renames first)
 *           #ag         → unchanged · #satellite → #now (globalNotices explains)
 */

export const SECTIONS = [
  { id: 'now', label: 'Now' },
  { id: 'charts', label: 'Charts' },
  { id: 'ag', label: 'Ag' },
  { id: 'download', label: 'Download' },
  { id: 'about', label: 'About' },
] as const

export type Section = (typeof SECTIONS)[number]['id']

export const DEFAULT_SECTION: Section = 'now'

const IDS: readonly string[] = SECTIONS.map((s) => s.id)

/** Old tab hashes → the section that replaced them. */
const LEGACY_HASH: Readonly<Record<string, Section>> = { latest: 'charts', downloader: 'download', satellite: 'now' }

/** `#ag` / `ag` → 'ag'; legacy tab names map to their section; anything else → 'now'. */
export function parseSection(hash: string): Section {
  const raw = hash.replace(/^#/, '').trim()
  if (IDS.includes(raw)) return raw as Section
  return LEGACY_HASH[raw] ?? DEFAULT_SECTION
}

/**
 * The section after the hash changed to `hash`: like parseSection, except
 * that an unrelated in-page anchor (the skip link's `#main`) keeps `current`
 * instead of jumping to Now.
 */
export function sectionForHash(hash: string, current: Section): Section {
  const raw = hash.replace(/^#/, '').trim()
  return raw === '' || IDS.includes(raw) || raw in LEGACY_HASH ? parseSection(raw) : current
}

/** Section label ("Charts"), for announcements and titles. */
export const sectionLabel = (s: Section): string => SECTIONS.find((x) => x.id === s)?.label ?? s

/**
 * History operation for a navigation: a section change adds an entry (Back
 * returns to the previous section); a change inside one section replaces it.
 */
export function historyMode(from: Section, to: Section): 'push' | 'replace' {
  return from === to ? 'replace' : 'push'
}

/** Keys that only the old Latest tab read; a hash-less link carrying one meant Latest. */
const LATEST_KEYS = ['from', 'to', 'agg', 'vars', 'gridmet'] as const

/**
 * Boot-time rewrite of a legacy link (run after `migrateLegacySearch`, which
 * renames per-tab keys using the OLD hash). Returns the new `{ search, hash }`
 * (`search` is `?…` or `''`), or null when the URL is already current.
 *  - `#latest`, or no hash with a Latest-only key → `#charts` + `cmp=1`
 *  - `#downloader` → `#download`
 * Every other key is kept byte-for-byte.
 */
export function legacyRedirect(search: string, hash: string): { search: string; hash: string } | null {
  const raw = hash.replace(/^#/, '').trim()
  const params = new URLSearchParams(search)
  const latestLink = raw === 'latest' || (raw === '' && LATEST_KEYS.some((k) => params.has(k)))
  if (latestLink) {
    const q = search.replace(/^\?/, '')
    const withCmp = params.has('cmp') ? q : q ? `${q}&cmp=1` : 'cmp=1'
    return { search: `?${withCmp}`, hash: '#charts' }
  }
  if (raw === 'downloader') return { search, hash: '#download' }
  return null
}
