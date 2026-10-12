/**
 * Growing degree days, ported from `mesonet-db-rds/api/app/app/derived.py`
 * (`calc_gdds` 40-77, `_gdd_cutoffs` 80-90, cumulative + stages 1028-1065).
 *
 * **Units exception.** The contract is SI, but GDD values and stage
 * thresholds are °F·day because the published stage tables are in °F·day and
 * the clip-then-average method is not linear under a unit change once the
 * cutoffs bind. Inputs (`DailyMet.tminC/tmaxC`) are °C and are converted to
 * °F here; `GddSeries.cutoffs` is reported in °C per the contract.
 *
 * Method (API "method B"): clip both Tmin and Tmax to [low, high], average,
 * subtract low. Wheat and barley follow NDAWN: 32/70 °F until Haun stage 2 is
 * reached, then 32/95 °F.
 *
 * Divergences (DIVERGENCES.md): stage labels are recomputed after the
 * wheat/barley switch (D-GDD-1); a crop with no stage table yields null stage
 * labels rather than "Planted"/0 (D-GDD-2); cumulative carries forward over
 * missing days (D-GDD-3).
 */
import type {
  DailyMet,
  DailyNormals,
  ForecastDaily,
  GddCrop,
  GddCutoffs,
  GddProjection,
  GddSeries,
  GddStage,
  GddStageTable,
  LocalDate,
  Nullable,
} from '../contract'
import { cToF, fToC } from './units'
import { addDays, cumulativeSum, ok } from './util'

/** Crop cutoffs in °F, verbatim from derived.py:80-90. */
export const GDD_CUTOFFS_F = {
  barley: [32, 70],
  barley2: [32, 95],
  canola: [41, 100],
  corn: [50, 86],
  wheat: [32, 70],
  wheat2: [32, 95],
  sugarbeet: [34, 86],
  sunflower: [44, Infinity],
  hemp: [32, Infinity],
} as const satisfies Record<string, readonly [number, number]>

/** The API's no-crop default (`schemas.py` ParamLow/ParamHigh): 50/86 °F. */
export const DEFAULT_GDD_CUTOFFS_F: readonly [number, number] = [50, 86]

/** Crops that switch cutoffs at Haun stage 2 (NDAWN). */
const NDAWN_SWITCH = new Set<GddCrop>(['wheat', 'barley'])
const NDAWN_SWITCH_STAGE = 2

export interface GddOptions {
  /** Crop whose cutoffs (and NDAWN switch) to use. */
  crop?: GddCrop | null
  /** Custom cutoffs, °C. Override the crop's (and disable the NDAWN switch). */
  lowC?: number
  highC?: number
  /** Stage table; omit or pass an empty table for "no stage table". */
  stages?: GddStageTable
}

/** One day's GDD in °F·day (derived.py:72-77). */
export function gddDayF(tminF: number, tmaxF: number, lowF: number, highF: number): number {
  const lo = Math.min(Math.max(tminF, lowF), highF)
  const hi = Math.min(Math.max(tmaxF, lowF), highF)
  return (lo + hi) / 2 - lowF
}

export interface StageLabel {
  stage: number | string | null
  name: string | null
}

function sortedStages(table: GddStageTable | undefined): GddStage[] {
  return (table?.stages ?? []).filter((s) => ok(s.gdd)).sort((a, b) => a.gdd - b.gdd)
}

/**
 * Last stage whose threshold ≤ cumulative (pandas `merge_asof`, backward).
 * Below the first threshold: stage 0 with a null name (derived.py:1041-1043;
 * see {@link labelStages} for the "Planted" fill). No table or no cumulative
 * → nulls (D-GDD-2).
 */
export function stageAt(cumulative: Nullable, stages: GddStage[]): StageLabel {
  if (stages.length === 0 || !ok(cumulative)) return { stage: null, name: null }
  let hit: GddStage | null = null
  for (const s of stages) {
    if (s.gdd <= cumulative) hit = s
    else break
  }
  if (!hit) return { stage: 0, name: null }
  // Emit the published label (`code`) unless it is just the numeric stage
  // (wheat/barley Haun numbers stay numbers).
  const label = hit.code != null && hit.code !== String(hit.stage) ? hit.code : hit.stage
  return { stage: label, name: hit.name }
}

