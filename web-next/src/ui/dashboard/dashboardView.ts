/**
 * `x-data="dashboardView"` (partials/dashboard/index.html): the big-screen dashboard (core/dashboard).
 * One request for every station variable over the URL window and interval (`from`/`to`/`agg`, so a
 * chart opened from here keeps them), drawn as two stacks of panels on one time axis (`stackColumns`):
 * equal rows aligned across the stacks, crosshair, tooltip and zoom linked between them. Wind direction
 * is a wind rose of the window (the Rose view's request). The range and interval chips. The conditions,
 * photo and About cards are Now's and About's components, nested.
 */
import Alpine from 'alpinejs'
import { LAYOUT, dashboardStackChart, fillRows, latestTimeseriesTable, windRoseFitChart, windRoseTable, windRoseTitle, type LatestTimeseriesModel } from '../../core/charts'
import { DASHBOARD_RANGES, ROSE_ON_DASHBOARD, stackColumns, stackOf } from '../../core/dashboard'
import { untilNow } from '../../core/latest'
import { loadErrorText } from '../../core/loadError'
import { chartWindow } from '../../core/models/timeseries'
import { buildWindRoseModel, type WindRoseModel } from '../../core/models/windRose'
import { denverWallMs } from '../../core/today'
import type { LatestAgg } from '../../core/url-schema'
import {
  LABELS,
  LIST_AG_TOOLS,
  activePreset,
  chartHeading,
  chartPatch,
  currentReading,
  effectiveAgg,
  intervalChips,
  intervalNote,
  intervalPatch,
  intervalWord,
  plainName,
  rangeChipPatch,
  rangeLabel,
  rangeView,
  roseAgg,
  roseRequest,
  roseRows,
  spanDays,
  type IntervalChip,
  type Variable,
} from '../../core/variables'
import type { ChartBindings } from '../charts/chart'
import { chartVariables, recordResource, seriesModel, seriesRequest, variablesError, type SeriesQuery } from '../charts/resources'
import { component } from '../component'
import { follow } from '../shell/navigate'
import { latestObs } from '../station/resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

/** The stacks' echarts.connect group (ui/charts/chart `group`). */
const STACKS = 'dashboard-stacks'

