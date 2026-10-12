/**
 * Soil water potential and percent saturation for the Data Downloader,
 * computed in the browser (mesonet2's `/derived` has neither). Input is the
 * level-`q.level` `soil_vwc` rows of the download period; output is one row
 * per input row with the legacy `/derived` headers, so old `els=swp,…`
 * links produce the same columns:
 *   Soil Water Potential @ -5 cm [bar]   positive bar magnitude, 3 dp
 *   Soil Water Potential @ -5 cm Clipped?  VWC outside the lab range (the
 *                                          value is then a bound, not a fit)
 *   Percent Saturation @ -5 cm [%]
 * Only depths with mesonet-soils parameters appear. No frozen mask: these
 * are data, as `/derived` served them. Pure.
 */
import { kPaToBar, percentSaturation, swp } from '../ag/compute'
import type { Nullable, SoilParams, SoilSeries } from '../ag/contract'
import type { Row } from '../aggregate'
import { MISSING_DATA_COLUMN } from '../csv'

const VWC_COL = /^Soil VWC @ -(\d+) cm \[%\]$/

const num = (v: unknown): Nullable => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const round3 = (v: Nullable) => (v == null ? null : Math.round(v * 1000) / 1000)

export function soilDerivedRows(rows: readonly Row[], params: SoilParams[], codes: readonly string[]): Row[] {
  if (rows.length === 0) return []
  const cols = new Map<number, string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const m = VWC_COL.exec(k)
      if (m) cols.set(Number(m[1]), k)
    }
  }
  const depthsCm = [...cols.keys()].sort((a, b) => a - b)
  const soil: SoilSeries = {
    station: String(rows[0].station),
    level: 2,
    provisional: rows.map(() => false),
    depthsCm,
    time: rows.map((r) => String(r.datetime)),
    epochMs: rows.map((_, i) => i),
    vwcPct: depthsCm.map((cm) => rows.map((r) => num(r[cols.get(cm)!]))),
    tempC: depthsCm.map(() => rows.map(() => null)),
  }
  const s = codes.includes('swp') ? swp(soil, params) : null
  const p = codes.includes('percent_saturation') ? percentSaturation(soil, params) : null
  return rows.map((r, i) => {
    const out: Row = { station: r.station, datetime: r.datetime }
    s?.depthsCm.forEach((cm, d) => {
      const v = s.kPa[d][i]
      out[`Soil Water Potential @ -${cm} cm [bar]`] = round3(kPaToBar(v))
      out[`Soil Water Potential @ -${cm} cm Clipped?`] = v == null ? null : s.clipped[d][i]
    })
    p?.depthsCm.forEach((cm, d) => {
      out[`Percent Saturation @ -${cm} cm [%]`] = round3(p.pct[d][i])
    })
    for (const flag of [MISSING_DATA_COLUMN, 'provisional']) if (flag in r) out[flag] = r[flag]
    return out
  })
}
