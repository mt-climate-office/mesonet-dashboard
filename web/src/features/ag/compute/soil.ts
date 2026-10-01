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

function paramsFor(params: SoilParams[], station: string, depthCm: number): SoilParams | undefined {
  return params.find((p) => p.station === station && p.depthCm === depthCm)
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
    const p = paramsFor(params, soil.station, depth)
    if (!p?.fx || p.model !== 'FX') return
    const fx = p.fx
    const lo = ok(p.labVwcMin) ? p.labVwcMin : -Infinity
    const hi = ok(p.labVwcMax) ? p.labVwcMax : Infinity
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
    const por = paramsFor(params, soil.station, depth)?.porosityPct
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
  /** `frozen[d][i]` true where soil temperature at that depth ≤ 0 °C. Missing temperature → false. */
  frozen: boolean[][]
}

export function frozenMask(soil: SoilSeries): FrozenMask {
  return {
    station: soil.station,
    depthsCm: [...soil.depthsCm],
    time: [...soil.time],
    frozen: soil.tempC.map((col) => col.map((t) => ok(t) && t <= 0)),
  }
}

/**
 * Null out values where the soil is frozen. `depthsCm` are the depths of
 * `values` (e.g. `SwpSeries.depthsCm`); depths absent from the mask pass
 * through unchanged.
 */
export function applyFrozenMask(depthsCm: number[], values: Nullable[][], mask: FrozenMask): Nullable[][] {
  return values.map((col, d) => {
    const m = mask.frozen[mask.depthsCm.indexOf(depthsCm[d])]
    return m ? col.map((v, i) => (m[i] ? null : v)) : [...col]
  })
}
