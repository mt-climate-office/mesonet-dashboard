/**
 * Renderer-free display helpers for Ag Tools: unit conversion at the display
 * edge, axis/legend labels, stage text and the soil-band constants. Pulled
 * out of the old Plotly builders (web/src/features/ag/figures) so the ECharts
 * builders in core/charts reuse them unchanged.
 */
import type { CciClass, FeelsLikeRegime, LocalDate, LocalDateTime, Nullable } from '../contract'
import { cToF, kPaToBar, mmToIn, msToMph } from '../compute'
import { elementLabel } from '../../downloader/labels'
import { axisTitle, cumulativeTitle, plainUnit } from '../../variables/labels'

export type Period = 'daily' | 'hourly'

export type SoilProfileVar = 'soil_vwc' | 'soil_temp' | 'soil_blk_ec' | 'swp' | 'percent_saturation'

/** SWP band edges, positive bar magnitudes (field capacity, wilting point). */
export const SWP_FIELD_CAPACITY = 0.33
export const SWP_WILTING_POINT = 15

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

/**
 * Columnar counterpart of `core/gaps.ts` `insertGaps`: a step longer than
 * `thresholdRatio` × the median cadence gets a null row, so line series break
 * there. The data layer already gap-fills its axes, so this is normally a
 * no-op; it guards series built from an axis that skips rows. Gap rows reuse
 * the preceding x.
 */
export function insertGapsColumnar<T extends Nullable[]>(
  epochMs: number[],
  x: string[],
  ys: T[],
  thresholdRatio = 1.5,
): { x: string[]; ys: Nullable[][] } {
  if (epochMs.length < 3) return { x, ys }
  const deltas: number[] = []
  for (let i = 1; i < epochMs.length; i++) {
    const d = epochMs[i] - epochMs[i - 1]
    if (d > 0) deltas.push(d)
  }
  if (deltas.length === 0) return { x, ys }
  const cadence = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]
  const threshold = cadence * thresholdRatio
  const outX: string[] = [x[0]]
  const outYs: Nullable[][] = ys.map((y) => [y[0]])
  for (let i = 1; i < epochMs.length; i++) {
    if (epochMs[i] - epochMs[i - 1] > threshold) {
      outX.push(x[i - 1])
      outYs.forEach((y) => y.push(null))
    }
    outX.push(x[i])
    outYs.forEach((y, k) => y.push(ys[k][i]))
  }
  return { x: outX, ys: outYs }
}
