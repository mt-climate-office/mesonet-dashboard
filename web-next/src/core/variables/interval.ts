/**
 * The variable page's Interval row (Auto · 5-min · Hourly · Daily) over the
 * `agg` URL key: Auto is the key absent, the others are explicit. Auto is
 * hourly up to 30 days and daily beyond (and for All years); 5-min (`raw`)
 * only for windows of 7 days or less. Pure.
 */
import { dayMs } from '../latest/view'
import type { LatestAgg, UrlState } from '../url-schema'

export type Interval = 'auto' | LatestAgg

/** Longest window (days) Auto draws hourly, and the longest that offers 5-min data. */
export const AUTO_HOURLY_MAX_DAYS = 30
export const RAW_MAX_DAYS = 7

const LABEL: Record<Interval, string> = { auto: 'Auto', raw: '5-min', hourly: 'Hourly', daily: 'Daily' }
const ORDER: readonly Interval[] = ['auto', 'raw', 'hourly', 'daily']

/** Days between two inclusive window dates (24 h = 1, 7 d = 7, 1 y = 365); 0 for a bad pair. */
export function spanDays(start: string, end: string): number {
  try {
    return Math.max(0, Math.round((dayMs(end) - dayMs(start)) / 86_400_000))
  } catch {
    return 0
  }
}

/** 5-min data is offered for this many days. */
export const rawAllowed = (days: number): boolean => days <= RAW_MAX_DAYS

/** What Auto draws for a window of `days` (`all`: the All-years view, always daily). */
export const autoAgg = (days: number, all = false): LatestAgg => (all || days > AUTO_HOURLY_MAX_DAYS ? 'daily' : 'hourly')

/** The interval the chart uses: the URL's, unless absent or not offered here (5-min on a long window, anything on All years). */
export function effectiveAgg(agg: LatestAgg | null, days: number, all = false): LatestAgg {
  if (all || agg === null || (agg === 'raw' && !rawAllowed(days))) return autoAgg(days, all)
  return agg
}

export interface IntervalChip {
  id: Interval
  /** "Auto (hourly)" names what Auto picked; the rest are plain. */
  label: string
  pressed: boolean
  disabled: boolean
  /** Why a disabled chip is off ('' otherwise). */
  reason: string
}

/** The row's chips for the URL `agg` over `days` (`all`: All years, where only Auto applies). */
export function intervalChips(agg: LatestAgg | null, days: number, all = false): IntervalChip[] {
  const current: Interval = agg === null || all || effectiveAgg(agg, days) !== agg ? 'auto' : agg
  return ORDER.map((id) => {
    const disabled = id !== 'auto' && (all || (id === 'raw' && !rawAllowed(days)))
    const reason = !disabled ? '' : all ? 'All years is always daily' : `5-minute data is offered for ${RAW_MAX_DAYS} days or less`
    const label = id === 'auto' ? `Auto (${LABEL[autoAgg(days, all)].toLowerCase()})` : LABEL[id]
    return { id, label, pressed: id === current, disabled, reason }
  })
}

/** URL patch for an interval chip (Auto clears the key). */
export const intervalPatch = (id: Interval): Pick<UrlState, 'agg'> => ({ agg: id === 'auto' ? null : id })

/** "Hourly", "5-min", "Daily": the word for an interval in labels. */
export const intervalWord = (agg: LatestAgg): string => LABEL[agg]
