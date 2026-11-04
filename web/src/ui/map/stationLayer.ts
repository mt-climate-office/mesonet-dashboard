/**
 * Station circles on a map host: the kit's one station paint and its colocation module (count badge +
 * spider, MCO.map.colocation), a hover/focus popup (DOM + textContent only — never setHTML;
 * MIGRATION-MATRIX Q3), click to select, focus halo for the keyboard twin. Used through ui/map/presets.ts.
 */
import type * as MapLibre from 'maplibre-gl'
import type { Station } from '../../core/api'
import {
  markerProps,
  popupLines,
  selectedSite,
  siteOf,
  stationRank,
  type MarkerCollection,
  type MarkerProps,
} from '../../core/map'
import type { Theme } from '../../core/palette'
import type { ColocationController } from '../../types/mco'

const SRC = 'stations'
/** Invisible, larger hit targets over every anchor and spider foot (touch-friendly). */
const HIT = 'stations-hit'
const SPIDER_HIT = 'spider-hit'
/** A blank 28 px image: the selected marker's footprint in symbol collision. */
const OBSTACLE = 'station-obstacle'
/** Popup offset (px) over a stacked site: clear of the spider's top foot (26 px out, kit RADIUS_PX). */
const STACKED_OFFSET = 38
const EMPTY: MarkerCollection = { type: 'FeatureCollection', features: [] }

export interface StationLayerInput {
  stations: readonly Station[]
  visible: ReadonlySet<string> | null
  selected: string | null
}

export interface StationLayer {
  /** Host `layers` callback: adds the source and layers for the current theme; returns the features drawn. */
  add(map: MapLibre.Map, theme: Theme): MarkerCollection
  /** New stations / filter / selection; returns the features now drawn. */
  update(input: StationLayerInput): MarkerCollection
  /** Show the popup + focus halo on station `id`'s site (keyboard twin); null hides both. */
  focus(id: string | null): void
  dispose(): void
}

