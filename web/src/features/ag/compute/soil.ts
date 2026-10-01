/**
 * Soil water potential, percent saturation and the frozen-soil mask.
 *
 * SWP ports `mesonet-db-rds/api/app/app/derived.py` `calc_swp` (188-299) and
 * `soil_fx_inverse_model` (1099-1123): VWC is clipped to the lab-observed
 * VWC range for that station and depth, then inverted with Fredlund–Xing,
 *   ψ = h · (exp(((s − r)/(θ − r))^(1/m)) − e)^(1/n)   [kPa],  θ = VWC/100.
 *
 * Divergence D-SWP-1 (DIVERGENCES.md): the API clips every station with the
 * *first* station's range for that depth (derived.py:255, 262-263); here
 * each station uses its own range (only params whose `station` matches the
 * series are used).
 *
 * Percent saturation ports `calc_percent_saturation` (302-359):
 * clip(VWC / porosity · 100, 0, 100).
 *
 * The frozen mask ports the legacy heatmap rule
 * (`app/mdb/utils/plot_derived.py` `update_value`, ~349-361): where soil
 * temperature ≤ 32 °F (0 °C), VWC / EC / saturation / SWP are hidden.
 */
import type {
  FxParams,
  LocalDate,
  LocalDateTime,
  Nullable,
  PercentSaturationSeries,
  SoilParams,
  SoilSeries,
  SwpSeries,
} from '../contract'
import { clean, ok } from './util'

/** Fredlund–Xing inverse: θ (fraction) → ψ (kPa). NaN/complex → null. */
export function fxInverse(theta: number, p: FxParams): Nullable {
  const base = (p.s - p.r) / (theta - p.r)
  const inner = Math.exp(base ** (1 / p.m)) - Math.E
  return clean(p.h * inner ** (1 / p.n))
}

function rowsFor(params: SoilParams[], station: string, depthCm: number): SoilParams[] {
  return params.filter((p) => p.station === station && p.depthCm === depthCm)
}

/** The FX row for a station+depth (rows for other models are ignored). */
function fxRowFor(params: SoilParams[], station: string, depthCm: number): SoilParams | undefined {
  return rowsFor(params, station, depthCm).find((p) => p.model === 'FX' && p.fx != null)
}

/** Porosity for a station+depth from whichever row carries it. */
function porosityFor(params: SoilParams[], station: string, depthCm: number): number | undefined {
  return rowsFor(params, station, depthCm).find((p) => ok(p.porosityPct))?.porosityPct
}

/** Lab VWC range: the FX row's, else any row for the station+depth that has one. */
function labRangeFor(params: SoilParams[], station: string, depthCm: number, fxRow: SoilParams) {
  const src = ok(fxRow.labVwcMin) || ok(fxRow.labVwcMax)
    ? fxRow
    : rowsFor(params, station, depthCm).find((p) => ok(p.labVwcMin) || ok(p.labVwcMax))
  return {
    lo: ok(src?.labVwcMin) ? src.labVwcMin : -Infinity,
    hi: ok(src?.labVwcMax) ? src.labVwcMax : Infinity,
  }
}

/**
 * Soil water potential (kPa, positive suction) per depth. Only depths with
 * FX parameters for this station appear in the output, as in the API.
 */
export function swp(soil: SoilSeries, params: SoilParams[]): SwpSeries {
  const depthsCm: number[] = []
  const kPa: Nullable[][] = []
  const clipped: boolean[][] = []
  soil.depthsCm.forEach((depth, d) => {
    const p = fxRowFor(params, soil.station, depth)
    if (!p?.fx) return
    const fx = p.fx
    const { lo, hi } = labRangeFor(params, soil.station, depth, p)
    const vals: Nullable[] = []
    const flags: boolean[] = []
    for (const v of soil.vwcPct[d]) {
      if (!ok(v)) {
        vals.push(null)
        flags.push(false)
        continue
      }
      const c = Math.min(hi, Math.max(lo, v))
      flags.push(c !== v)
      vals.push(fxInverse(c / 100, fx))
    }
    depthsCm.push(depth)
    kPa.push(vals)
    clipped.push(flags)
  })
  return {
    station: soil.station,
    level: soil.level,
    provisional: [...soil.provisional],
    depthsCm,
    time: [...soil.time],
    epochMs: [...soil.epochMs],
    kPa,
    clipped,
  }
}

/** Percent saturation per depth; only depths with a porosity appear. */
export function percentSaturation(soil: SoilSeries, params: SoilParams[]): PercentSaturationSeries {
  const depthsCm: number[] = []
  const pct: Nullable[][] = []
  soil.depthsCm.forEach((depth, d) => {
    const por = porosityFor(params, soil.station, depth)
    if (!ok(por)) return
    depthsCm.push(depth)
    pct.push(soil.vwcPct[d].map((v) => (ok(v) ? clean(Math.min(100, Math.max(0, (v / por) * 100))) : null)))
  })
  return {
    station: soil.station,
    level: soil.level,
    provisional: [...soil.provisional],
    depthsCm,
    time: [...soil.time],
    epochMs: [...soil.epochMs],
    pct,
  }
}

export interface FrozenMask {
  station: string
  depthsCm: number[]
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  /** `frozen[d][i]` true where soil temperature at that depth ≤ 0 °C. Missing temperature → false. */
  frozen: boolean[][]
}

export function frozenMask(soil: SoilSeries): FrozenMask {
  return {
    station: soil.station,
    depthsCm: [...soil.depthsCm],
    time: [...soil.time],
    epochMs: [...soil.epochMs],
    frozen: soil.tempC.map((col) => col.map((t) => ok(t) && t <= 0)),
  }
}

/** The time axis and depths of a per-depth series (e.g. `SwpSeries`). */
export interface DepthSeriesAxis {
  depthsCm: number[]
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
}

/**
 * Null out values where the soil is frozen. `values[d]` belongs to
 * `axis.depthsCm[d]`; depths absent from the mask pass through unchanged.
 *
 * @throws if `axis` and `mask` do not share the same time axis (same length
 * and identical `time` and `epochMs`), or a column's length differs.
 */
export function applyFrozenMask(axis: DepthSeriesAxis, values: Nullable[][], mask: FrozenMask): Nullable[][] {
  const n = mask.time.length
  const same =
    axis.time.length === n &&
    axis.epochMs.length === n &&
    mask.epochMs.length === n &&
    axis.time.every((t, i) => t === mask.time[i] && axis.epochMs[i] === mask.epochMs[i])
  if (!same) throw new Error('applyFrozenMask: values and mask have different time axes')
  if (values.length !== axis.depthsCm.length || values.some((col) => col.length !== n)) {
    throw new Error('applyFrozenMask: values do not match the axis shape')
  }
  return values.map((col, d) => {
    const m = mask.frozen[mask.depthsCm.indexOf(axis.depthsCm[d])]
    return m ? col.map((v, i) => (m[i] ? null : v)) : [...col]
  })
}
