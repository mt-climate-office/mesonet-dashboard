/**
 * `x-data="variableRose({ part })"`: the Wind direction page's Rose view
 * (`wd=rose`; partials/charts/rose.html). `part: 'chart'` is the rose (core/charts
 * windRoseLargeChart) or, with `tbl`, its table, and announces each new window;
 * `part: 'stats'` is the stats card under the chips. Both read the same cached
 * request: wind speed + direction over the page's window at the rose's interval
 * (core/variables rose, `roseAgg`). Logic is in core.
 */
import Alpine from 'alpinejs'
import type { ObservationRow } from '../../core/api'
import type { Resource } from '../../core/cache'
import { windRoseLargeChart, windRoseTable, windRoseTitle, type ChartTable } from '../../core/charts'
import { dataSettled, plotStatus, type PlotStatus } from '../../core/latest'
import { loadErrorText } from '../../core/loadError'
import { buildWindRoseModel, windRoseStats, type WindRoseModel, type WindRoseStat } from '../../core/models/windRose'
import { chartWindow } from '../../core/models/timeseries'
import { CALM_MPH } from '../../core/overview/summary'
import { pageRange, roseAgg, roseAnnouncement, roseRequest, roseRows, spanDays, type PageRange } from '../../core/variables'
import type { ChartBindings } from './chart'
import { component } from '../component'
import { announce } from '../shell/live'
import { recordResource } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function variableRose(o: { part: 'chart' | 'stats' }) {
  // The model, kept while its rows and window are the same (the chart host redraws on a new model); kept
  // through a new window's load for the same station, so the rose does not flash.
  let memo: { rows: unknown; range: PageRange; station: string; model: WindRoseModel | null } | null = null
  return component({
    init() {
      if (o.part === 'chart') this.$watch('announceKey', (key: string) => key && announce(key))
    },

    range(): PageRange {
      return pageRange(url().state)
    },
    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    /** Hourly, or raw where the URL asks for it and the window offers it. */
    agg(): 'raw' | 'hourly' {
      const w = this.window()
      return roseAgg(url().state.agg, spanDays(w.start, w.end))
    },
    resource(): Resource<ObservationRow[]> | null {
      const id = stations().id
      const w = this.window()
      return id && w.valid ? recordResource(roseRequest(id, w.start, w.end, this.agg())) : null
    },
    model(): WindRoseModel | null {
      const id = stations().id ?? ''
      const res = this.resource()
      const range = this.range()
      if (!res || res.status === 'error') return null
      if (!res.data) return memo?.station === id ? memo.model : null
      if (memo?.rows !== res.data || memo.range !== range || memo.station !== id) {
        memo = { rows: res.data, range, station: id, model: buildWindRoseModel(roseRows(Alpine.raw(res.data), range)) }
      }
      return memo.model
    },
    /** The model has something to draw (not every reading calm). */
    drawable(): boolean {
      return (this.model()?.n ?? 0) > 0
    },
    status(): PlotStatus {
      const m = this.model()
      const s = plotStatus({ empty: null, waiting: !stations().id, record: this.resource()?.status ?? null, hasModel: !!m })
      return s.kind === 'ready' && m && m.n === 0 ? { kind: 'empty', title: `Calm throughout (under ${CALM_MPH} mph): nothing to draw.` } : s
    },
    loadError(): string {
      const res = this.resource()
      return res?.status === 'error' ? loadErrorText('The wind rose', res.error) : ''
    },
    /** The chart shows this window's data (not the previous window's while it loads). */
    settled(): boolean {
      return dataSettled({ record: this.resource()?.status ?? null, hasModel: !!this.model() })
    },
    /** "Wind, Oct 1 – Oct 8", or "Wind, last 24 hours". */
    title(): string {
      const m = this.model()
      return m ? (windRoseTitle(m, this.range() === '24h') ?? '') : ''
    },
    table(): ChartTable | null {
      const m = this.model()
      return m ? windRoseTable(m, this.range() === '24h') : null
    },
    /** Bindings for the nested `x-data="chart(roseChart())"`: nothing drawn when every reading was calm (its message shows). */
    roseChart(): ChartBindings<WindRoseModel> {
      return {
        builder: windRoseLargeChart,
        table: (m) => windRoseTable(m, this.range() === '24h'),
        label: 'Wind rose chart',
        model: () => (this.drawable() ? this.model() : null),
      }
    },
    stats(): WindRoseStat[] {
      const m = this.model()
      return m && this.settled() ? windRoseStats(m) : []
    },
    get announceKey(): string {
      const m = this.model()
      if (!m || !this.settled()) return ''
      const st = stations().current
      return roseAnnouncement(st?.name ?? '', m, this.range(), this.agg(), st?.sub_network)
    },
  })
}
