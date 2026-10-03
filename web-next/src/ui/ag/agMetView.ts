/**
 * `x-data="agMetView"`: the Reference ET, feels-like and livestock risk
 * card (partials/ag/met.html). Level-2 daily or hourly observations →
 * core `metView` → the chart host, its table (tbl=1) and the stats card.
 */
import Alpine from 'alpinejs'
import type { MetChart } from '../../core/ag/view/results'
import { metStats, type AgStat } from '../../core/ag/view/stats'
import type { ChartTable } from '../../core/charts'
import { type AgView, gate, metView } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { fetchDailyMet, fetchHourlyMet, fetchStationMeta } from '../../core/ag/data'
import type { DailyMet, HourlyMet } from '../../core/ag/contract'
import { component } from '../component'
import { AG_CHARTS, LOADING, currentTab, raw, trackView, windowQuery } from './shared'

export function agMetView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<MetChart>,
    charts: AG_CHARTS,

    init() {
      stop = trackView(this, () => compute())
    },
    destroy() {
      stop()
    },

    /** The chart kind for the current variable; its host stays mounted while data loads. */
    kind: (): string => currentTab().variable,
    /** The model for one chart kind, or null (that host then clears). */
    modelOf<K extends MetChart['kind']>(kind: K) {
      const m = this.view.model
      return m && m.kind === kind ? (m.model as Extract<MetChart, { kind: K }>['model']) : null
    },
    /** The drawn chart's table twin, for the table view. */
    tableOf(): ChartTable | null {
      const m = this.view.model
      return m ? (AG_CHARTS[m.kind].table as (model: MetChart['model']) => ChartTable)(m.model) : null
    },
    stats(): AgStat[] {
      return metStats(this.view.model)
    },
  })
}

function compute(): AgView<MetChart> {
  const t = currentTab()
  const q = windowQuery(t)
  const variable = t.variable
  if (!q || (variable !== 'etr' && variable !== 'feels_like' && variable !== 'cci')) return LOADING
  const data = Alpine.store('data')
  const ttl = AG_TTL.series
  const met =
    t.period === 'daily'
      ? data.cached<DailyMet | HourlyMet>(agKeys.dailyMet(q), () => fetchDailyMet(q), { ttl })
      : data.cached<DailyMet | HourlyMet>(agKeys.hourlyMet(q), () => fetchHourlyMet(q), { ttl })
  // ETr needs the site (lat, elevation, wind height); the catalog is already loaded.
  const meta =
    variable === 'etr'
      ? data.cached(agKeys.stationMeta(q.station), () => fetchStationMeta(q.station, raw(Alpine.store('station').list)), {
          ttl: AG_TTL.stationMeta,
        })
      : null
  return gate<MetChart>([met, meta]) ?? metView(variable, t.period, t.livestock, raw(met.data!), raw(meta?.data))
}
