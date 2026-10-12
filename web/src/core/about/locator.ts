/**
 * The About locator map's camera frame: a box centred on the selected station that reaches its nearest
 * neighbour, so ui/map can fit it inside the space clear of the map's overlays (legend, controls), at a
 * zoom held within `LOCATOR_ZOOM` (`locatorZoom`).
 */
import type { Station } from '../api'
import { haversineKm } from '../stations/nearest'

/** [[west, south], [east, north]] in decimal degrees. */
export type LngLatBox = [[number, number], [number, number]]

const KM_PER_DEG_LAT = 111.2
/** Closer than this is the same site (a test station beside the real one), not a neighbour. */
const SAME_SITE_KM = 0.5

/**
 * The frame for station `id`: centred on it, wide and tall enough for its `neighbours` (default 1) nearest
 * other sites and at least `minHalfKm` (default 15) each way; null for an unknown id or no coordinates.
 */
export function locatorFrame(
  list: readonly Pick<Station, 'station' | 'latitude' | 'longitude'>[],
  id: string | null,
  { neighbours = 1, minHalfKm = 15 } = {},
): LngLatBox | null {
  const s = id ? list.find((x) => x.station === id) : undefined
  if (!s || !Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return null
  const near = list
    .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
    .map((n) => ({ n, km: haversineKm(s.latitude, s.longitude, n.latitude, n.longitude) }))
    .filter((d) => d.km > SAME_SITE_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, neighbours)
  let halfLat = minHalfKm / KM_PER_DEG_LAT
  let halfLon = minHalfKm / (KM_PER_DEG_LAT * Math.cos((s.latitude * Math.PI) / 180))
  for (const { n } of near) {
    halfLat = Math.max(halfLat, Math.abs(n.latitude - s.latitude))
    halfLon = Math.max(halfLon, Math.abs(n.longitude - s.longitude))
  }
  return [[s.longitude - halfLon, s.latitude - halfLat], [s.longitude + halfLon, s.latitude + halfLat]]
}

/**
 * Zoom limits for the fit. 8 is the locator's former fixed zoom (a town and its valley): a dense area
 * (Bozeman) fits closer than that and stays at 8; an isolated station's neighbour may be 100 km off, so
 * the frame zooms out at most one level (the neighbour may then fall outside it).
 */
export const LOCATOR_ZOOM = { min: 7, max: 8 } as const

/** The zoom to show a frame that fits at zoom `fit`: `fit` held within `LOCATOR_ZOOM`; the maximum when not finite. */
export function locatorZoom(fit: number): number {
  if (!Number.isFinite(fit)) return LOCATOR_ZOOM.max
  return Math.min(LOCATOR_ZOOM.max, Math.max(LOCATOR_ZOOM.min, fit))
}
