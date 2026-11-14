/**
 * Types for the kit globals loaded from the CDN in index.html: `window.MCO`
 * (core/mco-core.js), `MCO.photos` (photos/mco-photos.js; types in mco-photos.d.ts), `MCO.places`
 * (places/mco-places.js; types, with the kit search box, in mco-places.d.ts), `MCO.summary`
 * (summary/mco-summary.js; types in mco-summary.d.ts), `MCO.map`
 * (map/mco-map.js) and `maplibregl`. The kit version is pinned in index.html only.
 * Hand-written from the kit's source comments; extend as calls are added.
 */
import type * as MapLibre from 'maplibre-gl'
import type { McoPhotos } from './mco-photos'
import type { McoPlaces, SearchBox, SearchBoxOptions, SearchModel } from './mco-places'
import type { McoSummary } from './mco-summary'

type Theme = 'dark' | 'light' | 'high-contrast'

interface McoToast {
  element: HTMLElement
  show(msg: string, ms?: number): void
  hide(): void
}

interface McoMap {
  /** The pinned MapLibre release ('6.11.2'). */
  MAPLIBRE_VERSION: string
  /**
   * Import MapLibre 6 (ES modules only) from the kit's pin, publish it as `window.maplibregl` and resolve
   * with it; one shared import, retried on the next call after a failure. SRI comes from index.html's import map.
   */
  loadMapLibre(opts?: { url?: string }): Promise<typeof MapLibre>
  MT_FIT_BOUNDS: [[number, number], [number, number]]
  FIT_OPTS: MapLibre.FitBoundsOptions
  TERRARIUM_DEM: MapLibre.RasterDEMSourceSpecification
  TRIBAL_LABEL_LAYOUT: MapLibre.SymbolLayerSpecification['layout']
  /** CARTO Dark Matter (dark + high-contrast) or Positron (light), read at call time. */
  cartoStyleUrl(): string
  /** Bad basemap label → correct text, exact whole-label matches (kit 0.20.0). */
  LABEL_CORRECTIONS: Record<string, string>
  /** Rewrite every symbol layer's text-field to apply LABEL_CORRECTIONS; returns the layers rewritten. */
  correctBasemapLabels(map: MapLibre.Map, table?: Record<string, string>): number
  themedStyleUrl(urls: { dark: string; light: string }): string
  initialCamera(
    params: URLSearchParams,
    opts?: { bounds?: MapLibre.LngLatBoundsLike; fitOpts?: MapLibre.FitBoundsOptions },
  ): Partial<MapLibre.MapOptions>
  cameraParams(map: MapLibre.Map): { lng: string; lat: string; zoom: string }
  addNavigation(map: MapLibre.Map, opts?: { showCompass?: boolean; position?: MapLibre.ControlPosition }): MapLibre.NavigationControl
  addFitControl(
    map: MapLibre.Map,
    opts?: {
      bounds?: MapLibre.LngLatBoundsLike
      fitOpts?: MapLibre.FitBoundsOptions | (() => MapLibre.FitBoundsOptions)
      title?: string
      container?: HTMLElement
      onBeforeFit?: () => void
    },
  ): HTMLButtonElement | null
  installZoomFloor(
    map: MapLibre.Map,
    opts?: {
      bounds?: MapLibre.LngLatBoundsLike
      fitOpts?: MapLibre.FitBoundsOptions | (() => MapLibre.FitBoundsOptions)
      resizeDebounceMs?: number
    },
  ): { refresh(): void; fitZoom(): number | undefined; dispose(): void }
  hillshadePaints(opts?: { exaggeration?: number; method?: string | null }): Record<string, unknown>
  firstSymbolLayerId(map: MapLibre.Map): string | undefined
  addHillshade(
    map: MapLibre.Map,
    opts?: { sourceId?: string; layerId?: string; beforeId?: string; source?: MapLibre.SourceSpecification; exaggeration?: number },
  ): string
  overlayPaints(): {
    stateLine: Record<string, unknown>
    countiesLine: Record<string, unknown>
    tribalFill: Record<string, unknown>
    tribalLine: Record<string, unknown>
    tribalLabelPaint: Record<string, unknown>
  }
  /** The one station circle (0.21.0): no network encoding; defaults are the HydroMet blue, the radius ramp and a --dot-stroke edge. */
  stationPaint(opts?: { fill?: unknown; radius?: unknown; stroke?: unknown; strokeWidth?: number }): MapLibre.CircleLayerSpecification['paint']
  /** The selected-station ring, in --selection-ring (read at call time). */
  selectionPaint(opts?: { radius?: unknown; width?: number }): MapLibre.CircleLayerSpecification['paint']
  /** The keyboard-focus halo, in --accent-line (read at call time). */
  focusPaint(opts?: { radius?: unknown; width?: number }): MapLibre.CircleLayerSpecification['paint']
  /** An invisible circle (11 px radius by default): a tappable target. */
  hitPaint(opts?: { radius?: unknown }): MapLibre.CircleLayerSpecification['paint']
  /** Colocated stations (0.21.0): 4-decimal buckets, a count badge and a spider. */
  colocation: McoColocation
}

