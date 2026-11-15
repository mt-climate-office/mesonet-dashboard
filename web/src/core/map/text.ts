/**
 * Plain-text models the station map renders: the hover/focus popup, the
 * `.sr-only` table twin and the live-region announcement. Strings only — the
 * UI puts them in the DOM with textContent, never as HTML.
 */
import { formatElevation } from '../about/details'
import type { Station } from '../api'
import { asNetwork } from './markers'

export interface PopupLine {
  /** Station name (falls back to the id). */
  name: string
  /** "HydroMet · 4,595 ft (1,400 m)", in the display units as About shows it (elevation omitted when unknown). */
  detail: string
}

/** Popup lines for a marker's codes, in code order; unknown ids are skipped. */
export function popupLines(codes: readonly string[], byId: ReadonlyMap<string, Station>): PopupLine[] {
  const out: PopupLine[] = []
  for (const id of codes) {
    const s = byId.get(id)
    if (!s) continue
    const elev = Number.isFinite(s.elevation) ? formatElevation(s.elevation) : null
    out.push({ name: s.name || s.station, detail: [asNetwork(s.sub_network), elev].filter(Boolean).join(' · ') })
  }
  return out
}

export interface StationRow {
  id: string
  name: string
  network: string
  /** County name, or "—" when the catalog has none. */
  county: string
}

/** Table-twin rows for the visible stations, sorted by name then id. */
export function stationRows(stations: readonly Station[]): StationRow[] {
  return stations
    .map((s) => ({ id: s.station, name: s.name || s.station, network: asNetwork(s.sub_network), county: s.county || '—' }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

/** Live-region text for a newly selected station, e.g. "Selected Bozeman (acebozem), HydroMet, Gallatin County." */
export function selectionAnnouncement(s: Station | undefined): string {
  if (!s) return 'No station selected.'
  const county = s.county ? `, ${s.county} County` : ''
  return `Selected ${s.name || s.station} (${s.station}), ${asNetwork(s.sub_network)}${county}.`
}
