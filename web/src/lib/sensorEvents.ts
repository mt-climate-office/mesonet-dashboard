/**
 * Sensor-change overlays for the Latest Data chart: sensor added/replaced,
 * sunset/removed, and reported outages, built from `/config/{station}/`
 * instruments. Port of the legacy `_build_sensor_events`,
 * `_filter_outage_events_to_metric_na` and `_add_sensor_event_overlays`
 * (app/mdb/utils/plotting.py on main, including 5afb746f: an outage ends when
 * its sensor is replaced).
 *
 * Times are "wall-clock milliseconds" in America/Denver: the wall-clock
 * reading parsed as if it were UTC. Plotly draws date strings at their wall
 * clock and ignores any offset, and the API already returns Denver-local
 * timestamps, so working in wall-clock space keeps overlays aligned with the
 * traces without a timezone library.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Legacy shifts every config date (local midnight) by +12 h. */
export const EVENT_OFFSET_MS = 12 * HOUR

/**
 * Element code → chart column label (after LAB_SWAP). Port of legacy
 * `params.short_to_long_map`, plus the 28 in (-70 cm) depth, which the new
 * chart plots but the legacy map lacked.
 */
export const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  air_temp_0200: 'Air Temperature [°F]',
  air_temp_0244: 'Air Temperature [°F]',
  ppt: 'Precipitation [in]',
  ppt_max_rate: 'Max Precip Rate [in/h]',
  bp: 'Atmospheric Pressure [mbar]',
  rh: 'Relative Humidity [%]',
  soil_temp_0005: 'Soil Temperature @ 2 in [°F]',
  soil_temp_0010: 'Soil Temperature @ 4 in [°F]',
  soil_temp_0020: 'Soil Temperature @ 8 in [°F]',
  soil_temp_0050: 'Soil Temperature @ 20 in [°F]',
  soil_temp_0070: 'Soil Temperature @ 28 in [°F]',
  soil_temp_0091: 'Soil Temperature @ 36 in [°F]',
  soil_temp_0100: 'Soil Temperature @ 40 in [°F]',
  soil_vwc_0005: 'Soil VWC @ 2 in [%]',
  soil_vwc_0010: 'Soil VWC @ 4 in [%]',
  soil_vwc_0020: 'Soil VWC @ 8 in [%]',
  soil_vwc_0050: 'Soil VWC @ 20 in [%]',
  soil_vwc_0070: 'Soil VWC @ 28 in [%]',
  soil_vwc_0091: 'Soil VWC @ 36 in [%]',
  soil_vwc_0100: 'Soil VWC @ 40 in [%]',
  soil_ec_blk_0005: 'Bulk EC @ 2 in [mS/cm]',
  soil_ec_blk_0010: 'Bulk EC @ 4 in [mS/cm]',
  soil_ec_blk_0020: 'Bulk EC @ 8 in [mS/cm]',
  soil_ec_blk_0050: 'Bulk EC @ 20 in [mS/cm]',
  soil_ec_blk_0070: 'Bulk EC @ 28 in [mS/cm]',
  soil_ec_blk_0091: 'Bulk EC @ 36 in [mS/cm]',
  soil_ec_blk_0100: 'Bulk EC @ 40 in [mS/cm]',
  sol_rad: 'Solar Radiation [W/m²]',
  wind_dir_0244: 'Wind Direction [deg]',
  wind_dir_1000: 'Wind Direction [deg]',
  wind_spd_0244: 'Wind Speed [mi/hr]',
  wind_spd_1000: 'Wind Speed [mi/hr]',
  windgust_0244: 'Gust Speed [mi/hr]',
  windgust_1000: 'Gust Speed [mi/hr]',
  snow_depth: 'Snow Depth [in]',
}

/* -------------------------------------------------------------------------- */
/* Time helpers                                                                */
/* -------------------------------------------------------------------------- */

const WALL_CLOCK_RE =
  /^\s*(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/

/**
 * Parse a date or datetime string to wall-clock ms, ignoring any trailing
 * offset. Returns null for blanks, "None", "NaN" and unparseable values.
 */
export function parseWallClock(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v || /^(none|nan|null|nat)$/i.test(v)) return null
  const m = WALL_CLOCK_RE.exec(v)
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  return Number.isFinite(ms) ? ms : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Wall-clock ms → "YYYY-MM-DD HH:mm:ss" (what Plotly expects). */
export function formatWallClock(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  )
}

