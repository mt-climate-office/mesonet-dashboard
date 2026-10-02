/**
 * Soil water potential source switch.
 *
 * SWP stays on the API's `/derived` (server-side soil parameters) until
 * mesonet-db-rds#186 resolves: the public mesonet-soils fits diverge strongly
 * at the dry end (DIVERGENCES.md D-SWP-2). The client path (`compute` `swp()`
 * over vendored/data2 soil parameters) is implemented and tested; switching
 * is the one-line change of `SWP_SOURCE` below.
 *
 * Both paths return a contract `SwpSeries` (kPa) on the soil series' own
 * time axis, so the Soil Profile frozen mask applies to either unchanged.
 */
import { derivedSwpRequest } from '../../api/derived'
import type { LocalDate, Nullable, SoilParams, SoilSeries, SwpSeries } from '../contract'
import { swp } from '../compute'
import { DEFAULT_AG_LEVEL, fetchRows } from '../data'
import { type RawRow, denverLocal, depthCm, parseApiDatetime, parseHeader, toNum, toSi } from '../data/parse'

export type SwpSource = 'api' | 'client'

/** Flip to `'client'` once the public soil parameters match the API's. */
export const SWP_SOURCE: SwpSource = 'api'

/**
 * `/derived/{daily,hourly}?elements=swp` rows → `SwpSeries` aligned to
 * `axis` (the matching `SoilSeries`): daily rows join on the local date,
 * hourly rows on the UTC instant. Axis rows without an API row are null.
 * The API does not report clipping, so `clipped` is all false.
 */
export function swpFromApiRows(rows: RawRow[], axis: SoilSeries, period: 'daily' | 'hourly'): SwpSeries {
  const cols: { header: string; depth: number }[] = []
  if (rows.length > 0) {
    for (const header of Object.keys(rows[0])) {
      const p = parseHeader(header)
      if (!p || p.name !== 'Soil Water Potential') continue
      const d = depthCm(p)
      if (d !== null) cols.push({ header, depth: d })
    }
  }
  cols.sort((a, b) => a.depth - b.depth)
  const toKPa = toSi('bar')
  const byKey = new Map<string | number, RawRow>()
  for (const r of rows) {
    const t = parseApiDatetime(r.datetime ?? r.index ?? '')
    byKey.set(period === 'daily' ? denverLocal(t).date : t, r)
  }
  const keys: (LocalDate | number)[] = period === 'daily' ? axis.time.map((t) => t.slice(0, 10)) : axis.epochMs
  const kPa: Nullable[][] = cols.map((c) =>
    keys.map((k) => {
      const v = toNum(byKey.get(k)?.[c.header])
      return v === null ? null : toKPa(v)
    }),
  )
  return {
    station: axis.station,
    level: axis.level,
    provisional: [...axis.provisional],
    depthsCm: cols.map((c) => c.depth),
    time: [...axis.time],
    epochMs: [...axis.epochMs],
    kPa,
    clipped: kPa.map((col) => col.map(() => false)),
  }
}

export interface SwpQuery {
  station: string
  start: LocalDate
  end: LocalDate
  period: 'daily' | 'hourly'
}

/** Client path: `compute` `swp()` over the station's soil parameters. */
export function swpFromParams(soil: SoilSeries, params: SoilParams[]): SwpSeries {
  return swp(soil, params)
}


/**
 * Raw `/derived` SWP rows for `q` at the Ag QC level (the `api` path). Pair
 * with `swpFromApiRows` once the matching `SoilSeries` is loaded.
 */
export function fetchSwpApiRows(q: SwpQuery): Promise<RawRow[]> {
  return fetchRows(
    derivedSwpRequest({ station: q.station, start: q.start, end: q.end, time: q.period, level: DEFAULT_AG_LEVEL }),
  )
}
