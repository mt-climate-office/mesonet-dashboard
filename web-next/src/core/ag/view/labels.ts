/**
 * Renderer-free display helpers for Ag Tools: unit conversion at the display
 * edge, axis/legend labels, stage text and the soil-band constants. Pulled
 * out of the old Plotly builders (web/src/features/ag/figures) so the ECharts
 * builders in core/charts reuse them unchanged.
 */
import type { CciClass, FeelsLikeRegime, LocalDate, LocalDateTime, Nullable, SwpSeries } from '../contract'
import { cToF, kPaToBar, mmToIn, msToMph } from '../compute'
import { elementLabel } from '../../downloader/labels'
import { axisTitle, cumulativeTitle, plainUnit } from '../../variables/labels'

export type Period = 'daily' | 'hourly'

export type SoilProfileVar = 'soil_vwc' | 'soil_temp' | 'soil_blk_ec' | 'swp' | 'percent_saturation'

/** SWP band edges, positive bar magnitudes (field capacity, wilting point). */
export const SWP_FIELD_CAPACITY = 0.33
export const SWP_WILTING_POINT = 15

/**
 * Display ceiling (bar) for dry-end SWP. Where observed VWC is drier than the
 * driest lab point, `swp()` clips it to the lab range, so its value is only a
 * lower bound on suction; the curve's dry tail also runs to ~10⁴ bar before
 * any clip. Every value drier than this, and every dry-end clip, is a lower
 * bound: it draws at min(value, cap), dotted, and reads "≤ −… bar".
 */
export const SWP_CAP_BAR = 1000

export interface SwpBar {
  /** Positive bar magnitudes, never past `SWP_CAP_BAR`. */
  bar: Nullable[][]
  /** `dry[d][i]`: a dry-end clip or past the cap, so `bar` is a lower bound. */
  dry: boolean[][]
}

/**
 * `SwpSeries` (kPa) → display bar. A value past the cap, or a clipped value
 * past the wilting point (a dry-end clip: VWC below the lab range), is a lower
 * bound, capped at `SWP_CAP_BAR`; wet-end clips sit at the wettest lab point,
 * near saturation, and stay as they are.
 */
export function swpBar(s: Pick<SwpSeries, 'kPa' | 'clipped'>): SwpBar {
  const dry = s.kPa.map((col, d) =>
    col.map((v, i) => {
      const b = kPaToBar(v)
      return b != null && (b > SWP_CAP_BAR || (!!s.clipped[d]?.[i] && b >= SWP_WILTING_POINT))
    }),
  )
  const bar = s.kPa.map((col, d) =>
    col.map((v, i) => {
      const b = kPaToBar(v)
      return dry[d][i] && b != null ? Math.min(b, SWP_CAP_BAR) : b
    }),
  )
  return { bar, dry }
}

/** Share of a depth's readings on the cap at or above which the SWP chart leaves the depth out. */
export const SWP_CAPPED_SHARE = 0.9

/**
 * Depths drier than `SWP_CAP_BAR` for (nearly) the whole window: at least `SWP_CAPPED_SHARE` of
 * their readings sit on the cap, so the chart would draw a flat dotted line at the cap that reads
 * as a reference line. Returns the series without them and one note per depth dropped
 * ("40 in: drier than -1,000 bar for the whole period, so it is not drawn.").
 */
export function dropCappedDepths(s: SwpSeries): { series: SwpSeries; notes: string[] } {
  const { bar } = swpBar(s)
  const notes: string[] = []
  const keep = s.depthsCm.flatMap((cm, d) => {
    const valued = bar[d].filter((v) => v != null).length
    const capped = bar[d].filter((v) => v != null && v >= SWP_CAP_BAR).length
    if (valued === 0 || capped / valued < SWP_CAPPED_SHARE) return [d]
    const when = capped === valued ? 'the whole period' : 'nearly the whole period'
    notes.push(`${depthLabel(cm)}: drier than -${SWP_CAP_BAR.toLocaleString('en-US')} bar for ${when}, so it is not drawn.`)
    return []
  })
  if (keep.length === s.depthsCm.length) return { series: s, notes }
  return {
    series: { ...s, depthsCm: keep.map((d) => s.depthsCm[d]), kPa: keep.map((d) => s.kPa[d]), clipped: keep.map((d) => s.clipped[d]) },
    notes,
  }
}

/** "-12.34 bar", or "≤ -1000.00 bar (drier than the lab range)" for a dry-end clip. */
export function swpText(bar: number, dry: boolean): string {
  return dry ? `≤ -${bar.toFixed(2)} bar (drier than the lab range)` : `-${bar.toFixed(2)} bar`
}

