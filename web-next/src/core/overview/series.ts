/**
 * The Now overview's one hourly request (72 h, QC level 2) turned into what
 * the tiles need: per-variable 48 h series for the sparklines, today's air
 * temperature high/low, and precipitation sums for stations without the
 * `/derived/ppt/` summary. Times are Denver wall-clock ms (core/sensorEvents).
 */
import type { ObservationRow } from '../api'
import { parseWallClock } from '../sensorEvents'
import type { SparkSeries } from '../charts/sparkline'

/** Sparkline keys, one per tile that has one. */
export type SeriesKey = 'air' | 'rh' | 'wind' | 'ppt' | 'solar' | 'pressure' | 'soil' | 'snow' | 'vpd'

/** Element codes for the request: the base set, plus the optional ones the station reports now. */
export const SPARK_ELEMENTS = ['air_temp', 'rh', 'wind_spd', 'ppt', 'sol_rad', 'soil_vwc', 'bp'] as const
/** [element code, `/latest` column prefix that shows the station reports it]. */
export const OPTIONAL_SPARK_ELEMENTS = [
  ['snow_depth', 'Snow Depth'],
  ['vpd_atmo', 'VPD'],
] as const

const HOUR = 3_600_000
export const SPARK_WINDOW_MS = 48 * HOUR

/**
 * The one hourly request behind every sparkline: from local midnight two days
 * before `today` (so ≥ 48 h, ≤ 72 h of rows), level 2, the base elements plus
 * snow depth / VPD when the station's `/latest` row has them. `key` encodes
 * every input (ARCHITECTURE "Data flow").
 */
export function sparkQuery(station: string, today: string, latest: Record<string, unknown>) {
  const cols = Object.keys(latest)
  const optional = OPTIONAL_SPARK_ELEMENTS.filter(([, prefix]) => cols.some((c) => c.startsWith(prefix))).map(([e]) => e)
  const elements = [...SPARK_ELEMENTS, ...optional].join(',')
  const [y, m, d] = today.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d - 2)).toISOString().slice(0, 10)
  return {
    key: `obs:${station}:hourly:${start}:-:${elements}:l2`,
    query: { station, start, period: 'hourly' as const, elements, level: 2 as const },
  }
}

/** Column (LAB_SWAP-renamed) → key; soil uses the shallowest VWC column present. */
function keyFor(col: string): SeriesKey | null {
  if (col === 'Air Temperature [°F]') return 'air'
  if (col === 'Relative Humidity [%]') return 'rh'
  if (col.startsWith('Wind Speed')) return 'wind'
  if (col === 'Precipitation [in]') return 'ppt'
  if (col.startsWith('Solar Radiation')) return 'solar'
  if (col.startsWith('Atmospheric Pressure')) return 'pressure'
  if (col.startsWith('Snow Depth')) return 'snow'
  if (col.startsWith('VPD')) return 'vpd'
  return null
}

const soilDepth = (col: string): number | null => {
  const m = /^Soil VWC @ (\d+) in \[/.exec(col)
  return m ? Number(m[1]) : null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

type Timed = { t: number; date: string; row: ObservationRow }

/** Rows with their wall-clock ms and local date, ascending; unparseable stamps dropped. */
function timed(rows: readonly ObservationRow[]): Timed[] {
  const out: Timed[] = []
  for (const row of rows) {
    const t = parseWallClock(row.datetime)
    if (t !== null) out.push({ t, date: String(row.datetime).slice(0, 10), row })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** The last 48 h (ending at the newest row) of every variable present, keyed by tile. */
export function sparkSeries(rows: readonly ObservationRow[]): Partial<Record<SeriesKey, SparkSeries>> {
  const all = timed(rows)
  if (!all.length) return {}
  const end = all[all.length - 1].t
  const win = all.filter((r) => r.t > end - SPARK_WINDOW_MS)
  const cols = Object.keys(win[0].row)
  const soilCol = cols
    .filter((c) => soilDepth(c) !== null)
    .sort((a, b) => (soilDepth(a) ?? 0) - (soilDepth(b) ?? 0))[0]
  const out: Partial<Record<SeriesKey, SparkSeries>> = {}
  const t = win.map((r) => r.t)
  for (const col of cols) {
    const key = col === soilCol ? 'soil' : keyFor(col)
    if (!key || out[key]) continue
    const v = win.map((r) => num(r.row[col]))
    if (v.some((x) => x !== null)) out[key] = { t, v }
  }
  return out
}

/** Today's (local date `today`, YYYY-MM-DD) hourly air temperature max/min, or null. */
export function todayHighLow(rows: readonly ObservationRow[], today: string): { hi: number; lo: number } | null {
  const temps = timed(rows)
    .filter((r) => r.date === today)
    .map((r) => num(r.row['Air Temperature [°F]']))
    .filter((v): v is number => v !== null)
  return temps.length ? { hi: Math.max(...temps), lo: Math.min(...temps) } : null
}

/** Hourly precipitation sums: since local midnight of `today`, and the last 24 rows' hours. Null without ppt. */
export function hourlyPrecip(rows: readonly ObservationRow[], today: string): { sinceMidnight: number; last24h: number } | null {
  const all = timed(rows).filter((r) => num(r.row['Precipitation [in]']) !== null)
  if (!all.length) return null
  const end = all[all.length - 1].t
  const sum = (xs: typeof all) => xs.reduce((a, r) => a + (r.row['Precipitation [in]'] as number), 0)
  return {
    sinceMidnight: sum(all.filter((r) => r.date === today)),
    last24h: sum(all.filter((r) => r.t > end - 24 * HOUR)),
  }
}