/** Properties MCO.map.colocation adds to every feature it emits, on top of the app's. */
interface ColocationProps {
  /** Visible stations at the site. */
  colocationCount: number
  /** 0 = the site's anchor (the marker drawn); spider feet are 0 too. */
  colocationIndex: number
  /** The site key (`bucketKey`). */
  bucket: string
  colocationId: string
}

/** A GeoJSON point collection as the kit emits it (structurally what MapLibre's setData takes). */
interface PointCollection<P> {
  type: 'FeatureCollection'
  features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: P }[]
}

interface ColocationOptions<T> {
  /** The app's GeoJSON source id. */
  source: string
  id?: (s: T) => string
  lngLat?: (s: T) => [number, number]
  /** Lower = the site's anchor. */
  rank?: (s: T) => number
  visible?: (s: T) => boolean
  properties?: (s: T) => object
  anchorLayers?: string[]
  spiderLayers?: string[]
  /** 'spider': a first click on a stacked anchor only fans it out. */
  anchorClick?: 'spider'
  onSelect?: (id: string, info: { item: T | undefined; foot: boolean }) => void
  onEmpty?: () => void
}

interface ColocationController<T, P = Record<string, unknown>> {
  setData(items?: readonly T[]): PointCollection<P & ColocationProps>
  refresh(): PointCollection<P & ColocationProps>
  /** Adds the two spider sources (call in style.load, before the app's layers). */
  addSources(): void
  open(bucketOrId: string): boolean
  close(): void
  isOpen(): boolean
  openBucket(): string | null
  /** The site's visible members, anchor first. */
  members(bucketOrId: string): T[]
  siblings(id: string): T[]
  info(id: string): { bucket: string; index: number; count: number } | null
  collection(): PointCollection<P & ColocationProps>
  spiderSource: string
  spiderLinesSource: string
  dispose(): void
}

interface McoColocation {
  <T, P extends object = Record<string, unknown>>(
    map: MapLibre.Map,
    opts: ColocationOptions<T> & { properties?: (s: T) => P },
  ): ColocationController<T, P>
  PRECISION: number
  /** "lat,lon", each to `precision` (default PRECISION, 4) decimals: the site key. */
  bucketKey(lat: number, lon: number, precision?: number): string
  /** Layer filter: the site anchors only. */
  ANCHOR_ONLY: MapLibre.ExpressionSpecification
  /** Layer filter: sites with more than one visible station. */
  STACKED: MapLibre.ExpressionSpecification
  /** The count badge: a disc layer (`${id}-disc`) then its text layer (`id`); add both, in order. */
  badgeLayers(opts: {
    id?: string
    source: string
    filter?: unknown
    offset?: [number, number]
    radius?: number
    textSize?: number
    minzoom?: number
  }): MapLibre.LayerSpecification[]
  spiderLinePaint(): MapLibre.LineLayerSpecification['paint']
}

