/** Station / element metadata and small per-station endpoints. */
import { fetchCsv, fetchJson, mergeOn } from './http'
import { asSeaLevel, fetchMslp, PRESSURE_COLUMN } from './pressure'
import { qcOverride } from './qcLevel'
import type {
  ElementMeta,
  ObservationRow,
  PptSummaryRow,
  Station,
  StationConfig,
  StationElement,
} from './types'

export const getStations = () => fetchCsv<Station>('stations')

export const getElements = () => fetchCsv<ElementMeta>('elements')

/**
 * Elements a station reports. `publicOnly` maps to the API's `public` flag
 * (API default true = common, public-facing elements only); pass `false` for
 * the full list including uncommon/diagnostic elements. Omitting it sends no
 * `public` param, so existing callers are unchanged.
 */
export const getStationElements = (station: string, publicOnly?: boolean) =>
  fetchCsv<StationElement>(
    `elements/${station}/`,
    publicOnly === undefined ? {} : { public: publicOnly },
  )

/** The newest row; `level` only under the `?level=` override (the API's default is 2). */
/** The newest reading, with station pressure replaced by sea-level pressure (core/api/pressure). */
export const getStationLatest = async (station: string): Promise<ObservationRow[]> => {
  const level = qcOverride()
  const query = { stations: station, ...(level === null ? {} : { level }) }
  const [latest, mslp] = await Promise.all([
    fetchCsv<ObservationRow>('latest', query),
    // A failed request leaves pressure empty rather than failing the reading.
    fetchMslp('latest', query).catch((err: unknown) => {
      console.warn('Sea-level pressure request failed; pressure left empty.', err)
      return []
    }),
  ])
  if (!latest.some((r) => PRESSURE_COLUMN in r)) return latest
  return asSeaLevel(mergeOn(latest, mslp, ['station', 'datetime']))
}

export const getStationConfig = (station: string) =>
  fetchJson<StationConfig>(`config/${station}/`)

export const getPptSummary = (station: string) =>
  fetchCsv<PptSummaryRow>('derived/ppt/', { stations: station })
