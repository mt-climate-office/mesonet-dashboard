/**
 * The variable page's Interval row (Auto · 5-min · Hourly · Daily) over the
 * `agg` URL key: Auto is the key absent, the others are explicit. Auto is
 * hourly up to 30 days and daily beyond (and for All years); the raw interval
 * (`raw`) only for windows of 7 days or less. Raw is the logger's own
 * interval, named per network: 5-min at HydroMet, 15-min at AgriMet. The
 * Wind direction page's Rose view draws hourly or raw readings only. Pure.
 */
import { dayMs } from '../latest/view'
import type { LatestAgg, UrlState } from '../url-schema'

export type Interval = 'auto' | LatestAgg

/** Longest window (days) Auto draws hourly, and the longest that offers raw data. */
export const AUTO_HOURLY_MAX_DAYS = 30
export const RAW_MAX_DAYS = 7

/** Minutes between a station's raw readings: AgriMet loggers record every 15 minutes, every other network every 5. */
export const rawMinutes = (network: string | null | undefined): 5 | 15 => (network === 'AgriMet' ? 15 : 5)

const LABEL: Record<Exclude<Interval, 'raw'>, string> = { auto: 'Auto', hourly: 'Hourly', daily: 'Daily' }
const ORDER: readonly Interval[] = ['auto', 'raw', 'hourly', 'daily']

/** Days between two inclusive window dates (24 h = 1, 7 d = 7, 1 y = 365); 0 for a bad pair. */
export function spanDays(start: string, end: string): number {
  try {
    return Math.max(0, Math.round((dayMs(end) - dayMs(start)) / 86_400_000))
  } catch {
    return 0
  }
}

/** Raw data is offered for this many days. */
export const rawAllowed = (days: number): boolean => days <= RAW_MAX_DAYS

/** What Auto draws for a window of `days` (`all`: the All-years view, always daily). */
export const autoAgg = (days: number, all = false): LatestAgg => (all || days > AUTO_HOURLY_MAX_DAYS ? 'daily' : 'hourly')

/** The interval the chart uses: the URL's, unless absent or not offered here (raw on a long window, anything on All years). */
export function effectiveAgg(agg: LatestAgg | null, days: number, all = false): LatestAgg {
  if (all || agg === null || (agg === 'raw' && !rawAllowed(days))) return autoAgg(days, all)
  return agg
}

/** The interval the Rose view uses: raw where the URL asks for it and the window offers it, else hourly (never daily). */
export const roseAgg = (agg: LatestAgg | null, days: number): 'raw' | 'hourly' => (agg === 'raw' && rawAllowed(days) ? 'raw' : 'hourly')

export interface IntervalChip {
  id: Interval
  /** "Auto (hourly)" names what Auto picked; the rest are plain. */
  label: string
  pressed: boolean
  disabled: boolean
  /** Why a disabled chip is off ('' otherwise). */
  reason: string
}

export interface IntervalOptions {
  /** All years, where only Auto applies. */
  all?: boolean
  /** The station's network (`sub_network`), which names the raw interval. */
  network?: string | null
  /** The Rose view: Auto is hourly, Daily is not offered. */
  rose?: boolean
}

/** The row's chips for the URL `agg` over `days`. */
export function intervalChips(agg: LatestAgg | null, days: number, o: IntervalOptions = {}): IntervalChip[] {
  const all = !!o.all && !o.rose
  const shown: LatestAgg = o.rose ? roseAgg(agg, days) : effectiveAgg(agg, days, all)
  const current: Interval = agg === null || all || shown !== agg ? 'auto' : agg
  const raw = intervalWord('raw', o.network)
  return ORDER.map((id) => {
    const reason =
      id === 'auto'
        ? ''
        : all
          ? 'All years shows daily values'
          : id === 'raw' && !rawAllowed(days)
            ? `${rawMinutes(o.network)}-minute data is offered for ${RAW_MAX_DAYS} days or less`
            : id === 'daily' && o.rose
              ? `The rose uses hourly or ${rawMinutes(o.network)}-minute readings`
              : ''
    const label = id === 'auto' ? `Auto (${o.rose ? 'hourly' : intervalWord(autoAgg(days, all)).toLowerCase()})` : id === 'raw' ? raw : LABEL[id]
    return { id, label, pressed: id === current, disabled: reason !== '', reason }
  })
}

/** Why the row's disabled chips are off, one sentence each ('' when every chip is offered). */
export const intervalNote = (chips: readonly IntervalChip[]): string =>
  [...new Set(chips.filter((c) => c.disabled).map((c) => c.reason))].map((r) => `${r}.`).join(' ')

/** URL patch for an interval chip (Auto clears the key). */
export const intervalPatch = (id: Interval): Pick<UrlState, 'agg'> => ({ agg: id === 'auto' ? null : id })

/** "Hourly", "5-min" ("15-min" at AgriMet, `network`), "Daily": the word for an interval in labels. */
export const intervalWord = (agg: LatestAgg, network?: string | null): string => (agg === 'raw' ? `${rawMinutes(network)}-min` : LABEL[agg])

/** Compare's interval chips (finest first), named for the station's network. */
export const compareAggOptions = (network?: string | null): { value: LatestAgg; label: string }[] =>
  (['raw', 'hourly', 'daily'] as const).map((value) => ({ value, label: intervalWord(value, network) }))

/** Compare's note under its interval chips: how much of each interval loads well. */
export const compareLoadNote = (network?: string | null): string =>
  `Hourly and daily averages load faster. Avoid more than 1 year of daily, 3 months of hourly or 2 weeks of ${rawMinutes(network)}-minute data.`
