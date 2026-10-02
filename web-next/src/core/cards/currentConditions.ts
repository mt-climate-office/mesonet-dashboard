/**
 * Pure helpers for the Current Conditions card: the latest-observation rows
 * (legacy get_station_latest) and the HydroMet Precipitation Summary
 * (legacy get_ppt_summary, `/derived/ppt/`).
 */
import { degToCompass } from '../params'
import { parseWallClock } from '../sensorEvents'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * API local stamp ("2026-10-01 13:15:00-06:00") → "Oct 1, 2026 1:15 PM", read
 * as Mountain wall clock (the offset is ignored, so every viewer sees MT).
 * Unparseable input comes back unchanged.
 */
export function formatLatestStamp(ts: string): string {
  const ms = parseWallClock(ts)
  if (ms === null) return ts
  const d = new Date(ms)
  const h = d.getUTCHours()
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Rows legacy get_station_latest keeps (params.elem_labs, after lab_swap):
 * station-reported met/soil/precip/wind/well-level columns. VPD, Well EC and
 * Well Water Temperature are not in that list, so they are not shown. Snow
 * Depth is: legacy listed it as "Snow Depth [in.]" while the API sends
 * "[in]", so legacy silently dropped it (legacy bug not ported).
 */
export function isCurrentConditionsColumn(col: string): boolean {
  return (
    col === 'Air Temperature [°F]' ||
    col === 'Atmospheric Pressure [mbar]' ||
    col === 'Precipitation [in]' ||
    col === 'Max Precip Rate [in/hr]' ||
    col === 'Max Precip Rate [in/h]' ||
    col === 'Relative Humidity [%]' ||
    col === 'Solar Radiation [W/m²]' ||
    col === 'Wind Direction [deg]' ||
    col === 'Wind Speed [mi/hr]' ||
    col === 'Gust Speed [mi/hr]' ||
    col === 'Well Water Level [in]' ||
    col === 'Snow Depth [in]' ||
    col === 'Snow Depth [in.]' ||
    /^(Soil Temperature|Soil VWC|Bulk EC) @ \d+ in \[/.test(col)
  )
}

/**
 * Legacy "{compass} ({deg} deg)", e.g. "N (357.3 deg)". Legacy formats a
 * pandas float, so whole degrees keep their ".0" ("E (90.0 deg)").
 */
export const formatWindDirection = (deg: number): string =>
  `${degToCompass(deg)} (${Number.isInteger(deg) ? deg.toFixed(1) : deg} deg)`

/**
 * Current-conditions rows in legacy order: Timestamp, then the kept columns
 * in API order, then "Real Feel [°F]" (NWS wind-chill formula at every
 * temperature, rounded to 2 decimals; legacy bug kept). Values are shown as
 * the API sends them; empty values are dropped.
 */
export function currentConditionsRows(
  latest: Record<string, unknown>,
): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = []
  const ts = latest.datetime
  if (typeof ts === 'string' && ts) {
    out.push(['Timestamp', formatLatestStamp(ts)])
  }
  for (const [k, v] of Object.entries(latest)) {
    if (!isCurrentConditionsColumn(k)) continue
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out.push([
      k,
      k === 'Wind Direction [deg]' && typeof v === 'number' ? formatWindDirection(v) : String(v),
    ] as const)
  }
  const airT = latest['Air Temperature [°F]']
  const windKey = Object.keys(latest).find((k) => k.startsWith('Wind Speed')) ?? ''
  const wind = windKey ? latest[windKey] : null
  if (typeof airT === 'number' && typeof wind === 'number' && wind > 0) {
    const realFeel =
      35.74 +
      0.6215 * airT -
      35.75 * Math.pow(wind, 0.16) +
      0.4275 * airT * Math.pow(wind, 0.16)
    out.push(['Real Feel [°F]', String(Math.round(realFeel * 100) / 100)] as const)
  }
  return out
}

/**
 * Precipitation Summary rows from the first `/derived/ppt/` row: every
 * numeric column but `station`, as "{value.toFixed(2)} in", in reverse column
 * order (legacy melts then reverses, newest window first). Blanks are dropped.
 */
export function pptSummaryRows(summary: Record<string, unknown> | undefined): Array<readonly [string, string]> {
  if (!summary) return []
  const out: Array<readonly [string, string]> = []
  for (const [k, v] of Object.entries(summary)) {
    if (k === 'station' || v === null || v === undefined || v === '') continue
    const num = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(num)) out.push([k, `${num.toFixed(2)} in`] as const)
  }
  return out.reverse()
}
