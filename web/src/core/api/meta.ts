/** Station / element metadata and small per-station endpoints. */
import { fetchCsv, fetchJson, mergeOn } from './http'
import { asSeaLevel, fetchMslp, PRESSURE_COLUMN } from './pressure'
import { asDerivedVpd, fetchVpd } from './vpd'
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

/**
 * The newest reading (`level` only under the `?level=` override; the API's default is 2), with
 * station pressure replaced by sea-level pressure (core/api/pressure) and VPD by the derived `vpd`,
 * which every station with air temperature and humidity has (core/api/vpd).
 */
export const getStationLatest = async (station: string): Promise<ObservationRow[]> => {
  const level = qcOverride()
  const query = { stations: station, ...(level === null ? {} : { level }) }
  // A failed derived request leaves its value empty rather than failing the reading.
  const orEmpty = (what: string) => (err: unknown): ObservationRow[] => {
    console.warn(`${what} request failed; left empty.`, err)
    return []
  }
  const [latest, mslp, vpd] = await Promise.all([
    fetchCsv<ObservationRow>('latest', query),
    fetchMslp('latest', query).catch(orEmpty('Sea-level pressure')),
    fetchVpd('latest', query).catch(orEmpty('VPD')),
  ])
  const keys = ['station', 'datetime']
  const pressured = latest.some((r) => PRESSURE_COLUMN in r) ? asSeaLevel(mergeOn(latest, mslp, keys)) : latest
  // Left-joined on the reading: a derived row at another instant is not this reading's VPD.
  return latest.length === 0 ? latest : asDerivedVpd(mergeOn(pressured, vpd, keys))
}

export const getStationConfig = (station: string) =>
  fetchJson<StationConfig>(`config/${station}/`)

export const getPptSummary = (station: string) =>
  fetchCsv<PptSummaryRow>('derived/ppt/', { stations: station })
