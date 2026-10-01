import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'
import { isKnownStation } from '../lib/stations'

/**
 * The `?s=` station, but only once it is known to be a real station id.
 *
 * `?s=` can briefly hold an NWSLI id or a mis-cased id (legacy links) until
 * GlobalNotices' resolver rewrites it, so station-scoped queries should key
 * off this instead of the raw param to avoid firing doomed requests (422s).
 *
 * - catalog loading → null
 * - catalog loaded → the station if it is in the catalog, else null
 * - catalog failed → the raw param (best effort; don't block the page)
 */
export function useResolvedStation(): string | null {
  const [station] = useStationParam()
  const { data, isError } = useStations()
  if (!station) return null
  if (data) return isKnownStation(station, data) ? station : null
  return isError ? station : null
}