/**
 * Stage labels for a run of cumulative values, with the API's name rule
 * (derived.py:1045-1048): if any row reached a named stage, rows below the
 * first threshold are named "Planted"; otherwise every name stays null (the
 * API drops the column). `named` forces the fill (e.g. a projection whose
 * observed series already reached a named stage).
 */
export function labelStages(cumulative: Nullable[], stages: GddStage[], named = false): StageLabel[] {
  const labels = cumulative.map((c) => stageAt(c, stages))
  if (named || labels.some((l) => l.name != null)) {
    const first = stages[0]?.gdd
    cumulative.forEach((c, i) => {
      if (ok(c) && first != null && c < first) labels[i] = { stage: 0, name: 'Planted' }
    })
  }
  return labels
}

export { cumulativeSum }

function stageNumber(s: number | string | null): number | null {
  if (typeof s === 'number') return s
  if (typeof s === 'string' && s.trim() !== '' && Number.isFinite(Number(s))) return Number(s)
  return null
}

interface Resolved {
  crop: GddCrop | null
  lowF: number
  highF: number
  /** Post-switch upper cutoff when the NDAWN rule applies. */
  switchHighF: number | null
}

function resolveCutoffs(opts: GddOptions): Resolved {
  if (opts.lowC != null || opts.highC != null) {
    // Custom cutoffs: not a crop series (contract: crop null). An omitted
    // bound falls back to the named crop's (or the 50/86 °F default).
    const [dl, dh] = opts.crop ? GDD_CUTOFFS_F[opts.crop] : DEFAULT_GDD_CUTOFFS_F
    return {
      crop: null,
      lowF: opts.lowC != null ? cToF(opts.lowC) : dl,
      highF: opts.highC != null ? cToF(opts.highC) : dh,
      switchHighF: null,
    }
  }
  const crop = opts.crop ?? null
  if (crop) {
    const [lowF, highF] = GDD_CUTOFFS_F[crop]
    const switchHighF = NDAWN_SWITCH.has(crop)
      ? GDD_CUTOFFS_F[`${crop as 'wheat' | 'barley'}2`][1]
      : null
    return { crop, lowF, highF, switchHighF }
  }
  return { crop, lowF: DEFAULT_GDD_CUTOFFS_F[0], highF: DEFAULT_GDD_CUTOFFS_F[1], switchHighF: null }
}

// fToC(Infinity) === Infinity, so open-ended caps need no special case.
const cutoffsC = (lowF: number, highF: number): GddCutoffs => ({ lowC: fToC(lowF), highC: fToC(highF) })

/** Growing degree days (°F·day) with cumulative sum and crop stages. */
export function gdd(met: DailyMet, opts: GddOptions = {}): GddSeries {
  const r = resolveCutoffs(opts)
  const stages = sortedStages(opts.stages)
  const tminF = met.tminC.map((x) => (ok(x) ? cToF(x) : null))
  const tmaxF = met.tmaxC.map((x) => (ok(x) ? cToF(x) : null))
  const dayGdd = (i: number, highF: number): Nullable => {
    const lo = tminF[i]
    const hi = tmaxF[i]
    return ok(lo) && ok(hi) ? gddDayF(lo, hi, r.lowF, highF) : null
  }

  let daily = met.date.map((_, i) => dayGdd(i, r.highF))
  let cumulative = cumulativeSum(daily)

  const switchHigh = stages.length > 0 ? r.switchHighF : null
  if (switchHigh != null) {
    // NDAWN (derived.py:1049-1059): rows whose first-pass stage is ≥ 2 use
    // the post-switch cap. First-pass cumulative is identical to the final
    // one up to the switch day, so the switch day itself is the same.
    const firstPass = cumulative.map((c) => stageNumber(stageAt(c, stages).stage))
    daily = daily.map((d, i) => {
      const s = firstPass[i]
      return s != null && s >= NDAWN_SWITCH_STAGE ? dayGdd(i, switchHigh) : d
    })
    cumulative = cumulativeSum(daily)
  }

  // D-GDD-1: labels always come from the final cumulative.
  const labels = labelStages(cumulative, stages)
  return {
    station: met.station,
    level: met.level,
    provisional: [...met.provisional],
    crop: r.crop,
    cutoffs: cutoffsC(r.lowF, r.highF),
    date: [...met.date],
    daily,
    cumulative,
    stage: labels.map((l) => l.stage),
    stageName: labels.map((l) => l.name),
    ndawnSwitch:
      switchHigh != null ? { atStage: NDAWN_SWITCH_STAGE, cutoffs: cutoffsC(r.lowF, switchHigh) } : null,
  }
}

