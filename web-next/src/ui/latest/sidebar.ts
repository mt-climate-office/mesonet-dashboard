/**
 * `latestSidebar`: bindings for the Latest controls (partials/latest/index.html):
 * station combobox, network chips, dates + period of record, aggregation,
 * gridMET switch and variable chips. State lives in `$store.url`; the rules
 * are in core/latest/sidebar.ts.
 */
import Alpine from 'alpinejs'
import { getStationElements, type StationElement } from '../../core/api'
import type { Resource } from '../../core/cache'
import type { ComboboxItem } from '../../core/controls/comboboxModel'
import {
  TTL,
  datesPatch,
  elementsKey,
  installDate,
  netsValue,
  networkOptions,
  periodOfRecordPatch,
  showingPeriodOfRecord,
  stationItems,
  todayIso,
  variableOptions,
  varsValue,
} from '../../core/latest'
import { availableVars, chartWindow, isIsoDate } from '../../core/models/timeseries'
import { latestVars, type LatestAgg } from '../../core/url-schema'
import { component } from '../component'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

/** The station's `/elements/{id}/` resource (shared by the sidebar and the timeseries), or null. */
export function elementsResource(id: string | null): Resource<StationElement[]> | null {
  return id ? Alpine.store('data').cached(elementsKey(id), () => getStationElements(id), { ttl: TTL.elements }) : null
}

/** The station's element list, or undefined while loading / without a station. */
export function stationElements(id: string | null): StationElement[] | undefined {
  const d = elementsResource(id)?.data
  return d ? (Alpine.raw(d) as StationElement[]) : undefined
}

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }))

export function latestSidebar() {
  return component({
    aggOptions: [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'raw', label: 'Raw' },
    ],

    /* Station */
    stationItems(): ComboboxItem[] {
      return stationItems(stations().list, url().state.nets, stations().id)
    },
    stationValue(): string | null {
      return stations().id
    },
    stationPlaceholder(): string {
      const c = stations().catalog
      return c?.status === 'error' ? 'Failed to load stations' : c?.data ? 'Select a Mesonet Station...' : 'Loading stations…'
    },
    selectStation(id: string | null): void {
      stations().select(id)
    },

    /* Networks */
    networkOptions() {
      return opts(networkOptions(stations().list))
    },
    nets(): string[] {
      return [...url().state.nets]
    },
    setNets(next: string[]): void {
      url().set({ nets: netsValue(next, networkOptions(stations().list)) })
    },

    /* Dates */
    installed(): string | null {
      return installDate(stations().current)
    },
    dates() {
      // A malformed ?from/?to shows as an empty input (the plot shows the no-data message).
      const w = chartWindow(url().state.from, url().state.to)
      return { start: isIsoDate(w.start) ? w.start : '', end: isIsoDate(w.end) ? w.end : '' }
    },
    dateMin(): string | null {
      return this.installed()
    },
    dateMax(): string {
      return todayIso()
    },
    setDates(r: { start: string; end: string }): void {
      url().set(datesPatch(r.start, r.end))
    },
    showingPor(): boolean {
      const d = this.dates()
      return showingPeriodOfRecord(url().state.agg, d.start, d.end, this.installed())
    },
    porLabel(): string {
      return this.showingPor() ? 'Display Latest 2 Weeks' : 'Display Period of Record'
    },
    porDisabled(): boolean {
      return !stations().id
    },
    togglePor(): void {
      url().set(periodOfRecordPatch(this.showingPor(), this.installed()))
    },

    /* Aggregation + normals */
    agg(): LatestAgg {
      return url().state.agg
    },
    setAgg(v: string): void {
      url().set({ agg: v as LatestAgg })
    },
    gridmet(): boolean {
      return url().state.gridmet
    },
    gridmetDisabled(): boolean {
      return url().state.agg !== 'daily'
    },
    setGridmet(e: Event): void {
      url().set({ gridmet: (e.target as HTMLInputElement).checked })
    },

    /* Variables */
    varOptions() {
      return opts(variableOptions(stationElements(stations().id)))
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