/** Wire a station layer to `map`; `onSelect` gets the clicked station id. */
export function createStationLayer(map: MapLibre.Map, onSelect: (id: string) => void): StationLayer {
  let input: StationLayerInput = { stations: [], visible: null, selected: null }
  let site: string | null = null
  let byId = new Map<string, Station>()
  let hoverId: string | null = null
  let focusId: string | null = null
  /** Where the hovered spider foot is drawn (the spider moves feet off the catalog point). */
  let footAt: [number, number] | null = null
  const A = MCO.map.colocation.ANCHOR_ONLY

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-popup', maxWidth: '260px' })

  // Grouping, the spider, hover-to-fan and click-to-select are the kit's (4-decimal buckets, HydroMet anchors).
  // On touch a first tap on a stacked site only fans it out: selecting navigates (the picker closes), so the
  // second station there must be reachable first.
  const coloc: ColocationController<Station, MarkerProps> = MCO.map.colocation(map, {
    source: SRC,
    rank: stationRank,
    visible: (s: Station) => (input.visible === null || input.visible.has(s.station)) && Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
    properties: (s: Station) => markerProps(s, input.selected, site),
    anchorLayers: [HIT, 'stations-dots', 'stations-badge', 'stations-badge-disc'],
    spiderLayers: [SPIDER_HIT, 'spider-dots'],
    anchorClick: matchMedia('(hover: none)').matches ? 'spider' : undefined,
    onSelect: (id) => onSelect(id),
  })

  const markers = (): MarkerCollection => coloc.collection()

  const setFocusFilter = () => {
    const s = focusId ? byId.get(focusId) : undefined
    const f: MapLibre.FilterSpecification = ['all', A, ['==', ['get', 'bucket'], s ? siteOf(s) : '']]
    if (map.getLayer('stations-focus')) map.setFilter('stations-focus', f)
  }

  /** The popup on `id`: a site's anchor lists every station there; a spider foot only itself. */
  const showPopup = (id: string, foot: boolean) => {
    const s = byId.get(id)
    const info = coloc.info(id)
    if (!s || !info) return popup.remove()
    const ids = foot ? [id] : coloc.members(id).map((m) => m.station)
    const anchor = foot ? s : (coloc.members(id)[0] ?? s)
    const body = document.createElement('div')
    for (const line of popupLines(ids, byId)) {
      const name = document.createElement('p')
      name.className = 'map-popup-name'
      name.textContent = line.name
      const detail = document.createElement('p')
      detail.className = 'map-popup-detail'
      detail.textContent = line.detail
      body.append(name, detail)
    }
    popup.setOffset(!foot && info.count > 1 ? STACKED_OFFSET : 12)
    const at: [number, number] = foot && footAt ? footAt : [anchor.longitude, anchor.latitude]
    popup.setLngLat(at).setDOMContent(body).addTo(map)
    // Decoration for sighted users; the sr-only table twin carries the same text.
    popup.getElement()?.setAttribute('aria-hidden', 'true')
  }

  const onMove = (e: MapLibre.MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    const id = String(f?.properties?.station ?? '')
    const foot = f?.layer.id === SPIDER_HIT
    footAt = foot && f?.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null
    const key = `${foot ? 'foot' : 'site'}:${id}`
    if (id && key !== hoverId) {
      hoverId = key
      showPopup(id, foot)
    }
  }
  const onLeave = () => {
    map.getCanvas().style.cursor = ''
    hoverId = null
    footAt = null
    if (focusId && coloc.info(focusId)) showPopup(focusId, false)
    else popup.remove()
  }
  for (const layer of [HIT, SPIDER_HIT]) {
    map.on('mousemove', layer, onMove)
    map.on('mouseleave', layer, onLeave)
  }

  const rebuild = () => {
    site = selectedSite(input.stations, input.visible, input.selected)
    coloc.setData(input.stations)
    setFocusFilter()
  }

  return {
    add(m) {
      m.addSource(SRC, { type: 'geojson', data: EMPTY })
      coloc.addSources()
      // Selected site on top, then stacked sites.
      const sort: MapLibre.DataDrivenPropertyValueSpecification<number> = [
        '+', ['*', 2, ['get', 'siteSelected']], ['case', MCO.map.colocation.STACKED, 1, 0],
      ]
      const layers: MapLibre.LayerSpecification[] = [
        { id: 'spider-lines', type: 'line', source: coloc.spiderLinesSource, paint: MCO.map.colocation.spiderLinePaint() },
        { id: 'stations-dots', type: 'circle', source: SRC, filter: A, layout: { 'circle-sort-key': sort }, paint: MCO.map.stationPaint() },
        // Selection ring (kit --selection-ring) on the site holding the selected station, whichever member it is.
        {
          id: 'stations-selected', type: 'circle', source: SRC, filter: ['all', A, ['==', ['get', 'siteSelected'], 1]],
          paint: MCO.map.selectionPaint(),
        },
        // Keyboard focus halo in the kit focus-ring color (--accent-line): the visible focus indicator
        // while a twin-table button (sr-only) has focus.
        { id: 'stations-focus', type: 'circle', source: SRC, filter: ['all', A, ['==', ['get', 'bucket'], '']], paint: MCO.map.focusPaint() },
        ...MCO.map.colocation.badgeLayers({ id: 'stations-badge', source: SRC }),
        // An invisible collision box over the selected marker: basemap labels (placed after it) step
        // aside instead of running under the ring (map.ts letPlaceLabelsMove).
        {
          id: 'stations-selected-obstacle', type: 'symbol', source: SRC, filter: ['all', A, ['==', ['get', 'siteSelected'], 1]],
          layout: { 'icon-image': OBSTACLE, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
        },
        { id: HIT, type: 'circle', source: SRC, filter: A, layout: { 'circle-sort-key': sort }, paint: MCO.map.hitPaint() },
        { id: 'spider-dots', type: 'circle', source: coloc.spiderSource, paint: MCO.map.stationPaint() },
        { id: 'spider-selected', type: 'circle', source: coloc.spiderSource, filter: ['==', ['get', 'selected'], 1], paint: MCO.map.selectionPaint() },
        { id: SPIDER_HIT, type: 'circle', source: coloc.spiderSource, paint: MCO.map.hitPaint() },
      ]
      if (!m.hasImage(OBSTACLE)) m.addImage(OBSTACLE, { width: 28, height: 28, data: new Uint8Array(28 * 28 * 4) })
      for (const l of layers) if (!m.getLayer(l.id)) m.addLayer(l)
      rebuild()
      return markers()
    },

    update(next) {
      input = next
      byId = new Map(next.stations.map((s) => [s.station, s]))
      rebuild()
      if (hoverId && !coloc.info(hoverId.slice(hoverId.indexOf(':') + 1))) onLeave()
      return markers()
    },

    focus(id) {
      focusId = id
      setFocusFilter()
      if (id && coloc.info(id)) showPopup(id, false)
      else if (!hoverId) popup.remove()
    },

    dispose() {
      for (const layer of [HIT, SPIDER_HIT]) {
        map.off('mousemove', layer, onMove)
        map.off('mouseleave', layer, onLeave)
      }
      coloc.dispose()
      popup.remove()
    },
  }
}
