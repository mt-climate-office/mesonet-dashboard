/**
 * Ag tool state: URL keys (`$store.url.state`; the tool is `v`) + the station row → the
 * resolved selection every Ag component reads, the URL patches the controls
 * write, and the one-off URL fix-ups (stale cutoffs, ineligible soil chip).
 * Pure; the ui/ag components call these.
 */
import type { Station, StationElement } from '../../api'
import type { RangeValue } from '../../controls/rangeModel'
import { DERIVED_VAR_OPTIONS, type DerivedVar, GDD_CROPS, SOIL_VAR_OPTIONS, isAgTool } from '../../params/ag'
import { stationHasSwp } from '../../stations'
import type { UrlKey, UrlState } from '../../url-schema'
import { elementLabel } from '../../downloader/labels'
import type { GddCrop, LocalDate } from '../contract'
import { GDD_CUTOFFS_F } from '../compute/gdd'
import { addDays } from '../data/parse'
import { type GddCutoffState, SLIDER_NONE, parseGddCutoffs, sliderWrites, toSlider } from './gddCutoffs'
import type { Period, SoilProfileVar } from './labels'

export type AgVariable = DerivedVar
export const SOIL_PROFILE = 'soil_temp,soil_ec_blk' satisfies AgVariable

const CROPS = new Set(GDD_CROPS.map((c) => c.value))
/** Variables that need soil water potential sensors (legacy filter_to_only_swp_stations). */
const SWP_ONLY = new Set<string>(['swp', 'percent_saturation'])
/** Variables with the Hourly/Daily toggle (legacy app.py:628-683). */
const TIME_AGG = new Set<string>(['etr', 'feels_like', 'cci', 'swp', 'percent_saturation'])

/** Ag URL keys this module reads. */
export type AgUrl = Pick<
  UrlState,
  's' | 'v' | 'crop' | 'gdd_lo' | 'gdd_hi' | 'gdd_proj' | 'ag_time' | 'lt' | 'soilv' | 'annv' | 'ag_from' | 'ag_to'
>

export interface AgTab {
  /** `v` is an Ag tool id (core/params/ag `isAgTool`). */
  open: boolean
  /** The open tool; GDD (the legacy default) when `v` is not an Ag tool. */
  variable: AgVariable
  variableLabel: string
  crop: GddCrop
  cropLabel: string
  cut: GddCutoffState
  /** SWP / percent saturation: only has_swp stations qualify. */
  swpOnly: boolean
  hasSwp: boolean
  showTimeAgg: boolean
  /** Annual comparison ignores the window, so its date range is hidden. */
  showDates: boolean
  /** Effective period (daily unless the toggle is shown). */
  period: Period
  livestock: 'adult' | 'newborn'
  soilOptions: { value: string; label: string }[]
  soilVar: SoilProfileVar
  annualVar: string | null
  gddProj: UrlState['gdd_proj']
  /** Inclusive local window; start ≤ end. */
  start: LocalDate
  end: LocalDate
}

/** Default window: the last 365 days through today (legacy started today − 365 d). */
export function dateWindow(from: string | null, to: string | null, today: LocalDate): { start: LocalDate; end: LocalDate } {
  const end = to ?? today
  const start = from ?? addDays(today, -365)
  return start <= end ? { start, end } : { start: end, end }
}

/** Resolve the URL + station row into the Ag selection (unknown values fall back to defaults). */
export function resolveAgTab(url: AgUrl, station: Station | undefined, today: LocalDate): AgTab {
  const variable: AgVariable = isAgTool(url.v) ? url.v : 'gdd'
  const crop = (CROPS.has(url.crop) ? url.crop : 'wheat') as GddCrop
  const hasSwp = stationHasSwp(station)
  const soilOptions = SOIL_VAR_OPTIONS.filter((o) => hasSwp || !SWP_ONLY.has(o.value))
  const showTimeAgg = TIME_AGG.has(variable)
  return {
    open: isAgTool(url.v),
    variable,
    variableLabel: DERIVED_VAR_OPTIONS.find((o) => o.value === variable)?.label ?? variable,
    crop,
    cropLabel: GDD_CROPS.find((c) => c.value === crop)?.label ?? crop,
    cut: parseGddCutoffs(crop, url.gdd_lo, url.gdd_hi),
    swpOnly: SWP_ONLY.has(variable),
    hasSwp,
    showTimeAgg,
    showDates: variable !== 'annual',
    period: showTimeAgg ? url.ag_time : 'daily',
    livestock: url.lt,
    soilOptions,
    soilVar: (soilOptions.some((o) => o.value === url.soilv) ? url.soilv : 'soil_vwc') as SoilProfileVar,
    annualVar: url.annv,
    gddProj: url.gdd_proj,
    ...dateWindow(url.ag_from, url.ag_to, today),
  }
}

/**
 * Opening a tool resets crop, custom cutoffs, time aggregation and soil
 * variable (legacy app.py ~567-599), and shows its chart (not All years or a
 * table). Only this patch resets, so a deep link's explicit params survive
 * the initial load.
 */
export function variablePatch(v: string): Partial<UrlState> {
  return { v, view: 'recent', tbl: false, cmp: false, crop: 'wheat', gdd_lo: null, gdd_hi: null, ag_time: 'daily', soilv: 'soil_vwc' }
}

/** Ag keys other than the tool itself: every option a tool reads (old `#ag` links carry them; core/router). */
export const AG_KEYS = ['crop', 'gdd_lo', 'gdd_hi', 'gdd_proj', 'ag_time', 'lt', 'soilv', 'annv', 'ag_from', 'ag_to'] as const satisfies readonly UrlKey[]

