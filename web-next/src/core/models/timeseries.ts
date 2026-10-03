/**
 * Latest tab station timeseries, as a renderer-free model: which panels to
 * draw, each panel's series, normals overlay, sensor-change spans and empty
 * states. Extracted from web/src/components/charts/StationTimeseriesChart.tsx;
 * the ECharts builder in core/charts turns this into an option.
 *
 * Time: every x is Denver wall-clock ms (the API's local reading parsed as if
 * UTC, the core/sensorEvents convention). Charts set `useUTC: true` so axis
 * labels read in Mountain Time with no time-zone library.
 */
import dayjs from 'dayjs'
import { denverDay } from '../today'
import type { ObservationRow } from '../api'
import { insertGaps } from '../gaps'
import { mergeNormals, type StationNormals } from '../normals'
import {
  depthLabelFromColumn,
  latestAxisTitle,
  latestElementCodes,
  latestVariableForColumn,
  latestVarsFromElements,
} from '../params'
import {
  parseWallClock,
  sensorEventText,
  sensorEventsForSubplot,
  type ConfigRow,
  type SubplotKind,
} from '../sensorEvents'
import type { LatestAgg } from '../url-schema'

/** Default window: the last 14 days (legacy). */
export const DEFAULT_WINDOW_DAYS = 14

/** Variables that have gridMET normals (daily aggregation only). */
export const NORMALS_VARS = ['Precipitation', 'Reference ET', 'Air Temperature', 'Relative Humidity'] as const

/** Legacy make_nodata_figure texts (app.py render_station_plot). */
export const NO_DATA_TITLE = 'No data available for selected station and dates'
export const NO_DATA_HINT = 'Either change the date range or select a new station.'

const SOIL_VARS = new Set(['Soil Temperature', 'Soil VWC', 'Bulk EC'])

/** "YYYY-MM-DD" that parses; malformed ?from/?to are treated as no data. */
export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid()

/* -------------------------------------------------------------------------- */
/* Request planning                                                            */
/* -------------------------------------------------------------------------- */

type ElementRow = { element: string; description_short: string }

/**
 * The selection filtered to what the station offers, in selection order
 * (legacy update_select_vars). Before the element list loads, the selection
 * passes through unchanged.
 */
export function availableVars(selection: readonly string[], stationElements?: readonly ElementRow[]): string[] {
  if (!stationElements) return [...selection]
  const have = new Set(latestVarsFromElements(stationElements))
  return selection.filter((v) => have.has(v))
}

export interface WindowPlan {
  /** Inclusive local dates, YYYY-MM-DD. */
  start: string
  end: string
  valid: boolean
}

/**
 * The chart window from `?from`/`?to` (null = default 14 days ending today,
 * local). `today` is injectable for tests.
 */
export function chartWindow(from: string | null, to: string | null, today = denverDay()): WindowPlan {
  const start = from ?? today.subtract(DEFAULT_WINDOW_DAYS, 'day').format('YYYY-MM-DD')
  const end = to ?? today.format('YYYY-MM-DD')
  return { start, end, valid: isIsoDate(start) && isIsoDate(end) && start <= end }
}

/** Element codes + ETr flag for one request over `vars` (see latestElementCodes). */
export function requestElements(vars: readonly string[], stationElements?: readonly ElementRow[]) {
  return {
    elements: latestElementCodes(vars, stationElements).join(','),
    hasEtr: vars.includes('Reference ET'),
  }
}

/* -------------------------------------------------------------------------- */
/* Empty states                                                                */
/* -------------------------------------------------------------------------- */

export type TimeseriesEmpty =
  | { kind: 'no-vars'; title: 'No variables selected' }
  | { kind: 'no-station'; title: 'Select Station'; hint: string }
  | { kind: 'not-found'; title: 'Station not found.' }
  | { kind: 'no-data'; title: typeof NO_DATA_TITLE; hint: typeof NO_DATA_HINT }

export interface EmptyInput {
  /** Raw selection (`latestVars(url)`), before station filtering. */
  selection: readonly string[]
  /** `availableVars(...)` result, or null while the element list loads. */
  available: readonly string[] | null
  /** Raw `?s=`. */
  param: string | null
  /** `confirmedStation(...)`. */
  station: string | null
  catalogLoaded: boolean
  windowValid: boolean
}

