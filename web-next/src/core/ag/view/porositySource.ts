/**
 * Porosity source switch for percent saturation (DIVERGENCES.md D-PS-1).
 *
 * Percent saturation is `clip(VWC / porosity · 100, 0, 100)`, computed in
 * the browser from the level-2 VWC observations. The porosity comes from the
 * API by default: `/derived/{daily,hourly}?elements=percent_saturation&keep=true`
 * returns `Porosity @ -10 cm [%]` columns from the API's soil-parameter DB.
 * The public mesonet-soils porosities (vendored `public/data/soil_params.json`)
 * differ from the DB at 60 of 91 has_swp stations, so a vendored-porosity
 * saturation would not match what the API and legacy dashboard show.
 * `POROSITY_SOURCE = 'vendored'` restores the tested vendored path
 * (`compute` `percentSaturation()` over `loadSoilParams`).
 *
 * Both paths return a contract `PercentSaturationSeries` on the soil
 * series' own time axis, so the Soil Profile frozen mask applies unchanged.
 */
import { exclusiveEnd } from '../../api/record'
import type { LocalDate, Nullable, PercentSaturationSeries, SoilSeries } from '../contract'
import { DEFAULT_AG_LEVEL, fetchRows } from '../data'
import { type RawRow, denverLocal, depthCm, parseApiDatetime, parseHeader, toNum } from '../data/parse'

export type PorositySource = 'api' | 'vendored'

/** Flip to `'vendored'` once mesonet-soils porosities match the API DB. */
export const POROSITY_SOURCE: PorositySource = 'api'

export interface PorosityQuery {
  station: string
  start: LocalDate
  end: LocalDate
  period: 'daily' | 'hourly'
}

/** `/derived/{period}` request whose `keep=true` columns carry the API's porosity. */
export function derivedPorosityRequest(q: PorosityQuery & { level: 0 | 1 | 2 }): {
  path: string
  query: Record<string, string | number | boolean>
} {
  return {
    path: `derived/${q.period}/`,
    query: {
      stations: q.station,
      start_time: q.start,
      end_time: exclusiveEnd(q.end),
      elements: 'percent_saturation',
      keep: true,
      level: q.level,
    },
  }
}

const clip = (x: number) => Math.min(100, Math.max(0, x))

/**
 * Percent saturation from the client's VWC (`soil`) and the API's porosity
 * columns (`rows`). Daily rows join on the local date, hourly rows on the
 * UTC instant; each value uses its own row's porosity. Only depths for which
 * the API reports a porosity appear (as in `/derived`); an axis row without
 * an API porosity is null.
 */
export function percentSaturationFromApiPorosity(
  rows: RawRow[],
  soil: SoilSeries,
  period: 'daily' | 'hourly',
): PercentSaturationSeries {
  const porCols = new Map<number, string>()
  if (rows.length > 0) {
    for (const header of Object.keys(rows[0])) {
      const p = parseHeader(header)
      if (!p || p.name !== 'Porosity') continue
      const d = depthCm(p)
      if (d !== null) porCols.set(d, header)
    }
  }
  const byKey = new Map<string | number, RawRow>()
  for (const r of rows) {
    const t = parseApiDatetime(r.datetime ?? r.index ?? '')
    byKey.set(period === 'daily' ? denverLocal(t).date : t, r)
  }
  const keys: (LocalDate | number)[] =
    period === 'daily' ? soil.time.map((t) => t.slice(0, 10)) : soil.epochMs
  const depthsCm: number[] = []
  const pct: Nullable[][] = []
  soil.depthsCm.forEach((depth, d) => {
    const header = porCols.get(depth)
    if (!header) return
    // A column that is blank on every row means the DB has no porosity there.
    if (!rows.some((r) => toNum(r[header]) !== null)) return
    depthsCm.push(depth)
    pct.push(
      keys.map((k, i) => {
        const v = soil.vwcPct[d][i]
        const por = toNum(byKey.get(k)?.[header])
        if (v === null || v === undefined || !Number.isFinite(v) || por === null || por <= 0) return null
        return clip((v / por) * 100)
      }),
    )
  })
  return {
    station: soil.station,
    level: soil.level,
    provisional: [...soil.provisional],
    depthsCm,
    time: [...soil.time],
    epochMs: [...soil.epochMs],
    pct,
  }
}


/**
 * Raw `/derived` porosity rows for `q` at the Ag QC level (the `api` path).
 * Pair with `percentSaturationFromApiPorosity` once `SoilSeries` is loaded.
 */
export function fetchPorosityRows(q: PorosityQuery): Promise<RawRow[]> {
  return fetchRows(derivedPorosityRequest({ ...q, level: DEFAULT_AG_LEVEL }))
}
