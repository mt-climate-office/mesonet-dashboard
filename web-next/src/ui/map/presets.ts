/**
 * The station maps (thin wrappers over ui/map/map.ts + stationLayer):
 *   stationMap    — Latest card: select a station, fly to it.
 *   locatorMap    — About: frames the selected station and its near neighbours clear of the overlays;
 *                   the page keeps one-finger and wheel scrolling.
 *   pickerMap     — station picker: the whole state stays in view, click selects; cooperative on touch.
 *   landingMap    — the no-station landing: the picker's map, large, its legend open beside Montana.
 *
 * Markup: an empty element with a height; the component builds the map,
 * legend panel and sr-only table twin inside it.
 *   <div class="latest-map" x-data="stationMap({ stations: () => $store.station.list,
 *        selected: () => $store.station.id, onSelect: (id) => $store.station.select(id) })"></div>
 * Optional `visible: () => Set|string[]|null` (network filter) and `label`.
 * The keyboard twin (combobox elsewhere, or the sr-only table) calls `onSelect` too.
 */
import Alpine from 'alpinejs'
import type * as MapLibre from 'maplibre-gl'
import type { Station } from '../../core/api'
import { locatorFrame, locatorZoom } from '../../core/about'
import { legendRows, selectionAnnouncement, stationRows, visibleStations } from '../../core/map'
import { component } from '../component'
import { announce } from '../shell/live'
import { createLegend } from './legend'
import { createMap, cssVar, type FitPadding, type MapHost } from './map'
import { createSrTable } from './srTable'
import { createStationLayer, type StationLayer } from './stationLayer'

export interface StationMapOptions {
  stations: () => readonly Station[]
  /** Selected station id, or null. */
  selected: () => string | null
  /** A marker click or twin-table button picked `id`; the caller updates `selected`. */
  onSelect: (id: string) => void
  /** Station ids to show (network filter); null/undefined shows all. */
  visible?: () => ReadonlySet<string> | readonly string[] | null | undefined
  /** Start the legend collapsed at every width (narrow drawers). */
  legendCollapsed?: boolean
  /** Accessible name for the map. */
  label?: string
}

interface Preset {
  label: string
  /** Centre on the selected station when it changes. */
  fly: boolean
  /**
   * With `fly`: frame the selected station and its nearest neighbour (core/about `locatorFrame`, at a
   * zoom held to 7–8 by `locatorZoom`) inside the space clear of the legend (top-left), the zoom buttons
   * and the attribution (right).
   */
  frame?: boolean
  /** Map gestures need two fingers or Ctrl/⌘ (ui/map/map.ts `cooperativeGestures`). */
  cooperative?: boolean
  /** Fit padding (ui/map/map.ts `fitPadding`: fixed, or a function of the frame's size). */
  fitPadding?: FitPadding
}

const toSet = (v: ReadonlySet<string> | readonly string[] | null | undefined): ReadonlySet<string> | null =>
  v == null ? null : v instanceof Set ? v : new Set(v as readonly string[])

function mapView(opts: StationMapOptions, preset: Preset) {
  // MapLibre objects live in this closure, never in Alpine's reactive data
  // (a reactive proxy around a Map breaks it and costs every frame).
  let host: MapHost | null = null
  let layer: StationLayer | null = null
  let effect: ReturnType<typeof Alpine.effect> | null = null

  return component({
    init() {
      const root = this.$el as HTMLElement
      root.classList.add('map-frame')
      const canvas = document.createElement('div')
      canvas.className = 'map-canvas'
      const legend = createLegend('Stations', { collapsed: opts.legendCollapsed })
      const table = createSrTable({
        caption: 'Stations shown on the map',
        onSelect: (id) => opts.onSelect(id),
        onFocus: (id) => layer?.focus(id),
      })
      root.append(canvas, legend.element, table.element)

      host = createMap(canvas, {
        label: opts.label ?? preset.label,
        cooperativeGestures: preset.cooperative,
        refit: !preset.fly,
        fitPadding: preset.fitPadding,
        layers: (map, theme) => {
          const markers = layer?.add(map, theme)
          if (markers) legend.render(legendRows(markers, theme, cssVar))
        },
      })
      layer = createStationLayer(host.map, (id) => opts.onSelect(id))

      let last: string | null | undefined // undefined until the first run
      effect = Alpine.effect(() => {
        const stations = opts.stations()
        const selected = opts.selected()
        const visible = toSet(opts.visible?.())
        if (!layer || !host) return
        const markers = layer.update({ stations, visible, selected })
        legend.render(legendRows(markers, MCO.getTheme(), cssVar))
        table.render(stationRows(visibleStations(stations, visible)), selected)

        // Selection side effects wait for the catalog; the first one seen is the
        // page's initial state (deep link), so it is neither announced nor animated.
        const s = selected ? stations.find((x) => x.station === selected) : undefined
        if (!stations.length || selected === last || (selected && !s)) return
        const first = last === undefined
        last = selected
        if (!first) announce(selectionAnnouncement(s))
        // Centre the station in the space below the legend (top-left), so the legend covers less around it.
        const legendBottom = legend.element.offsetTop + legend.element.offsetHeight
        if (!preset.fly || !s) return
        const box = preset.frame ? locatorFrame(stations, s.station) : null
        if (box && host.fitTo(box, { padding: clearOfOverlays(legendBottom), zoom: locatorZoom, animate: !first })) return
        host.flyTo([s.longitude, s.latitude], { animate: !first, offset: [0, legendBottom / 2] })
      })
    },

    /** Select station `id` (same path as a marker click). */
    select(id: string) {
      opts.onSelect(id)
    },

    destroy() {
      if (effect) Alpine.release(effect)
      layer?.dispose()
      host?.dispose()
      effect = layer = host = null
    },
  })
}

