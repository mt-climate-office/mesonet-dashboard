/**
 * `x-data="aboutReadings"` (partials/about/readings.html): every current
 * reading from `/latest`, plus the precipitation summary from `/derived/ppt/`
 * for HydroMet stations only (it 422s for AgriMet). Rows:
 * core/cards/currentConditions. Now's "All readings" link scrolls here.
 */
import Alpine from 'alpinejs'
import { currentConditionsRows, pptSummaryRows } from '../../core/cards'
import { component } from '../component'
import { latestObs, pptSummary } from '../station/resources'

type Row = readonly [string, string]

export function aboutReadings() {
  return component({
    get state(): 'loading' | 'error' | 'empty' | 'ready' {
      const id = Alpine.store('station').id
      if (!id) return 'loading'
      const r = latestObs(id)
      if (r.status === 'loading' && !r.data) return 'loading'
      if (r.status === 'error' && !r.data) return 'error'
      return this.rows.length ? 'ready' : 'empty'
    },

    get rows(): Row[] {
      const id = Alpine.store('station').id
      const first = id ? latestObs(id).data?.[0] : undefined
      return first ? currentConditionsRows(first as Record<string, unknown>) : []
    },

    get pptRows(): Row[] {
      const s = Alpine.store('station').current
      if (s?.sub_network !== 'HydroMet') return []
      return pptSummaryRows(pptSummary(s.station).data?.[0])
    },
  })
}
