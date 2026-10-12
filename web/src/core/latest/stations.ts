/**
 * The Latest network filter (`?nets=`), shared by the station picker and the
 * locator map card: which stations pass, keeping the selected one visible.
 */
import type { Station } from '../api'

/**
 * True when `s` passes the network filter: an empty selection shows every
 * station (legacy ST-003), and the selected station always stays visible.
 */
export function passesNets(s: Pick<Station, 'station' | 'sub_network'>, nets: readonly string[], selected: string | null): boolean {
  return nets.length === 0 || nets.includes(s.sub_network) || s.station === selected
}

/** Ids of the stations the map and picker show for `nets` (see passesNets). */
export function visibleStationIds(list: readonly Station[], nets: readonly string[], selected: string | null): string[] {
  return list.filter((s) => passesNets(s, nets, selected)).map((s) => s.station)
}