/**
 * Which empty state to show before data, or null to proceed (legacy order:
 * "No variables selected" wins over the station check). A null `station`
 * with an unloaded catalog is "still loading", not an empty state.
 */
export function emptyState(i: EmptyInput): TimeseriesEmpty | null {
  if (i.selection.length === 0 || (i.station && i.available && i.available.length === 0)) {
    return { kind: 'no-vars', title: 'No variables selected' }
  }
  if (!i.param) {
    return { kind: 'no-station', title: 'Select Station', hint: 'To get started, select a station from the dropdown or the map.' }
  }
  if (!i.station) return i.catalogLoaded ? { kind: 'not-found', title: 'Station not found.' } : null
  if (!i.windowValid) return noData()
  return null
}

export const noData = (): TimeseriesEmpty => ({ kind: 'no-data', title: NO_DATA_TITLE, hint: NO_DATA_HINT })

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

export interface TimeseriesSeries {
  /** Full column name, e.g. "Soil VWC @ 2 in [%]". */
  name: string
  type: 'line' | 'bar'
  /** Soil depth label ("4 in") for soil panels, else null. Palette key. */
  depth: string | null
  /** Aligned with `TimeseriesModel.x`; null = gap or missing. */
  values: (number | null)[]
  /** Legacy hover label ("Precipitation Total", the variable, or the column). */
  hoverLabel: string
  /** Daily views of the variable page: each day's true low and high, aligned with `values` (core/variables/band). */
  band?: { lo: (number | null)[]; hi: (number | null)[] }
}

export type NormalsOverlay =
  /** Line variables: shaded min–max band. */
  | { kind: 'band'; min: (number | null)[]; max: (number | null)[]; label: string }
  /** Bar variables (precip, ETr): 25th / median / 75th markers. */
  | { kind: 'markers'; p25: (number | null)[]; median: (number | null)[]; p75: (number | null)[] }

export interface SensorSpan {
  /** Wall-clock ms. */
  x0: number
  x1: number
  /** Legacy hover text (contains `<br>` separators). */
  text: string
}

export interface TimeseriesPanel {
  /** Display variable, e.g. "Air Temperature". Palette key. */
  variable: string
  /** Legacy axis title (may carry `<br>` / `<sup>` markup from params). */
  axisTitle: string
  isSoil: boolean
  /** Variable selected but no column had a value: draw the panel with a note. */
  noData: boolean
  /** Fixed y range (Snow Depth: 0 … ≥ 1), else null for auto. */
  yRange: [number, number] | null
  /** Show a legend: line panels with more than one column (not soil). */
  legend: boolean
  series: TimeseriesSeries[]
  normals: NormalsOverlay | null
  sensorSpans: SensorSpan[]
}

export interface TimeseriesModel {
  /** Wall-clock ms per row, gap rows included (shared by every panel). */
  x: number[]
  /** Legacy forced x range: [first day − 1, last day + 1], wall-clock ms. */
  xRange: [number, number] | null
  panels: TimeseriesPanel[]
}

