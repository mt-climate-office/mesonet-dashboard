/**
 * Multi-year daily series for the Annual comparison.
 *
 * Source: `/observations/daily`, one request per calendar year (bounded
 * concurrency), so each year is cached and retried independently and the
 * API's ~6 s/year latency overlaps; or, with `together`, one request for all
 * the years (the install year with the next, core/variables `requestGroups`).
 *
 * The data2 Parquet archive (`daily/wide/level=2/year=YYYY/part-*.parquet`)
 * was prototyped as a primary source and is NOT wired in yet:
 *  - files are ZSTD-compressed → needs `hyparquet` + `hyparquet-compressors`
 *    (fzstd + hysnappy), i.e. two new dependencies;
 *  - `daily/wide` carries one aggregate per element (avg; sum for ppt), no
 *    min/max, so GDD-style inputs still need the API (`daily/long` has
 *    avg/min/max/sum but is ~57 MB/year in 4 row groups of ~30 MB);
 *  - measured for acebozem 2021–2025, air_temp + ppt: 28 range requests,
 *    1.45 MB, 3.8 s (vs. the API: ~100 KB, ~23 s for the same span).
 * See the Wave 2 B report for the decision.
 */
import type { LocalDate, Nullable, QcLevel } from '../contract'
import { agLevel, fetchRows } from './observations'
import { denverToday } from '../../today'
import { addDays, denverLocal, parseApiDatetime, parseHeader, toBool, toNum, toSi } from './parse'
import type { RawRow } from './parse'

export type AggFunc = 'avg' | 'min' | 'max' | 'sum'

export interface AnnualYear {
  year: number
  date: LocalDate[]
  /** SI units (°C, mm, W/m², m/s, %). */
  value: Nullable[]
  provisional: boolean[]
  /**
   * The API value-column label the year came from (US units, e.g.
   * `Total Precipitation [in]`), so the display edge can convert back from
   * SI and label the axis. null when the year had no rows.
   */
  header: string | null
}

export interface AnnualDaily {
  station: string
  element: string
  agg: AggFunc
  level: QcLevel
  /** Source the data came from (Parquet archive not yet enabled). */
  source: 'api'
  years: AnnualYear[]
}

export interface AnnualOptions {
  agg?: AggFunc
  level?: QcLevel
  /** Max parallel requests (default 3). */
  concurrency?: number
  /** Years starting after this date are not requested (default: today, Denver). */
  today?: LocalDate
  /** One request from the first year's Jan 1 to the last year's Dec 31, split by year here. */
  together?: boolean
}

/**
 * One year's API rows → a full Jan 1 … Dec 31 axis. Days without a row
 * (future days, gaps, a future year with no rows) are null.
 */
export function parseAnnualYear(rows: RawRow[], year: number): AnnualYear {
  const header = rows.length
    ? Object.keys(rows[0]).find((h) => parseHeader(h) !== null)
    : undefined
  const conv = header ? toSi(parseHeader(header)!.unit) : (x: number) => x
  const byDate = new Map<LocalDate, RawRow>()
  for (const r of rows) byDate.set(denverLocal(parseApiDatetime(r.datetime)).date, r)
  const end = `${year}-12-31`
  const out: AnnualYear = { year, date: [], value: [], provisional: [], header: header ?? null }
  for (let d = `${year}-01-01`; d <= end; d = addDays(d, 1)) {
    const r = byDate.get(d)
    const v = r && header ? toNum(r[header]) : null
    out.date.push(d)
    out.value.push(v === null ? null : conv(v))
    out.provisional.push(r ? toBool(r.provisional) : false)
  }
  return out
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

/**
 * Daily `element` aggregated by `agg` for each requested calendar year.
 * Years with no data come back as all-null.
 */
export async function getAnnualDaily(
  station: string,
  element: string,
  years: number[],
  opts: AnnualOptions = {},
): Promise<AnnualDaily> {
  const agg = opts.agg ?? (element === 'ppt' ? 'sum' : 'avg')
  const level = opts.level ?? agLevel()
  const today = opts.today ?? denverToday()
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  const fetchYears = (first: number, last: number) =>
    fetchRows({
      path: 'observations/daily/',
      query: {
        stations: station,
        elements: element,
        agg_func: agg,
        level,
        start_time: `${first}-01-01`,
        end_time: `${last + 1}-01-01`, // exclusive
      },
    })
  if (opts.together) {
    const asked = sorted.filter((year) => `${year}-01-01` <= today)
    // parseAnnualYear keeps only its own year's rows.
    const rows = asked.length ? await fetchYears(asked[0], asked[asked.length - 1]) : []
    return { station, element, agg, level, source: 'api', years: sorted.map((year) => parseAnnualYear(rows, year)) }
  }
  const out = await pool(sorted, opts.concurrency ?? 3, async (year) => {
    if (`${year}-01-01` > today) return parseAnnualYear([], year)
    return parseAnnualYear(await fetchYears(year, year), year)
  })
  return { station, element, agg, level, source: 'api', years: out }
}
