/**
 * `x-data="variableHistory"`: the variable page's History view, years
 * overlaid (core/charts annualChart). Daily data, one calendar year per
 * cached request (core/variables `historyRequest`), newest year first; the
 * next older year is requested once the newer ones have settled, so the chart
 * fills in progressively and the API sees one request at a time.
 */
import Alpine from 'alpinejs'
import type { ObservationRow } from '../../core/api'
import { annualChart, annualTable, type AnnualModel } from '../../core/charts'
import { installDate, todayIso } from '../../core/latest'
import { findVariable, historyModel, historyRequest, historyYears, plainName, type Variable } from '../../core/variables'
import { component } from '../component'
import { announce } from '../shell/live'
import { chartVariables, recordResource, stationElements } from './resources'

export function variableHistory() {
  // Pinned at creation: the view lives inside the page's block keyed by variable, so it is rebuilt on a
  // variable change. Reading `v` live would request the next variable's history before this view closes.
  const vid = Alpine.store('url').state.v
  return component({
    annualChart,
    annualTable,

    init() {
      this.$watch('progress', (p: string) => p.startsWith('Showing') && announce(p))
    },

    get variable(): Variable | undefined {
      return findVariable(chartVariables(Alpine.store('station').id) ?? [], vid)
    },
    /** The chart's accessible name: "Air temperature by year". */
    label(): string {
      const v = this.variable
      return `${v ? plainName(v.id, v.name) : 'History'} by year`
    },
    /** Each year's rows so far (newest first); requests stop at the first year still loading. */
    get years(): { year: number; rows: ObservationRow[] | null; loading: boolean }[] {
      const st = Alpine.store('station')
      const v = this.variable
      if (!st.id || !v) return []
      const today = todayIso()
      const installed = installDate(st.current)
      const out: { year: number; rows: ObservationRow[] | null; loading: boolean }[] = []
      for (const year of historyYears(installed, today)) {
        // All years is history: not re-read on the freshness tick, even for the current year.
        const res = recordResource(historyRequest(st.id, year, v, stationElements(st.id) ?? [], today, installed), { live: false })
        const loading = res?.status === 'loading'
        out.push({ year, rows: res?.data ? (Alpine.raw(res.data) as ObservationRow[]) : null, loading })
        if (loading) break
      }
      return out
    },
    model(): (AnnualModel & { column: string }) | null {
      const v = this.variable
      if (!v) return null
      return historyModel(v, this.years.flatMap((y) => (y.rows ? [y.rows] : [])), Number(todayIso().slice(0, 4)))
    },
    loading(): boolean {
      return this.years.some((y) => y.loading)
    },
    /** "Loading 2024…" while years arrive, then "Showing 2017–2026." */
    get progress(): string {
      const ys = this.years
      const pending = ys.find((y) => y.loading)
      if (pending) return `Loading ${pending.year}…`
      const have = ys.filter((y) => y.rows?.length).map((y) => y.year)
      return have.length ? `Showing ${Math.min(...have)}–${Math.max(...have)}.` : ''
    },
  })
}
