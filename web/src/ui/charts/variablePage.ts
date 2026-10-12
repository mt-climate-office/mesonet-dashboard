/**
 * `x-data="variablePage"`: Charts → one variable (`v=`; partials/charts/variable.html).
 * Header (back, title, ⋯ menu), "value now · range", the chart (core/charts
 * variableChart; the Daily interval adds the low–high band) or, with `tbl`,
 * its table; range chips over from/to (All years = `view=history`, its own
 * component), the Interval row over `agg`, and the stats card. On Wind
 * direction a View row switches to the wind rose of the window (`wd=rose`;
 * its own component, variableRose). On a soil variable an Arrays row draws
 * each sensor array (`arrays=1`; array B dashed). A sideways swipe on touch, or ⋯ →
 * Previous / Next, walks the list. A Download sheet opened by the URL with
 * nothing to download is prefilled from this chart. Logic is in core/variables.
 */
import Alpine from 'alpinejs'
import { variableChart, variableTable, variableTableAll, type ChartTable, type LatestTimeseriesModel } from '../../core/charts'
import { fromChart, prefillsFromChart, variableElements, windRoseElements } from '../../core/downloader/fromChart'
import { POR_FALLBACK_START, dataSettled, installDate, plotStatus, todayIso, untilNow, viewAnnouncement, type PlotStatus } from '../../core/latest'
import { chartWindow } from '../../core/models/timeseries'
import {
  ARRAY_CHIPS,
  RANGE_CHIPS,
  ROSE_ALL_YEARS_REASON,
  WIND_VIEW_CHIPS,
  arraysNote,
  arraysPatch,
  currentReading,
  effectiveAgg,
  findVariable,
  hasBand,
  intervalChips,
  intervalNote,
  intervalPatch,
  neighbors,
  offersArrays,
  offersRose,
  pageRange,
  panelStats,
  plainName,
  rangeChipPatch,
  rangeLabel,
  rangeView,
  roseAgg,
  roseOffersRange,
  showsNormals,
  showsRose,
  spanDays,
  splitsArrays,
  windViewPatch,
  withBand,
  type ArrayChip,
  type IntervalChip,
  type PageRange,
  type StatRow,
  type Variable,
  type WindViewChip,
} from '../../core/variables'
import { loadErrorText } from '../../core/loadError'
import { denverWallMs } from '../../core/today'
import type { LatestAgg } from '../../core/url-schema'
import { component } from '../component'
import { initSwipe } from '../layout/swipe'
import { announce } from '../shell/live'
import { stepChart } from '../shell/navigate'
import { countEvent } from '../shell/analytics'
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
    /** The interval drawn (Auto resolved; raw only where offered; the rose: hourly or raw). */
    agg(): LatestAgg {
      return this.rose() ? roseAgg(url().state.agg, this.days()) : effectiveAgg(url().state.agg, this.days(), this.all())
    },
    intervals(): IntervalChip[] {
      return intervalChips(url().state.agg, this.days(), { all: this.all(), network: stations().current?.sub_network, rose: this.rose() })
    },
    /** Why the interval chips not offered here are off ('' when every one is), shown under the row. */
    intervalNote(): string {
      return intervalNote(this.intervals())
    },
    /** This page offers the Time series | Rose switch (Wind direction). */
    offersRose(): boolean {
      return offersRose(this.variable?.id)
    },
    /** The page shows the wind rose (`wd=rose`), not the time series. */
    rose(): boolean {
      return showsRose(url().state, this.variable?.id)
    },
    windViews: WIND_VIEW_CHIPS,
    windView(): WindViewChip {
      return this.rose() ? 'rose' : 'series'
    },
    /** This page offers the Combined | Separate arrays row (soil depths, as a time series or its table). */
    offersArrays(): boolean {
      return offersArrays(this.variable) && !this.all() && !this.rose()
    },
    arrayChips: ARRAY_CHIPS,
    arrayView(): ArrayChip {
      return splitsArrays(url().state, this.variable) ? 'split' : 'combined'
    },
    /** Why Separate shows no array lines ('' otherwise), shown under the row. */
    arraysNote(): string {
      return this.settled() ? arraysNote(this.arrayView() === 'split', this.model()?.ts.panels[0]) : ''
    },
    setArrays(id: ArrayChip): void {
      if (id === this.arrayView()) return
      url().set(arraysPatch(id))
      countEvent(`arrays/${id}`, 'Soil arrays chosen')
    },
    /** A range chip the view does not offer (All years beside the rose), and why. */
    rangeOff(id: (typeof RANGE_CHIPS)[number]['id']): boolean {
      return this.rose() && !roseOffersRange(id)
    },
    rangeNote(): string {
      return this.rose() ? ROSE_ALL_YEARS_REASON : ''
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
      if (this.rangeOff(id)) return
      url().set(rangeChipPatch(id, url().state.agg))
    },
    /** Time series | Rose: pushed, like Show as table, so Back returns. */
    setWindView(id: WindViewChip): void {
      if (id === this.windView()) return
      url().go('charts', windViewPatch(id), true)
      countEvent(`wind-view/${id}`, 'Wind view chosen')
    },
    setInterval(c: IntervalChip): void {
      if (c.disabled) return
      url().set(intervalPatch(c.id))
      countEvent(`interval/${c.id}`, 'Interval chosen')
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
      const els = stationElements(id) ?? []
      // The rose is drawn from wind direction and wind speed: both download.
      const elements = this.rose() ? windRoseElements(els) : variableElements(v.name, els)
      url().set(fromChart({ elements, start, end: all ? todayIso() : w.end, interval: this.agg() }))
      return true
    },

    /* Chart (the time series; the rose is variableRose's) */
    query(): SeriesQuery | null {
      const id = stations().id
      const v = this.variable
      if (!id || !v || !this.window().valid || this.all() || this.rose()) return null
      const agg = this.agg()
      return { station: id, window: this.window(), agg, vars: [v.name], gridmet: showsNormals(v, agg), splitArrays: splitsArrays(url().state, v) }
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
    /** Visible range: the window up to now (core/latest untilNow), or the last 24 h for the 24 h preset. */
    viewRange(): [number, number] | null {
      const w = this.window()
      const r = this.range()
      if (!w.valid || r === 'all') return null
      const xs = this.model()?.ts.x.filter(Number.isFinite) ?? []
      return untilNow(rangeView(r, w.start, w.end, xs.length ? xs[xs.length - 1] : null), this.agg(), denverWallMs())
    },
    stats(): StatRow[] {
      const m = this.model()
      const r = this.viewRange()
      return m && r && this.variable && this.settled() ? panelStats(m.ts.panels[0], m.ts.x, r, this.variable.sum, this.variable.id, m.partial) : []
    },
    table(): ChartTable | null {
      const m = this.model()
      return m ? variableTableAll(m) : null
    },
    get announceKey(): string {
      // All years has its own data and announcement; reading the model here would fetch a window.
      // (The rose announces itself; with it shown, query() is null and so is the model.)
      if (this.all()) return ''
      const m = this.model()
      const w = this.window()
      if (!m || !this.settled()) return ''
      return viewAnnouncement(`${stations().current?.name ?? ''} ${this.title()}`.trim(), m.period, w.start, w.end, 1)
    },
  })
}
