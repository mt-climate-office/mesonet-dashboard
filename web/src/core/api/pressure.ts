/**
 * Pressure is shown reduced to sea level. The API's derived `mslp` (NWS-style:
 * 12-hour mean temperature plus a plateau correction fit to ASOS) takes the
 * place of the station's measured `bp` in every record and latest request
 * (core/api `getStationRecord`, `getStationLatest`). The Downloader bypasses
 * both, so downloads keep the measured station pressure.
 */
import type { AggPeriod } from '../params'
import { fetchCsv } from './http'
import type { ObservationRow } from './types'

/** The measured station-pressure element: still requested, for the row timeline and `provisional`. */
export const STATION_PRESSURE = 'bp'

/** The column every pressure reader matches (core/params/columns, core/overview); it carries `mslp`. */
export const PRESSURE_COLUMN = 'Atmospheric Pressure [mbar]'

/** `/derived/*` path for `mslp` by period: native 5/15-min rows for raw (DERIVED_ENDPOINTS' raw is hourly, for ETr). */
export const MSLP_ENDPOINTS: Readonly<Record<AggPeriod, string>> = {
  hourly: 'derived/hourly',
  daily: 'derived/daily',
  monthly: 'derived/daily',
  raw: 'derived',
}

const isMslpColumn = (col: string): boolean => col.startsWith('Sea Level Pressure')

/** Whether a comma-separated element list asks for station pressure. */
export const asksPressure = (elements: string | undefined): boolean =>
  (elements ?? '').split(',').includes(STATION_PRESSURE)

/** A comma-separated element list without station pressure. */
export const withoutPressure = (elements: string): string =>
  elements.split(',').filter((e) => e && e !== STATION_PRESSURE).join(',')

/**
 * `/derived` sea-level pressure rows for the same window and QC level as the
 * observations. `query` holds `stations`, `level` and, unless this is the latest
 * reading, `start_time`/`end_time`/`rm_na`.
 */
export const fetchMslp = (period: AggPeriod | 'latest', query: Record<string, unknown>): Promise<ObservationRow[]> =>
  fetchCsv<ObservationRow>(period === 'latest' ? 'derived' : MSLP_ENDPOINTS[period], { ...query, elements: 'mslp' })

/**
 * Rows merged from observations and `fetchMslp`, with the sea-level value moved
 * into PRESSURE_COLUMN. A row whose measured pressure has no sea-level value
 * (no air temperature to reduce it with, or a failed request) gets null, never
 * the station pressure: the two differ by ~150 mb at a typical station.
 */
export function asSeaLevel(rows: readonly ObservationRow[]): ObservationRow[] {
  return rows.map((row) => {
    const out: ObservationRow = { ...row }
    const mslpCol = Object.keys(out).find(isMslpColumn)
    const mslp = mslpCol === undefined ? undefined : out[mslpCol]
    if (mslpCol !== undefined) delete out[mslpCol]
    if (PRESSURE_COLUMN in out || mslpCol !== undefined) {
      out[PRESSURE_COLUMN] = typeof mslp === 'number' && Number.isFinite(mslp) ? mslp : null
    }
    return out
  })
}
