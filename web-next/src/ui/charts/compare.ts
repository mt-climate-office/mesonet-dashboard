/**
 * `x-data="compare"`: Charts → Compare, the stacked station plot (one panel
 * per selected variable, core/charts latestTimeseries). Reads the legacy
 * Latest keys (from/to/agg/vars/gridmet); a zoom writes `from`/`to`. On
 * phones each panel is ~1/3 of a screen and the page scrolls past the stack.
 * Markup in partials/charts/compare.html.
 */
import Alpine from 'alpinejs'
import { latestTimeseriesChart, latestTimeseriesHeight, latestTimeseriesTable, type LatestTimeseriesModel } from '../../core/charts'
import { dataSettled, datesPatch, installDate, plotStatus, todayIso, viewAnnouncement, windowRange, zoomWindow, type PlotStatus } from '../../core/latest'
import { availableVars, chartWindow, emptyState, type TimeseriesEmpty } from '../../core/models/timeseries'
import { latestAgg, latestVars } from '../../core/url-schema'
import { component } from '../component'
import { announce } from '../shell/live'
import { elementsResource, recordResource, seriesModel, seriesRequest, stationElements, type SeriesQuery } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')
const compactQuery = matchMedia('(max-width: 640px)')

export function compare() {
  const build = seriesModel()
  let onCompact: ((e: MediaQueryListEvent) => void) | null = null

  return component({
    compact: compactQuery.matches,
    latestTimeseriesChart,
    latestTimeseriesTable,
    /** The user's last zoom (wall-clock ms) and the URL window it belongs to ("start|end"). */
    userView: null as [number, number] | null,
    userWindow: '',

    init() {
      onCompact = (e: MediaQueryListEvent) => (this.compact = e.matches)
      compactQuery.addEventListener('change', onCompact)
      // A window set from outside (controls, back/forward) drops the user's view.
      this.$watch('windowKey', (key: string) => {
        if (key !== this.userWindow) this.userView = null
      })
      this.$watch('announceKey', (key: string) => {
        if (key) announce(key)
      })
      // Details go to the console; the user sees the legacy no-data message.
      this.$watch('recordError', (err: unknown) => {
        if (err) console.error('Compare request failed:', err)
      })
    },
    destroy() {
      if (onCompact) compactQuery.removeEventListener('change', onCompact)
    },

    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    vars(): string[] | null {
      const id = stations().id
      // Wait for the element list (it decides the request) unless it failed.
      if (id && elementsResource(id)?.status === 'loading') return null
      return availableVars(latestVars(url().state), stationElements(id))
    },
    empty(): TimeseriesEmpty | null {
      const c = stations().catalog
      return emptyState({
        selection: latestVars(url().state),
        available: this.vars(),
        param: url().state.s,
        station: stations().id,
        catalogLoaded: !!c?.data || c?.status === 'error',
        windowValid: this.window().valid,
      })
    },
    query(): SeriesQuery | null {
      const id = stations().id
      const vars = this.vars()
      if (!id || !vars || this.empty()) return null
      const s = url().state
      return { station: id, window: this.window(), agg: latestAgg(s), vars, gridmet: s.gridmet }
    },
    record() {
      const q = this.query()
      return q ? recordResource(seriesRequest(q)) : null
    },
    get recordError(): unknown {
      const res = this.record()
      return res?.status === 'error' ? res.error : null
    },
    model(): LatestTimeseriesModel | null {
      const q = this.query()
      return q ? build(q) : null
    },
    status(): PlotStatus {
      return plotStatus({
        empty: this.empty(),
        waiting: !stations().id || this.vars() === null,
        record: this.record()?.status ?? null,
        hasModel: !!this.model(),
      })
    },
    loading(): boolean {
      return this.record()?.status === 'loading'
    },
    heightStyle(): string {
      const px = latestTimeseriesHeight(this.model()?.ts.panels.length ?? 1, this.compact)
      return `--chart-height: ${px}px; --chart-height-compact: ${px}px`
    },
    /** Live-region text once a new view has data; '' while loading. */
    get announceKey(): string {
      const m = this.model()
      if (!m || !dataSettled({ record: this.record()?.status ?? null, hasModel: true })) return ''
      const w = this.window()
      return viewAnnouncement(stations().current?.name ?? stations().id ?? '', m.period, w.start, w.end, m.ts.panels.length)
    },

    /** "start|end" of the URL (fetch) window. */
    get windowKey(): string {
      const w = this.window()
      return `${w.start}|${w.end}`
    },
    /** The user's own view while the URL window is the one it produced, else the URL window. */
    range(): [number, number] | null {
      if (this.userView && this.windowKey === this.userWindow) return this.userView
      const w = this.window()
      return w.valid ? windowRange(w.start, w.end) : null
    },
    /** A user zoom/pan: refetch (rewrite from/to) only once the view leaves the loaded days. */
    onZoom(fromMs: number, toMs: number): void {
      this.userView = [fromMs, toMs]
      const next = zoomWindow([fromMs, toMs], this.window(), todayIso(), installDate(stations().current))
      this.userWindow = next ? `${next.start}|${next.end}` : this.windowKey
      if (next) url().set(datesPatch(next.start, next.end))
    },
  })
}
