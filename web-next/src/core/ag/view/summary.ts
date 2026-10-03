/**
 * The option chips above an Ag tool's chart (partials/ag/options.html): which
 * options the open tool has, in order, and each one's summary text, e.g.
 * `Wheat` · `32–70 °F` · `Since Oct 2, 2025` · `Projected to Oct 31`. A chip
 * names its option's current value, so the row says what is drawn. Pure.
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
  season: 'Projected to Oct 31',
  '30': 'Projected +30 days',
  '60': 'Projected +60 days',
  off: 'No projection',
}

/** "32–70 °F", or "from 44 °F" without an upper cutoff; custom cutoffs win over the crop's. */
function cutoffText(t: Pick<AgTab, 'crop' | 'cut'>): string {
  const [cl, ch] = GDD_CUTOFFS_F[t.crop]
  const lo = t.cut.loF ?? cl
  const hi = t.cut.hiF ?? ch
  return Number.isFinite(hi) ? `${lo}–${hi} °F` : `from ${lo} °F`
}

/** An option of the open tool: `id` picks its control (partials/ag/options.html), `name` labels it. */
export type OptionId = 'crop' | 'cutoffs' | 'dates' | 'projection' | 'interval' | 'livestock' | 'soil' | 'annual'
export interface OptionChip {
  id: OptionId
  /** What the option is ("Crop"): the chip's accessible name starts with it and its popover is titled by it. */
  name: string
  /** Its current value ("Wheat"). */
  text: string
}

const NAMES: Record<OptionId, string> = {
  crop: 'Crop',
  cutoffs: 'Temperature cutoffs',
  dates: 'Dates',
  projection: 'Projection',
  interval: 'Interval',
  livestock: 'Livestock',
  soil: 'Soil variable',
  annual: 'Comparison variable',
}

/** Which options each tool has, in chip order. */
const OPTIONS: Record<AgTab['variable'], readonly OptionId[]> = {
  gdd: ['crop', 'cutoffs', 'dates', 'projection'],
  etr: ['interval', 'dates'],
  feels_like: ['interval', 'dates'],
  swp: ['interval', 'dates'],
  percent_saturation: ['interval', 'dates'],
  cci: ['interval', 'livestock', 'dates'],
  'soil_temp,soil_ec_blk': ['soil', 'dates'],
  annual: ['annual'],
}

/**
 * The chips for the open tool. `annualLabel` is the Annual comparison
 * variable's display name (null while the station's elements load); `today`
 * makes a window that ends today read "Since Oct 2, 2025".
 */
export function optionChips(t: AgTab, annualLabel: string | null, today: LocalDate): OptionChip[] {
  const text = (id: OptionId): string => {
    switch (id) {
      case 'crop':
        return t.cropLabel
      case 'cutoffs':
        return cutoffText(t)
      case 'dates':
        return t.end === today ? `Since ${monthDay(t.start)}, ${t.start.slice(0, 4)}` : dateRangeText(t.start, t.end)
      case 'projection':
        return PROJECTION_TEXT[t.gddProj]
      case 'interval':
        return t.period === 'hourly' ? 'Hourly' : 'Daily'
      case 'livestock':
        return t.livestock === 'newborn' ? 'Newborn' : 'Adult'
      case 'soil':
        return t.soilOptions.find((o) => o.value === t.soilVar)?.label ?? t.soilVar
      case 'annual':
        return annualLabel ?? 'Choose a variable'
    }
  }
  return OPTIONS[t.variable].map((id) => ({ id, name: NAMES[id], text: text(id) }))
}
