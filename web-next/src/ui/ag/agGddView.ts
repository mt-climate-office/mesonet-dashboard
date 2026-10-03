/**
 * `x-data="agGddView"`: the growing degree days card (partials/ag/gdd.html).
 * Daily observations + vendored stage tables → core `gddView`; when the
 * window ends today, gridMET normals and the NWS gridpoint forecast feed
 * the projection. Also its table (tbl=1) and the stats card (so far, stage).
 */
import Alpine from 'alpinejs'
import type { ChartTable, GddModel } from '../../core/charts'
import { gddStats, type AgStat } from '../../core/ag/view/stats'
import { type AgView, gate, gddView } from '../../core/ag/view/results'
import { AG_TTL, agKeys, forecastNeedsRetry } from '../../core/ag/view/keys'
import { projectionThrough } from '../../core/ag/view/projection'
import { fetchDailyMet, fetchDailyNormals, fetchForecastDaily, loadGddStages, type ForecastResult } from '../../core/ag/data'
import { denverToday } from '../../core/ag/data/parse'
import { component } from '../component'
import { AG_CHARTS, LOADING, currentTab, raw, trackView, windowQuery } from './shared'

export function agGddView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<GddModel>,
    charts: AG_CHARTS,
    tableOf(): ChartTable | null {
      return this.view.model ? AG_CHARTS.gdd.table(this.view.model) : null
    },
    stats(): AgStat[] {
      return gddStats(this.view.model)
    },
    init() {
      stop = trackView(this, () => compute())
    },
    destroy() {
      stop()
    },
  })
}

/** Forecast fetch time, so a degraded result is retried after 5 minutes (AG_TTL.forecastDegraded). */
interface TimedForecast {
  at: number
  result: ForecastResult
}
let retried = -1

/** NWS forecast for the station (never errors; `degraded` instead). */
function forecastFor(lat: number, lon: number): ForecastResult | undefined {
  const res = Alpine.store('data').cached<TimedForecast>(
    agKeys.forecast(lat, lon),
    async () => ({ at: Date.now(), result: await fetchForecastDaily(lat, lon) }),
    { ttl: AG_TTL.forecast, retry: false },
  )
  const f = res.data
  if (f && f.at !== retried && forecastNeedsRetry(f.result.status === 'degraded', f.at, Date.now())) {
    retried = f.at
    res.refresh()
  }
  return raw(f?.result)
}

function compute(): AgView<GddModel> {
  const t = currentTab()
  const q = windowQuery(t)
  if (!q || t.variable !== 'gdd') return LOADING
  const data = Alpine.store('data')
  const met = data.cached(agKeys.dailyMet(q), () => fetchDailyMet(q), { ttl: AG_TTL.series })
  const stages = data.cached(agKeys.gddStages(), () => loadGddStages(), { ttl: AG_TTL.static })
  const wait = gate<GddModel>([met, stages])
  if (wait) return wait
  const m = raw(met.data!)
  const through = projectionThrough(m.date.at(-1), t.gddProj, denverToday())
  let normals
  let forecast
  if (through) {
    normals = raw(data.cached(agKeys.normals(q.station), () => fetchDailyNormals(q.station), { ttl: AG_TTL.static }).data)
    const st = Alpine.store('station').current
    const lat = Number(st?.latitude)
    const lon = Number(st?.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lon)) forecast = forecastFor(lat, lon)
  }
  return gddView({ tab: t, met: m, table: raw(stages.data!).tables[t.crop], through, normals, forecast })
}
