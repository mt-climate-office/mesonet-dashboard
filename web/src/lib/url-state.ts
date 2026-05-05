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
    'time',
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
  const [from, setFrom] = useQueryState('from', parseAsString)
  const [to, setTo] = useQueryState('to', parseAsString)

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
  const [from, setFrom] = useQueryState('from', parseAsString)
  const [to, setTo] = useQueryState('to', parseAsString)

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
    'vars',
    parseAsArrayOf(parseAsString, ',').withDefault(DEFAULT_SAT_VARS),
  )
  const [cmpX, setCmpX] = useQueryState('cmpx', parseAsString)
  const [cmpY, setCmpY] = useQueryState('cmpy', parseAsString)
  const [from, setFrom] = useQueryState('from', parseAsString)
  const [to, setTo] = useQueryState('to', parseAsString)

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
