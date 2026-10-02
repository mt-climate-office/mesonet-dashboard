/**
 * Station grouping for the station maps (core/map/markers.ts), ported from
 * legacy `plotting.plot_station`: stations at an identical lat/lon form one
 * marker. Marker colours come from core/palette network roles, not here.
 * A click picks the first station code of the group (legacy sorted the codes
 * with np.unique, i.e. alphabetically).
 */
import type { Station } from '../api'

export interface StationGroup {
  longitude: number
  latitude: number
  /** Station codes, sorted (legacy np.unique order). */
  codes: string[]
  /** "{name} ({sub_network})" per station, in input order. */
  longNames: string[]
  selected: boolean
}

/** One group per distinct lat/lon (rows without coordinates skipped); `selected` marks the group holding that code. */
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
    out.push({
      longitude: list[0].longitude,
      latitude: list[0].latitude,
      codes,
      longNames,
      selected: isSelected,
    })
  }
  return out
}
