/**
 * Station markers for the map host (kit 0.21.0, HOUSE-STYLE §7): every station draws the same
 * (`MCO.map.stationPaint`), and the stations at one site are one marker with a count badge and a
 * spider (`MCO.map.colocation`, which groups by its 4-decimal buckets). The pure parts live here:
 * the anchor rank, each station's feature properties and the selected site.
 */
import type { Station } from '../api'
import type { NetworkName } from '../palette'
import type { ColocationProps, PointCollection } from '../../types/mco'

/** The catalog's networks, in anchor order: the first present at a site is the marker drawn. */
const NETWORK_ORDER: readonly NetworkName[] = ['HydroMet', 'AgriMet', 'Cooperator']

/** The catalog's `sub_network` as a network name; anything unknown is HydroMet (legacy rule). */
export function asNetwork(subNetwork: string): NetworkName {
  return (NETWORK_ORDER as readonly string[]).includes(subNetwork) ? (subNetwork as NetworkName) : 'HydroMet'
}

/** `MCO.map.colocation` rank (lower = the site's anchor): HydroMet, then AgriMet, then Cooperator. */
export const stationRank = (s: Station): number => NETWORK_ORDER.indexOf(asNetwork(s.sub_network))

/** Visible catalog rows with finite coordinates, in catalog order. */
export function visibleStations(stations: readonly Station[], visible: ReadonlySet<string> | null): Station[] {
  return stations.filter(
    (s) => (visible === null || visible.has(s.station)) && Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
  )
}

/** A station's site: the kit's colocation bucket ("lat,lon" to 4 decimals, about 11 m). */
export const siteOf = (s: Pick<Station, 'latitude' | 'longitude'>): string =>
  MCO.map.colocation.bucketKey(s.latitude, s.longitude)

/** The app's properties on each station feature (MapLibre properties must be primitives). */
export interface MarkerProps {
  station: string
  /** 1 on the selected station (its spider foot carries the ring). */
  selected: 0 | 1
  /** 1 on every station at the selected station's site (the anchor carries the ring while the spider is shut). */
  siteSelected: 0 | 1
}

/** Features as `MCO.map.colocation` emits them: the app's properties plus its count, index and bucket. */
export type MarkerCollection = PointCollection<MarkerProps & ColocationProps>

/**
 * The site holding `selected` when that station is visible, else null (a selected station the filter
 * hides gets no ring, and lends none to the stations beside it).
 */
export function selectedSite(stations: readonly Station[], visible: ReadonlySet<string> | null, selected: string | null): string | null {
  if (!selected) return null
  const s = visibleStations(stations, visible).find((x) => x.station === selected)
  return s ? siteOf(s) : null
}

/** Feature properties for station `s`, given the selected id and its site (`selectedSite`). */
export function markerProps(s: Station, selected: string | null, site: string | null): MarkerProps {
  return {
    station: s.station,
    selected: s.station === selected ? 1 : 0,
    siteSelected: site !== null && siteOf(s) === site ? 1 : 0,
  }
}