export const FEELS_LIKE_LABELS: Record<FeelsLikeRegime, string> = {
  wind_chill: 'Wind Chill',
  heat_index: 'Heat Index',
  air_temp: 'Average Temperature',
}

/** Livestock risk classes in severity order (legend order). */
export const CCI_CLASSES: CciClass[] = [
  'No Stress',
  'Mild',
  'Moderate',
  'Severe',
  'Extreme',
  'Extreme Danger',
]

/** Soil profile heatmap labels and units (display units; SWP drawn on log10 bar). */
export const PROFILE_META: Record<SoilProfileVar, { label: string; units: string; mid?: number }> = {
  soil_vwc: { label: axisTitle('soil_vwc', 'Soil moisture'), units: '%' },
  soil_temp: { label: axisTitle('soil_temp', 'Soil temperature'), units: '°F', mid: 32 },
  soil_blk_ec: { label: axisTitle('soil_ec_blk', 'Soil salinity (EC)'), units: 'mS/cm' },
  swp: { label: axisTitle('swp', 'Soil water potential'), units: 'bar' },
  percent_saturation: { label: axisTitle('percent_saturation', 'Soil saturation'), units: '%' },
}

/**
 * SI → the API's US display unit, keyed by the unit in the API column label
 * (the unit `data/parse.ts` `toSi` converted from). Unknown units were not
 * converted and pass through. Null stays null.
 */
export function fromSi(unit: string | null | undefined): (v: Nullable) => Nullable {
  switch ((unit ?? '').trim()) {
    case '°F':
    case 'degF':
      return (v) => cToF(v)
    case 'mi/h':
    case 'mi/hr':
    case 'mph':
    case 'mi hr^-1':
      return (v) => msToMph(v)
    case 'in':
    case 'in.':
    case 'in/h':
    case 'in/hr':
      return (v) => mmToIn(v)
    case 'bar':
      return (v) => kPaToBar(v)
    case 'ft':
      return (v) => (v == null ? null : v / 0.3048)
    default:
      return (v) => v
  }
}

/** `Total Precipitation [in]` → `{ name: 'Precipitation', unit: 'in' }`. */
export function parseLabel(header: string | null | undefined): { name: string; unit: string | null } {
  if (!header) return { name: '', unit: null }
  const m = /^(?:(?:Minimum|Maximum|Average|Sum|Total)\s+)?(.+?)\s*(?:\[([^\]]+)\])?$/.exec(header.trim())
  return { name: m?.[1] ?? header, unit: m?.[2] ?? null }
}

/**
 * Annual comparison y label in plain words (core/downloader `elementLabel`,
 * `plainUnit`): "Average Air Temperature @ 2 m [°F]" → "Air temperature at
 * 6.6 ft (°F)"; cumulative "Total Precipitation [in]" → "Cumulative rain (in)".
 */
export function annualAxisLabel(header: string | null | undefined, cumulative: boolean): string {
  const { name, unit } = parseLabel(header)
  const plain = name ? elementLabel(name) : ''
  const base = unit ? `${plain} (${plainUnit(unit)})` : plain
  return cumulative ? cumulativeTitle(base) : base
}

/** "V1 (Emergence)", or "2 – Two leaves" when the stage id and name differ. */
export function stageText(stage: number | string | null, name: string | null): string {
  if (stage == null) return ''
  const s = String(stage)
  if (name && !s.includes(name)) return s === '0' ? name : `${s} – ${name}`
  return s === '0' && !name ? 'Before first stage' : s
}

/** Nominal soil-sensor depths, cm → the dashboard's inch labels (LAB_SWAP). */
const CM_TO_IN: Record<number, number> = { 5: 2, 10: 4, 20: 8, 50: 20, 70: 28, 91: 36, 100: 40 }

/** 10 → "4 in"; non-nominal depths round to the nearest inch. */
export const depthLabel = (cm: number): string => `${CM_TO_IN[cm] ?? Math.round(cm / 2.54)} in`

/**
 * Chart x values: local (America/Denver) wall-clock strings, `YYYY-MM-DD` for
 * daily rows and `YYYY-MM-DD HH:mm` for hourly (the `T` becomes a space).
 */
export const xValues = (time: (LocalDate | LocalDateTime)[]): string[] =>
  time.map((t) => (t.length > 10 ? t.replace('T', ' ') : t))

/** Largest finite value, floored at 0 (an all-null series gives 0). */
export const finiteMax = (values: Nullable[]): number => {
  let m = 0
  for (const v of values) if (v != null && Number.isFinite(v) && v > m) m = v
  return m
}