/** Wall-clock ms → "YYYY-MM-DD". */
export function formatWallDate(ms: number): string {
  return formatWallClock(ms).slice(0, 10)
}

/** The current America/Denver wall clock, in wall-clock ms. */
export function denverNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
}

/* -------------------------------------------------------------------------- */
/* Config normalisation                                                        */
/* -------------------------------------------------------------------------- */

/** One instrument as `/config/{station}/` returns it; every field is loose. */
export interface RawInstrument {
  date_start?: unknown
  date_end?: unknown
  elements?: unknown
  outage_ranges?: unknown
  [key: string]: unknown
}

/** One (element, deployment) row: the legacy `explode("elements")` frame. */
export interface ConfigRow {
  element: string
  dateStart: string | null
  dateEnd: string | null
  outageRanges: string[][]
}

/** Port of `_normalize_outage_ranges`: list-of-lists of non-blank strings. */
export function normalizeOutageRanges(value: unknown): string[][] {
  let v = value
  if (v === null || v === undefined) return []
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s || /^(none|nan)$/i.test(s)) return []
    try {
      // Python repr ("[['2024-01-01', None]]") → JSON.
      v = JSON.parse(s.replace(/'/g, '"').replace(/\bNone\b/g, 'null'))
    } catch {
      return []
    }
  }
  if (!Array.isArray(v)) return []
  const out: string[][] = []
  for (const item of v) {
    if (!Array.isArray(item)) continue
    const cleaned = item
      .filter((x) => x !== null && x !== undefined && String(x).trim() !== '')
      .map((x) => String(x))
    if (cleaned.length > 0) out.push(cleaned)
  }
  return out
}

const asDateString = (v: unknown): string | null =>
  typeof v === 'string' ? v : null

/**
 * Explode instruments into one row per element, mapping element codes to
 * chart labels with `labelFor` (default: ELEMENT_LABELS, falling back to the
 * code). A few instruments carry parallel `date_start`/`date_end` arrays
 * (one entry per deployment); those become one row per deployment.
 */
export function explodeInstruments(
  instruments: readonly RawInstrument[] | null | undefined,
  labelFor: (code: string) => string = (c) => ELEMENT_LABELS[c] ?? c,
): ConfigRow[] {
  if (!instruments) return []
  const rows: ConfigRow[] = []
  for (const ins of instruments) {
    const elements = Array.isArray(ins.elements)
      ? ins.elements.map(String)
      : ins.elements === null || ins.elements === undefined
        ? ['Unknown Element']
        : [String(ins.elements)]
    const starts = Array.isArray(ins.date_start) ? ins.date_start : [ins.date_start]
    const ends = Array.isArray(ins.date_end) ? ins.date_end : [ins.date_end]
    const n = Math.max(starts.length, ends.length)
    const outageRanges = normalizeOutageRanges(ins.outage_ranges)
    for (let i = 0; i < n; i++) {
      for (const code of elements) {
        rows.push({
          element: labelFor(code),
          dateStart: asDateString(starts[i]),
          dateEnd: asDateString(ends[i]),
          // Outages belong to the instrument, so attach them to its latest
          // deployment only (avoids duplicate overlays for array rows).
          outageRanges: i === n - 1 ? outageRanges : [],
        })
      }
    }
  }
  return rows
}

/* -------------------------------------------------------------------------- */
/* Event building                                                              */
/* -------------------------------------------------------------------------- */

export type SensorEventReason = 'added' | 'removed' | 'outage'

export interface SensorEvent {
  reason: SensorEventReason
  /** Wall-clock ms. */
  x0: number
  x1: number
  /** Sorted, de-duplicated element labels. */
  elements: string[]
  openEnded: boolean
}

export interface BuildOptions {
  dataMin: number
  dataMax?: number | null
  defaultWidthMs: number
  /** Wall-clock "now"; defaults to the current Denver time. */
  now?: number
}

const overlaps = (start: number, end: number, rs: number, re: number) =>
  start <= re && end >= rs

