/**
 * The variable page's range chips (24 h · 7 d · 14 d · 30 d · 1 y · All
 * years). A preset is a window of whole local days ending today, stored in
 * `from`/`to` (Compare reads them too); All years is `view=history`. The URL
 * is read back to tell which chip (if any) is pressed; any other window is a
 * custom range (⋯ → Custom dates…). The interval is separate (interval.ts).
 */
import { denverDay } from '../today'
import { dateRangeText } from '../ag/view/summary'
import { datesPatch, todayIso } from '../latest/sidebar'
import { windowRange } from '../latest/view'
import { chartWindow } from '../models/timeseries'
import type { UrlState } from '../url-schema'
import { rawAllowed } from './interval'

export interface RangePreset {
  id: '24h' | '7d' | '14d' | '30d' | '1y'
  label: string
  /** Days before today where the window starts. */
  days: number
  /** "Last 7 days": the range label under the title. */
  long: string
}

/** 14 d is the default window (absent from/to), so it keeps a clean URL. */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: '24h', label: '24 h', days: 1, long: 'Last 24 hours' },
  { id: '7d', label: '7 d', days: 7, long: 'Last 7 days' },
  { id: '14d', label: '14 d', days: 14, long: 'Last 14 days' },
  { id: '30d', label: '30 d', days: 30, long: 'Last 30 days' },
  { id: '1y', label: '1 y', days: 365, long: 'Last year' },
]

export type RangeId = RangePreset['id'] | 'custom'
/** What the page shows: a window (a preset or custom) or All years. */
export type PageRange = RangeId | 'all'

/** The chips in order; 'all' is All years. */
export const RANGE_CHIPS: readonly { id: RangePreset['id'] | 'all'; label: string }[] = [
  ...RANGE_PRESETS.map((p) => ({ id: p.id, label: p.label })),
  { id: 'all', label: 'All years' },
]

const HOUR = 3_600_000

/** `from`/`to` for a preset (`today` injectable for tests). */
export function presetPatch(id: RangePreset['id'], today = denverDay()): Pick<UrlState, 'from' | 'to'> {
  const p = RANGE_PRESETS.find((x) => x.id === id) ?? RANGE_PRESETS[2]
  return datesPatch(today.subtract(p.days, 'day').format('YYYY-MM-DD'), todayIso(today), today)
}

/** The preset the URL window matches, else 'custom'. */
export function activePreset(state: Pick<UrlState, 'from' | 'to'>, today = denverDay()): RangeId {
  const w = chartWindow(state.from, state.to, today)
  if (!w.valid || w.end !== todayIso(today)) return 'custom'
  return RANGE_PRESETS.find((x) => w.start === today.subtract(x.days, 'day').format('YYYY-MM-DD'))?.id ?? 'custom'
}

/** The page's range: All years (`view=history`), else the window's preset or 'custom'. */
export function pageRange(state: Pick<UrlState, 'view' | 'from' | 'to'>, today = denverDay()): PageRange {
  return state.view === 'history' ? 'all' : activePreset(state, today)
}

/**
 * URL patch for a range chip. A window chip leaves All years and keeps the
 * interval, except 5-min where the new window does not offer it (Auto then).
 */
export function rangeChipPatch(id: RangePreset['id'] | 'all', agg: UrlState['agg'], today = denverDay()): Partial<UrlState> {
  if (id === 'all') return { view: 'history' }
  const days = RANGE_PRESETS.find((p) => p.id === id)?.days ?? 14
  return { view: 'recent', ...presetPatch(id, today), ...(agg === 'raw' && !rawAllowed(days) ? { agg: null } : {}) }
}

/** The line under the title: "Last 7 days", "All years", or the custom dates ("Sep 1 – Sep 20, 2026"). */
export function rangeLabel(range: PageRange, start: string, end: string): string {
  if (range === 'all') return 'All years'
  return RANGE_PRESETS.find((p) => p.id === range)?.long ?? dateRangeText(start, end)
}

/**
 * The 24 hours up to and including the newest reading `lastMs` (wall-clock
 * ms), as a half-open `[from, to)` range like every view: the 24 hourly
 * readings ending at the newest. The list's "last 24 h" total and the 24 h
 * preset both use it, so their totals agree.
 */
export const last24h = (lastMs: number): [number, number] => [lastMs - 24 * HOUR + 1, lastMs + 1]

/**
 * Visible x range (wall-clock ms, `[from, to)`) for the window: the whole days,
 * except 24 h, which is `last24h` of the newest observation (`lastMs`) once it is known.
 */
export function rangeView(id: RangeId, start: string, end: string, lastMs: number | null): [number, number] {
  if (id === '24h' && lastMs !== null) return last24h(lastMs)
  return windowRange(start, end)
}
