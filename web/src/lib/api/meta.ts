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

export const getStationElements = (station: string) =>
  fetchCsv<StationElement>(`elements/${station}/`)

export const getStationLatest = (station: string) =>
  fetchCsv<ObservationRow>('latest', { stations: station })

export const getStationConfig = (station: string) =>
  fetchJson<StationConfig>(`config/${station}/`)

export const getPptSummary = (station: string) =>
  fetchCsv<PptSummaryRow>('derived/ppt/', { stations: station })