/** Port of `_build_sensor_events` (grouped by reason/x0/x1/open_ended). */
export function buildSensorEvents(
  rows: readonly ConfigRow[],
  { dataMin, dataMax, defaultWidthMs: width, now }: BuildOptions,
): SensorEvent[] {
  if (rows.length === 0 || !Number.isFinite(dataMin)) return []
  const current = now ?? denverNow()
  const max = dataMax ?? current

  interface Raw {
    reason: SensorEventReason
    x0: number
    x1: number
    element: string
    openEnded: boolean
  }
  const events: Raw[] = []

  for (const row of rows) {
    const start = parseWallClock(row.dateStart)
    const startEvent = start === null ? null : start + EVENT_OFFSET_MS
    if (startEvent !== null && overlaps(startEvent, startEvent + width, dataMin, max)) {
      events.push({
        reason: 'added',
        x0: startEvent,
        x1: startEvent + width,
        element: row.element,
        openEnded: false,
      })
    }

    const end = parseWallClock(row.dateEnd)
    const endEvent = end === null ? null : end + EVENT_OFFSET_MS
    if (endEvent !== null && overlaps(endEvent, endEvent + width, dataMin, max)) {
      events.push({
        reason: 'removed',
        x0: endEvent,
        x1: endEvent + width,
        element: row.element,
        openEnded: false,
      })
    }

    for (const outage of row.outageRanges) {
      const oStart = parseWallClock(outage[0])
      const oEnd = outage.length > 1 ? parseWallClock(outage[1]) : null
      if (oStart === null) continue
      const x0 = oStart + EVENT_OFFSET_MS
      let x1 = oEnd !== null ? oEnd + EVENT_OFFSET_MS : current
      // 5afb746f: an outage ends when its sensor is sunset/replaced.
      let cappedBySensorEnd = false
      if (endEvent !== null && endEvent < x1) {
        x1 = endEvent
        cappedBySensorEnd = true
      }
      if (x1 <= x0) {
        if (cappedBySensorEnd && endEvent !== null && endEvent < x0) continue
        x1 = x0 + width
      }
      if (overlaps(x0, x1, dataMin, max)) {
        events.push({
          reason: 'outage',
          x0,
          x1,
          element: row.element,
          openEnded: oEnd === null && !cappedBySensorEnd,
        })
      }
    }
  }

  // groupby(["reason", "x0", "x1", "open_ended"]).element.agg(sorted(set))
  const groups = new Map<string, SensorEvent>()
  for (const e of events) {
    const key = `${e.reason}|${e.x0}|${e.x1}|${e.openEnded}`
    const g = groups.get(key)
    if (g) {
      if (!g.elements.includes(e.element)) g.elements.push(e.element)
    } else {
      groups.set(key, {
        reason: e.reason,
        x0: e.x0,
        x1: e.x1,
        elements: [e.element],
        openEnded: e.openEnded,
      })
    }
  }
  const out = [...groups.values()]
  for (const g of out) {
    g.elements.sort()
    if (g.x1 <= g.x0) g.x1 = g.x0 + width
  }
  // pandas groupby sorts by its keys.
  out.sort(
    (a, b) =>
      a.reason.localeCompare(b.reason) ||
      a.x0 - b.x0 ||
      a.x1 - b.x1 ||
      Number(a.openEnded) - Number(b.openEnded),
  )
  return out
}

/* -------------------------------------------------------------------------- */
/* Outage clipping to missing data                                             */
/* -------------------------------------------------------------------------- */

/** One observation: its wall-clock time and whether any metric column has a value. */
export interface MetricSample {
  t: number
  hasValue: boolean
}

function median(sorted: number[]): number {
  const n = sorted.length
  const mid = Math.floor(n / 2)
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [sorted[0]]
  for (const [s, e] of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged
}

function clip(s: number, e: number, cs: number, ce: number): [number, number] | null {
  const a = Math.max(s, cs)
  const b = Math.min(e, ce)
  return b <= a ? null : [a, b]
}

/** Port of `_metric_na_intervals`: spans in [start, end] with no metric data. */
export function metricNaIntervals(
  samples: readonly MetricSample[],
  start: number,
  end: number,
): Array<[number, number]> {
  const work = samples.filter((s) => Number.isFinite(s.t)).sort((a, b) => a.t - b.t)
  if (work.length === 0) return []
  const dataMin = work[0].t
  const dataMax = work[work.length - 1].t
  const cs = Math.max(start, dataMin)
  const ce = Math.min(end, dataMax)
  if (ce <= cs) return []

  const unique = [...new Set(work.map((s) => s.t))]
  const deltas: number[] = []
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1]
    if (d > 0) deltas.push(d)
  }
  const window = work.filter((s) => s.t >= cs && s.t <= ce)
  if (deltas.length === 0) {
    if (window.length === 0 || !window.some((s) => s.hasValue)) return [[cs, ce]]
    return []
  }
  const cadence = median(deltas.sort((a, b) => a - b))
  if (window.length === 0) return [[cs, ce]]

  const intervals: Array<[number, number]> = []
  for (const s of window) {
    if (s.hasValue) continue
    const c = clip(s.t, s.t + cadence, cs, ce)
    if (c) intervals.push(c)
  }
  const threshold = cadence * 1.5
  for (let i = 1; i < work.length; i++) {
    const prev = work[i - 1].t
    const cur = work[i].t
    if (cur - prev <= threshold) continue
    const c = clip(prev + cadence, cur, cs, ce)
    if (c) intervals.push(c)
  }
  return mergeIntervals(intervals)
}

