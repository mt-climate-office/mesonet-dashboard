/** Station / element metadata and small per-station endpoints. */
import { fetchCsv, fetchJson } from './http'
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

export const getStationLatest = (station: string) =>
  fetchCsv<ObservationRow>('latest', { stations: station })

export const getStationConfig = (station: string) =>
  fetchJson<StationConfig>(`config/${station}/`)

export const getPptSummary = (station: string) =>
  fetchCsv<PptSummaryRow>('derived/ppt/', { stations: station })
