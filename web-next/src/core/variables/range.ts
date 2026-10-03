/**
 * Range presets for the variable page (24 h · 7 d · 14 d · 30 d · 1 y ·
 * Custom), stored in the `from`/`to`/`agg` keys that Compare also reads. A
 * preset is a window of whole local days ending today; the URL is read back
 * to tell which preset (if any) is showing.
 */
import dayjs from 'dayjs'
import { datesPatch, todayIso } from '../latest/sidebar'
import { windowRange } from '../latest/view'
import { chartWindow } from '../models/timeseries'
import type { LatestAgg, UrlState } from '../url-schema'

export interface RangePreset {
  id: '24h' | '7d' | '14d' | '30d' | '1y'
  label: string
  /** Days before today where the window starts. */
  days: number
  agg: LatestAgg
}

/** 14 d hourly is the default window (absent from/to), so it keeps a clean URL. */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: '24h', label: '24 h', days: 1, agg: 'hourly' },
  { id: '7d', label: '7 d', days: 7, agg: 'hourly' },
  { id: '14d', label: '14 d', days: 14, agg: 'hourly' },
  { id: '30d', label: '30 d', days: 30, agg: 'hourly' },
  { id: '1y', label: '1 y', days: 365, agg: 'daily' },
]

export type RangeId = RangePreset['id'] | 'custom'

const HOUR = 3_600_000

/** URL patch for a preset (`today` injectable for tests). */
export function presetPatch(id: RangePreset['id'], today = dayjs()): Pick<UrlState, 'from' | 'to' | 'agg'> {
  const p = RANGE_PRESETS.find((x) => x.id === id) ?? RANGE_PRESETS[2]
  return { ...datesPatch(today.subtract(p.days, 'day').format('YYYY-MM-DD'), todayIso(today), today), agg: p.agg }
}

/** The preset the URL window matches, else 'custom'. */
export function activePreset(state: Pick<UrlState, 'from' | 'to' | 'agg'>, today = dayjs()): RangeId {
  const w = chartWindow(state.from, state.to, today)
  if (!w.valid || w.end !== todayIso(today)) return 'custom'
  const p = RANGE_PRESETS.find((x) => x.agg === state.agg && w.start === today.subtract(x.days, 'day').format('YYYY-MM-DD'))
  return p?.id ?? 'custom'
}

/**
 * Visible x range (wall-clock ms) for the window: the whole days, except 24 h,
 * which shows the 24 hours up to the newest observation (`lastMs`) once it is known.
 */
export function rangeView(id: RangeId, start: string, end: string, lastMs: number | null): [number, number] {
  if (id === '24h' && lastMs !== null) return [lastMs - 24 * HOUR, lastMs]
  return windowRange(start, end)
}
