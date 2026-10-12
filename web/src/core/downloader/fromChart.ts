/**
 * The Download sheet prefilled from a chart (a chart's ⋯ → Download data):
 * the chart's element codes, dates and interval as the Downloader's URL keys
 * (`els`, `dl_from`, `dl_to`, `period`). The caller writes the patch, then
 * opens the sheet (`openSheet('download', opener)` sets `dl`). `qc` is left
 * as it is. Pure.
 */
import type { DerivedVar } from '../params/ag'
import { LATEST_EXCLUDED_ELEMENTS, latestVarName } from '../params'
import type { LatestAgg, UrlState } from '../url-schema'
import { chartsMode } from '../variables/catalog'
import { DERIVED_CODES } from './request'

type ElementRow = { element: string; description_short: string }

export interface ChartDownload {
  /** Element codes (`/elements` codes such as `air_temp_0200`, or derived codes such as `etr`). */
  elements: readonly string[]
  /** The chart's inclusive dates, YYYY-MM-DD. */
  start: string
  end: string
  /** The chart's effective interval. 5-min becomes hourly, the Downloader's finest. */
  interval: LatestAgg
}

/**
 * The keys `fromChart` writes (an old `#downloader` link carries them too) at
 * their defaults, so absent from the URL. Closing the Download sheet applies
 * it: the user is done with them, and they never outlive the sheet.
 */
export const PREFILL_RESET: Pick<UrlState, 'els' | 'dl_from' | 'dl_to' | 'period'> = { els: [], dl_from: null, dl_to: null, period: 'daily' }

/**
 * Whether the Download sheet, opened by the URL (`dl=1`), takes its prefill
 * from the chart behind it: Charts shows a variable or an Ag tool (`v`, not
 * Compare) and the URL carries none of the prefill keys. An old `#downloader`
 * link that carries its own `els`, dates or interval keeps exactly those.
 */
export function prefillsFromChart(state: Pick<UrlState, 'dl' | 'v' | 'cmp' | 'els' | 'dl_from' | 'dl_to' | 'period'>): boolean {
  const carries = state.els.length > 0 || state.dl_from !== null || state.dl_to !== null || state.period !== PREFILL_RESET.period
  return state.dl && !carries && chartsMode(state) !== 'list' && chartsMode(state) !== 'compare'
}

/** The Downloader keys for a chart (see the header). */
export function fromChart(c: ChartDownload): Pick<UrlState, 'els' | 'dl_from' | 'dl_to' | 'period'> {
  return { els: [...new Set(c.elements)], dl_from: c.start, dl_to: c.end, period: c.interval === 'daily' ? 'daily' : 'hourly' }
}

/**
 * A Charts variable's element codes at a station: every element whose display
 * name ("Soil VWC", the `description_short` before "@") is `name`, in list
 * order without repeats; Reference ET is the derived `etr`.
 */
export function variableElements(name: string, elements: readonly ElementRow[]): string[] {
  if (name === 'Reference ET') return ['etr']
  const out = elements
    .filter((e) => !LATEST_EXCLUDED_ELEMENTS.has(e.element) && !DERIVED_CODES.has(e.element) && latestVarName(String(e.description_short ?? '')) === name)
    .map((e) => e.element)
  return [...new Set(out)]
}

/** The element codes behind a wind rose: wind direction, then wind speed (the rose needs both). */
export const windRoseElements = (elements: readonly ElementRow[]): string[] => [
  ...variableElements('Wind Direction', elements),
  ...variableElements('Wind Speed', elements),
]

/** Soil profile sub-variable (`soilv`) → its display variable, or the derived code it is. */
const SOIL_VARS: Record<string, string> = { soil_vwc: 'Soil VWC', soil_temp: 'Soil Temperature', soil_blk_ec: 'Bulk EC' }

/**
 * The element codes behind an Ag tool: its derived code (ETr, feels like,
 * livestock risk, SWP, saturation); air temperature for GDD; the soil
 * profile's sub-variable at every depth; the Annual comparison's element.
 */
export function agToolElements(tool: DerivedVar, o: { soilVar: string; annualVar: string | null }, elements: readonly ElementRow[]): string[] {
  switch (tool) {
    case 'gdd':
      return variableElements('Air Temperature', elements)
    case 'soil_temp,soil_ec_blk':
      return SOIL_VARS[o.soilVar] ? variableElements(SOIL_VARS[o.soilVar], elements) : [o.soilVar]
    case 'annual':
      return o.annualVar ? [o.annualVar] : []
    default:
      return [tool]
  }
}

/**
 * The interval an Ag tool's download asks for: feels like and livestock risk always hourly (their
 * daily chart is each day's hourly high and low, which the API's daily values, means, are not);
 * every other tool its chart's interval.
 */
export const agDownloadInterval = (tool: DerivedVar, period: LatestAgg): LatestAgg =>
  tool === 'feels_like' || tool === 'cci' ? 'hourly' : period
