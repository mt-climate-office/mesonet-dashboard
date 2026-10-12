/**
 * Pure helpers over the station catalog (`/stations`).
 */
import type { SoilParams } from './ag/contract'
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

/** Station ids with at least one Fredlund–Xing fit in the mesonet-soils parameters: these get SWP. */
export function swpStationIds(params: readonly Pick<SoilParams, 'station' | 'fx'>[]): Set<string> {
  return new Set(params.filter((p) => p.fx).map((p) => p.station))
}

/**
 * The catalog with `has_swp` set from the soil parameters (`swpStationIds`).
 * mesonet2's `/stations` has no `has_swp` column; the parameters are what
 * SWP and percent saturation are computed from, so they decide.
 */
export function withSwpFlags<T extends Pick<Station, 'station' | 'has_swp'>>(
  stations: readonly T[],
  swp: ReadonlySet<string>,
): T[] {
  return stations.map((s) => ({ ...s, has_swp: swp.has(s.station) }))
}

/** Stations with soil-water-potential parameters (`has_swp`). */
export function stationsWithSwp<T extends Pick<Station, 'has_swp'>>(
  stations: readonly T[],
): T[] {
  return stations.filter((s) => isTrueFlag(s.has_swp))
}

/** True when the station has soil-water-potential parameters. */
export function stationHasSwp(station: Pick<Station, 'has_swp'> | null | undefined): boolean {
  return !!station && isTrueFlag(station.has_swp)
}

/** True when `id` is exactly a catalog station id. */
export function isKnownStation(
  id: string | null | undefined,
  stations: readonly Pick<Station, 'station'>[],
): boolean {
  return !!id && stations.some((s) => s.station === id)
}

/**
 * The `?s=` station once it is known to be a real station id, so
 * station-scoped requests never fire for an NWSLI or mis-cased id (422s):
 *  - catalog loading → null
 *  - catalog loaded → `param` if it is a catalog id, else null
 *  - catalog failed → `param` (best effort; don't block the page)
 */
export function confirmedStation(
  param: string | null,
  catalog: readonly Pick<Station, 'station'>[] | undefined,
  catalogFailed: boolean,
): string | null {
  if (!param) return null
  if (catalog) return isKnownStation(param, catalog) ? param : null
  return catalogFailed ? param : null
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
