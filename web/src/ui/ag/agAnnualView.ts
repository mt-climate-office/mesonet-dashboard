/**
 * `x-data="agAnnualView"`: the annual comparison card
 * (partials/ag/annual.html). Waits for the station's element list, then one
 * cached request per calendar year (newest first, from the install year, which
 * shares the next year's request: core/variables `requestGroups`), drawn
 * progressively as years arrive. Retry (the shared error state) refetches what failed.
 */
import Alpine from 'alpinejs'
import type { AnnualModel, ChartTable } from '../../core/charts'
import { type AgView, annualView, annualYears, elementsGate } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { annualElement, annualOptions } from '../../core/ag/view/tab'
import { type AnnualDaily, agLevel, getAnnualDaily } from '../../core/ag/data'
import { denverToday } from '../../core/today'
import { requestGroups } from '../../core/variables'
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
  const installed = Alpine.store('station').current?.date_installed
  const years = annualYears(installed, currentYear)
  const groups = requestGroups(years, installed)
  const results = element
    ? years.map((year) => {
        // Both years of a group read the one entry; each keeps its own year of it.
        const group = groups.find((g) => g.includes(year)) ?? [year]
        const r = Alpine.store('data').cached<AnnualDaily>(
          agKeys.annual(station, element, group),
          () => getAnnualDaily(station, element, group, { level: agLevel(), together: true }),
          { ttl: AG_TTL.series },
        )
        const data = raw(r.data)
        return { status: r.status, data: data && group.length > 1 ? { ...data, years: data.years.filter((y) => y.year === year) } : data, error: r.error }
      })
    : []
  return annualView(element, years, results, currentYear)
}
