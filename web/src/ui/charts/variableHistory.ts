/**
 * `x-data="variableHistory"`: the variable page's History view, years
 * overlaid (core/charts annualChart). Daily data, one calendar year per
 * cached request (core/variables `requestGroups`, `historyRequest`: the install
 * year shares the next one's), newest first; the next older one is requested
 * once the newer ones have settled, so the chart fills in progressively and the
 * API sees one request at a time.
 */
import Alpine from 'alpinejs'
import { getStationRecord, type ObservationRow } from '../../core/api'
import { annualChart, annualTable, type AnnualModel } from '../../core/charts'
import { installDate, todayIso } from '../../core/latest'
import { findVariable, historyModel, historyNote, historyRequest, historyRows, historyYears, plainName, requestGroups, type Variable } from '../../core/variables'
import { component } from '../component'
import { announce } from '../shell/live'
import { chartVariables, stationElements } from './resources'

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
    /** The note above the chart (core/variables historyNote): how each year is drawn. */
    note(): string {
      return historyNote(this.variable)
    },
    /** Each request group's rows so far (newest first); requests stop at the first group still loading. */
    get years(): { years: number[]; rows: ObservationRow[] | null; loading: boolean }[] {
      const st = Alpine.store('station')
      const v = this.variable
      if (!st.id || !v) return []
      const today = todayIso()
      const installed = installDate(st.current)
      const out: { years: number[]; rows: ObservationRow[] | null; loading: boolean }[] = []
      for (const years of requestGroups(historyYears(installed, today), installed)) {
        // All years is history: not re-read on the freshness tick, even for the current year. A group
        // without data (the API's 404) is empty (historyRows); its own key, as its own fetcher.
        const req = historyRequest(st.id, years, v, stationElements(st.id) ?? [], today, installed)
        const res = req ? Alpine.store('data').cached(`history:${req.key}`, () => historyRows(() => getStationRecord(req.query))) : null
        const loading = res?.status === 'loading'
        out.push({ years, rows: res?.data ? (Alpine.raw(res.data) as ObservationRow[]) : null, loading })
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
    /** "Loading 2024…" (or "Loading 2020–2021…") while years arrive, then "Showing 2017–2026." (the years drawn). */
    get progress(): string {
      const pending = this.years.find((y) => y.loading)
      if (pending) return `Loading ${[...pending.years].reverse().join('–')}…`
      const have = this.model()?.traces.map((t) => t.year) ?? []
      return have.length ? `Showing ${Math.min(...have)}–${Math.max(...have)}.` : ''
    },
  })
}