/**
 * Port of `_filter_outage_events_to_metric_na`: outages are drawn only where
 * the subplot's data is actually missing. Other events pass through.
 */
export function filterOutagesToMissingData(
  events: readonly SensorEvent[],
  samples: readonly MetricSample[],
): SensorEvent[] {
  const out: SensorEvent[] = []
  for (const e of events) {
    if (e.reason !== 'outage') {
      out.push(e)
      continue
    }
    if (e.x1 <= e.x0) continue
    for (const [s, t] of metricNaIntervals(samples, e.x0, e.x1)) {
      out.push({ ...e, x0: s, x1: t, openEnded: e.openEnded && t === e.x1 })
    }
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Per-subplot entry point + hover text                                        */
/* -------------------------------------------------------------------------- */

/** Which legacy plot function the subplot corresponds to. */
export type SubplotKind = 'met' | 'soil' | 'ppt'

/**
 * Legacy widths: 6 h everywhere, except `plot_met` uses 48 h when the window
 * spans more than 31 days.
 */
export function defaultEventWidth(kind: SubplotKind, dataMin: number, dataMax: number): number {
  if (kind === 'met' && dataMax - dataMin > 31 * DAY) return 48 * HOUR
  return 6 * HOUR
}

export interface SubplotEventsInput {
  kind: SubplotKind
  /** Chart columns in this subplot (LAB_SWAP-normalised labels). */
  columns: readonly string[]
  /** Exploded config rows (see `explodeInstruments`). */
  config: readonly ConfigRow[]
  /** Observation rows (not gap-filled): `datetime` plus column values. */
  rows: ReadonlyArray<Record<string, unknown>>
  now?: number
}

/** Events for one subplot: config filtered to its columns, outages clipped to NA spans. */
export function sensorEventsForSubplot({
  kind,
  columns,
  config,
  rows,
  now,
}: SubplotEventsInput): SensorEvent[] {
  const cols = new Set(columns)
  const relevant = config.filter((r) => cols.has(r.element))
  if (relevant.length === 0) return []
  const samples: MetricSample[] = []
  for (const r of rows) {
    const t = parseWallClock(r.datetime)
    if (t === null) continue
    samples.push({
      t,
      hasValue: columns.some((c) => {
        const v = r[c]
        return v !== null && v !== undefined && v !== '' && !Number.isNaN(v)
      }),
    })
  }
  if (samples.length === 0) return []
  let dataMin = Infinity
  let dataMax = -Infinity
  for (const s of samples) {
    if (s.t < dataMin) dataMin = s.t
    if (s.t > dataMax) dataMax = s.t
  }
  const events = buildSensorEvents(relevant, {
    dataMin,
    dataMax,
    defaultWidthMs: defaultEventWidth(kind, dataMin, dataMax),
    now,
  })
  return filterOutagesToMissingData(events, samples)
}

/** Hover text, verbatim from `_add_sensor_event_overlays`. */
export function sensorEventText(e: SensorEvent): string {
  const date0 = formatWallDate(e.x0)
  const date1 = formatWallDate(e.x1)
  const elems = e.elements.join(',<br>')
  if (e.reason === 'added') {
    return `A sensor was added/replaced on ${date0}, affecting the following elements:<br>${elems}`
  }
  if (e.reason === 'removed') {
    return `A sensor was sunset/removed on ${date0}, affecting the following elements:<br>${elems}`
  }
  if (e.openEnded) {
    return `A sensor outage was reported on ${date0} and is ongoing as of ${date1}, affecting the following elements:<br>${elems}`
  }
  if (date0 === date1) {
    return `A sensor outage was reported on ${date0}, affecting the following elements:<br>${elems}`
  }
  return `A sensor outage was reported on ${date0} and lasted through ${date1}, affecting the following elements:<br>${elems}`
}
