/**
 * The one MapLibre host (ARCHITECTURE "one map host"): CARTO basemap per theme,
 * kit controls + zoom floor, hillshade and Montana boundaries, then the
 * caller's layers. Re-themes with setStyle and re-adds everything on style.load.
 */
import type * as MapLibre from 'maplibre-gl'
import { THEME_EVENT, type Theme } from '../../core/theme'

/** Vendored kit boundaries (public/geo/README.md), served beside the app. */
const GEO = `${import.meta.env.BASE_URL}geo/`

/** A kit CSS variable's current value (MapLibre paints can't read var(); kit MIGRATING). */
export const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export interface MapHostOptions {
  /** Accessible name of the map container (role="application"). */
  label: string
  /**
   * Adds the caller's sources/layers. Runs after every style load (first
   * load and each theme switch), above the boundaries; `theme` is current.
   */
  layers: (map: MapLibre.Map, theme: Theme) => void
  /**
   * One finger (touch) and a plain wheel scroll the page; two fingers or
   * Ctrl/⌘ + wheel move the map. For small maps in a scrolling page.
   */
  cooperativeGestures?: boolean
  /** Fit Montana again whenever the frame resizes, until the user moves the map (a frame that grows on reveal). */
  refit?: boolean
  /** Padding (px) when fitting Montana, for overlays on the frame (default the kit's 24 all round). */
  fitPadding?: MapLibre.PaddingOptions
}

export interface MapHost {
  readonly map: MapLibre.Map
  /**
   * Centre on a point, zooming in to at least `minZoom` (default 8); animates unless `animate` is false or
   * motion is reduced. `offset` (px, [x, y]) moves the point from the centre, e.g. below an overlay.
   */
  flyTo(lngLat: [number, number], opts?: { minZoom?: number; animate?: boolean; offset?: [number, number] }): void
  /**
   * Fit `bounds` ([[w, s], [e, n]]) inside the frame less `padding` (px, for overlays), zoomed in no
   * further than `maxZoom`; animates unless `animate` is false or motion is reduced. Returns false (and
   * does nothing) when the frame is too small for the padding.
   */
  fitTo(bounds: [[number, number], [number, number]], opts: { padding: Required<MapLibre.PaddingOptions>; maxZoom: number; animate?: boolean }): boolean
  /** Remove listeners and the map (call from Alpine `destroy`). */
  dispose(): void
}

