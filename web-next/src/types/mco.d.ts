/**
 * Types for the kit globals loaded from the CDN in index.html: `window.MCO`
 * (core/mco-core.js @0.11.3), `MCO.map` (map/mco-map.js) and `maplibregl`.
 * Hand-written from the kit's source comments; extend as calls are added.
 */
import type * as MapLibre from 'maplibre-gl'

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
  createToast(opts?: { element?: HTMLElement; duration?: number }): McoToast
  /** Singleton toast, 2800 ms default. */
  showToast(msg: string, ms?: number): void
  getTheme(): Theme
  /** Release the anti-flash snippet's first-paint hold (`mco-booting`, `[data-hold]`); idempotent. */
  ready(): void
  /** Sets data-theme; persists to localStorage 'mco-theme' unless persist: false. */
  setTheme(theme: Theme, opts?: { persist?: boolean }): void
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
  map: McoMap
}

declare global {
  interface Window {
    MCO: Mco
  }
  const MCO: Mco
  /** MapLibre GL from the kit-pinned CDN, once `MCO.map.loadMapLibre()` resolves (types only from the npm package). */
  const maplibregl: typeof MapLibre
}

export type { Mco, McoMap, Theme }
