/**
 * The About section's station details: catalog row (`/stations`) plus the
 * newest `/latest` stamp → label/value rows for a definition list.
 */
import type { Station } from '../api'
import { metersToFeet } from '../cards/metadata'
import { fmtWall, MISSING } from '../charts/format'
import { parseWallClock } from '../sensorEvents'

export interface DetailRow {
  label: string
  value: string
}

/** "YYYY-MM-DD…" (API local) → "Oct 30, 2020"; null for blanks and "None". */
export function formatDay(value: string | null | undefined): string | null {
  const ms = parseWallClock(value)
  return ms === null ? null : fmtWall(ms, 'daily')
}

/** "45.66° N, 111.07° W", as the catalog sends the degrees. */
export function formatCoordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return MISSING
  return `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon)}° ${lon < 0 ? 'W' : 'E'}`
}

/** "4,905 ft (1,495 m)" from metres; feet as legacy round(m × 3.281). */
export function formatElevation(m: number): string {
  if (!Number.isFinite(m)) return MISSING
  return `${metersToFeet(m).toLocaleString('en-US')} ft (${Math.round(m).toLocaleString('en-US')} m)`
}

/**
 * Install date to the newest report ("Oct 30, 2020 – Oct 1, 2026"); "Since
 * Oct 30, 2020" until `/latest` answers; "—" without an install date.
 */
export function periodOfRecord(installed: string | null, latestStamp: string | null | undefined): string {
  const from = formatDay(installed)
  if (!from) return MISSING
  const to = formatDay(latestStamp)
  return to ? `${from} – ${to}` : `Since ${from}`
}

/** Rows in display order; County and NWS ID only when the catalog has them. */
export function stationDetails(s: Station, latestStamp: string | null | undefined): DetailRow[] {
  return [
    { label: 'Name', value: s.name },
    { label: 'Station ID', value: s.station },
    { label: 'Network', value: s.sub_network || MISSING },
    ...(s.nwsli_id ? [{ label: 'NWS ID', value: s.nwsli_id }] : []),
    ...(s.county ? [{ label: 'County', value: s.county }] : []),
    { label: 'Coordinates', value: formatCoordinates(s.latitude, s.longitude) },
    { label: 'Elevation', value: formatElevation(s.elevation) },
    { label: 'Installed', value: formatDay(s.date_installed) ?? MISSING },
    { label: 'Period of record', value: periodOfRecord(s.date_installed, latestStamp) },
  ]
}
