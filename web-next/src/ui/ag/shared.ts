/**
 * Glue shared by the Ag Tools components: the resolved tab state, the chart
 * bindings per kind (builder + table twin + label for the chart host), and
 * `trackView`, which keeps a card's `view` in sync and announces it.
 */
import Alpine from 'alpinejs'
import { resolveAgTab, type AgTab } from '../../core/ag/view/tab'
import { type AgView, viewAnnouncement } from '../../core/ag/view/results'
import { denverToday } from '../../core/today'
import * as C from '../../core/charts'
import { getStationElements } from '../../core/api'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { announce } from '../shell/live'

/** The Ag selection for the current URL and station. */
export const currentTab = (): AgTab =>
  resolveAgTab(Alpine.store('url').state, Alpine.store('station').current, denverToday())

/** The query window of the current tab, or null without a confirmed station. */
export function windowQuery(t: AgTab): { station: string; start: string; end: string } | null {
  const station = Alpine.store('station').id
  return station ? { station, start: t.start, end: t.end } : null
}

/** The station's element list (Annual comparison options), shared by the controls and the Annual card. */
export const elementsResource = (station: string) =>
  Alpine.store('data').cached(agKeys.elements(station), () => getStationElements(station), { ttl: AG_TTL.elements })

/** Resource data without the reactive proxy (compute reads every element). */
export const raw = <T>(v: T): T => (v == null ? v : Alpine.raw(v))

/** Host bindings per chart kind: `x-data="chart({ ...charts.etr, model: () => … })"`. */
export const AG_CHARTS = {
  etr: { builder: C.etrChart, table: C.etrTable, label: 'Reference ET chart' },
  feels_like: { builder: C.feelsLikeChart, table: C.feelsLikeTable, label: 'Feels like chart' },
  cci: { builder: C.cciChart, table: C.cciTable, label: 'Livestock risk index chart' },
  gdd: { builder: C.gddChart, table: C.gddTable, label: 'Growing degree days chart' },
  profile: { builder: C.soilProfileChart, table: C.soilProfileTable, label: 'Soil profile heatmap' },
  swp: { builder: C.swpChart, table: C.swpTable, label: 'Soil water potential chart' },
  percent_saturation: { builder: C.percentSaturationChart, table: C.percentSaturationTable, label: 'Percent soil saturation chart' },
  annual: { builder: C.annualChart, table: C.annualTable, label: 'Annual comparison chart' },
}

export const LOADING: AgView<never> = { status: 'loading', message: null, notes: [], model: null }

/**
 * Recompute `host.view` whenever `compute`'s inputs change, and announce each
 * settled view politely. Returns the cleanup for `destroy()`.
 */
export function trackView<M>(host: { view: AgView<M> }, compute: () => AgView<M>): () => void {
  let last: AgView<M> | null = null
  const fx = [
    Alpine.effect(() => {
      host.view = compute()
    }),
    Alpine.effect(() => {
      // Once per new view (the tab/station reads below must not re-announce it).
      const v = host.view
      if (v === last) return
      last = v
      const station = Alpine.store('station').current?.name ?? 'this station'
      const text = viewAnnouncement(currentTab().variableLabel, v, station)
      if (text) announce(text)
    }),
  ]
  return () => fx.forEach((f) => Alpine.release(f))
}
