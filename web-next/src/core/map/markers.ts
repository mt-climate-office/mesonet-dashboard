/**
 * Station markers for the map host: catalog rows → one GeoJSON point per
 * location (co-located stations merged by core/downloader `groupStations`),
 * each carrying its resolved paint (fill, stroke, halo) for the current theme.
 */
import type { Station } from '../api'
import { groupStations } from '../downloader/stationGroups'
import { NETWORK_COLOR, NETWORK_SHAPE, resolve, type NetworkName, type NetworkShape, type Theme } from '../palette'

/** Reads a kit CSS variable (the UI passes a getComputedStyle reader). */
export type GetVar = (name: string) => string

/** Kit chrome tokens the marker shapes use (outline, hollow centre). */
const DOT_STROKE = { token: '--dot-stroke' }
const SURFACE = { token: '--bg-surface' }

/** Draw order when one marker holds several networks: the first listed is the inner dot. */
const NETWORK_ORDER: readonly NetworkName[] = ['HydroMet', 'AgriMet', 'Cooperator']

/** The catalog's `sub_network` as a palette network; anything unknown is HydroMet (legacy rule). */
export function asNetwork(subNetwork: string): NetworkName {
  return (NETWORK_ORDER as readonly string[]).includes(subNetwork) ? (subNetwork as NetworkName) : 'HydroMet'
}

export interface MarkerStyle {
  fill: string
  stroke: string
  /** Stroke width in px. */
  strokeWidth: number
}

/**
 * Paint for one network's marker shape (NETWORK_SHAPE), so shape — not only
 * color — tells networks apart: filled dot, hollow dot (surface centre,
 * thick colored edge), thin ring.
 */
export function markerStyle(network: NetworkName, theme: Theme, getVar: GetVar): MarkerStyle {
  const color = NETWORK_COLOR[theme][network]
  const shape: NetworkShape = NETWORK_SHAPE[network]
  if (shape === 'circle-hollow') return { fill: resolve(SURFACE, getVar), stroke: color, strokeWidth: 2.5 }
  if (shape === 'ring') return { fill: 'rgba(0,0,0,0)', stroke: color, strokeWidth: 1.5 }
  return { fill: color, stroke: resolve(DOT_STROKE, getVar), strokeWidth: 1.2 }
}

/** GeoJSON properties of one marker (MapLibre properties must be primitives). */
export interface MarkerProps {
  /** Group key: the member codes joined by ",". */
  key: string
  /** Inner-dot network (first of NETWORK_ORDER present). */
  network: NetworkName
  /** Every network in the marker, NETWORK_ORDER, joined by ",". */
  networks: string
  fill: string
  stroke: string
  strokeWidth: number
  /** Outer ring color for co-located markers (the second network), '' otherwise. */
  halo: string
  /** 1 when the marker contains the selected station. */
  selected: 0 | 1
  /** circle-sort-key: selected on top, then co-located. */
  sort: number
}

/** GeoJSON point feature (RFC 7946), structurally what MapLibre's setData takes. */
export interface MarkerFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: MarkerProps
}
export interface MarkerCollection {
  type: 'FeatureCollection'
  features: MarkerFeature[]
}

export interface MarkerInput {
  stations: readonly Station[]
  /** Station ids to show; null shows every station (network filter input). */
  visible: ReadonlySet<string> | null
  selected: string | null
  theme: Theme
  getVar: GetVar
}

/** Visible catalog rows with finite coordinates, in catalog order. */
export function visibleStations(stations: readonly Station[], visible: ReadonlySet<string> | null): Station[] {
  return stations.filter(
    (s) => (visible === null || visible.has(s.station)) && Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
  )
}

/** One marker per location among the visible stations; a selected station outside `visible` gets no ring. */
export function stationMarkers({ stations, visible, selected, theme, getVar }: MarkerInput): MarkerCollection {
  const shown = visibleStations(stations, visible)
  const netOf = new Map(shown.map((s) => [s.station, asNetwork(s.sub_network)]))
  const features = groupStations(shown, selected).map((g): MarkerFeature => {
    const nets = NETWORK_ORDER.filter((n) => g.codes.some((c) => netOf.get(c) === n))
    const network = nets[0] ?? 'HydroMet'
    const style = markerStyle(network, theme, getVar)
    const coLocated = g.codes.length > 1
    const halo = coLocated ? NETWORK_COLOR[theme][nets[1] ?? network] : ''
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.longitude, g.latitude] },
      properties: {
        key: g.codes.join(','),
        network,
        networks: nets.join(','),
        ...style,
        halo,
        selected: g.selected ? 1 : 0,
        sort: (g.selected ? 2 : 0) + (coLocated ? 1 : 0),
      },
    }
  })
  return { type: 'FeatureCollection', features }
}

/** Codes of a marker from its `key`. */
export const keyCodes = (key: string): string[] => (key ? key.split(',') : [])

/**
 * Station a click on a marker selects: the first code, or — when the marker
 * already holds the selection — the next one, so a pointer can reach every
 * co-located station (legacy always took the first).
 */
export function clickTarget(key: string, selected: string | null): string | null {
  const codes = keyCodes(key)
  if (codes.length === 0) return null
  const i = selected ? codes.indexOf(selected) : -1
  return codes[(i + 1) % codes.length]
}

/** Marker key containing station `id`, or null. */
export function markerKeyOf(markers: MarkerCollection, id: string | null): string | null {
  if (!id) return null
  const f = markers.features.find((m) => keyCodes(m.properties.key).includes(id))
  return f ? f.properties.key : null
}
