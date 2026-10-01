/** Station camera catalog (`/photos/`). */
import { fetchCsv } from './http'

/**
 * Camera metadata for every station that has photos. The "Photo Directions"
 * column comes back as a Python-list-shaped string like
 * `['N (North)', 'SNOW (Snow Platform)']` so we parse it client-side.
 */
export interface PhotoStationRow {
  'Station ID': string
  'Camera Manufacturer': string
  'Camera Model': string
  'Photo Start Date': string
  'Photo Directions': string
}

export interface PhotoDirection {
  /** Code used in the URL path (e.g. `N`, `SNOW`, `NS`). */
  value: string
  /** Human label from the metadata (e.g. `North`, `Snow Platform`). */
  label: string
}

export interface PhotoMeta {
  station: string
  manufacturer: string
  model: string
  startDate: string
  directions: PhotoDirection[]
}

const DIRECTION_REGEX = /'([^']+)'/g

function parseDirections(raw: string): PhotoDirection[] {
  const out: PhotoDirection[] = []
  for (const match of raw.matchAll(DIRECTION_REGEX)) {
    const item = match[1]
    const m = item.match(/^([^\s(]+)\s*\(([^)]+)\)\s*$/)
    if (m) {
      out.push({ value: m[1], label: m[2] })
    } else {
      out.push({ value: item, label: item })
    }
  }
  return out
}

export async function getPhotoCatalog(): Promise<PhotoMeta[]> {
  const rows = await fetchCsv<PhotoStationRow>('photos/')
  return rows
    .map((r) => ({
      station: String(r['Station ID']),
      manufacturer: String(r['Camera Manufacturer'] ?? ''),
      model: String(r['Camera Model'] ?? ''),
      startDate: String(r['Photo Start Date'] ?? ''),
      directions: parseDirections(String(r['Photo Directions'] ?? '')),
    }))
    .filter((m) => m.station)
}
