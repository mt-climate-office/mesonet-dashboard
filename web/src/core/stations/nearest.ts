/**
 * "Near me" for the station picker: great-circle distance (haversine) from a
 * point to every catalog station, the closest few, and their labels.
 */
import type { Station } from '../api'

const EARTH_KM = 6371.0088
const KM_PER_MI = 1.609344
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in km between two points in decimal degrees (WGS84 sphere). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export interface NearStation {
  station: string
  name: string
  sub_network: string
  km: number
  miles: number
}

/** The `n` stations nearest (lat, lon), closest first; rows without finite coordinates are skipped. */
export function nearestStations(
  list: readonly Pick<Station, 'station' | 'name' | 'sub_network' | 'latitude' | 'longitude'>[],
  lat: number,
  lon: number,
  n = 5,
): NearStation[] {
  return list
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map((s) => {
      const km = haversineKm(lat, lon, s.latitude, s.longitude)
      return { station: s.station, name: s.name, sub_network: s.sub_network, km, miles: km / KM_PER_MI }
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

/** "0.4 mi" under 10 miles, else "23 mi". */
export const formatMiles = (mi: number): string => (mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`)
