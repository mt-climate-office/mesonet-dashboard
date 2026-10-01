/**
 * URL query-state for every tab (nuqs). Each tab owns its own keys so state
 * set on one tab never leaks into another; only the station is shared.
 *
 * Key map (query param → meaning):
 *
 *   Shared     s          station id
 *
 *   Latest     from, to   chart window (YYYY-MM-DD; pan/zoom writes these)
 *              agg        hourly | daily | raw
 *              vars       display-variable names, comma-separated
 *              nets       map network filter
 *              gridmet    overlay normals
 *              card       top card: wind | forecast | photo
 *              info       bottom card: map | metadata | current
 *     (Latest keeps the un-prefixed legacy names because it is the most-shared
 *      tab and existing links must keep working.)
 *
 *   Ag Tools   var        derived variable (etr, gdd, …)
 *              crop       GDD crop
 *              gdd_lo, gdd_hi  GDD slider thresholds
 *              ag_time    hourly | daily
 *              lt         livestock: adult | newborn
 *              soilv      soil profile sub-variable
 *              annv       annual comparison variable
 *              ag_from, ag_to  date window
 *
 *   Downloader els        element codes
 *              pub        show uncommon elements
 *              rmna       remove flagged rows
 *              period     monthly | daily | hourly
 *              dl_from, dl_to  date window
 *
 *   Satellite  mode       ts | cmp
 *              pct        show percentiles
 *              sat_vars   satellite variable codes
 *              cmpx, cmpy compare products
 *              sat_from, sat_to  date window
 *
 * Legacy links: before namespacing, Ag/Downloader/Satellite read the shared
 * `from`/`to` (and Ag `time`, Satellite `vars`). `migrateLegacyUrlState()`
 * runs once at startup and, when the hash tab is one of those, renames the
 * legacy keys to that tab's keys via history.replaceState.
 */
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from 'nuqs'
import type { AggPeriod } from './params'

const AGG_OPTIONS = ['hourly', 'daily', 'raw'] as const
type LatestAgg = (typeof AGG_OPTIONS)[number]

const NETWORK_OPTIONS = ['HydroMet', 'AgriMet', 'Cooperator'] as const

const TOP_CARDS = ['wind', 'forecast', 'photo'] as const
const BOTTOM_CARDS = ['map', 'metadata', 'current'] as const

/**
 * URL state for the Latest Data tab. Returns one stable object so consumers
 * can re-read the whole state without juggling multiple useQueryState hooks.
 */
export function useLatestTabState() {
  const [s, setS] = useQueryState('s', parseAsString)
  const [from, setFrom] = useQueryState('from', parseAsString)
  const [to, setTo] = useQueryState('to', parseAsString)
  const [agg, setAgg] = useQueryState(
    'agg',
    parseAsStringEnum<LatestAgg>(AGG_OPTIONS as unknown as LatestAgg[]).withDefault('hourly'),
  )
  const [vars, setVars] = useQueryState(
    'vars',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  )
  const [nets, setNets] = useQueryState(
    'nets',
    parseAsArrayOf(parseAsString, ',').withDefault([...NETWORK_OPTIONS]),
  )
  const [gridmet, setGridmet] = useQueryState(
    'gridmet',
    parseAsBoolean.withDefault(false),
  )
  const [topCard, setTopCard] = useQueryState(
    'card',
    parseAsStringEnum([...TOP_CARDS]).withDefault('wind'),
  )
  const [bottomCard, setBottomCard] = useQueryState(
    'info',
    parseAsStringEnum([...BOTTOM_CARDS]).withDefault('map'),
  )

  return {
    station: s,
    setStation: setS,
    from,
    setFrom,
    to,
    setTo,
    agg,
    setAgg,
    vars,
    setVars,
    nets,
    setNets,
    gridmet,
    setGridmet,
    topCard,
    setTopCard,
    bottomCard,
    setBottomCard,
  }
}

/** Convenience: URL-encoded period maps directly to AggPeriod for the API. */
export function aggToPeriod(agg: LatestAgg): AggPeriod {
  return agg
}

/** Just the station, since some sub-trees only need that. */
export function useStationParam() {
  return useQueryState('s', parseAsString)
}

/** Wrapper around nuqs's batch reader for callers that need many params at once. */
export const readMany = useQueryStates

/* -------------------------------------------------------------------------- */
/* Ag Tools tab state                                                          */
/* -------------------------------------------------------------------------- */

const AG_TIME_OPTIONS = ['hourly', 'daily'] as const
type AgTime = (typeof AG_TIME_OPTIONS)[number]
const AG_LIVESTOCK_OPTIONS = ['adult', 'newborn'] as const
type AgLivestock = (typeof AG_LIVESTOCK_OPTIONS)[number]

const AG_VAR_DEFAULT = 'etr'

