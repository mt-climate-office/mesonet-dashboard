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
import { buildWindRoseModel, calmText, type WindRoseModel } from '../../core/models/windRose'
import { type Units, units } from '../../core/units'
import { roseRows } from '../../core/variables'
import type { ChartBindings } from '../charts/chart'
import { component } from '../component'
import { windObs } from '../station/resources'

export function windRoseCard() {
  // The model, kept while its rows and display units are the same (the chart host redraws on a new model).
  let memo: { rows: unknown; units: Units; model: WindRoseModel | null } | null = null
  return component({
    get resource(): Resource<ObservationRow[]> | null {
      const id = Alpine.store('station').id
      return id ? windObs(id, nowWindRoseRequest(id)) : null
    },

    get model(): WindRoseModel | null {
      const rows = this.resource?.data
      if (!rows) return null
      const u = units()
      if (memo?.rows !== rows || memo.units !== u) memo = { rows, units: u, model: buildWindRoseModel(roseRows(Alpine.raw(rows), '24h'), u) }
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

    /** The calm state's text: "Calm for the last 24 hours (under 1 mph)." in the display units. */
    get calmMessage(): string {
      return `Calm for the last 24 hours (${calmText()}).`
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
