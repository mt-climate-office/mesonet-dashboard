/**
 * Station grouping and marker colours for the Downloader map, ported from
 * legacy `plotting.plot_station` (stations grouped by identical lat/lon):
 *   - AgriMet → #00cc96, everything else (HydroMet) → #7A7AFB,
 *   - co-located (more than one station at a point) → #FB7A7A,
 *   - the group containing the selected station → #FFD700.
 * Hover text lists the long names ("{name} ({sub_network})"); a click picks
 * the first station code of the group (legacy sorted the codes with
 * np.unique, i.e. alphabetically).
 */
import type { Station } from '../../lib/api'

export const DL_MARKER_COLORS = {
  AgriMet: '#00cc96',
  HydroMet: '#7A7AFB',
  coLocated: '#FB7A7A',
  selected: '#FFD700',
} as const

export interface StationGroup {
  longitude: number
  latitude: number
  /** Station codes, sorted (legacy np.unique order). */
  codes: string[]
  /** "{name} ({sub_network})" per station, in input order. */
  longNames: string[]
  color: string
  selected: boolean
}

export function groupStations(
  stations: ReadonlyArray<Station>,
  selected: string | null,
): StationGroup[] {
  const byPoint = new Map<string, Station[]>()
  for (const s of stations) {
    if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) continue
    const key = `${s.latitude},${s.longitude}`
    const list = byPoint.get(key)
    if (list) list.push(s)
    else byPoint.set(key, [s])
  }
  const out: StationGroup[] = []
  for (const list of byPoint.values()) {
    const longNames = list.map((s) => `${s.name} (${s.sub_network})`)
    const codes = [...new Set(list.map((s) => s.station))].sort()
    const isSelected = selected != null && codes.includes(selected)
    let color: string =
      list.length > 1
        ? DL_MARKER_COLORS.coLocated
        : longNames[0].includes('AgriMet')
          ? DL_MARKER_COLORS.AgriMet
          : DL_MARKER_COLORS.HydroMet
    if (isSelected) color = DL_MARKER_COLORS.selected
    out.push({
      longitude: list[0].longitude,
      latitude: list[0].latitude,
      codes,
      longNames,
      color,
      selected: isSelected,
    })
  }
  return out
}
