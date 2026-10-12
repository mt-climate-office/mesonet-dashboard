/**
 * Station circles on a map host: markers from core/map, hover/focus popup
 * (DOM + textContent only — never setHTML; MIGRATION-MATRIX Q3), click to
 * select, focus halo for the keyboard twin. Used through ui/map/presets.ts.
 */
import type * as MapLibre from 'maplibre-gl'
import type { Station } from '../../core/api'
import {
  clickTarget,
  keyCodes,
  markerKeyOf,
  popupLines,
  stationMarkers,
  type MarkerCollection,
} from '../../core/map'
import { SELECTION_RING, resolve, type Theme } from '../../core/palette'
import { cssVar } from './map'

const SRC = 'stations'
/** Invisible, larger hit target over every marker (touch-friendly). */
const HIT = 'stations-hit'
/** A blank 28 px image: the selected marker's footprint in symbol collision. */
const OBSTACLE = 'station-obstacle'

export interface StationLayerInput {
  stations: readonly Station[]
  visible: ReadonlySet<string> | null
  selected: string | null
}

export interface StationLayer {
  /** Host `layers` callback: adds the source and circle layers for `theme`; returns the markers drawn. */
  add(map: MapLibre.Map, theme: Theme): MarkerCollection
  /** New stations / filter / selection; returns the markers now drawn. */
  update(input: StationLayerInput): MarkerCollection
  /** Show the popup + focus halo on station `id` (keyboard twin); null hides both. */
  focus(id: string | null): void
  dispose(): void
}


// Base dot radius by zoom; rings add a pad on top (a number, or a per-feature
// expression — zoom must stay the top-level interpolate input).
type Pad = number | MapLibre.ExpressionSpecification
const radius = (pad: Pad): MapLibre.ExpressionSpecification => [
  'interpolate', ['linear'], ['zoom'], 4, ['+', 4.5, pad], 8, ['+', 6, pad], 12, ['+', 9, pad],
]
const HAS_HALO: MapLibre.ExpressionSpecification = ['!=', ['get', 'halo'], '']

/** Wire a station layer to `map`; `onSelect` gets the clicked station id. */
export function createStationLayer(map: MapLibre.Map, onSelect: (id: string) => void): StationLayer {
  let input: StationLayerInput = { stations: [], visible: null, selected: null }
  let markers: MarkerCollection = { type: 'FeatureCollection', features: [] }
  let byId = new Map<string, Station>()
  let hoverKey: string | null = null
  let focusId: string | null = null

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-popup', maxWidth: '260px' })

  const rebuild = (theme: Theme = MCO.getTheme()) => {
    markers = stationMarkers({ ...input, theme, getVar: cssVar })
    ;(map.getSource(SRC) as MapLibre.GeoJSONSource | undefined)?.setData(markers)
    const focusKey = markerKeyOf(markers, focusId) ?? ''
    if (map.getLayer('stations-focus')) map.setFilter('stations-focus', ['==', ['get', 'key'], focusKey])
  }

  const showPopup = (key: string) => {
    const f = markers.features.find((m) => m.properties.key === key)
    if (!f) return popup.remove()
    const body = document.createElement('div')
    for (const line of popupLines(keyCodes(key), byId)) {
      const name = document.createElement('p')
      name.className = 'map-popup-name'
      name.textContent = line.name
      const detail = document.createElement('p')
      detail.className = 'map-popup-detail'
      detail.textContent = line.detail
      body.append(name, detail)
    }
    popup.setLngLat(f.geometry.coordinates).setDOMContent(body).addTo(map)
    // Decoration for sighted users; the sr-only table twin carries the same text.
    popup.getElement()?.setAttribute('aria-hidden', 'true')
  }

  const featureKey = (e: MapLibre.MapLayerMouseEvent) => String(e.features?.[0]?.properties?.key ?? '')
  const onMove = (e: MapLibre.MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = 'pointer'
    const key = featureKey(e)
    if (key && key !== hoverKey) showPopup((hoverKey = key))
  }
  const onLeave = () => {
    map.getCanvas().style.cursor = ''
    hoverKey = null
    const key = markerKeyOf(markers, focusId)
    if (key) showPopup(key)
    else popup.remove()
  }
  const onClick = (e: MapLibre.MapLayerMouseEvent) => {
    const id = clickTarget(featureKey(e), input.selected)
    if (id) onSelect(id)
  }
  map.on('mousemove', HIT, onMove)
  map.on('mouseleave', HIT, onLeave)
  map.on('click', HIT, onClick)

  return {
    add(m, theme) {
      m.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      const ring = resolve(SELECTION_RING, cssVar)
      // Co-located outer ring (second network's color) under the dot.
      m.addLayer({
        id: 'stations-halo', type: 'circle', source: SRC, filter: HAS_HALO,
        layout: { 'circle-sort-key': ['get', 'sort'] },
        paint: { 'circle-radius': radius(3.5), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2.5, 'circle-stroke-color': ['get', 'halo'] },
      })
      m.addLayer({
        id: 'stations-dots', type: 'circle', source: SRC,
        layout: { 'circle-sort-key': ['get', 'sort'] },
        paint: {
          'circle-radius': radius(0),
          'circle-color': ['get', 'fill'],
          'circle-stroke-color': ['get', 'stroke'],
          'circle-stroke-width': ['get', 'strokeWidth'],
        },
      })
      // Selection ring: kit --selection-ring, outside the halo when co-located.
      m.addLayer({
        id: 'stations-selected', type: 'circle', source: SRC, filter: ['==', ['get', 'selected'], 1],
        paint: {
          'circle-radius': radius(['case', HAS_HALO, 7.5, 4.5]),
          'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-stroke-color': ring,
        },
      })
      // Keyboard focus halo in the kit focus-ring color (--accent-line): the visible
      // focus indicator while a twin-table button (sr-only) has focus.
      m.addLayer({
        id: 'stations-focus', type: 'circle', source: SRC, filter: ['==', ['get', 'key'], ''],
        paint: {
          'circle-radius': radius(11), 'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--accent-line'),
        },
      })
      // An invisible collision box over the selected marker: basemap labels (placed after it) step
      // aside instead of running under the ring (map.ts letPlaceLabelsMove).
      if (!m.hasImage(OBSTACLE)) m.addImage(OBSTACLE, { width: 28, height: 28, data: new Uint8Array(28 * 28 * 4) })
      m.addLayer({
        id: 'stations-selected-obstacle', type: 'symbol', source: SRC, filter: ['==', ['get', 'selected'], 1],
        layout: { 'icon-image': OBSTACLE, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      })
      m.addLayer({
        id: HIT, type: 'circle', source: SRC,
        // Same order as the drawn dots, so the marker on top is the one hit.
        layout: { 'circle-sort-key': ['get', 'sort'] },
        paint: { 'circle-radius': radius(7), 'circle-color': 'rgba(0,0,0,0)' },
      })
      rebuild(theme)
      return markers
    },

    update(next) {
      input = next
      byId = new Map(next.stations.map((s) => [s.station, s]))
      rebuild()
      if (hoverKey && !markers.features.some((f) => f.properties.key === hoverKey)) onLeave()
      return markers
    },

    focus(id) {
      focusId = id
      rebuild()
      const key = markerKeyOf(markers, id)
      if (key) showPopup(key)
      else if (!hoverKey) popup.remove()
    },

    dispose() {
      map.off('mousemove', HIT, onMove)
      map.off('mouseleave', HIT, onLeave)
      map.off('click', HIT, onClick)
      popup.remove()
    },
  }
}
