/**
 * Raw-observation adapters for Ag Tools: Mesonet v2 `/observations/*` CSV →
 * contract `DailyMet` / `HourlyMet` / `SoilSeries` / `StationMeta`.
 *
 * Split into pure converters (`parse*`, unit-tested against
 * `features/ag/__fixtures__`) and thin fetchers (`fetch*`).
 *
 *  - Requests use API default units (US) and convert to SI here.
 *  - `end` is inclusive in every query; it is sent as `exclusiveEnd(end)`.
 *  - The time axis is made gap-free between the first and last returned
 *    rows (daily: every local date; hourly: every UTC hour). Filled rows are
 *    all-null with `provisional=false`.
 *  - A station lacking a sensor simply has no column for it (the API omits
 *    unknown elements when others are present) → that input is all-null.
 *    A 404 "No data available" (nothing at all) → an empty series.
 */
import { HttpError, fetchText } from '../../api/http'
import { exclusiveEnd } from '../../api/record'
import type { Station, StationElement } from '../../api/types'
import type {
  DailyMet,
  HourlyMet,
  LocalDate,
  Network,
  Nullable,
  QcLevel,
  SoilSeries,
  StationMeta,
} from '../contract'
import {
  type AggName,
  type ParsedHeader,
  type RawRow,
  addDays,
  denverLocal,
  denverMidnight,
  depthCm,
  parseApiDatetime,
  parseCsvRaw,
  parseHeader,
  toBool,
  toNum,
  toSi,
} from './parse'

/* ---------------------------------------------------------------- query */

export interface ObsQuery {
  station: string
  /** Inclusive local start date, `YYYY-MM-DD`. */
  start: LocalDate
  /** Inclusive local end date, `YYYY-MM-DD`. */
  end: LocalDate
  /** QC level; Ag Tools default to 2 (what `/derived` uses). */
  level?: QcLevel
}

export interface ApiRequest {
  path: string
  query: Record<string, string | number | boolean>
}

export const DEFAULT_AG_LEVEL: QcLevel = 2

/** `/observations/daily` inputs for ETo/GDD/CCI/feels-like (fixture-identical). */
export const DAILY_MET_ELEMENTS = {
  elements: ['air_temp', 'air_temp', 'air_temp', 'rh', 'rh', 'rh', 'sol_rad', 'wind_spd'],
  agg_func: ['min', 'max', 'avg', 'min', 'max', 'avg', 'avg', 'avg'],
} as const

export const HOURLY_MET_ELEMENTS = {
  elements: ['air_temp', 'rh', 'sol_rad', 'wind_spd'],
  agg_func: ['avg'],
} as const

export const SOIL_ELEMENTS = {
  // soil_ec_blk feeds the Soil Profile heatmap's EC view; stations without
  // EC simply omit the columns (→ all-null `ecMsCm`).
  elements: ['soil_vwc', 'soil_temp', 'soil_ec_blk'],
  agg_func: ['avg'],
} as const

function obsRequest(
  period: 'daily' | 'hourly',
  q: ObsQuery,
  spec: { elements: readonly string[]; agg_func: readonly string[] },
): ApiRequest {
  return {
    path: `observations/${period}/`,
    query: {
      stations: q.station,
      start_time: q.start,
      end_time: exclusiveEnd(q.end),
      level: q.level ?? DEFAULT_AG_LEVEL,
      elements: spec.elements.join(','),
      agg_func: spec.agg_func.join(','),
    },
  }
}

export const dailyMetRequest = (q: ObsQuery) => obsRequest('daily', q, DAILY_MET_ELEMENTS)
export const hourlyMetRequest = (q: ObsQuery) => obsRequest('hourly', q, HOURLY_MET_ELEMENTS)
export const soilRequest = (q: ObsQuery, period: 'daily' | 'hourly') =>
  obsRequest(period, q, SOIL_ELEMENTS)

/* ---------------------------------------------------------- column index */

interface Column {
  header: string
  parsed: ParsedHeader
}

function indexColumns(rows: RawRow[]): Column[] {
  if (rows.length === 0) return []
  const out: Column[] = []
  for (const header of Object.keys(rows[0])) {
    const parsed = parseHeader(header)
    if (parsed) out.push({ header, parsed })
  }
  return out
}

function findColumn(cols: Column[], name: string, agg: AggName | null): Column | undefined {
  return cols.find((c) => c.parsed.name === name && c.parsed.agg === agg)
}

/* ------------------------------------------------------------ time frame */

interface Frame {
  /** Row per output index, or undefined for a filled gap. */
  rows: (RawRow | undefined)[]
  epochMs: number[]
  date: LocalDate[]
  dateTime: string[]
}

const HOUR = 3_600_000

