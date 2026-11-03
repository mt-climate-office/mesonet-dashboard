/**
 * VPD is the API's derived `vpd` (FAO-56, from air temperature and RH) at every
 * station, not the ATMOS 41's own `vpd_atmo`, which 84 stations report. It fills
 * the VPD column in every record and latest request (core/api `getStationRecord`,
 * `getStationLatest`); the Downloader bypasses both, so downloads keep `vpd_atmo`.
 */
import type { AggPeriod } from '../params'
import { VPD_ELEMENT } from '../params'
import { fetchCsv } from './http'
import { MSLP_ENDPOINTS } from './pressure'
import type { ObservationRow } from './types'

/** The column every VPD reader matches (core/params/columns, core/overview); it carries `vpd`. */
export const VPD_COLUMN = 'VPD [mbar]'

const isDerivedVpdColumn = (col: string): boolean => col.startsWith('Vapor Pressure Deficit')

/** Whether a comma-separated element list asks for VPD. */
export const asksVpd = (elements: string | undefined): boolean =>
  (elements ?? '').split(',').includes(VPD_ELEMENT)

/** A comma-separated element list without VPD. */
export const withoutVpd = (elements: string): string =>
  elements.split(',').filter((e) => e && e !== VPD_ELEMENT).join(',')

/**
 * `/derived` VPD rows for the same window and QC level as the observations, on
 * the same endpoints as `mslp` (native rows for raw). `query` holds `stations`,
 * `level` and, unless this is the latest reading, `start_time`/`end_time`/`rm_na`.
 */
export const fetchVpd = (period: AggPeriod | 'latest', query: Record<string, unknown>): Promise<ObservationRow[]> =>
  fetchCsv<ObservationRow>(period === 'latest' ? 'derived' : MSLP_ENDPOINTS[period], { ...query, elements: 'vpd' })

/**
 * Rows merged from observations and `fetchVpd`, with the derived value moved
 * into VPD_COLUMN. Every row gets the column once the derived series is there
 * (a station without `vpd_atmo` too); a row with no derived value is null, never
 * the sensor's reading, so the dashboard shows one VPD.
 */
export function asDerivedVpd(rows: readonly ObservationRow[]): ObservationRow[] {
  const derived = rows.some((r) => Object.keys(r).some(isDerivedVpdColumn))
  return rows.map((row) => {
    const out: ObservationRow = { ...row }
    const col = Object.keys(out).find(isDerivedVpdColumn)
    const v = col === undefined ? undefined : out[col]
    if (col !== undefined) delete out[col]
    if (derived || VPD_COLUMN in out) {
      out[VPD_COLUMN] = typeof v === 'number' && Number.isFinite(v) ? v : null
    }
    return out
  })
}