export function useAgToolsState() {
  const [station, setStation] = useQueryState('s', parseAsString)
  const [variable, setVariable] = useQueryState(
    'var',
    parseAsString.withDefault(AG_VAR_DEFAULT),
  )
  const [crop, setCrop] = useQueryState('crop', parseAsString.withDefault('wheat'))
  const [gddLo, setGddLo] = useQueryState('gdd_lo', parseAsString)
  const [gddHi, setGddHi] = useQueryState('gdd_hi', parseAsString)
  const [time, setTime] = useQueryState(
    'ag_time',
    parseAsStringEnum<AgTime>(AG_TIME_OPTIONS as unknown as AgTime[]).withDefault('daily'),
  )
  const [livestock, setLivestock] = useQueryState(
    'lt',
    parseAsStringEnum<AgLivestock>(
      AG_LIVESTOCK_OPTIONS as unknown as AgLivestock[],
    ).withDefault('adult'),
  )
  const [soilVar, setSoilVar] = useQueryState(
    'soilv',
    parseAsString.withDefault('soil_vwc'),
  )
  const [annualVar, setAnnualVar] = useQueryState('annv', parseAsString)
  const [from, setFrom] = useQueryState('ag_from', parseAsString)
  const [to, setTo] = useQueryState('ag_to', parseAsString)

  return {
    station,
    setStation,
    variable,
    setVariable,
    crop,
    setCrop,
    gddLo,
    setGddLo,
    gddHi,
    setGddHi,
    time,
    setTime,
    livestock,
    setLivestock,
    soilVar,
    setSoilVar,
    annualVar,
    setAnnualVar,
    from,
    setFrom,
    to,
    setTo,
  }
}

/* -------------------------------------------------------------------------- */
/* Data Downloader tab state                                                   */
/* -------------------------------------------------------------------------- */

const DL_PERIOD_OPTIONS = ['monthly', 'daily', 'hourly'] as const
type DlPeriod = (typeof DL_PERIOD_OPTIONS)[number]

export function useDownloaderState() {
  const [station, setStation] = useQueryState('s', parseAsString)
  const [elements, setElements] = useQueryState(
    'els',
    parseAsArrayOf(parseAsString, ',').withDefault([]),
  )
  const [showUncommon, setShowUncommon] = useQueryState(
    'pub',
    parseAsBoolean.withDefault(false),
  )
  const [removeFlagged, setRemoveFlagged] = useQueryState(
    'rmna',
    parseAsBoolean.withDefault(false),
  )
  const [period, setPeriod] = useQueryState(
    'period',
    parseAsStringEnum<DlPeriod>(
      DL_PERIOD_OPTIONS as unknown as DlPeriod[],
    ).withDefault('daily'),
  )
  const [from, setFrom] = useQueryState('dl_from', parseAsString)
  const [to, setTo] = useQueryState('dl_to', parseAsString)

  return {
    station,
    setStation,
    elements,
    setElements,
    showUncommon,
    setShowUncommon,
    removeFlagged,
    setRemoveFlagged,
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
  }
}

/* -------------------------------------------------------------------------- */
/* Satellite tab state                                                         */
/* -------------------------------------------------------------------------- */

const SAT_MODE_OPTIONS = ['ts', 'cmp'] as const
type SatMode = (typeof SAT_MODE_OPTIONS)[number]
const DEFAULT_SAT_VARS = ['ET', 'GPP', 'NDVI']

export function useSatelliteState() {
  const [station, setStation] = useQueryState('s', parseAsString)
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum<SatMode>(
      SAT_MODE_OPTIONS as unknown as SatMode[],
    ).withDefault('ts'),
  )
  const [percentiles, setPercentiles] = useQueryState(
    'pct',
    parseAsBoolean.withDefault(true),
  )
  const [vars, setVars] = useQueryState(
    'sat_vars',
    parseAsArrayOf(parseAsString, ',').withDefault(DEFAULT_SAT_VARS),
  )
  const [cmpX, setCmpX] = useQueryState('cmpx', parseAsString)
  const [cmpY, setCmpY] = useQueryState('cmpy', parseAsString)
  const [from, setFrom] = useQueryState('sat_from', parseAsString)
  const [to, setTo] = useQueryState('sat_to', parseAsString)

  return {
    station,
    setStation,
    mode,
    setMode,
    percentiles,
    setPercentiles,
    vars,
    setVars,
    cmpX,
    setCmpX,
    cmpY,
    setCmpY,
    from,
    setFrom,
    to,
    setTo,
  }
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
 * Pure part of the migration. Given a query string (with or without `?`) and
 * the hash tab (with or without `#`), rename each legacy key to the tab's key
 * when the new key is absent. Returns the new query string (`?…` or `''`), or
 * `null` when nothing changed.
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
 * Rewrite the current URL in place (replaceState) if it carries legacy keys
 * for the active tab. Call once, before nuqs first reads the location.
 */
export function migrateLegacyUrlState(): void {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  const next = migrateLegacySearch(search, hash)
  if (next === null) return
  window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`)
}
