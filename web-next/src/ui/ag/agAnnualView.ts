/**
 * `x-data="agAnnualView"`: the annual comparison card
 * (partials/ag/annual.html). One cached request per calendar year (newest
 * first, from the install year), drawn progressively as years arrive.
 */
import Alpine from 'alpinejs'
import type { AnnualModel } from '../../core/charts'
import { type AgView, annualView, annualYears } from '../../core/ag/view/results'
import { AG_TTL, agKeys } from '../../core/ag/view/keys'
import { DEFAULT_AG_LEVEL, getAnnualDaily } from '../../core/ag/data'
import { denverToday } from '../../core/ag/data/parse'
import { component } from '../component'
import { AG_CHARTS, LOADING, currentTab, raw, trackView } from './shared'

export function agAnnualView() {
  let stop = () => {}
  return component({
    view: LOADING as AgView<AnnualModel>,
    charts: AG_CHARTS,
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
  const station = Alpine.store('station').current
  if (!station || t.variable !== 'annual') return LOADING
  const currentYear = Number(denverToday().slice(0, 4))
  const years = annualYears(station.date_installed, currentYear)
  const element = t.annualVar
  const results = element
    ? years.map((year) => {
        const r = Alpine.store('data').cached(
          agKeys.annual(station.station, element, year),
          () => getAnnualDaily(station.station, element, [year], { level: DEFAULT_AG_LEVEL }),
          { ttl: AG_TTL.series },
        )
        return { status: r.status, data: raw(r.data), error: r.error }
      })
    : []
  return annualView(element, years, results, currentYear)
}
