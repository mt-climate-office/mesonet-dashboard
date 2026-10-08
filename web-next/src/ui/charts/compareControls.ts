/**
 * `x-data="compareControls"`: the Compare options (partials/charts/compare.html):
 * dates + Whole record, the interval chips, the normals switch and the
 * variable chips (plain names). State lives in `$store.url` (the legacy Latest
 * keys); the rules are in core/latest/sidebar.ts. The station comes from the
 * station picker.
 */
import Alpine from 'alpinejs'
import { datesPatch, installDate, periodOfRecordPatch, showingPeriodOfRecord, todayIso, variableOptions, varsValue } from '../../core/latest'
import { availableVars, chartWindow, isIsoDate } from '../../core/models/timeseries'
import { latestAgg, latestVars, type LatestAgg } from '../../core/url-schema'
import { plainVariableOptions } from '../../core/variables'
import { component } from '../component'
import { stationElements } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

/** When the options sit beside the plot (styles/charts.css `.cmp-layout`); below it they would push the plot down. */
const SIDE_BY_SIDE = '(min-width: 1060px) and (min-height: 561px)'

export function compareControls() {
  return component({
    /** The `<details>` starts open beside the plot, closed above it (phones and tablets). */
    init() {
      ;(this.$el as HTMLDetailsElement).open = window.matchMedia(SIDE_BY_SIDE).matches
    },

    /** The interval chips, named as on the variable page. */
    aggOptions: [
      { value: 'raw', label: '5-min' },
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
    ] as const,

    /* Dates */
    installed(): string | null {
      return installDate(stations().current)
    },
    dates() {
      // A malformed ?from/?to shows as an empty input (the plot shows the no-data message).
      const w = chartWindow(url().state.from, url().state.to)
      return { start: isIsoDate(w.start) ? w.start : '', end: isIsoDate(w.end) ? w.end : '' }
    },
    dateMax(): string {
      return todayIso()
    },
    setDates(r: { start: string; end: string }): void {
      url().set(datesPatch(r.start, r.end))
    },
    showingPor(): boolean {
      const d = this.dates()
      return showingPeriodOfRecord(latestAgg(url().state), d.start, d.end, this.installed())
    },
    porDisabled(): boolean {
      return !stations().id
    },
    togglePor(): void {
      url().set(periodOfRecordPatch(this.showingPor(), this.installed()))
    },

    /* Aggregation + normals */
    agg(): LatestAgg {
      return latestAgg(url().state)
    },
    setAgg(v: string): void {
      url().set({ agg: v as LatestAgg })
    },
    gridmet(): boolean {
      return url().state.gridmet
    },
    gridmetDisabled(): boolean {
      return latestAgg(url().state) !== 'daily'
    },
    setGridmet(e: Event): void {
      url().set({ gridmet: (e.target as HTMLInputElement).checked })
    },

    /* Variables */
    varOptions() {
      const els = stationElements(stations().id)
      return plainVariableOptions(variableOptions(els), els)
    },
    varValue(): string[] {
      return availableVars(latestVars(url().state), stationElements(stations().id))
    },
    setVars(next: string[]): void {
      const options = variableOptions(stationElements(stations().id))
      url().set({ vars: varsValue(latestVars(url().state), next, options) })
    },
  })
}
