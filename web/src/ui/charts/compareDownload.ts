/**
 * `x-data="compareDownload"`: Compare's Download data button (partials/charts/compare.html, in the
 * header, beside the title). Opens the Download sheet prefilled with what the plot shows: the selected
 * variables this station reports, the dates and the interval (core/downloader/fromChart). A sheet opened
 * by the URL (`?cmp=1&dl=1`) with nothing to download is prefilled the same way, once the station's
 * elements are in. gridMET normals are not station data, so they are not in the CSV.
 */
import Alpine from 'alpinejs'
import { compareElements, fromChart, prefillsFromChart } from '../../core/downloader/fromChart'
import { availableVars, chartWindow } from '../../core/models/timeseries'
import { latestAgg, latestVars } from '../../core/url-schema'
import { component } from '../component'
import { openSheet } from '../shell/sheet'
import { stationElements } from './resources'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function compareDownload() {
  let stopPrefill = () => {}
  return component({
    init() {
      const fx = Alpine.effect(() => {
        if (prefillsFromChart(url().state) && stationElements(stations().id)) this.prefill()
      })
      stopPrefill = () => Alpine.release(fx)
    },
    destroy() {
      stopPrefill()
    },

    /** The element codes the plot shows; [] before a station and its element list are in. */
    elements(): string[] {
      const els = stationElements(stations().id)
      if (!stations().id || !els) return []
      return compareElements(availableVars(latestVars(url().state), els), els)
    },
    /** Off without a station, a variable this station reports, or valid dates. */
    downloadDisabled(): boolean {
      return !this.elements().length || !chartWindow(url().state.from, url().state.to).valid
    },
    /** Write the Downloader keys for the plot; false while there is nothing to download. */
    prefill(): boolean {
      if (this.downloadDisabled()) return false
      const w = chartWindow(url().state.from, url().state.to)
      url().set(fromChart({ elements: this.elements(), start: w.start, end: w.end, interval: latestAgg(url().state) }))
      return true
    },
    download(e: Event): void {
      if (this.prefill()) openSheet('download', e.currentTarget as HTMLElement)
    },
  })
}