/** `"MM-DD"` for a local date; Feb 29 falls back to Feb 28 when absent. */
function normalFor(normals: DailyNormals, date: LocalDate) {
  const md = date.slice(5, 10)
  return normals.byMonthDay[md] ?? (md === '02-29' ? normals.byMonthDay['02-28'] : undefined)
}

/**
 * Project a GDD series forward from the day after its last date through
 * `through` (inclusive). Days covered by the forecast use forecast Tmin/Tmax
 * (per variable; a missing forecast value falls back to the normal median);
 * the rest use the station's 1991–2020 gridMET normals: the median
 * temperatures drive `daily`/`cumulative`, and q25/q75 temperatures drive the
 * `cumulativeQ25`/`cumulativeQ75` envelope. Cutoffs, NDAWN switch and stages
 * follow `series`.
 */
export function projectGdd(
  series: GddSeries,
  normals: DailyNormals,
  forecast: ForecastDaily | undefined,
  through: LocalDate,
  stages?: GddStageTable,
): GddProjection {
  const out: GddProjection = {
    date: [],
    daily: [],
    cumulative: [],
    cumulativeQ25: [],
    cumulativeQ75: [],
    stage: [],
    stageName: [],
    basis: [],
  }
  if (series.date.length === 0) return out
  const last = series.date[series.date.length - 1]
  if (through <= last) return out

  const table = sortedStages(stages)
  const lowF = cToF(series.cutoffs.lowC)
  const baseHighF = cToF(series.cutoffs.highC)
  // The switch decision is the series' own, recorded by gdd().
  const sw = table.length > 0 ? series.ndawnSwitch : null
  const switchHighF = sw ? cToF(sw.cutoffs.highC) : null

  const fc = new Map<LocalDate, { tmin: Nullable; tmax: Nullable }>()
  forecast?.date.forEach((d, i) => fc.set(d, { tmin: forecast.tminC[i], tmax: forecast.tmaxC[i] }))

  let start: Nullable = null
  for (let i = series.cumulative.length - 1; i >= 0; i--) {
    if (ok(series.cumulative[i])) {
      start = series.cumulative[i]
      break
    }
  }
  const acc = { median: start ?? 0, q25: start ?? 0, q75: start ?? 0 }

  const step = (track: keyof typeof acc, tminC: Nullable, tmaxC: Nullable): Nullable => {
    if (!ok(tminC) || !ok(tmaxC)) return null
    let highF = baseHighF
    if (switchHighF != null) {
      // As in gdd(): a day switches when its own pre-switch cumulative
      // reaches stage 2 (and every later day stays switched).
      const firstPass = acc[track] + gddDayF(cToF(tminC), cToF(tmaxC), lowF, baseHighF)
      const s = stageNumber(stageAt(firstPass, table).stage)
      if (sw && s != null && s >= sw.atStage) highF = switchHighF
    }
    const g = gddDayF(cToF(tminC), cToF(tmaxC), lowF, highF)
    acc[track] += g
    return g
  }

  for (let d = addDays(last, 1); d <= through; d = addDays(d, 1)) {
    const n = normalFor(normals, d)
    const f = fc.get(d)
    const fmin = f && ok(f.tmin) ? f.tmin : null
    const fmax = f && ok(f.tmax) ? f.tmax : null
    const fromForecast = fmin != null || fmax != null
    const tmin = (q: 'median' | 'q25' | 'q75') => fmin ?? n?.tminC[q] ?? null
    const tmax = (q: 'median' | 'q25' | 'q75') => fmax ?? n?.tmaxC[q] ?? null
    const g = step('median', tmin('median'), tmax('median'))
    step('q25', tmin('q25'), tmax('q25'))
    step('q75', tmin('q75'), tmax('q75'))
    out.date.push(d)
    out.daily.push(g)
    out.cumulative.push(acc.median)
    out.cumulativeQ25.push(acc.q25)
    out.cumulativeQ75.push(acc.q75)
    out.basis.push(fromForecast ? 'forecast' : 'normals')
  }
  const labels = labelStages(out.cumulative, table, series.stageName.some((n) => n != null))
  out.stage = labels.map((l) => l.stage)
  out.stageName = labels.map((l) => l.name)
  return out
}
