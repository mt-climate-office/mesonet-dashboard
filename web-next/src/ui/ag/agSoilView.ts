/**
 * `x-data="agSoilView"`: the soil profile heatmap, soil water potential and
 * percent saturation card (partials/ag/soil.html). Level-2 soil observations
 * + the API's SWP / porosity rows (the only `/derived` requests) → core
 * `soilView`. The profile is always daily.
 */
import Alpine from 'alpinejs'
import { type AgView, type SoilChart, gate, soilSub, soilView } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { POROSITY_SOURCE, fetchPorosityRows } from '../../core/ag/view/porositySource'
import { SWP_SOURCE, fetchSwpApiRows } from '../../core/ag/view/swpSource'
import { SOIL_PROFILE } from '../../core/ag/view/tab'
import { fetchSoilSeries, loadSoilParams, soilParamsFor } from '../../core/ag/data'
import type { ChartTable } from '../../core/charts'
import { component } from '../component'
import { AG_CHARTS, LOADING, currentTab, raw, trackView, windowQuery } from './shared'

export function agSoilView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<SoilChart>,
    charts: AG_CHARTS,
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
  const swp = sub === 'swp' && SWP_SOURCE === 'api' ? data.cached(agKeys.swpRows(w, period), () => fetchSwpApiRows(q), { ttl }) : null
  const porosity =
    sub === 'percent_saturation' && POROSITY_SOURCE === 'api'
      ? data.cached(agKeys.porosityRows(w, period), () => fetchPorosityRows(q), { ttl })
      : null
  // Only the client SWP / vendored porosity paths need the soil parameters.
  const needsParams = (sub === 'swp' && !swp) || (sub === 'percent_saturation' && !porosity)
  const params = needsParams ? data.cached(agKeys.soilParams(), () => loadSoilParams(), { ttl: AG_TTL.static }) : null
  return (
    gate<SoilChart>([soil, swp, porosity, params]) ??
    soilView({
      variable,
      soilVar: t.soilVar,
      period,
      soil: raw(soil.data!),
      swpRows: raw(swp?.data),
      porosityRows: raw(porosity?.data),
      params: params?.data ? soilParamsFor(raw(params.data), w.station) : undefined,
    })
  )
}
