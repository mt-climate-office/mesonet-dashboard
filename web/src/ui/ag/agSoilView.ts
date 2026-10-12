/**
 * `x-data="agSoilView"`: the soil profile heatmap, soil water potential and
 * percent saturation card (partials/ag/soil.html). Level-2 soil observations
 * + mesonet-soils parameters → core `soilView`. The profile is always daily.
 */
import Alpine from 'alpinejs'
import { type AgView, type SoilChart, gate, soilSub, soilView } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { SOIL_PROFILE } from '../../core/ag/view/tab'
import { fetchSoilSeries, loadSoilParams, soilParamsFor } from '../../core/ag/data'
import type { ChartTable } from '../../core/charts'
import { component } from '../component'
import { AG_CHARTS, LOADING, agLoadError, currentTab, raw, trackView, windowQuery } from './shared'

export function agSoilView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<SoilChart>,
    charts: AG_CHARTS,
    /** The error state's text (partials/ag/status.html → partials/load-error.html). */
    loadError(): string {
      return agLoadError(this.view)
    },
    init() {
      stop = trackView(this, () => compute())
    },
    destroy() {
      stop()
    },
    /** The chart kind for the current variable; its host stays mounted while data loads. */
    kind(): SoilChart['kind'] {
      const v = currentTab().variable
      return v === SOIL_PROFILE ? 'profile' : (v as SoilChart['kind'])
    },
    modelOf<K extends SoilChart['kind']>(kind: K) {
      const m = this.view.model
      return m && m.kind === kind ? (m.model as Extract<SoilChart, { kind: K }>['model']) : null
    },
    /** The drawn chart's table twin, for the table view. */
    tableOf(): ChartTable | null {
      const m = this.view.model
      return m ? (AG_CHARTS[m.kind].table as (model: SoilChart['model']) => ChartTable)(m.model) : null
    },
  })
}

function compute(): AgView<SoilChart> {
  const t = currentTab()
  const w = windowQuery(t)
  const variable = t.variable
  if (!w || (variable !== SOIL_PROFILE && variable !== 'swp' && variable !== 'percent_saturation')) return LOADING
  const period = variable === SOIL_PROFILE ? 'daily' : t.period
  const q = { ...w, period }
  const sub = soilSub(variable, t.soilVar)
  const data = Alpine.store('data')
  const ttl = AG_TTL.series
  const soil = data.cached(agKeys.soil(w, period), () => fetchSoilSeries(q), { ttl })
  const needsParams = sub === 'swp' || sub === 'percent_saturation'
  const params = needsParams ? data.cached(agKeys.soilParams(), () => loadSoilParams(), { ttl: AG_TTL.static }) : null
  return (
    gate<SoilChart>([soil, params]) ??
    soilView({
      variable,
      soilVar: t.soilVar,
      period,
      soil: raw(soil.data!),
      params: params?.data ? soilParamsFor(raw(params.data), w.station) : undefined,
    })
  )
}
