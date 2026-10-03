/**
 * `x-data="agAnnualView"`: the annual comparison card
 * (partials/ag/annual.html). Waits for the station's element list, then one
 * cached request per calendar year (newest first, from the install year),
 * drawn progressively as years arrive. Retry (the shared error state) refetches what failed.
 */
import Alpine from 'alpinejs'
import type { AnnualModel, ChartTable } from '../../core/charts'
import { type AgView, annualView, annualYears, elementsGate } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { annualElement, annualOptions } from '../../core/ag/view/tab'
import { type AnnualDaily, DEFAULT_AG_LEVEL, getAnnualDaily } from '../../core/ag/data'
import { denverToday } from '../../core/today'
import { component } from '../component'
import { AG_CHARTS, LOADING, agLoadError, currentTab, elementsResource, raw, trackView } from './shared'

export function agAnnualView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<AnnualModel>,
    charts: AG_CHARTS,
    /** The error state's text (partials/ag/status.html → partials/load-error.html). */
    loadError(): string {
      return agLoadError(this.view)
    },
    tableOf(): ChartTable | null {
      return this.view.model ? AG_CHARTS.annual.table(this.view.model) : null
    },
    init() {
      stop = trackView(this, () => compute())
    },
    destroy() {
      stop()
    },
  })
}

function compute(): AgView<AnnualModel> {
  const t = currentTab()
  // Keyed on the confirmed id, not the catalog row: a failed catalog must not spin forever.
  const station = Alpine.store('station').id
  if (!station || t.variable !== 'annual') return LOADING
  const els = elementsResource(station)
  const wait = elementsGate<AnnualModel>(els)
  if (wait) return wait
  const element = annualElement(t.annualVar, annualOptions(raw(els.data!)))
  const currentYear = Number(denverToday().slice(0, 4))
  const years = annualYears(Alpine.store('station').current?.date_installed, currentYear)
  const results = element
    ? years.map((year) => {
        const r = Alpine.store('data').cached<AnnualDaily>(
          agKeys.annual(station, element, year),
          () => getAnnualDaily(station, element, [year], { level: DEFAULT_AG_LEVEL }),
          { ttl: AG_TTL.series },
        )
        return { status: r.status, data: raw(r.data), error: r.error }
      })
    : []
  return annualView(element, years, results, currentYear)
}
