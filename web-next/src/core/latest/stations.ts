// TEMP: replaced by latest-main at merge (their core/latest/stations.ts owns this helper).
/** Station filtering for the Latest tab's maps. Pure. */
import type { Station } from '../api'

/**
 * Ids of the stations to show for the network filter `nets` (empty = all,
 * returns null). The selected station always stays visible, as legacy did.
 */
export function visibleStationIds(
  list: readonly Station[],
  nets: readonly string[],
  selected: string | null,
): Set<string> | null {
  if (nets.length === 0) return null
  return new Set(list.filter((s) => nets.includes(s.sub_network) || s.station === selected).map((s) => s.station))
}