export interface TimeseriesInput {
  rows: readonly ObservationRow[]
  /** `availableVars(...)`, in display order. */
  vars: readonly string[]
  period: LatestAgg
  /** Per-variable normals (only when `gridmet` is on and period is daily). */
  normalsByVar?: Readonly<Record<string, StationNormals | null>>
  /** `explodeInstruments(config.instruments)`. */
  sensorConfig?: readonly ConfigRow[]
  /** Wall-clock "now" for open-ended outages (tests). */
  now?: number
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Build the panel model; null when there are no rows or no variables. */
export function buildTimeseriesModel(input: TimeseriesInput): TimeseriesModel | null {
  const { rows, vars, period } = input
  if (rows.length === 0 || vars.length === 0) return null
  // Null rows wherever the API skipped an observation, so lines break there.
  const gapped = insertGaps([...rows])
  const x = gapped.map((r) => parseWallClock(r.datetime) ?? NaN)

  const columnsByVar = new Map<string, string[]>()
  for (const col of Object.keys(gapped[0])) {
    if (col === 'station' || col === 'datetime') continue
    const v = latestVariableForColumn(col)
    if (!v || !vars.includes(v)) continue
    if (!gapped.some((r) => isNum((r as Record<string, unknown>)[col]))) continue
    const list = columnsByVar.get(v) ?? []
    if (!list.includes(col)) list.push(col)
    columnsByVar.set(v, list)
  }

  const days = gapped.map((r) => String(r.datetime).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  const dayMs = (d: string, delta: number) => Date.parse(`${d}T00:00:00Z`) + delta * 86_400_000
  const xRange: [number, number] | null = days.length ? [dayMs(days[0], -1), dayMs(days[days.length - 1], 1)] : null

  const panels = vars.map((v) =>
    buildPanel(v, columnsByVar.get(v) ?? [], gapped, rows, period, input),
  )
  return { x, xRange, panels }
}

function buildPanel(
  variable: string,
  cols: string[],
  gapped: ObservationRow[],
  rawRows: readonly ObservationRow[],
  period: LatestAgg,
  input: TimeseriesInput,
): TimeseriesPanel {
  const isSoil = SOIL_VARS.has(variable)
  const isPpt = variable === 'Precipitation'
  const isEtr = variable === 'Reference ET'
  const noData = cols.length === 0
  // Soil columns shallow → deep.
  const sorted = isSoil
    ? [...cols].sort((a, b) => parseInt(depthLabelFromColumn(a) ?? '0', 10) - parseInt(depthLabelFromColumn(b) ?? '0', 10))
    : cols
  const valuesOf = (col: string) => gapped.map((r) => {
    const v = (r as Record<string, unknown>)[col]
    return typeof v === 'number' ? v : null
  })
  const series: TimeseriesSeries[] = sorted.map((col) => ({
    name: col,
    type: isPpt || isEtr ? 'bar' : 'line',
    depth: isSoil ? depthLabelFromColumn(col) : null,
    values: valuesOf(col),
    hoverLabel: isPpt ? 'Precipitation Total' : isEtr ? 'Reference ET Total' : isSoil ? variable : col,
  }))

  let normals: NormalsOverlay | null = null
  const norms = input.normalsByVar?.[variable]
  if (norms && !noData) {
    const merged = mergeNormals(gapped, norms)
    if (merged.some((r) => r.mn !== null || r.mx !== null || r.avg !== null)) {
      normals = isPpt || isEtr
        ? { kind: 'markers', p25: merged.map((r) => r.mn), median: merged.map((r) => r.avg), p75: merged.map((r) => r.mx) }
        : { kind: 'band', min: merged.map((r) => r.mn), max: merged.map((r) => r.mx), label: sorted[0] ?? variable }
    }
  }

  // Sensor added/removed/outage spans (legacy plot_met/soil/ppt; ETr has none).
  let sensorSpans: SensorSpan[] = []
  if (!isEtr && !noData && input.sensorConfig?.length) {
    const kind: SubplotKind = isSoil ? 'soil' : isPpt ? 'ppt' : 'met'
    sensorSpans = sensorEventsForSubplot({
      kind,
      columns: cols,
      config: input.sensorConfig,
      rows: rawRows as ReadonlyArray<Record<string, unknown>>,
      now: input.now,
    }).map((e) => ({ x0: e.x0, x1: e.x1, text: sensorEventText(e) }))
  }

  let yRange: [number, number] | null = null
  if (variable === 'Snow Depth' && !noData) {
    let hi = -Infinity
    for (const s of series) for (const v of s.values) if (v !== null && v > hi) hi = v
    yRange = [0, Math.max(1, hi)]
  }

  return {
    variable,
    axisTitle: latestAxisTitle(variable, period),
    isSoil,
    noData,
    yRange,
    legend: !isSoil && !isPpt && !isEtr && sorted.length > 1,
    series,
    normals,
    sensorSpans,
  }
}

/** Legacy empty-panel note: "<variable> data are not available for this time period." */
export const panelNoDataText = (variable: string): string =>
  `${variable} data are not available for this time period.`
