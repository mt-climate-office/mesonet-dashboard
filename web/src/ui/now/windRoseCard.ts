/**
 * `x-data="windRoseCard"`: Now's wind rose over a fixed window, the last 24
 * hours of raw readings (5-min, 15-min at AgriMet), whatever the Charts range
 * in the URL (core/cards nowWindRoseRequest), drawn by the chart host with the
 * core/charts/windRose builder. Empty until a station is picked (legacy).
 */
import Alpine from 'alpinejs'
import type { Resource } from '../../core/cache'
import type { ObservationRow } from '../../core/api'
import { nowWindRoseRequest } from '../../core/cards'
import { windRoseChart, windRoseTable, windRoseTitle } from '../../core/charts'
import { buildWindRoseModel, type WindRoseModel } from '../../core/models/windRose'
import { roseRows } from '../../core/variables'
import type { ChartBindings } from '../charts/chart'
import { component } from '../component'
import { windObs } from '../station/resources'

export function windRoseCard() {
  // The model, kept while its rows are the same array (the chart host redraws on a new model).
  let memo: { rows: unknown; model: WindRoseModel | null } | null = null
  return component({
    get resource(): Resource<ObservationRow[]> | null {
      const id = Alpine.store('station').id
      return id ? windObs(id, nowWindRoseRequest(id)) : null
    },

    get model(): WindRoseModel | null {
      const rows = this.resource?.data
      if (!rows) return null
      if (memo?.rows !== rows) memo = { rows, model: buildWindRoseModel(roseRows(Alpine.raw(rows), '24h')) }
      return memo.model
    },

    /** none (no station) | loading | empty (failed or no wind data; legacy text) | calm (nothing to draw) | ready. */
    get state(): 'none' | 'loading' | 'empty' | 'calm' | 'ready' {
      const r = this.resource
      if (!r) return 'none'
      if (r.status === 'loading' && !r.data) return 'loading'
      const m = this.model
      return !m ? 'empty' : m.n === 0 ? 'calm' : 'ready'
    },

    get title(): string {
      return this.model ? (windRoseTitle(this.model, true) ?? '') : ''
    },

    /** Bindings for the nested `x-data="chart(roseChart())"`. */
    roseChart(): ChartBindings<WindRoseModel> {
      return { builder: windRoseChart, table: (m) => windRoseTable(m, true), label: 'Wind rose, last 24 hours', model: () => this.model }
    },
  })
}