interface Mco {
  versions: Record<string, string>
  /** 'America/Denver'. */
  TZ: string
  THEME_KEY: string
  lsGet(key: string): string | null
  lsSet(key: string, value: string): void
  escapeHTML(s: string): string
  escapeRe(s: string): string
  /** Today in Mountain Time, 'YYYY-MM-DD'. */
  todayMT(): string
  currentHourMT(): number
  hhmmNowMT(): string
  /** Shift a 'YYYY-MM-DD' by whole days (DST-safe). */
  shiftDate(date: string, deltaDays: number): string
  /** Epoch ms → "Oct 1, 3:00 PM MDT" (Mountain Time). */
  formatStampMT(ms: number): string
  formatDateMT(ms: number): string
  formatDateStr(date: string): string
  lastCompleteHourMT(): { date: string; hour: number }
  fetchJSON<T = unknown>(url: string, opts?: { timeoutMs?: number; cache?: RequestCache }): Promise<T>
  reducedMotion(): boolean
  viewport: {
    COMPACT_MQ: string
    isCompact(): boolean
    isTouch(): boolean
    onChange(fn: () => void): () => void
  }
  /**
   * The on-screen keyboard (kit 1.0.0, a port of this app's former `ui/layout/keyboard.ts`): from the visual
   * viewport it publishes `--kb-inset` (px covered; 0 under `KEYBOARD_MIN_PX` or while pinch-zoomed), `--vv-h`
   * and `.kb-open` on <html>, and fires `mco:keyboard` ({ detail: { open, inset } }) on document. `ready()` starts it.
   */
  keyboard: {
    KEYBOARD_MIN_PX: number
    /** Pure: px between the bottom of the visible area and the layout viewport's; 0 under `KEYBOARD_MIN_PX`. */
    keyboardInset(layoutHeight: number, vvHeight: number, vvOffsetTop: number): number
    /** Idempotent; returns `stop`. A no-op without `visualViewport`. */
    start(): () => void
    stop(): void
    isOpen(): boolean
    /** Current px the keyboard covers. */
    inset(): number
  }
  createToast(opts?: { element?: HTMLElement; duration?: number }): McoToast
  /** Singleton toast, 2800 ms default. */
  showToast(msg: string, ms?: number): void
  getTheme(): Theme
  /** The family credit line: "<source> · Montana Climate Office · climate.umt.edu" (kit 0.9.0). */
  credit(opts?: { source?: string }): string
  /** Release the anti-flash snippet's first-paint hold (`mco-booting`, `[data-hold]`) and start `keyboard` (kit 1.0.0). */
  ready(): void
  /** Sets data-theme; persists to localStorage 'mco-theme' unless persist: false. Fires `mco:themechange` on document when it changes. */
  setTheme(theme: Theme, opts?: { persist?: boolean }): void
  /** dark → light → high contrast (`cycle: true`), else dark ↔ light. Applies and returns the new theme. */
  toggleTheme(opts?: { cycle?: boolean }): Theme
  THEME_CYCLE: readonly Theme[]
  /** The page's one announcer (0.8.0): clears, then sets the text; the same text within 500 ms is dropped. */
  announce(text: string, opts?: { politeness?: 'polite' | 'assertive' }): void
  createLiveRegion(): { element: HTMLElement; announce(text: string): void }
  initInfoModal(opts: { dialog: HTMLDialogElement; trigger?: HTMLElement | null }): { open(): void; close(): void }
  initCollapsible(opts: {
    toggle: HTMLElement
    body: HTMLElement
    storageKey?: string
    startCollapsed?: boolean
    autoCollapseOnCompact?: boolean
    onChange?: (collapsed: boolean) => void
  }): { isCollapsed(): boolean; collapse(): void; expand(): void }
  urlParams(): URLSearchParams
  getParamLower(key: string, params?: URLSearchParams): string | null
  splitTokens(raw: string | null): string[] | null
  /** Search ranking (0.8.0; sections 0.16.0). */
  searchModel: SearchModel
  /** The APG combobox with list autocomplete over `.mco-search` markup (0.8.0). */
  initSearchBox(opts: SearchBoxOptions): SearchBox
  map: McoMap
  photos: McoPhotos
  places: McoPlaces
  summary: McoSummary
}

declare global {
  interface Window {
    MCO: Mco
  }
  const MCO: Mco
  /** MapLibre GL from the kit-pinned CDN, once `MCO.map.loadMapLibre()` resolves (types only from the npm package). */
  const maplibregl: typeof MapLibre
}

export type { ColocationController, ColocationProps, Mco, McoMap, PointCollection, Theme }
