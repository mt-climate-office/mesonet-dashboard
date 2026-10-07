/**
 * Station-view router: the three `#hash` sections, which history operation a
 * navigation uses, and the boot-time mapping of legacy links. Pure;
 * `stores/url.ts` applies the results to `location`/`history`.
 *
 * Sections: #now (default) · #charts · #about.
 * Legacy (DESIGN.md "Information architecture"):
 *   #latest               → #charts&cmp=1 (Compare; from/to/agg/vars/gridmet kept)
 *   #ag (bare)            → #charts, scrolled to the Ag tools group
 *   #ag&var=<tool>        → #charts&v=<tool>, every Ag key kept
 *   #ag&var=annual        → #charts&v=<annv's family>&view=history (All years)
 *   #download, #downloader → #charts&dl=1 (the Download sheet; dl_* keys kept)
 *   #satellite            → #now (globalNotices explains)
 */
import { AG_KEYS } from './ag/view/tab'
import { isAgTool } from './params/ag'
import { variableIdForElement } from './variables/catalog'
import type { UrlState } from './url-schema'

export const SECTIONS = [
  { id: 'now', label: 'Now' },
  { id: 'charts', label: 'Charts' },
  { id: 'about', label: 'About' },
] as const

export type Section = (typeof SECTIONS)[number]['id']

export const DEFAULT_SECTION: Section = 'now'

const IDS: readonly string[] = SECTIONS.map((s) => s.id)

/** Old section and tab hashes → the section that replaced them. */
const LEGACY_HASH: Readonly<Record<string, Section>> = {
  latest: 'charts',
  ag: 'charts',
  download: 'charts',
  downloader: 'charts',
  satellite: 'now',
}

/** `#charts` / `charts` → 'charts'; legacy names map to their section; anything else → 'now'. */
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
 * History operation for a navigation: a section change or a drill-down (a
 * Charts variable or Ag tool, a sub-view) adds an entry, so Back returns; any
 * other change inside one section replaces it.
 */
export function historyMode(from: Section, to: Section, drillDown = false): 'push' | 'replace' {
  return from === to && !drillDown ? 'replace' : 'push'
}

/** Where a chart page's back arrow returns: `section`, `depth` history entries back. */
export interface BackTo {
  section: Section
  depth: number
}

/**
 * The back target for a new history entry (null: the arrow goes to the Charts list): `from` when a
 * link names where it was opened from (a Now tile); carried one entry deeper through drill-downs in
 * the same section (a table view, Previous / Next); dropped on reaching the list or anything else.
 */
export function nextBackTo(o: { current: BackTo | null; from?: Section; sameSection: boolean; drillDown: boolean; toList: boolean }): BackTo | null {
  if (o.toList) return null
  if (o.from) return { section: o.from, depth: 1 }
  return o.current && o.sameSection && o.drillDown ? { section: o.current.section, depth: o.current.depth + 1 } : null
}

/** The back target kept in `history.state` (anything malformed is null). */
export function readBackTo(state: unknown): BackTo | null {
  const b = (state as { backTo?: { section?: unknown; depth?: unknown } } | null)?.backTo
  if (!b || !SECTIONS.some((s) => s.id === b.section) || !Number.isInteger(b.depth) || (b.depth as number) < 1) return null
  return { section: b.section as Section, depth: b.depth as number }
}

/** Keys that only the old Latest tab read; a hash-less link carrying one meant Latest. */
const LATEST_KEYS = ['from', 'to', 'agg', 'vars', 'gridmet'] as const

/** Id of the Charts list's Ag tools group: a bare legacy `#ag` link scrolls to it. */
export const AG_TOOLS_ANCHOR = 'charts-ag-tools'

/**
 * `search` (`?…` or '') with the `drop` keys removed and `add` pairs appended;
 * every other pair is kept byte for byte (literal commas and `+` survive).
 */
function editQuery(search: string, drop: readonly string[], add: ReadonlyArray<readonly [string, string]>): string {
  const keyOf = (pair: string) => {
    try {
      return decodeURIComponent(pair.split('=')[0].replace(/\+/g, ' '))
    } catch {
      return pair.split('=')[0]
    }
  }
  const kept = search.replace(/^\?/, '').split('&').filter((p) => p && !drop.includes(keyOf(p)))
  const pairs = [...kept, ...add.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/gi, ',')}`)]
  return pairs.length ? `?${pairs.join('&')}` : ''
}

/** The Charts patch for an old `#ag` link's query: the tool page, or the list when no tool was open. */
function agTarget(params: URLSearchParams): { drop: string[]; add: [string, string][] } | null {
  // GDD was the old tab's default tool, also for an unknown `var`.
  const v = params.get('var')
  if (v === null && !AG_KEYS.some((k) => params.has(k))) return null
  const tool = isAgTool(v) ? v : 'gdd'
  if (tool === 'annual') {
    // Annual comparison is now a variable's All-years view; with no `annv`, air temperature's.
    const annv = params.get('annv')
    return { drop: ['var', 'v', 'view'], add: [['v', annv ? variableIdForElement(annv) : 'air_temp'], ['view', 'history']] }
  }
  return { drop: ['var', 'v'], add: [['v', tool]] }
}

/**
 * Boot-time rewrite of a legacy link (run after `migrateLegacySearch`, which
 * renames per-tab keys using the OLD hash). Returns the new `{ search, hash }`
 * (`search` is `?…` or `''`) plus, for a bare `#ag`, the `anchor` to scroll
 * to once it renders; null when the URL is already current. See the header
 * for the mappings; every key not named there is kept byte for byte.
 */
export function legacyRedirect(search: string, hash: string): { search: string; hash: string; anchor?: string } | null {
  const raw = hash.replace(/^#/, '').trim()
  const params = new URLSearchParams(search)
  const latestLink = raw === 'latest' || (raw === '' && LATEST_KEYS.some((k) => params.has(k)))
  if (latestLink) {
    return { search: params.has('cmp') ? search : editQuery(search, [], [['cmp', '1']]), hash: '#charts' }
  }
  if (raw === 'download' || raw === 'downloader') {
    return { search: editQuery(search, ['dl'], [['dl', '1']]), hash: '#charts' }
  }
  if (raw === 'ag') {
    const to = agTarget(params)
    return to ? { search: editQuery(search, to.drop, to.add), hash: '#charts' } : { search, hash: '#charts', anchor: AG_TOOLS_ANCHOR }
  }
  return null
}

/** The Charts variable list: no variable or Ag tool, no Compare, the default sub-view. */
export const CHARTS_LIST_PATCH: Partial<UrlState> = { v: null, view: 'recent', tbl: false, cmp: false }

/**
 * A section-nav link from `from` to `to`: the URL patch and whether it adds a
 * history entry. Tapping Charts inside Charts returns to the list (a
 * drill-down back up, pushed unless already there); leaving Charts drops the
 * variable and Compare (`CHARTS_LIST_PATCH`), so the next visit opens the
 * list. Other sections keep their state.
 */
export function sectionNavPatch(
  from: Section,
  to: Section,
  state: Pick<UrlState, 'v' | 'cmp'>,
): { patch: Partial<UrlState>; drillDown: boolean } {
  if (from === 'charts' && to === 'charts') return { patch: CHARTS_LIST_PATCH, drillDown: state.v !== null || state.cmp }
  if (from === 'charts') return { patch: CHARTS_LIST_PATCH, drillDown: false }
  return { patch: {}, drillDown: false }
}
