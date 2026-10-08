/**
 * The Now Rain tile's graphic: seven daily precipitation bars (the last six
 * days and today, local dates) on a zero baseline, so a dry week draws the
 * bare baseline ("0 every day") rather than a blank. One small daily request; pure.
 */
import type { ObservationRow } from '../api'
import { sparkline, type Sparkline } from '../charts/sparkline'

const DAYS = 7
const COL = 'Precipitation [in]'

/** YYYY-MM-DD `n` days before local date `today`. */
const daysBefore = (today: string, n: number) => {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

/** The daily precipitation request for the 7 days ending `today` (inclusive), level 2. `key` encodes every input. */
export function rainDailyQuery(station: string, today: string) {
  const start = daysBefore(today, DAYS - 1)
  return {
    key: `obs:${station}:daily:${start}:${today}:ppt:l2`,
    query: { station, start, end: today, period: 'daily' as const, elements: 'ppt', level: 2 as const },
  }
}

/**
 * Seven daily totals (in, oldest first; a day without a row is a gap) as bars
 * on a baseline plus their screen-reader sentence (a dry week: the baseline
 * alone, "no rain"), or null when the rows are not in yet or no day reported.
 */
export function rainBars(rows: readonly ObservationRow[] | undefined, today: string): { spark: Sparkline; sparkLabel: string } | null {
  if (!rows) return null
  const byDate = new Map<string, number>()
  for (const r of rows) {
    const v = r[COL]
    if (typeof v === 'number' && Number.isFinite(v)) byDate.set(String(r.datetime).slice(0, 10), v)
  }
  const days = Array.from({ length: DAYS }, (_, i) => daysBefore(today, DAYS - 1 - i))
  const v = days.map((d) => byDate.get(d) ?? null)
  const total = v.reduce<number>((a, x) => a + (x ?? 0), 0)
  // Half-day null points at both ends centre each bar in its seventh of the width (no clamped end bars).
  const spark = sparkline({ t: [-0.5, ...days.map((_, i) => i), DAYS - 0.5], v: [null, ...v, null] }, { kind: 'bars' })
  if (!spark) return null
  if (!(total > 0)) return { spark, sparkLabel: 'Last 7 days: no rain.' }
  const wet = v.filter((x) => x !== null && x > 0).length
  return { spark, sparkLabel: `Last 7 days: ${total.toFixed(2)} in in total, rain on ${wet} ${wet === 1 ? 'day' : 'days'}.` }
}
