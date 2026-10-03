/**
 * The URL query schema: every key the app reads or writes, its default and
 * its parser. Pure; `stores/url.ts` is the only caller that touches `location`.
 *
 * Key map (query param → meaning). Each tab owns its keys so state set on one
 * tab never leaks into another; only `s` (station) and `theme` are shared.
 *
 *   Shared     s          station id (raw; may be an NWSLI or mis-cased id
 *                         until stores/station.ts rewrites it)
 *              theme      dark | light | high-contrast (read first by the
 *                         inline anti-flash script; absent = saved/OS choice)
 *
 *   Charts     v          what Charts shows, one namespace: an Ag tool id
 *                         (core/params/ag AG_TOOL_IDS: gdd, etr, …) opens that
 *                         tool; any other value is an element-family id
 *                         (air_temp, ppt, soil_vwc …; core/variables) and opens
 *                         its variable page; absent = the list
 *              view       variable sub-view: recent | history | table
 *              cmp        1 = the Compare (stacked) chart; `#latest` links map
 *                         here (core/router.ts). It reads the Latest keys.
 *              dl         1 = the Download sheet is open over Charts; old
 *                         `#download`/`#downloader` links map here
 *     (The variable page and Compare share from/to/agg/gridmet below.)
 *
 *   Latest     from, to   chart window (YYYY-MM-DD; pan/zoom writes these)
 *              agg        hourly | daily | raw
 *              vars       display-variable names, comma-separated (absent =
 *                         the 5 defaults; `vars=` = explicitly none)
 *              nets       map network filter
 *              gridmet    overlay normals
 *     (Latest keeps the un-prefixed legacy names because it is the most-shared
 *      tab and existing links must keep working.)
 *
 *   Ag Tools   (the open tool is `v` above; old links' `var` is mapped by
 *              core/router.ts at boot)
 *              crop       GDD crop
 *              gdd_lo, gdd_hi  custom GDD cutoffs, °F (absent = the crop's)
 *              gdd_proj   GDD projection horizon: season | 30 | 60 | off
 *              ag_time    hourly | daily
 *              lt         livestock: adult | newborn
 *              soilv      soil profile sub-variable
 *              annv       annual comparison variable
 *              ag_from, ag_to  date window
 *
 *   Downloader els        element codes
 *              pub        show uncommon elements
 *              rmna       legacy "remove flagged" switch (superseded by qc;
 *                         rmna=true with no qc maps to qc=2)
 *              period     monthly | daily | hourly
 *              dl_from, dl_to  date window
 *              qc         QC level 0 raw | 1 provisional | 2 quality-controlled
 *                         (absent = the tab's fallback, 2)
 *
 *   Satellite  mode, pct, sat_vars, cmpx, cmpy, sat_from, sat_to
 *              (tab hidden; keys kept so old links round-trip untouched)
 *
 * Keys not in this schema (e.g. legacy `state`, `kbd`, and the old Latest
 * cards' `card`/`info`) are preserved as-is, so old links round-trip.
 */
import { SELECTED_VARS } from './params/latest'

/* -------------------------------------------------------------------------- */
/* Option lists and types                                                      */
/* -------------------------------------------------------------------------- */

export const THEMES = ['dark', 'light', 'high-contrast'] as const
export type Theme = (typeof THEMES)[number]

export const LATEST_AGG_OPTIONS = ['hourly', 'daily', 'raw'] as const
export type LatestAgg = (typeof LATEST_AGG_OPTIONS)[number]

export const CHART_VIEWS = ['recent', 'history', 'table'] as const
export type ChartView = (typeof CHART_VIEWS)[number]

export const NETWORK_OPTIONS = ['HydroMet', 'AgriMet', 'Cooperator'] as const

export const AG_TIME_OPTIONS = ['hourly', 'daily'] as const
export type AgTime = (typeof AG_TIME_OPTIONS)[number]
export const AG_LIVESTOCK_OPTIONS = ['adult', 'newborn'] as const
export type AgLivestock = (typeof AG_LIVESTOCK_OPTIONS)[number]
export const GDD_PROJ_OPTIONS = ['season', '30', '60', 'off'] as const
export type GddProjHorizon = (typeof GDD_PROJ_OPTIONS)[number]

export const DL_PERIOD_OPTIONS = ['monthly', 'daily', 'hourly'] as const
export type DlPeriod = (typeof DL_PERIOD_OPTIONS)[number]
export const DL_QC_LEVELS = [0, 1, 2] as const
export type DlQcLevel = (typeof DL_QC_LEVELS)[number]

