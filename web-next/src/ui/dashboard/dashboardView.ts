/**
 * `x-data="dashboardView"` (partials/dashboard/index.html): the big-screen dashboard's chart grid
 * and its range chips (core/dashboard). One request for every station variable over the URL window
 * (`from`/`to`, so a chart opened from here keeps it), sliced into one compact chart per variable;
 * the grid's columns and rows follow its measured size (`dashboardGrid`), so it always fills the
 * screen and rearranges on any resize. The conditions, media and About cards are their own components.
 */
import Alpine from 'alpinejs'
import { variableCompactChart, variableTable, type LatestTimeseriesModel } from '../../core/charts'
import { DASHBOARD_RANGES, dashboardGrid, panelOf } from '../../core/dashboard'
import { untilNow } from '../../core/latest'
import { loadErrorText } from '../../core/loadError'
import { chartWindow } from '../../core/models/timeseries'
import { denverWallMs } from '../../core/today'
import { LABELS, LIST_AG_TOOLS, activePreset, chartHeading, chartPatch, currentReading, effectiveAgg, intervalWord, plainName, rangeChipPatch, rangeLabel, rangeView, spanDays, type Variable } from '../../core/variables'
import type { LatestAgg } from '../../core/url-schema'
import type { ChartBindings } from '../charts/chart'
import { chartVariables, recordResource, seriesModel, seriesRequest, variablesError, type SeriesQuery } from '../charts/resources'
import { component } from '../component'
import { follow } from '../shell/navigate'
import { latestObs } from '../station/resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function dashboardView() {
  const build = seriesModel()
  // Each card's slice, kept while the shared model is the same object (a new one would redraw the chart).
  const slices = new Map<string, { base: LatestTimeseriesModel; model: LatestTimeseriesModel | null }>()
  let ro: ResizeObserver | null = null
  return component({
    ranges: DASHBOARD_RANGES,
    agTools: LIST_AG_TOOLS.map((id) => ({ id, name: LABELS[id]?.name ?? id, sub: LABELS[id]?.sub ?? '' })),
    gridBox: { width: 0, height: 0, gap: 12 },

    /** `x-init` on the chart grid: measure it now and on every resize. */
    measure(el: HTMLElement): void {
      ro?.disconnect()
      // The gap is the spacing scale's (--gap), which grows on wide screens: read it, don't assume it.
      ro = new ResizeObserver(() => (this.gridBox = { width: el.clientWidth, height: el.clientHeight, gap: parseFloat(getComputedStyle(el).rowGap) || 0 }))
      ro.observe(el)
    },
    destroy() {
      ro?.disconnect()
    },
    /** CSS for the grid: its columns, and its rows' height (the minimum, scrolling, when they cannot all fit). */
    gridStyle(): string {
      const f = dashboardGrid(this.variables.length, this.gridBox.width, this.gridBox.height, this.gridBox.gap)
      return `--dash-cols: ${f.cols}; --dash-row: ${f.rowHeight === null ? 'var(--dash-row-min)' : `${f.rowHeight}px`}`
    },

    get variables(): Variable[] {
      return chartVariables(stations().id) ?? []
    },
    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    agg(): LatestAgg {
      const w = this.window()
      return effectiveAgg(url().state.agg, spanDays(w.start, w.end))
    },
    /** "Last 14 days · hourly". */
    rangeText(): string {
      const w = this.window()
      return `${rangeLabel(activePreset(url().state), w.start, w.end)} · ${intervalWord(this.agg(), stations().current?.sub_network)}`
    },
    pressed(id: string): boolean {
      return activePreset(url().state) === id
    },
    /** A range chip: every chart's window (replaces the history entry, like the chart pages' chips). */
    setRange(id: (typeof DASHBOARD_RANGES)[number]['id']): void {
      url().set(rangeChipPatch(id, url().state.agg))
    },

    query(): SeriesQuery | null {
      const id = stations().id
      const vars = this.variables
      const w = this.window()
      if (!id || !vars.length || !w.valid) return null
      return { station: id, window: w, agg: this.agg(), vars: vars.map((v) => v.name), gridmet: false }
    },
    model(): LatestTimeseriesModel | null {
      const q = this.query()
      return q ? build(q) : null
    },
    /** Skeletons until the element list and the shared request have something to draw (or failed). */
    loading(): boolean {
      if (this.loadError()) return false
      if (!this.variables.length) return true
      const q = this.query()
      return !this.model() && !!q && recordResource(seriesRequest(q))?.status !== 'error'
    },
    /** The error state's text (partials/load-error.html): the station's variables, else the charts' request; '' when none failed. */
    loadError(): string {
      const failed = variablesError(stations().id)
      if (failed) return failed
      const q = this.query()
      const rec = q ? recordResource(seriesRequest(q)) : null
      return rec?.status === 'error' && !this.model() ? loadErrorText('These charts', rec.error) : ''
    },
    /** Visible range: the window up to now; the 24 h chip, the 24 hours up to the newest reading (as on a chart page). */
    viewRange(): [number, number] | null {
      const w = this.window()
      if (!w.valid) return null
      const xs = this.model()?.ts.x.filter(Number.isFinite) ?? []
      return untilNow(rangeView(activePreset(url().state), w.start, w.end, xs.length ? xs[xs.length - 1] : null), this.agg(), denverWallMs())
    },

    name: (v: Variable): string => plainName(v.id, v.name),
    /** "57 °F now", '' for a total or without a reading. */
    now(v: Variable): string {
      const id = stations().id
      const latest = id ? (latestObs(id).data?.[0] as Record<string, unknown> | undefined) : undefined
      const r = currentReading(v, latest ? Alpine.raw(latest) : undefined)
      return r ? `${r} now` : ''
    },
    /** Bindings for a card's nested `x-data="chart(cardChart(v))"`. */
    cardChart(v: Variable): ChartBindings<LatestTimeseriesModel> {
      return {
        builder: variableCompactChart,
        table: variableTable,
        label: `${plainName(v.id, v.name)}, ${this.rangeText()}`,
        model: () => {
          const base = this.model()
          if (!base) return null
          const hit = slices.get(v.name)
          if (hit?.base === base) return hit.model
          const model = panelOf(base, v.name)
          slices.set(v.name, { base, model })
          return model
        },
        range: () => this.viewRange(),
      }
    },

    href(id: string): string {
      return url().hrefFor('charts', chartPatch(id))
    },
    /** A card or a More charts link: push its page on this window; Back (and its back link) returns here. */
    open(e: MouseEvent, id: string): void {
      follow(e, 'charts', { patch: chartPatch(id), drillDown: true, target: chartHeading(id), from: url().section })
    },
    compareHref(): string {
      return url().hrefFor('charts', { v: null, cmp: true })
    },
    openCompare(e: MouseEvent): void {
      follow(e, 'charts', { patch: { v: null, cmp: true }, drillDown: true, target: 'charts-compare-title', from: url().section })
    },
  })
}
