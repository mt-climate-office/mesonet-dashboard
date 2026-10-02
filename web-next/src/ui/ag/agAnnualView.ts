/**
 * `x-data="agAnnualView"`: the annual comparison card
 * (partials/ag/annual.html). Waits for the station's element list, then one
 * cached request per calendar year (newest first, from the install year),
 * drawn progressively as years arrive. Retry refetches what failed.
 */
import Alpine from 'alpinejs'
import type { Resource } from '../../core/cache'
import type { AnnualModel } from '../../core/charts'
import { type AgView, annualView, annualYears, elementsGate } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { annualElement, annualOptions } from '../../core/ag/view/tab'
import { type AnnualDaily, DEFAULT_AG_LEVEL, getAnnualDaily } from '../../core/ag/data'
import { denverToday } from '../../core/ag/data/parse'
import { component } from '../component'
import { AG_CHARTS, LOADING, currentTab, elementsResource, raw, trackView } from './shared'

export function agAnnualView() {
  let stop = () => {}
  // Resources behind the current view, so Retry can refresh the failed ones.
  const used: Resource<unknown>[] = []
  return component({
    view: LOADING as AgView<AnnualModel>,
    charts: AG_CHARTS,
    init() {
      stop = trackView(this, () => compute(used))
    },
    destroy() {
      stop()
    },
    retry() {
      used.filter((r) => r.status === 'error').forEach((r) => r.refresh())
    },
  })
}

function compute(used: Resource<unknown>[]): AgView<AnnualModel> {
  used.length = 0
  const t = currentTab()
  // Keyed on the confirmed id, not the catalog row: a failed catalog must not spin forever.
  const station = Alpine.store('station').id
  if (!station || t.variable !== 'annual') return LOADING
  const els = elementsResource(station)
  used.push(els)
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
        used.push(r)
        return { status: r.status, data: raw(r.data), error: r.error }
      })
    : []
  return annualView(element, years, results, currentYear)
}
