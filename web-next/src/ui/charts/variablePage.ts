/**
 * `x-data="variablePage"`: Charts → one variable (`v=`; partials/charts/variable.html).
 * Header (back, title, ⋯ menu), "value now · range", the chart (core/charts
 * variableChart; the Daily interval adds the low–high band) or, with `tbl`,
 * its table; range chips over from/to (All years = `view=history`, its own
 * component), the Interval row over `agg`, and the stats card. A sideways
 * swipe on touch, or ⋯ → Previous / Next, walks the list. A Download sheet
 * opened by the URL with nothing to download is prefilled from this chart.
 * Logic is in core/variables.
 */
import Alpine from 'alpinejs'
import { variableChart, variableTable, variableTableAll, type ChartTable, type LatestTimeseriesModel } from '../../core/charts'
import { fromChart, prefillsFromChart, variableElements } from '../../core/downloader/fromChart'
import { POR_FALLBACK_START, dataSettled, installDate, plotStatus, todayIso, viewAnnouncement, type PlotStatus } from '../../core/latest'
import { chartWindow } from '../../core/models/timeseries'
import {
  RANGE_CHIPS,
  currentReading,
  effectiveAgg,
  findVariable,
  hasBand,
  intervalChips,
  intervalPatch,
  neighbors,
  pageRange,
  panelStats,
  plainName,
  rangeChipPatch,
  rangeLabel,
  rangeView,
  showsNormals,
  spanDays,
  withBand,
  type IntervalChip,
  type PageRange,
  type StatRow,
  type Variable,
} from '../../core/variables'
import { loadErrorText } from '../../core/loadError'
import type { LatestAgg } from '../../core/url-schema'
import { component } from '../component'
import { initSwipe } from '../layout/swipe'
import { announce } from '../shell/live'
import { stepChart } from '../shell/navigate'
import { shareView } from '../shell/share'
import { openSheet } from '../shell/sheet'
import { latestObs } from '../station/resources'
import { chartVariables, elementsResource, recordResource, seriesModel, seriesRequest, stationElements, variablesError, type SeriesQuery } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function variablePage() {
  const build = seriesModel()
  // The banded model, kept while its inputs are the same objects (the chart host re-renders on a new one).
  let banded: { base: LatestTimeseriesModel; rows: unknown; model: LatestTimeseriesModel } | null = null
  let stopSwipe = () => {}
  let stopPrefill = () => {}
  return component({
    variableChart,
    variableTable,
    rangeChips: RANGE_CHIPS,

    init() {
      this.$watch('announceKey', (key: string) => key && announce(key))
      stopSwipe = initSwipe({ el: this.$el as HTMLElement, onStep: (s) => this.step(s) })
      // `?v=…&dl=1` with no `els`: the same prefill as ⋯ → Download data, once the station's elements are in.
      const fx = Alpine.effect(() => {
        if (prefillsFromChart(url().state) && stationElements(stations().id)) this.prefill()
      })
      stopPrefill = () => Alpine.release(fx)
    },
    destroy() {
      stopSwipe()
      stopPrefill()
    },

    get variable(): Variable | undefined {
      return findVariable(chartVariables(stations().id) ?? [], url().state.v)
    },
    /** 'loading' until the element list is in; 'error' if it (or the station list) failed; 'unknown' for an id this station lacks. */
    get state(): 'loading' | 'error' | 'unknown' | 'ready' {
      if (this.variable) return 'ready'
      if (variablesError(stations().id)) return 'error'
      return elementsResource(stations().id)?.data ? 'unknown' : 'loading'
    },
    /** The error state's text (partials/load-error.html): the station's variables' failure, else the chart's; '' when none failed. */
    loadError(): string {
      const failed = variablesError(stations().id)
      if (failed) return failed
      const q = this.query()
      const rec = q ? recordResource(seriesRequest(q)) : null
      return rec?.status === 'error' ? loadErrorText('This chart', rec.error) : ''
    },
    get near(): { prev: Variable | null; next: Variable | null } {
      const v = this.variable
      return v ? neighbors(chartVariables(stations().id) ?? [], v.id) : { prev: null, next: null }
    },
    title(): string {
      const v = this.variable
      return v ? plainName(v.id, v.name) : ''
    },
    nameOf: (v: Variable | null): string => (v ? plainName(v.id, v.name) : ''),

    /* What the URL asks for */
    range(): PageRange {
      return pageRange(url().state)
    },
    all(): boolean {
      return this.range() === 'all'
    },
    /** The chart is shown as its table (`tbl`; the legacy `view=table` too). */
    tableMode(): boolean {
      return url().state.tbl || url().state.view === 'table'
    },
    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    days(): number {
      const w = this.window()
      return spanDays(w.start, w.end)
    },
    /** The interval drawn (Auto resolved; 5-min only where offered). */
    agg(): LatestAgg {
      return effectiveAgg(url().state.agg, this.days(), this.all())
    },
    intervals(): IntervalChip[] {
      return intervalChips(url().state.agg, this.days(), this.all())
    },
    /** Why an interval chip is not offered here ('' when every one is), shown beside the row. */
    intervalNote(): string {
      return this.intervals().find((c) => c.disabled)?.reason ?? ''
    },
    /** "57 °F now · Last 14 days". */
    subline(): string {
      const v = this.variable
      const id = stations().id
      const latest = id ? (latestObs(id).data?.[0] as Record<string, unknown> | undefined) : undefined
      const now = v ? currentReading(v, latest ? Alpine.raw(latest) : undefined) : null
      const w = this.window()
      const label = rangeLabel(this.range(), w.start, w.end)
      return now ? `${now} now · ${label}` : label
    },

    /* Changes: range and interval replace the history entry; table/chart and prev/next push it */
    setRange(id: (typeof RANGE_CHIPS)[number]['id']): void {
      url().set(rangeChipPatch(id, url().state.agg))
    },
    setInterval(c: IntervalChip): void {
      if (!c.disabled) url().set(intervalPatch(c.id))
    },
    toggleTable(): void {
      url().go('charts', { tbl: !this.tableMode(), view: this.all() ? 'history' : 'recent' }, true)
    },
    /** Previous (−1) or next (1) variable in list order (ui/shell/navigate `stepChart`). */
    step(dir: -1 | 1): void {
      stepChart(this.near, dir)
    },
    openDates(): void {
      openSheet('dates')
    },
    share: () => shareView(),
    /** Download data: the sheet prefilled with this variable, these dates and this interval (core/downloader/fromChart). */
    download(): void {
      if (this.prefill()) openSheet('download')
    },
    /** Write the Downloader keys for this chart; false while the variable is unknown. */
    prefill(): boolean {
      const v = this.variable
      const id = stations().id
      if (!v || !id) return false
      const w = this.window()
      const all = this.all()
      const start = all ? (installDate(stations().current) ?? POR_FALLBACK_START) : w.start
      url().set(fromChart({ elements: variableElements(v.name, stationElements(id) ?? []), start, end: all ? todayIso() : w.end, interval: this.agg() }))
      return true
    },

    /* Chart */
    query(): SeriesQuery | null {
      const id = stations().id
      const v = this.variable
      if (!id || !v || !this.window().valid || this.all()) return null
      const agg = this.agg()
      return { station: id, window: this.window(), agg, vars: [v.name], gridmet: showsNormals(v, agg) }
    },
    /** The daily min/max request for the band (Daily interval, banded variables only). */
    extremes() {
      const q = this.query()
      const v = this.variable
      return q && v && q.agg === 'daily' && hasBand(v) ? recordResource(seriesRequest(q, true)) : null
    },
    model(): LatestTimeseriesModel | null {
      const q = this.query()
      const base = q ? build(q) : null
      const rows = this.extremes()?.data
      if (!base || !rows) return base
      if (banded?.base !== base || banded.rows !== rows) banded = { base, rows, model: withBand(base, Alpine.raw(rows)) }
      return banded.model
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
      const ext = this.extremes()
      // Low/High come from the band on the Daily interval: wait for it (or its failure).
      return dataSettled({ record: this.record(), hasModel: !!this.model() }) && (!ext || ext.status !== 'loading' || !!ext.data)
    },
    /** Visible range: the window, or the last 24 h for the 24 h preset. */
    viewRange(): [number, number] | null {
      const w = this.window()
      const r = this.range()
      if (!w.valid || r === 'all') return null
      const xs = this.model()?.ts.x.filter(Number.isFinite) ?? []
      return rangeView(r, w.start, w.end, xs.length ? xs[xs.length - 1] : null)
    },
    stats(): StatRow[] {
      const m = this.model()
      const r = this.viewRange()
      return m && r && this.variable && this.settled() ? panelStats(m.ts.panels[0], m.ts.x, r, this.variable.sum, this.variable.id) : []
    },
    table(): ChartTable | null {
      const m = this.model()
      return m ? variableTableAll(m) : null
    },
    get announceKey(): string {
      // All years has its own data and announcement; reading the model here would fetch a window.
      if (this.all()) return ''
      const m = this.model()
      const w = this.window()
      if (!m || !this.settled()) return ''
      return viewAnnouncement(`${stations().current?.name ?? ''} ${this.title()}`.trim(), m.period, w.start, w.end, 1)
    },
  })
}