export function dashboardView() {
  const build = seriesModel()
  const observers: ResizeObserver[] = []
  // Each stack's model, kept while the shared model is the same object (a new one would redraw the chart).
  const stackModels: ({ base: LatestTimeseriesModel; model: LatestTimeseriesModel | null } | null)[] = [null, null]
  let rose: { rows: unknown; range: string; model: WindRoseModel | null } | null = null
  return component({
    ranges: DASHBOARD_RANGES,
    agTools: LIST_AG_TOOLS.map((id) => ({ id, name: LABELS[id]?.name ?? id, sub: LABELS[id]?.sub ?? '' })),
    /** Each stack's measured canvas height (px), for the panel links over it. */
    stackH: [0, 0] as number[],

    destroy() {
      observers.forEach((r) => r.disconnect())
    },

    /* Window and interval (the URL's, as on a chart page) */
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
    /** "Last 14 days · Hourly". */
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
    /** The chart pages' interval chips (Auto · 5-min / 15-min · Hourly · Daily); raw only for short windows. */
    intervals(): IntervalChip[] {
      const w = this.window()
      return intervalChips(url().state.agg, spanDays(w.start, w.end), { network: stations().current?.sub_network })
    },
    intervalNote(): string {
      return intervalNote(this.intervals())
    },
    setInterval(c: IntervalChip): void {
      if (!c.disabled) url().set(intervalPatch(c.id))
    },

    /* The shared request */
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

    /* The two stacks */
    stacks(): [Variable[], Variable[]] {
      return stackColumns(this.variables)
    },
    /** Rows per stack: the longer stack's count, so both stacks' rows line up. */
    rows(): number {
      return Math.max(1, ...this.stacks().map((s) => s.length))
    },
    stackModel(i: number): LatestTimeseriesModel | null {
      const base = this.model()
      if (!base) return null
      const hit = stackModels[i]
      if (hit?.base === base && hit.model?.fill?.rows === this.rows()) return hit.model
      const stack = stackOf(base, this.stacks()[i].map((v) => v.name))
      const model = stack && { ...stack, fill: { rows: this.rows() } }
      stackModels[i] = { base, model }
      return model
    },
    /** Bindings for stack `i`'s nested `x-data="chart(stackChart(i))"`. */
    stackChart(i: number): ChartBindings<LatestTimeseriesModel> {
      return {
        builder: dashboardStackChart,
        table: latestTimeseriesTable,
        label: `${this.stacks()[i].map((v) => plainName(v.id, v.name)).join(', ')}: ${this.rangeText()}`,
        model: () => this.stackModel(i),
        range: () => this.viewRange(),
        group: STACKS,
      }
    },
    /** `x-init` on stack `i`'s plot box: its height, for the panel links. */
    measureStack(el: HTMLElement, i: number): void {
      const r = new ResizeObserver(() => (this.stackH = this.stackH.map((h, j) => (j === i ? el.clientHeight : h))))
      r.observe(el)
      observers.push(r)
    },
    /** The link over each panel of stack `i` (its name and reading now, in the gap above it), placed with the builder's own rows (`fillRows`). */
    stackLinks(i: number): { v: Variable; top: number }[] {
      const h = this.stackH[i]
      if (!h || !this.stackModel(i)) return []
      const { tops } = fillRows(this.rows(), h, true)
      return this.stacks()[i].map((v, j) => ({ v, top: tops[j] - LAYOUT.top }))
    },

    /* Wind direction: a rose of the window */
    roseVar(): Variable | undefined {
      return this.variables.find((v) => v.id === ROSE_ON_DASHBOARD)
    },
    roseModel(): WindRoseModel | null {
      const id = stations().id
      const w = this.window()
      if (!id || !w.valid || !this.roseVar()) return null
      const res = recordResource(roseRequest(id, w.start, w.end, roseAgg(url().state.agg, spanDays(w.start, w.end))))
      if (!res?.data) return rose?.model ?? null
      const range = activePreset(url().state)
      if (rose?.rows !== res.data || rose.range !== range) rose = { rows: res.data, range, model: buildWindRoseModel(roseRows(Alpine.raw(res.data), range)) }
      return rose.model
    },
    roseTitle(): string {
      const m = this.roseModel()
      return (m && windRoseTitle(m, activePreset(url().state) === '24h')) || 'Wind'
    },
    roseChart(): ChartBindings<WindRoseModel> {
      return {
        builder: windRoseFitChart,
        table: (m) => windRoseTable(m, activePreset(url().state) === '24h'),
        label: `Wind rose, ${this.rangeText()}`,
        model: () => this.roseModel(),
      }
    },
    roseHref(): string {
      return url().hrefFor('charts', { ...chartPatch(ROSE_ON_DASHBOARD), wd: 'rose' })
    },
    openRose(e: MouseEvent): void {
      follow(e, 'charts', { patch: { ...chartPatch(ROSE_ON_DASHBOARD), wd: 'rose' }, drillDown: true, target: 'var-title', from: url().section })
    },

    /* Labels and links */
    name: (v: Variable): string => plainName(v.id, v.name),
    /** The reading now ("57 °F", "4% at 2 in"; the partial adds "now"), '' for a total or without a reading. */
    now(v: Variable | undefined): string {
      const id = stations().id
      const latest = id ? (latestObs(id).data?.[0] as Record<string, unknown> | undefined) : undefined
      return (v && currentReading(v, latest ? Alpine.raw(latest) : undefined)) || ''
    },
    href(id: string): string {
      return url().hrefFor('charts', chartPatch(id))
    },
    /** A panel's name or a More chart: push its page on this window and interval; Back (and its back link) returns here. */
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
