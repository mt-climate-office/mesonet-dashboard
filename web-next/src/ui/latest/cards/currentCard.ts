/**
 * `x-data="currentCard"`: Current Conditions ("Latest Data Summary") from
 * `/latest`, plus the Precipitation Summary from `/derived/ppt/` for HydroMet
 * stations only (it 422s for AgriMet). Rows: core/cards/currentConditions.
 */
import Alpine from 'alpinejs'
import { currentConditionsRows, pptSummaryRows } from '../../../core/cards'
import { component } from '../../component'
import { latestObs, pptSummary } from './resources'

type Row = readonly [string, string]

export function currentCard() {
  return component({
    get state(): 'none' | 'loading' | 'error' | 'empty' | 'ready' {
      const id = Alpine.store('station').id
      if (!id) return 'none'
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
