/**
 * The one-line summary on the Ag "Options" disclosure (partials/ag/options.html),
 * e.g. "Wheat · 32–70 °F · to Oct 31". It names the options that shape the
 * chart, so a collapsed disclosure still says what is drawn. Pure.
 */
import type { LocalDate } from '../contract'
import { GDD_CUTOFFS_F } from '../compute/gdd'
import type { AgTab } from './tab'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-10-02` → "Oct 2" (parsed by hand: no `new Date` on a date-only string). */
const monthDay = (d: LocalDate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`

/** "Jan 5 – Oct 2, 2026", or "Oct 2, 2025 – Oct 2, 2026" across years. */
export function dateRangeText(start: LocalDate, end: LocalDate): string {
  const sy = start.slice(0, 4)
  const ey = end.slice(0, 4)
  return sy === ey ? `${monthDay(start)} – ${monthDay(end)}, ${ey}` : `${monthDay(start)}, ${sy} – ${monthDay(end)}, ${ey}`
}

const PROJECTION_TEXT: Record<AgTab['gddProj'], string> = {
  season: 'to Oct 31',
  '30': '+30 days',
  '60': '+60 days',
  off: 'no projection',
}

/** "32–70 °F", or "from 44 °F" without an upper cutoff; custom cutoffs win over the crop's. */
function cutoffText(t: Pick<AgTab, 'crop' | 'cut'>): string {
  const [cl, ch] = GDD_CUTOFFS_F[t.crop]
  const lo = t.cut.loF ?? cl
  const hi = t.cut.hiF ?? ch
  return Number.isFinite(hi) ? `${lo}–${hi} °F` : `from ${lo} °F`
}

/**
 * Summary for the open tool. `annualLabel` is the Annual comparison
 * variable's display name (null while the station's elements load).
 */
export function optionsSummary(t: AgTab, annualLabel: string | null): string {
  const dates = dateRangeText(t.start, t.end)
  const period = t.period === 'hourly' ? 'Hourly' : 'Daily'
  switch (t.variable) {
    case 'gdd':
      return [t.cropLabel, cutoffText(t), PROJECTION_TEXT[t.gddProj]].join(' · ')
    case 'cci':
      return [period, t.livestock === 'newborn' ? 'Newborn' : 'Adult', dates].join(' · ')
    case 'soil_temp,soil_ec_blk':
      return [t.soilOptions.find((o) => o.value === t.soilVar)?.label ?? t.soilVar, dates].join(' · ')
    case 'annual':
      return annualLabel ?? 'Choose a variable'
    case 'etr':
    case 'feels_like':
    case 'swp':
    case 'percent_saturation':
      return [period, dates].join(' · ')
  }
}