/**
 * Fit padding (px) that keeps markers 8 px clear of the frame's overlays: the legend (top-left, measured)
 * and the zoom buttons and attribution ⓘ down the right edge (10 px in, 31 px wide, 42 px on touch:
 * map.css). Those are sizes, not measurements: the controls are not in the DOM at the first fit.
 */
function clearOfOverlays(legendBottom: number): Required<MapLibre.PaddingOptions> {
  const control = 10 + (matchMedia('(hover: none)').matches ? 42 : 31) + 8
  return { top: legendBottom + 8, right: control, bottom: control, left: 12 }
}

/** Latest-card station map: selecting a station flies to it. */
export const stationMap = (opts: StationMapOptions) =>
  mapView(opts, { label: 'Map of Montana Mesonet stations', fly: true })

/** About locator map: frames the station and its neighbours; the page scrolls over it (cooperative gestures). */
export const locatorMap = (opts: StationMapOptions) =>
  mapView({ legendCollapsed: true, ...opts }, { label: 'Locator map of Montana Mesonet stations', fly: true, frame: true, cooperative: true })

/**
 * Station-picker map: picking a station does not move the map (the whole network stays in view).
 * On touch, two fingers move it, so one finger still scrolls the sheet or drawer. The frame is
 * small (303 × 240 in the drawer), so Montana fits below the collapsed legend (top-left) and left
 * of the zoom controls (top-right; 40 px buttons on touch, map.css) instead of under them.
 */
export const pickerMap = (opts: StationMapOptions) => {
  const touch = matchMedia('(hover: none)').matches
  return mapView(opts, {
    label: 'Map of Montana Mesonet stations',
    fly: false,
    cooperative: touch,
    fitPadding: { top: 56, right: touch ? 56 : 48, bottom: 16, left: 12 },
  })
}

/** Montana's width over its height on the web-mercator map (about 12° of longitude by 4.6° of latitude). */
const MT_ASPECT = 1.8

/**
 * No-station landing map (partials/landing.html): the picker map at page size. The legend starts open
 * except on compact screens (ui/map/legend.ts), so on a wide frame Montana fits right of it. A phone's
 * frame is taller than Montana: the state is centred at full width when that clears the zoom buttons
 * (three, 40 px on touch: map.css), else it sits just below them. On touch two fingers move the map
 * and one scrolls the page.
 */
export const landingMap = (opts: StationMapOptions) => {
  const touch = matchMedia('(hover: none)').matches
  const controls = 10 + 3 * (touch ? 40 : 29) + 8
  const fitPadding = (w: number, h: number): MapLibre.PaddingOptions => {
    if (matchMedia('(min-width: 900px)').matches && !MCO.viewport.isCompact()) return { top: 24, right: 64, bottom: 24, left: 220 }
    if (!matchMedia('(max-width: 640px)').matches) return { top: touch ? 76 : 56, right: touch ? 56 : 48, bottom: 16, left: 12 }
    const centredTop = (h - (w - 24) / MT_ASPECT) / 2
    return { top: centredTop >= controls ? 12 : controls, right: 12, bottom: 12, left: 12 }
  }
  return mapView(opts, { label: 'Map of Montana Mesonet stations', fly: false, cooperative: touch, fitPadding })
}