/** A new crop starts from its own cutoffs. */
export const cropPatch = (crop: string): Partial<UrlState> => ({ crop, gdd_lo: null, gdd_hi: null })

/** Annual comparison options: one per element, US-unit labels (legacy dist_swap), natural sort. */
export function annualOptions(elements: readonly StationElement[]): { value: string; label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  for (const e of elements) {
    if (seen.has(e.element)) continue
    seen.add(e.element)
    out.push({ value: e.element, label: elementLabel(e.description_short) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
}

/* ----------------------------------------------------------- GDD slider */

const fmtCutoff = (f: number) => (Number.isFinite(f) ? `${f} °F` : 'no upper cutoff')

/** Slider value (°F; high null = "no upper cutoff") for the current cutoffs. */
export function sliderValue(t: Pick<AgTab, 'crop' | 'cut'>): RangeValue {
  const [cl, ch] = GDD_CUTOFFS_F[t.crop]
  const hi = toSlider(t.cut.hiF ?? ch)
  return { low: toSlider(t.cut.loF ?? cl), high: hi >= SLIDER_NONE ? null : hi }
}

/** URL patch for a committed slider value: only a moved thumb is written. */
export function sliderPatch(t: Pick<AgTab, 'crop' | 'cut'>, v: RangeValue): Partial<UrlState> {
  const prev = sliderValue(t)
  const pos = (r: RangeValue) => [r.low, r.high ?? SLIDER_NONE] as const
  const w = sliderWrites(t.crop, pos(prev), pos(v))
  const patch: Partial<UrlState> = {}
  if (w.lo !== undefined) patch.gdd_lo = w.lo
  if (w.hi !== undefined) patch.gdd_hi = w.hi
  return patch
}

/** The note under the slider: the crop's cutoffs (and NDAWN switch) or the custom pair. */
export function cutoffSummary(t: Pick<AgTab, 'crop' | 'cropLabel' | 'cut'>): string {
  const [cl, ch] = GDD_CUTOFFS_F[t.crop]
  if (t.cut.custom) {
    return `Custom cutoffs: ${t.cut.loF ?? cl} °F to ${fmtCutoff(t.cut.hiF ?? ch)}. Growth-stage labels are not shown.`
  }
  const ndawn =
    t.crop === 'wheat' || t.crop === 'barley'
      ? `, switching to ${GDD_CUTOFFS_F[`${t.crop}2`][1]} °F at Haun stage 2 (NDAWN).`
      : '.'
  return `${t.cropLabel} cutoffs: ${cl} °F to ${fmtCutoff(ch)}${ndawn} Move the slider for custom cutoffs.`
}

/* ------------------------------------------------------------- fix-ups */

/**
 * One-off URL corrections once the inputs are known (null = none):
 * legacy/invalid GDD cutoffs stripped; a soil chip the station cannot show
 * falls back to VWC; Annual defaults to the first element when its value is
 * not offered. `annual` is null until the station's elements load.
 */
export function urlFixups(
  t: AgTab,
  url: AgUrl,
  stationKnown: boolean,
  annual: { value: string }[] | null,
): Partial<UrlState> | null {
  const patch: Partial<UrlState> = {}
  if (t.variable === 'gdd' && t.cut.strip.lo) patch.gdd_lo = null
  if (t.variable === 'gdd' && t.cut.strip.hi) patch.gdd_hi = null
  if (t.variable === SOIL_PROFILE && stationKnown && url.soilv !== t.soilVar) patch.soilv = t.soilVar
  if (t.variable === 'annual' && annual && annual.length > 0 && !annual.some((o) => o.value === url.annv)) {
    patch.annv = annual[0].value
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * The element the Annual card fetches, once the station's element list has
 * loaded (null before): `annv` if the list offers it, else its first option,
 * which is what the `urlFixups` write will set. A stale `annv` from another
 * station never fetches, and the card does not wait on the URL write.
 */
export function annualElement(annv: string | null, options: { value: string }[] | null): string | null {
  if (!options) return null
  return annv && options.some((o) => o.value === annv) ? annv : (options[0]?.value ?? null)
}

/** Why an SWP tool shows nothing at a station without SWP sensors (its empty state, beside "Choose a station"). */
export const notHereMessage = (name: string) => `${name} has no soil water potential sensors, so this tool does not apply there.`

/** Single-choice chips: the newly pressed value, or `current` when the pressed chip was clicked again. */
export const pickOne = (values: string[], current: string): string => values.find((v) => v !== current) ?? current

/**
 * Tools with an All-years view (`view=history`): Reference ET, which is also
 * an observed variable (`etr`) and keeps that variable's history and place in
 * the list (DIVERGENCES "Reference ET is one page").
 */
export const hasAllYears = (v: AgVariable): boolean => v === 'etr'

/** Which card draws a variable. */
export function variableGroup(v: AgVariable): 'met' | 'gdd' | 'soil' | 'annual' {
  if (v === 'gdd' || v === 'annual') return v
  return v === 'etr' || v === 'feels_like' || v === 'cci' ? 'met' : 'soil'
}

/**
 * What the chart card shows: the chart, "Loading stations…" while `?s=` waits
 * on the catalog, the "Select Station" prompt without a station, or
 * `not-here` for an SWP tool at a station without SWP sensors
 * (`notHereMessage`). The station comes from the header picker.
 */
export function chartState(
  t: Pick<AgTab, 'swpOnly' | 'hasSwp'>,
  param: string | null,
  stationId: string | null,
  catalogLoaded: boolean,
): 'chart' | 'loading-stations' | 'no-station' | 'not-here' {
  if (param && !catalogLoaded) return 'loading-stations'
  if (!stationId) return 'no-station'
  return t.swpOnly && !t.hasSwp ? 'not-here' : 'chart'
}