export const SAT_MODE_OPTIONS = ['ts', 'cmp'] as const
export type SatMode = (typeof SAT_MODE_OPTIONS)[number]
export const DEFAULT_SAT_VARS = ['ET', 'GPP', 'NDVI']

/* -------------------------------------------------------------------------- */
/* Parsers                                                                     */
/* -------------------------------------------------------------------------- */

/** One query key: default, parse (raw `null` = absent) and format. */
export interface KeySpec<T> {
  default: T
  parse: (raw: string | null) => T
  /** Query value for `v`; only called when `v` should be written. */
  format: (v: T) => string
}

/** Any KeySpec, whatever its value type (format's parameter is contravariant). */
type AnyKeySpec = Omit<KeySpec<unknown>, 'format'> & { format: (v: never) => string }

const str = (): KeySpec<string | null> => ({
  default: null,
  parse: (raw) => raw,
  format: (v) => v ?? '',
})

const strOr = (d: string): KeySpec<string> => ({
  default: d,
  parse: (raw) => raw ?? d,
  format: (v) => v,
})

function oneOf<T extends string, D extends T | null>(options: readonly T[], d: D): KeySpec<T | D> {
  return {
    default: d,
    parse: (raw) => ((options as readonly string[]).includes(raw ?? '') ? (raw as T) : d),
    format: (v) => String(v),
  }
}

/** nuqs semantics: absent → default; otherwise only "true" (any case) is true. */
const bool = (d: boolean): KeySpec<boolean> => ({
  default: d,
  parse: (raw) => (raw === null ? d : raw.toLowerCase() === 'true'),
  format: (v) => String(v),
})

/** A new-style on/off key: `1` (or `true`) is on, written as `1`; absent = off. */
const flag = (): KeySpec<boolean> => ({
  default: false,
  parse: (raw) => raw === '1' || raw?.toLowerCase() === 'true',
  format: () => '1',
})

/** Comma-separated list. Absent → default; `key=` → []. */
function list<D extends readonly string[] | null>(d: D): KeySpec<string[] | D> {
  return {
    default: d,
    parse: (raw) => (raw === null ? d : raw === '' ? [] : raw.split(',').filter((x) => x !== '')),
    format: (v) => (v ?? []).join(','),
  }
}

const qcLevel = (): KeySpec<DlQcLevel | null> => ({
  default: null,
  parse: (raw) => {
    const n = raw === null || raw.trim() === '' ? NaN : Number(raw)
    return (DL_QC_LEVELS as readonly number[]).includes(n) ? (n as DlQcLevel) : null
  },
  format: (v) => String(v),
})

/* -------------------------------------------------------------------------- */
/* The schema                                                                  */
/* -------------------------------------------------------------------------- */

export const URL_SCHEMA = {
  // Shared
  s: str(),
  theme: oneOf(THEMES, null),
  // Charts
  v: str(),
  view: oneOf(CHART_VIEWS, 'recent'),
  cmp: flag(),
  dl: flag(),
  // Latest (Compare)
  from: str(),
  to: str(),
  agg: oneOf(LATEST_AGG_OPTIONS, 'hourly'),
  // null = the default selection (SELECTED_VARS); [] = explicitly none.
  vars: list(null),
  nets: list(NETWORK_OPTIONS),
  gridmet: bool(false),
  // Ag Tools
  crop: strOr('wheat'),
  gdd_lo: str(),
  gdd_hi: str(),
  gdd_proj: oneOf(GDD_PROJ_OPTIONS, 'season'),
  ag_time: oneOf(AG_TIME_OPTIONS, 'daily'),
  lt: oneOf(AG_LIVESTOCK_OPTIONS, 'adult'),
  soilv: strOr('soil_vwc'),
  annv: str(),
  ag_from: str(),
  ag_to: str(),
  // Downloader
  els: list([] as string[]),
  pub: bool(false),
  rmna: bool(false),
  period: oneOf(DL_PERIOD_OPTIONS, 'daily'),
  dl_from: str(),
  dl_to: str(),
  qc: qcLevel(),
  // Satellite (hidden)
  mode: oneOf(SAT_MODE_OPTIONS, 'ts'),
  pct: bool(true),
  sat_vars: list(DEFAULT_SAT_VARS),
  cmpx: str(),
  cmpy: str(),
  sat_from: str(),
  sat_to: str(),
} satisfies Record<string, AnyKeySpec>

export type UrlKey = keyof typeof URL_SCHEMA
/** Parsed value of every schema key. */
export type UrlState = { [K in UrlKey]: ReturnType<(typeof URL_SCHEMA)[K]['parse']> }

const KEYS = Object.keys(URL_SCHEMA) as UrlKey[]

