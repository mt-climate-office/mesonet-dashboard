/**
 * Client-side monthly aggregation for the Data Downloader.
 *
 * The v2 API has no monthly endpoint, so "Monthly" requests fetch daily rows
 * (`/observations/daily`, `/derived/daily`) and roll them up here. Mirrors the
 * legacy `get_station_record(period="monthly")` rules:
 *   - group by America/Denver calendar year-month,
 *   - SUM precipitation and Reference ET, MEAN everything else,
 *   - month datetime = first of the month,
 *   - "Contains Missing Data" = any day in the month flagged.
 * Differences from legacy (intentional):
 *   - every numeric column is aggregated; legacy silently dropped columns not
 *     in its hard-coded label list (and the station column);
 *   - boolean flag columns (e.g. `provisional`) are aggregated with any();
 *   - a "Days With Data" column counts the daily rows in each month, so
 *     partial months (start/end of range, outages) are visible;
 *   - `obs_count` (raw observations per day) is dropped, superseded by
 *     "Days With Data";
 *   - aggregated values are rounded to 3 decimals (the API's precision).
 */

export type Row = Record<string, unknown>

export const DAYS_WITH_DATA_COLUMN = 'Days With Data'

/** Columns that are not carried into the monthly output. */
const DROP_COLUMNS: ReadonlySet<string> = new Set(['obs_count'])

/** Precipitation totals and Reference ET are summed; everything else averaged. */
export function isSummedColumn(col: string): boolean {
  return /^Precipitation\b/.test(col) || /Reference ET/.test(col)
}

/**
 * Local (America/Denver) `YYYY-MM` for an API datetime. API datetimes are
 * already local wall time with an offset (`2026-08-28 00:00:00-06:00`; the
 * API's `tz` defaults to America/Denver), so the leading year-month is the
 * local month. Anything else (e.g. a UTC `…Z` string) is converted via Intl.
 */
export function localMonthKey(datetime: unknown): string | null {
  if (typeof datetime !== 'string') return null
  const m = datetime.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const isUtc = /[Zz]$/.test(datetime.trim())
  if (!isUtc) return `${m[1]}-${m[2]}`
  const d = new Date(datetime)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const mo = parts.find((p) => p.type === 'month')?.value
  return y && mo ? `${y}-${mo}` : null
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Aggregate daily rows to monthly rows. Pure; input order does not matter. */
export function aggregateMonthly(rows: ReadonlyArray<Row>): Row[] {
  // First-seen column order across all rows (derived/observation rows from an
  // outer join may not share every key).
  const columns: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k)
        columns.push(k)
      }
    }
  }
  const valueCols = columns.filter(
    (c) => c !== 'datetime' && c !== DAYS_WITH_DATA_COLUMN && !DROP_COLUMNS.has(c),
  )

  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = localMonthKey(r.datetime)
    if (!key) continue
    let g = groups.get(key)
    if (!g) {
      g = []
      groups.set(key, g)
    }
    g.push(r)
  }

  const out: Row[] = []
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!
    const row: Row = {}
    for (const col of columns) {
      if (DROP_COLUMNS.has(col) || col === DAYS_WITH_DATA_COLUMN) continue
      if (col === 'datetime') {
        row.datetime = `${key}-01`
        continue
      }
      if (!valueCols.includes(col)) continue
      row[col] = aggregateColumn(col, g)
    }
    row[DAYS_WITH_DATA_COLUMN] = g.length
    out.push(row)
  }
  return out
}

function aggregateColumn(col: string, group: ReadonlyArray<Row>): unknown {
  const values = group.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '')
  if (values.length === 0) return null
  if (values.every((v) => typeof v === 'boolean')) return values.some(Boolean)
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) {
    // Non-numeric (e.g. the station id): carry the first value through.
    return values[0]
  }
  const sum = nums.reduce((a, b) => a + b, 0)
  return round3(isSummedColumn(col) ? sum : sum / nums.length)
}
