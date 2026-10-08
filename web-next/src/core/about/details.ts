/**
 * The About section's station details: catalog row (`/stations`) plus the
 * newest `/latest` stamp → label/value rows for a definition list.
 */
import type { Station } from '../api'
import { fmtWall, MISSING } from '../charts/format'
import { parseWallClock } from '../sensorEvents'

export interface DetailRow {
  label: string
  value: string
  /** A station id shown in mono after the value. */
  id?: string
}

/** "YYYY-MM-DD…" (API local) → "Oct 30, 2020"; null for blanks and "None". */
export function formatDay(value: string | null | undefined): string | null {
  const ms = parseWallClock(value)
  return ms === null ? null : fmtWall(ms, 'daily')
}

/** No-break space: keeps a number with its unit or hemisphere, so a narrow line never strands "W" or "ft". */
const NBSP = '\u00a0'

/** "45.66° N, 111.07° W" as the catalog sends the degrees, all NBSP-joined: the pair never wraps inside. */
export function formatCoordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return MISSING
  return `${Math.abs(lat)}°${NBSP}${lat < 0 ? 'S' : 'N'},${NBSP}${Math.abs(lon)}°${NBSP}${lon < 0 ? 'W' : 'E'}`
}

/** Elevation in feet from metres, as legacy: round(m × 3.281). */
export const metersToFeet = (m: number): number => Math.round(m * 3.281)

/** "4,905 ft (1,495 m)" from metres (`metersToFeet`; numbers and units joined by NBSP). */
export function formatElevation(m: number): string {
  if (!Number.isFinite(m)) return MISSING
  return `${metersToFeet(m).toLocaleString('en-US')}${NBSP}ft (${Math.round(m).toLocaleString('en-US')}${NBSP}m)`
}

/**
 * Install date to the newest report: "Oct 30, 2020 – today" when it reported
 * on `today` (YYYY-MM-DD), else "Oct 30, 2020 – Oct 1, 2026"; "Since Oct 30,
 * 2020" until `/latest` answers; "—" without an install date.
 */
export function periodOfRecord(installed: string | null, latestStamp: string | null | undefined, today: string): string {
  const from = formatDay(installed)
  if (!from) return MISSING
  const to = formatDay(latestStamp)
  if (!to) return `Since ${from}`
  return `${from} – ${latestStamp?.slice(0, 10) === today ? 'today' : to}`
}

/** "Gallatin County · 45.66° N, 111.07° W" (coordinates alone without a county). */
export function formatLocation(s: Station): string {
  const coords = formatCoordinates(s.latitude, s.longitude)
  return s.county ? `${s.county} County · ${coords}` : coords
}

/** Rows in display order: Station (name, id in mono), Network, Location, Elevation, Record. */
export function stationDetails(s: Station, latestStamp: string | null | undefined, today: string): DetailRow[] {
  return [
    { label: 'Station', value: s.name, id: s.station },
    { label: 'Network', value: s.sub_network || MISSING },
    { label: 'Location', value: formatLocation(s) },
    { label: 'Elevation', value: formatElevation(s.elevation) },
    { label: 'Record', value: periodOfRecord(s.date_installed, latestStamp, today) },
  ]
}
