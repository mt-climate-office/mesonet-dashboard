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
  /** Stronger county lines (Downloader, as in legacy). */
  emphasiseCounties?: boolean
}

export interface MapHost {
  readonly map: MapLibre.Map
  /** Centre on a point, zooming in to at least `minZoom` (default 8); animates unless `animate` is false or motion is reduced. */
  flyTo(lngLat: [number, number], opts?: { minZoom?: number; animate?: boolean }): void
  /** Remove listeners and the map (call from Alpine `destroy`). */
  dispose(): void
}

/** Create the map inside `el` (which must have a height). */
export function createMap(el: HTMLElement, opts: MapHostOptions): MapHost {
  el.setAttribute('role', 'application')
  el.setAttribute('aria-label', opts.label)

  const map = new maplibregl.Map({
    container: el,
    style: MCO.map.cartoStyleUrl(),
    bounds: MCO.map.MT_FIT_BOUNDS,
    fitBoundsOptions: MCO.map.FIT_OPTS,
    attributionControl: { compact: true },
    // Rotation is off in house maps (no compass, HOUSE-STYLE §7).
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  map.touchZoomRotate.disableRotation()
  map.keyboard.disableRotation()
  MCO.map.addNavigation(map)
  MCO.map.addFitControl(map)
  const floor = MCO.map.installZoomFloor(map)
  map.once('load', () => floor.refresh())

  // One automatic basemap retry per failure (see the 'error' handler below).
  let retried = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  // Every style load (first, then each setStyle) starts from a bare basemap.
  map.on('style.load', () => {
    retried = false
    addBoundaries(map, opts.emphasiseCounties === true)
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
  const resize = new ResizeObserver(() => map.resize())
  resize.observe(el)

  return {
    map,
    flyTo(lngLat, { minZoom = 8, animate = true } = {}) {
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), minZoom), animate: animate && !MCO.reducedMotion() })
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

/** Kit stack (HOUSE-STYLE §7): hillshade under the labels, then counties, tribal lands, state line. */
function addBoundaries(map: MapLibre.Map, emphasiseCounties: boolean): void {
  // CARTO draws its own dashed counties from z9; ours are the only treatment.
  if (map.getLayer('boundary_county')) map.setLayoutProperty('boundary_county', 'visibility', 'none')
  MCO.map.addHillshade(map)
  const p = MCO.map.overlayPaints()
  const counties = emphasiseCounties ? { ...p.countiesLine, 'line-width': 1, 'line-opacity': 0.85 } : p.countiesLine
  map.addSource('counties', { type: 'geojson', data: `${GEO}mt_counties_simple.geojson` })
  map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', paint: counties })
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
