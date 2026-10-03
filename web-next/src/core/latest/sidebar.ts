/**
 * Latest sidebar logic: station picker items, the network filter, variable
 * chips, the date window and the period-of-record toggle. ui/charts/compareControls.ts
 * reads these and writes the results to `$store.url`.
 */
import { denverDay } from '../today'
import type { Station } from '../api'
import type { ComboboxItem } from '../controls/comboboxModel'
import { DEFAULT_VARS, SELECTED_VARS, latestVarsFromElements } from '../params'
import { NETWORK_OPTIONS, type LatestAgg, type UrlState } from '../url-schema'
import { DEFAULT_WINDOW_DAYS } from '../models/timeseries'
import { passesNets } from './stations'

type ElementRow = { element: string; description_short: string }

/** Stations without a usable install date start here (the network's first year; web/ Sidebar). */
export const POR_FALLBACK_START = '2017-01-01'

/** Today in Denver as YYYY-MM-DD (core/today; `today` injectable for tests). */
export const todayIso = (today = denverDay()): string => today.format('YYYY-MM-DD')

/* ----------------------------------------------------------- networks */

/** Network chips from the catalog's sub_networks, sorted; HydroMet/AgriMet before it loads. */
export function networkOptions(list: readonly Pick<Station, 'sub_network'>[]): string[] {
  if (list.length === 0) return ['AgriMet', 'HydroMet']
  return [...new Set(list.map((s) => s.sub_network))].sort()
}

/** The `nets` value to store for a chip change: every catalog network on = the default (clean URL). */
export function netsValue(next: readonly string[], options: readonly string[]): UrlState['nets'] {
  // Only networks the catalog offers: the default also lists Cooperator, which may have no chip.
  return options.every((o) => next.includes(o)) ? [...NETWORK_OPTIONS] : next.filter((n) => options.includes(n))
}

/* ------------------------------------------------------------ stations */

/**
 * Combobox items: stations passing the network filter, grouped by network
 * (groups and names alphabetical). Typing also matches the NWSLI id and county.
 */
export function stationItems(list: readonly Station[], nets: readonly string[], selected: string | null): ComboboxItem[] {
  return list
    .filter((s) => passesNets(s, nets, selected))
    .sort((a, b) => a.sub_network.localeCompare(b.sub_network) || a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.station,
      label: s.name,
      group: s.sub_network,
      keywords: [s.nwsli_id, s.county].filter((k): k is string => !!k),
    }))
}

/* ----------------------------------------------------------- variables */

/** Variable chips: the station's (latestVarsFromElements), or the sorted defaults with no station (LDC-011, LDC-013). */
export function variableOptions(elements: readonly ElementRow[] | undefined): string[] {
  return elements ? latestVarsFromElements(elements) : [...DEFAULT_VARS].sort()
}

/**
 * New `vars` after a chip change. `raw` is the stored selection, `next` the
 * chips now on. Keeps selection order (panels follow it): new chips append,
 * removed chips drop, and variables this station lacks stay for the next one.
 * The default five in default order store as null (absent).
 */
export function varsValue(raw: readonly string[], next: readonly string[], options: readonly string[]): string[] | null {
  const kept = raw.filter((v) => !options.includes(v) || next.includes(v))
  const out = [...kept, ...next.filter((v) => !kept.includes(v))]
  return out.join('\u0000') === SELECTED_VARS.join('\u0000') ? null : out
}

/* --------------------------------------------------------------- dates */

/** Install date (YYYY-MM-DD) from the catalog row, or null when missing or malformed. */
export function installDate(s: Pick<Station, 'date_installed'> | undefined): string | null {
  const d = s?.date_installed
  return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null
}

/** The default window: the last 14 days ending today (LDC-003). */
export function defaultWindow(today = denverDay()): { start: string; end: string } {
  return { start: today.subtract(DEFAULT_WINDOW_DAYS, 'day').format('YYYY-MM-DD'), end: todayIso(today) }
}

/** `from`/`to` for a picked range; the default window stores as absent so it keeps rolling. */
export function datesPatch(start: string, end: string, today = denverDay()): Pick<UrlState, 'from' | 'to'> {
  const d = defaultWindow(today)
  return start === d.start && end === d.end ? { from: null, to: null } : { from: start, to: end }
}

/** Is the view the period of record (Daily, install date … today)? Read back from the URL (LDC-005). */
export function showingPeriodOfRecord(agg: LatestAgg, start: string, end: string, installed: string | null, today = denverDay()): boolean {
  return agg === 'daily' && start === (installed ?? POR_FALLBACK_START) && end === todayIso(today)
}

/** The toggle: POR → Hourly + last 14 days; otherwise → Daily + install date … today. */
export function periodOfRecordPatch(showingPor: boolean, installed: string | null, today = denverDay()): Pick<UrlState, 'agg' | 'from' | 'to'> {
  if (showingPor) return { agg: 'hourly', from: null, to: null }
  return { agg: 'daily', from: installed ?? POR_FALLBACK_START, to: todayIso(today) }
}
