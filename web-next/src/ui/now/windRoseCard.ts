/**
 * `x-data="windRoseCard"`: Now's wind rose over a fixed recent window, 14 days
 * hourly, whatever the Charts range in the URL (core/cards/windRose), drawn by
 * the chart host with the core/charts/windRose builder. Empty until a station
 * is picked (legacy).
 */
import Alpine from 'alpinejs'
import type { Resource } from '../../core/cache'
import type { ObservationRow } from '../../core/api'
import { windRoseRequest } from '../../core/cards'
import { windRoseChart, windRoseTable, windRoseTitle } from '../../core/charts'
import { buildWindRoseModel, type WindRoseModel } from '../../core/models/windRose'
import type { ChartBindings } from '../charts/chart'
import { component } from '../component'
import { windObs } from '../station/resources'

export function windRoseCard() {
  return component({
    get resource(): Resource<ObservationRow[]> | null {
      const id = Alpine.store('station').id
      return id ? windObs(windRoseRequest(id)) : null
    },

    get model(): WindRoseModel | null {
      const rows = this.resource?.data
      return rows ? buildWindRoseModel(rows) : null
    },

    /** none (no station) | loading | empty (failed or no wind data; legacy text) | ready. */
    get state(): 'none' | 'loading' | 'empty' | 'ready' {
      const r = this.resource
      if (!r) return 'none'
      if (r.status === 'loading' && !r.data) return 'loading'
      return this.model ? 'ready' : 'empty'
    },

    get title(): string {
      return this.model ? (windRoseTitle(this.model) ?? '') : ''
    },

    /** Bindings for the nested `x-data="chart(roseChart())"`. */
    roseChart(): ChartBindings<WindRoseModel> {
      return { builder: windRoseChart, table: windRoseTable, label: 'Wind rose', model: () => this.model }
    },
  })
}