/** Create the map inside `el` (which must have a height). */
export function createMap(el: HTMLElement, opts: MapHostOptions): MapHost {
  el.setAttribute('role', 'application')
  el.setAttribute('aria-label', opts.label)
  const fitOpts: MapLibre.FitBoundsOptions = { ...MCO.map.FIT_OPTS, ...(opts.fitPadding ? { padding: opts.fitPadding } : {}) }

  const map = new maplibregl.Map({
    container: el,
    style: MCO.map.cartoStyleUrl(),
    bounds: MCO.map.MT_FIT_BOUNDS,
    fitBoundsOptions: fitOpts,
    attributionControl: { compact: true },
    // Rotation is off in house maps (no compass, HOUSE-STYLE §7).
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    cooperativeGestures: opts.cooperativeGestures === true,
  })
  map.touchZoomRotate.disableRotation()
  map.keyboard.disableRotation()
  MCO.map.addNavigation(map)
  MCO.map.addFitControl(map, { fitOpts })
  const floor = MCO.map.installZoomFloor(map, { fitOpts })
  map.once('load', () => floor.refresh())
  // MapLibre opens the compact attribution when its text first arrives; on small maps it covers the
  // data. Collapse it in the same event (its own listener ran first), so it never paints open; ⓘ opens it.
  const collapseAttribution = () => {
    const attribution = el.querySelector('.maplibregl-compact')
    if (!attribution) return
    attribution.classList.remove('maplibregl-compact-show')
    map.off('styledata', collapseAttribution)
    map.off('sourcedata', collapseAttribution)
  }
  map.on('styledata', collapseAttribution)
  map.on('sourcedata', collapseAttribution)

  // One automatic basemap retry per failure (see the 'error' handler below).
  let retried = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  // Every style load (first, then each setStyle) starts from a bare basemap.
  map.on('style.load', () => {
    retried = false
    letPlaceLabelsMove(map)
    addBoundaries(map)
    opts.layers(map, MCO.getTheme())
  })

  // diff: false forces a full reload, so style.load fires and the layers come back.
  const loadStyle = () => map.setStyle(MCO.map.cartoStyleUrl(), { diff: false })
  const onTheme = () => {
    clearTimeout(retryTimer)
    loadStyle()
  }
  window.addEventListener(THEME_EVENT, onTheme)

  // Basemap style fetch failed: tell the user, retry once after 5 s (no loop;
  // a successful style.load re-arms the retry for the next failure).
  map.on('error', (e) => {
    const url = (e.error as { url?: string } | undefined)?.url
    if (!url || !url.endsWith('/style.json')) return
    MCO.showToast('Map basemap failed to load')
    if (retried) return
    retried = true
    retryTimer = setTimeout(loadStyle, 5000)
  })

  // The map sits in cards whose size changes without a window resize.
  let userMoved = false
  map.on('movestart', (e: { originalEvent?: Event }) => {
    if (e.originalEvent) userMoved = true
  })
  const resize = new ResizeObserver(() => {
    map.resize()
    if (opts.refit && !userMoved) {
      floor.refresh()
      map.fitBounds(MCO.map.MT_FIT_BOUNDS, { ...fitOpts, animate: false })
    }
  })
  resize.observe(el)

  return {
    map,
    flyTo(lngLat, { minZoom = 8, animate = true, offset = [0, 0] as [number, number] } = {}) {
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), minZoom), offset, animate: animate && !MCO.reducedMotion() })
    },
    fitTo(bounds, { padding, maxZoom, animate = true }) {
      const { width, height } = map.getContainer().getBoundingClientRect()
      if (width <= padding.left + padding.right || height <= padding.top + padding.bottom) return false
      map.fitBounds(bounds, { padding, maxZoom, animate: animate && !MCO.reducedMotion() })
      return true
    },
    dispose() {
      clearTimeout(retryTimer)
      window.removeEventListener(THEME_EVENT, onTheme)
      resize.disconnect()
      floor.dispose()
      map.remove()
    },
  }
}

/**
 * CARTO's town and city names sit centred on the place. Let each step above, below or beside it when
 * centred would collide with a symbol drawn over it (the selected station, stationLayer.ts), so the
 * marker never covers its own town's name ("B●MAN").
 */
function letPlaceLabelsMove(map: MapLibre.Map): void {
  for (const l of map.getStyle().layers) {
    if (l.type !== 'symbol' || l['source-layer'] !== 'place' || l.layout?.['text-anchor'] !== 'center') continue
    map.setLayoutProperty(l.id, 'text-variable-anchor', ['center', 'top', 'bottom', 'left', 'right'])
    map.setLayoutProperty(l.id, 'text-radial-offset', 1.2)
  }
}

/** Kit stack (HOUSE-STYLE §7): hillshade under the labels, then counties, tribal lands, state line. */
function addBoundaries(map: MapLibre.Map): void {
  // CARTO draws its own dashed counties from z9; ours are the only treatment.
  if (map.getLayer('boundary_county')) map.setLayoutProperty('boundary_county', 'visibility', 'none')
  MCO.map.addHillshade(map)
  const p = MCO.map.overlayPaints()
  map.addSource('counties', { type: 'geojson', data: `${GEO}mt_counties_simple.geojson` })
  map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', paint: p.countiesLine })
  map.addSource('tribal', { type: 'geojson', data: `${GEO}mt_reservations_simple.geojson` })
  map.addLayer({ id: 'tribal-fill', type: 'fill', source: 'tribal', paint: p.tribalFill })
  map.addLayer({ id: 'tribal-line', type: 'line', source: 'tribal', paint: p.tribalLine })
  map.addLayer({
    id: 'tribal-label',
    type: 'symbol',
    source: 'tribal',
    minzoom: 6,
    layout: MCO.map.TRIBAL_LABEL_LAYOUT,
    paint: p.tribalLabelPaint,
  })
  map.addSource('state', { type: 'geojson', data: `${GEO}mt_state_simple.geojson` })
  map.addLayer({ id: 'state-line', type: 'line', source: 'state', paint: p.stateLine })
}
