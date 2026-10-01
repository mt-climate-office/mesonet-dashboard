/**
 * Pure helpers over the station catalog (`/stations`).
 */
import type { Station } from './api'

/**
 * Read a boolean catalog flag. The v2 CSV writes Python booleans ("True" /
 * "False"), which papaparse's dynamicTyping leaves as strings, so a plain
 * truthiness check would treat "False" as true.
 */
export function isTrueFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return /^\s*(true|t|1|yes)\s*$/i.test(value)
  return false
}

/** Stations with soil-water-potential sensors (`has_swp`). */
export function stationsWithSwp<T extends Pick<Station, 'has_swp'>>(
  stations: readonly T[],
): T[] {
  return stations.filter((s) => isTrueFlag(s.has_swp))
}

/** True when the station has soil-water-potential sensors. */
export function stationHasSwp(station: Pick<Station, 'has_swp'> | null | undefined): boolean {
  return !!station && isTrueFlag(station.has_swp)
}

/**
 * Resolve a `?s=` value to a station id. Mirrors the legacy `/dash/<id>`
 * lookup (station id first, then NWSLI id), but case-insensitive so
 * `?s=KEEM8`, `?s=keem8` and `?s=ACEABSAR` all work.
 *
 * Returns the canonical station id, or `null` when nothing matches.
 */
export function resolveStationId(
  value: string | null | undefined,
  stations: readonly Pick<Station, 'station' | 'nwsli_id'>[],
): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const exact = stations.find((s) => s.station === raw)
  if (exact) return exact.station
  const needle = raw.toLowerCase()
  const byId = stations.find((s) => s.station.toLowerCase() === needle)
  if (byId) return byId.station
  const byNwsli = stations.find(
    (s) => typeof s.nwsli_id === 'string' && s.nwsli_id.trim().toLowerCase() === needle,
  )
  return byNwsli ? byNwsli.station : null
}
