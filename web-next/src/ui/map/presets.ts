/**
 * The station maps (thin wrappers over ui/map/map.ts + stationLayer):
 *   stationMap    — Latest card: select a station, fly to it.
 *   locatorMap    — About: as stationMap, small; the page keeps one-finger and wheel scrolling.
 *   downloaderMap — Downloader: counties emphasised, click selects, no re-centre (legacy).
 *   pickerMap     — station picker: the whole state stays in view, click selects.
 *
 * Markup: an empty element with a height; the component builds the map,
 * legend panel and sr-only table twin inside it.
 *   <div class="latest-map" x-data="stationMap({ stations: () => $store.station.list,
 *        selected: () => $store.station.id, onSelect: (id) => $store.station.select(id) })"></div>
 * Optional `visible: () => Set|string[]|null` (network filter) and `label`.
 * The keyboard twin (combobox elsewhere, or the sr-only table) calls `onSelect` too.
 */
import Alpine from 'alpinejs'
import type { Station } from '../../core/api'
import { legendRows, selectionAnnouncement, stationRows, visibleStations } from '../../core/map'
import { component } from '../component'
import { announce } from '../shell/live'
import { createLegend } from './legend'
import { createMap, cssVar, type MapHost } from './map'
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
  emphasiseCounties: boolean
  /** Centre on the selected station when it changes. */
  fly: boolean
  /** Map gestures need two fingers or Ctrl/⌘ (ui/map/map.ts `cooperativeGestures`). */
  cooperative?: boolean
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
        emphasiseCounties: preset.emphasiseCounties,
        cooperativeGestures: preset.cooperative,
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
        if (preset.fly && s) host.flyTo([s.longitude, s.latitude], { animate: !first })
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

/** Latest-card station map: selecting a station flies to it. */
export const stationMap = (opts: StationMapOptions) =>
  mapView(opts, { label: 'Map of Montana Mesonet stations', emphasiseCounties: false, fly: true })

/** About locator map: as stationMap, but the page scrolls over it (cooperative gestures). */
export const locatorMap = (opts: StationMapOptions) =>
  mapView({ legendCollapsed: true, ...opts }, { label: 'Locator map of Montana Mesonet stations', emphasiseCounties: false, fly: true, cooperative: true })

/** Downloader station map: county lines emphasised; selection does not move the map. */
export const downloaderMap = (opts: StationMapOptions) =>
  mapView(opts, { label: 'Map of Montana Mesonet stations to download', emphasiseCounties: true, fly: false })

/** Station-picker map: picking a station does not move the map (the whole network stays in view). */
export const pickerMap = (opts: StationMapOptions) =>
  mapView(opts, { label: 'Map of Montana Mesonet stations', emphasiseCounties: false, fly: false })