/* -------------------------------------------------------------------------- */
/* Read / write                                                                */
/* -------------------------------------------------------------------------- */

/** Parse a query string (with or without `?`) into the full typed state. */
export function readUrlState(search: string): UrlState {
  const params = new URLSearchParams(search)
  const out: Record<string, unknown> = {}
  for (const k of KEYS) out[k] = URL_SCHEMA[k].parse(params.get(k))
  return out as UrlState
}

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.join('\u0000') === b.join('\u0000') : a === b

/**
 * Serialize `state` into a query string (`?…`, or `''` when nothing is set).
 * Schema keys at their default are omitted, so an all-defaults view has a
 * clean URL. Non-schema keys from `current` are kept in their original order.
 */
export function writeUrlSearch(state: UrlState, current = ''): string {
  const params = new URLSearchParams(current)
  const pairs: [string, string][] = []
  for (const [k, v] of params) {
    if (!(k in URL_SCHEMA)) pairs.push([k, v])
  }
  for (const k of KEYS) {
    const spec = URL_SCHEMA[k] as AnyKeySpec
    const v = state[k]
    if (v === null || v === undefined) continue
    if (same(v, spec.default)) continue
    pairs.push([k, (spec.format as (v: unknown) => string)(v)])
  }
  if (pairs.length === 0) return ''
  // Commas stay literal and spaces become '+', matching links the React app
  // (nuqs) produced, so shared URLs keep their familiar shape.
  const enc = (s: string) => encodeURIComponent(s).replace(/%2C/gi, ',').replace(/%20/g, '+')
  return `?${pairs.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&')}`
}

/**
 * Absolute URL of the view in `state`: `loc`'s origin, path and hash with
 * the query re-serialized by `writeUrlSearch` against `loc.search`, i.e.
 * what the URL store writes on its next flush (Share copies this).
 */
export function viewHref(
  loc: Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>,
  state: UrlState,
): string {
  return `${loc.origin}${loc.pathname}${writeUrlSearch(state, loc.search)}${loc.hash}`
}

/** The Latest selection with "absent = defaults" resolved. */
export function latestVars(state: Pick<UrlState, 'vars'>): string[] {
  return state.vars ?? [...SELECTED_VARS]
}

/** Patch for "user picked a station" (picker, Download's combobox and map). */
export function selectStationPatch(id: string | null): Partial<UrlState> {
  return { s: id }
}

/* -------------------------------------------------------------------------- */
/* Legacy-key migration                                                        */
/* -------------------------------------------------------------------------- */

/** Per-tab renames applied to pre-namespacing links: [legacy, current]. */
export const LEGACY_KEY_RENAMES: Readonly<
  Record<string, ReadonlyArray<readonly [string, string]>>
> = {
  ag: [
    ['from', 'ag_from'],
    ['to', 'ag_to'],
    ['time', 'ag_time'],
  ],
  downloader: [
    ['from', 'dl_from'],
    ['to', 'dl_to'],
  ],
  satellite: [
    ['vars', 'sat_vars'],
    ['from', 'sat_from'],
    ['to', 'sat_to'],
  ],
}

/**
 * Given a query string (with or without `?`) and the hash tab (with or without
 * `#`), rename each legacy key to the tab's key when the new key is absent.
 * Returns the new query string (`?…` or `''`), or `null` when nothing changed.
 */
export function migrateLegacySearch(search: string, hash: string): string | null {
  const renames = LEGACY_KEY_RENAMES[hash.replace(/^#/, '').trim()]
  if (!renames) return null
  const params = new URLSearchParams(search)
  let changed = false
  for (const [legacy, next] of renames) {
    const value = params.get(legacy)
    if (value === null || params.has(next)) continue
    params.delete(legacy)
    params.set(next, value)
    changed = true
  }
  if (!changed) return null
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Legacy `/<base>/<station>` deep link → canonical `<base>/?s=<station>`.
 * `base` has no trailing slash. Returns the new path+query+hash, or null when
 * `pathname` is not a single station-like segment under `base`.
 */
export function stationPathRedirect(
  pathname: string,
  search: string,
  hash: string,
  base: string,
): string | null {
  if (!pathname.startsWith(`${base}/`) || pathname.length <= base.length + 1) return null
  const segment = pathname.slice(base.length + 1).replace(/\/+$/, '')
  // Only single-segment identifiers are station ids.
  if (!segment || segment.includes('/') || !/^[a-z0-9_-]+$/i.test(segment)) return null
  const params = new URLSearchParams(search)
  if (!params.has('s')) params.set('s', segment)
  const qs = params.toString()
  return `${base}/${qs ? `?${qs}` : ''}${hash}`
}