function rowEpoch(r: RawRow): number {
  return parseApiDatetime(r.datetime ?? r.index ?? '')
}

/** Daily frame keyed by local date, gap-filled first → last. */
function dailyFrame(rows: RawRow[]): Frame {
  const byDate = new Map<LocalDate, { row: RawRow; t: number }>()
  for (const r of rows) {
    const t = rowEpoch(r)
    byDate.set(denverLocal(t).date, { row: r, t })
  }
  const dates = [...byDate.keys()].sort()
  const frame: Frame = { rows: [], epochMs: [], date: [], dateTime: [] }
  if (dates.length === 0) return frame
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) {
    const hit = byDate.get(d)
    frame.rows.push(hit?.row)
    const t = hit?.t ?? denverMidnight(d)
    frame.epochMs.push(t)
    frame.date.push(d)
    frame.dateTime.push(`${d}T00:00`)
  }
  return frame
}

/** Hourly frame on the UTC hour grid, gap-filled first → last (DST-safe). */
function hourlyFrame(rows: RawRow[]): Frame {
  const byT = new Map<number, RawRow>()
  for (const r of rows) byT.set(rowEpoch(r), r)
  const ts = [...byT.keys()].sort((a, b) => a - b)
  const frame: Frame = { rows: [], epochMs: [], date: [], dateTime: [] }
  if (ts.length === 0) return frame
  for (let t = ts[0]; t <= ts[ts.length - 1]; t += HOUR) {
    const loc = denverLocal(t)
    frame.rows.push(byT.get(t))
    frame.epochMs.push(t)
    frame.date.push(loc.date)
    frame.dateTime.push(loc.dateTime)
  }
  return frame
}

function pluck(frame: Frame, col: Column | undefined): Nullable[] {
  if (!col) return frame.rows.map(() => null)
  const conv = toSi(col.parsed.unit)
  return frame.rows.map((r) => {
    const v = r ? toNum(r[col.header]) : null
    return v === null ? null : conv(v)
  })
}

const provisionalOf = (frame: Frame) =>
  frame.rows.map((r) => (r ? toBool(r.provisional) : false))

/* ------------------------------------------------------------ converters */

export interface SeriesMeta {
  station: string
  level: QcLevel
}

/** `/observations/daily` (min/max/avg air_temp, rh; avg sol_rad, wind_spd) → DailyMet. */
export function parseDailyMet(rows: RawRow[], meta: SeriesMeta): DailyMet {
  const cols = indexColumns(rows)
  const f = dailyFrame(rows)
  return {
    station: meta.station,
    level: meta.level,
    provisional: provisionalOf(f),
    date: f.date,
    tminC: pluck(f, findColumn(cols, 'Air Temperature', 'Minimum')),
    tmaxC: pluck(f, findColumn(cols, 'Air Temperature', 'Maximum')),
    tavgC: pluck(f, findColumn(cols, 'Air Temperature', 'Average')),
    rhMin: pluck(f, findColumn(cols, 'Relative Humidity', 'Minimum')),
    rhMax: pluck(f, findColumn(cols, 'Relative Humidity', 'Maximum')),
    rhAvg: pluck(f, findColumn(cols, 'Relative Humidity', 'Average')),
    sradWm2: pluck(f, findColumn(cols, 'Solar Radiation', 'Average')),
    windMs: pluck(f, findColumn(cols, 'Wind Speed', 'Average')),
  }
}

/** `/observations/hourly` (avg air_temp, rh, sol_rad, wind_spd) → HourlyMet. */
export function parseHourlyMet(rows: RawRow[], meta: SeriesMeta): HourlyMet {
  const cols = indexColumns(rows)
  const f = hourlyFrame(rows)
  const col = (name: string) => findColumn(cols, name, 'Average') ?? findColumn(cols, name, null)
  return {
    station: meta.station,
    level: meta.level,
    provisional: provisionalOf(f),
    time: f.dateTime,
    epochMs: f.epochMs,
    tC: pluck(f, col('Air Temperature')),
    rh: pluck(f, col('Relative Humidity')),
    sradWm2: pluck(f, col('Solar Radiation')),
    windMs: pluck(f, col('Wind Speed')),
  }
}

