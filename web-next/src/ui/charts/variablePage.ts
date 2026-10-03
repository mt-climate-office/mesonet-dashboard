/**
 * `x-data="variablePage"`: Charts → one variable (`v=`; partials/charts/variable.html).
 * Header with prev/next chips, the sub-view switch (recent | history | table,
 * `view=`), range presets over from/to/agg, the normals switch on daily views,
 * the chart (core/charts variableChart) with its stats row, and the Table view
 * (the chart's table twin, paged). History is its own component (variableHistory).
 */
import Alpine from 'alpinejs'
import { variableChart, variableTable, variableTableAll, type ChartTable, type LatestTimeseriesModel } from '../../core/charts'
import { dataSettled, datesPatch, plotStatus, todayIso, viewAnnouncement, type PlotStatus } from '../../core/latest'
import { chartWindow, isIsoDate } from '../../core/models/timeseries'
import { RANGE_PRESETS, activePreset, findVariable, neighbors, panelStats, presetPatch, rangeView, tablePage, type RangeId, type StatRow, type TablePage, type Variable } from '../../core/variables'
import type { ChartView, LatestAgg } from '../../core/url-schema'
import { component } from '../component'
import { announce } from '../shell/live'
import { follow } from '../shell/navigate'
import { chartVariables, elementsResource, recordResource, seriesModel, seriesRequest, type SeriesQuery } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function variablePage() {
  const build = seriesModel()
  return component({
    variableChart,
    variableTable,
    presets: RANGE_PRESETS,
    aggOptions: [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'raw', label: 'Raw' },
    ],
    /** The custom date fields are open (also whenever the URL window is not a preset). */
    customOpen: false,
    page: 1,

    init() {
      this.$watch('announceKey', (key: string) => key && announce(key))
      // A new variable, window or view starts the table on its first page.
      this.$watch('tableKey', () => (this.page = 1))
    },

    get variable(): Variable | undefined {
      return findVariable(chartVariables(stations().id) ?? [], url().state.v)
    },
    /** 'loading' until the element list is in; 'unknown' for an id this station lacks. */
    get state(): 'loading' | 'unknown' | 'ready' {
      if (this.variable) return 'ready'
      const els = elementsResource(stations().id)
      return els?.data || els?.status === 'error' ? 'unknown' : 'loading'
    },
    get near(): { prev: Variable | null; next: Variable | null } {
      const v = this.variable
      return v ? neighbors(chartVariables(stations().id) ?? [], v.id) : { prev: null, next: null }
    },
    view(): ChartView {
      return url().state.view
    },

    /* Navigation (pushState: Back returns) */
    href(patch: { v?: string; view?: ChartView }): string {
      return url().hrefFor('charts', { v: patch.v ?? url().state.v, view: patch.view ?? 'recent', cmp: false })
    },
    /** A prev/next chip remounts the page body, so its heading takes focus; a view link stays where it is. */
    go(e: MouseEvent, patch: { v?: string; view?: ChartView }): void {
      const next = { v: patch.v ?? url().state.v, view: patch.view ?? 'recent' }
      follow(e, 'charts', { patch: next, drillDown: true, target: patch.v ? 'var-title' : undefined })
    },

    /* Range */
    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    preset(): RangeId {
      return activePreset(url().state)
    },
    showCustom(): boolean {
      return this.customOpen || this.preset() === 'custom'
    },
    setPreset(id: RangeId): void {
      this.customOpen = id === 'custom'
      if (id !== 'custom') url().set(presetPatch(id))
    },
    dates() {
      const w = this.window()
      return { start: isIsoDate(w.start) ? w.start : '', end: isIsoDate(w.end) ? w.end : '' }
    },
    dateMax: todayIso,
    setDates(r: { start: string; end: string }): void {
      url().set(datesPatch(r.start, r.end))
    },
    agg(): LatestAgg {
      return url().state.agg
    },
    setAgg(v: string): void {
      url().set({ agg: v as LatestAgg })
    },
    normalsAvailable(): boolean {
      return !!this.variable?.normals && url().state.agg === 'daily'
    },
    setGridmet(e: Event): void {
      url().set({ gridmet: (e.target as HTMLInputElement).checked })
    },

    /* Chart */
    query(): SeriesQuery | null {
      const id = stations().id
      const v = this.variable
      if (!id || !v || !this.window().valid) return null
      const s = url().state
      return { station: id, window: this.window(), agg: s.agg, vars: [v.name], gridmet: s.gridmet }
    },
    model(): LatestTimeseriesModel | null {
      const q = this.query()
      return q ? build(q) : null
    },
    record(): 'loading' | 'success' | 'error' | null {
      const q = this.query()
      return q ? (recordResource(seriesRequest(q))?.status ?? null) : null
    },
    status(): PlotStatus {
      return plotStatus({ empty: null, waiting: this.state === 'loading', record: this.record(), hasModel: !!this.model() })
    },
    /** The chart shows this window's data (not the previous window's while it loads): stats and the announcement wait. */
    settled(): boolean {
      return dataSettled({ record: this.record(), hasModel: !!this.model() })
    },
    /** Visible range: the window, or the last 24 h for the 24 h preset. */
    range(): [number, number] | null {
      const w = this.window()
      if (!w.valid) return null
      const xs = this.model()?.ts.x.filter(Number.isFinite) ?? []
      return rangeView(this.preset(), w.start, w.end, xs.length ? xs[xs.length - 1] : null)
    },
    stats(): StatRow[] {
      const m = this.model()
      const r = this.range()
      return m && r && this.variable && this.settled() ? panelStats(m.ts.panels[0], m.ts.x, r, this.variable.sum) : []
    },
    get announceKey(): string {
      // History has its own data and announcement; reading the model here would fetch the recent window.
      if (this.view() === 'history') return ''
      const m = this.model()
      const w = this.window()
      if (!m || !this.settled()) return ''
      return viewAnnouncement(`${stations().current?.name ?? ''} ${this.variable?.name ?? ''}`.trim(), m.period, w.start, w.end, 1)
    },

    /* Table view */
    table(): ChartTable | null {
      const m = this.model()
      return m && this.view() === 'table' ? variableTableAll(m) : null
    },
    tablePage(): TablePage {
      return tablePage(this.table()?.rows ?? [], this.page)
    },
    get tableKey(): string {
      const w = this.window()
      return `${url().state.v}|${url().state.agg}|${w.start}|${w.end}|${this.view()}`
    },
  })
}