/** `/observations/{daily,hourly}` soil_vwc + soil_temp + soil_ec_blk (avg) → SoilSeries. */
export function parseSoilSeries(
  rows: RawRow[],
  meta: SeriesMeta & { period: 'daily' | 'hourly' },
): SoilSeries {
  const cols = indexColumns(rows)
  const f = meta.period === 'daily' ? dailyFrame(rows) : hourlyFrame(rows)
  const vwc = new Map<number, Column>()
  const temp = new Map<number, Column>()
  const ec = new Map<number, Column>()
  for (const c of cols) {
    if (c.parsed.agg !== 'Average' && c.parsed.agg !== null) continue
    const d = depthCm(c.parsed)
    if (d === null) continue
    if (c.parsed.name === 'Soil VWC') vwc.set(d, c)
    else if (c.parsed.name === 'Soil Temperature') temp.set(d, c)
    else if (c.parsed.name === 'Bulk EC') ec.set(d, c)
  }
  const depthsCm = [...new Set([...vwc.keys(), ...temp.keys()])].sort((a, b) => a - b)
  return {
    station: meta.station,
    level: meta.level,
    provisional: provisionalOf(f),
    depthsCm,
    time: meta.period === 'daily' ? f.date : f.dateTime,
    epochMs: f.epochMs,
    vwcPct: depthsCm.map((d) => pluck(f, vwc.get(d))),
    tempC: depthsCm.map((d) => pluck(f, temp.get(d))),
    ecMsCm: depthsCm.map((d) => pluck(f, ec.get(d))),
  }
}

/** Anemometer height from a station's element list (`wind_spd_1000` / `_0244`). */
export function windHeightFromElements(
  elements: Pick<StationElement, 'element'>[],
  network: Network,
): 10 | 2.44 {
  const codes = new Set(elements.map((e) => e.element))
  if (codes.has('wind_spd_0244')) return 2.44
  if (codes.has('wind_spd_1000')) return 10
  return network === 'AgriMet' ? 2.44 : 10
}

/** `/stations` row + `/elements/{station}/` → StationMeta. */
export function parseStationMeta(
  station: Pick<
    Station,
    'station' | 'latitude' | 'longitude' | 'elevation' | 'sub_network' | 'has_swp' | 'date_installed'
  >,
  elements: Pick<StationElement, 'element'>[],
): StationMeta {
  const network: Network = station.sub_network === 'AgriMet' ? 'AgriMet' : 'HydroMet'
  return {
    id: station.station,
    lat: Number(station.latitude),
    lon: Number(station.longitude),
    elevationM: Number(station.elevation),
    network,
    windHeightM: windHeightFromElements(elements, network),
    hasSwp: toBool(station.has_swp),
    installed: String(station.date_installed ?? '').slice(0, 10),
  }
}

/* --------------------------------------------------------------- fetchers */

/**
 * The API's specific "nothing matched" 404 details. FastAPI's generic
 * `{"detail":"Not Found"}` (wrong route, unknown station) is NOT no-data.
 */
const NO_DATA_DETAIL = /No data available|Element '[^']+' not found/

/** True for the API's "nothing matched" 404 (as opposed to a bad request). */
export function isNoData(err: unknown): boolean {
  return (
    err instanceof HttpError &&
    err.status === 404 &&
    NO_DATA_DETAIL.test(err.message)
  )
}

/** GET a CSV request; "no data" 404 → []. */
export async function fetchRows(req: ApiRequest): Promise<RawRow[]> {
  try {
    return parseCsvRaw(await fetchText(req.path, { ...req.query, type: 'csv' }))
  } catch (err) {
    if (isNoData(err)) return []
    throw err
  }
}

const levelOf = (q: ObsQuery) => q.level ?? DEFAULT_AG_LEVEL

export async function fetchDailyMet(q: ObsQuery): Promise<DailyMet> {
  return parseDailyMet(await fetchRows(dailyMetRequest(q)), {
    station: q.station,
    level: levelOf(q),
  })
}

export async function fetchHourlyMet(q: ObsQuery): Promise<HourlyMet> {
  return parseHourlyMet(await fetchRows(hourlyMetRequest(q)), {
    station: q.station,
    level: levelOf(q),
  })
}

export async function fetchSoilSeries(
  q: ObsQuery & { period: 'daily' | 'hourly' },
): Promise<SoilSeries> {
  return parseSoilSeries(await fetchRows(soilRequest(q, q.period)), {
    station: q.station,
    level: levelOf(q),
    period: q.period,
  })
}

/**
 * StationMeta from `/stations` (lat/lon 2 dp, elevation m) and
 * `/elements/{station}/` (wind height). Pass `stations` to reuse an
 * already-loaded catalog (e.g. from `useStations`).
 */
export async function fetchStationMeta(
  station: string,
  stations?: Station[],
): Promise<StationMeta> {
  const [catalog, elements] = await Promise.all([
    stations ? Promise.resolve(stations) : fetchRows({ path: 'stations/', query: {} }),
    fetchRows({ path: `elements/${station}/`, query: {} }),
  ])
  const row = (catalog as unknown as Station[]).find((s) => s.station === station)
  if (!row) throw new Error(`Unknown station: ${station}`)
  return parseStationMeta(row, elements as unknown as StationElement[])
}
