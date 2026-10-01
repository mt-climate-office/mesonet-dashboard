/**
 * Pure glue between the data hooks, the compute library and the figure
 * builders (unit-tested in derive.test.ts; the React views stay thin).
 */
import type {
  DailyMet,
  HourlyMet,
  Nullable,
  PercentSaturationSeries,
  SoilSeries,
  SwpSeries,
} from '../contract'
import {
  type AnnualTrace,
  applyFrozenMask,
  cToF,
  frozenMask,
  groupByYear,
  isCumulativeVariable,
  kPaToBar,
} from '../compute'
import type { AnnualDaily } from '../data'
import { type SoilProfileVar, annualAxisLabel, fromSi, parseLabel } from '../figures'

/* ------------------------------------------------------ sensor coverage */

export type MetInput = 'temperature' | 'humidity' | 'solar' | 'wind'

const INPUT_LABEL: Record<MetInput, string> = {
  temperature: 'Air temperature',
  humidity: 'Relative humidity',
  solar: 'Solar radiation',
  wind: 'Wind speed',
}

function inputColumns(met: DailyMet | HourlyMet, input: MetInput): Nullable[][] {
  if ('date' in met) {
    if (input === 'temperature') return [met.tminC, met.tmaxC]
    if (input === 'humidity') return [met.rhMin, met.rhMax]
    if (input === 'solar') return [met.sradWm2]
    return [met.windMs]
  }
  if (input === 'temperature') return [met.tC]
  if (input === 'humidity') return [met.rh]
  if (input === 'solar') return [met.sradWm2]
  return [met.windMs]
}

export interface Coverage {
  /** Set when the series has no rows at all. */
  noData: boolean
  /** Inputs with no values anywhere in the window (→ nothing to plot). */
  unavailable: MetInput[]
  /** Inputs missing on some rows: count of rows. */
  partial: { input: MetInput; rows: number }[]
}

/** Which required inputs are missing, wholly or partly, in a met series. */
export function coverage(met: DailyMet | HourlyMet, needs: MetInput[]): Coverage {
  const n = 'date' in met ? met.date.length : met.time.length
  const out: Coverage = { noData: n === 0, unavailable: [], partial: [] }
  if (n === 0) return out
  for (const input of needs) {
    const cols = inputColumns(met, input)
    let missing = 0
    for (let i = 0; i < n; i++) if (cols.some((c) => c[i] == null)) missing++
    if (missing === n) out.unavailable.push(input)
    else if (missing > 0) out.partial.push({ input, rows: missing })
  }
  return out
}

/** "Solar radiation unavailable for this period" style message, or null. */
export function unavailableMessage(c: Coverage): string | null {
  if (c.noData) return 'No data for the current selection.'
  if (c.unavailable.length === 0) return null
  const names = c.unavailable.map((i) => INPUT_LABEL[i])
  return `${names.join(' and ')} unavailable for this period.`
}

export function partialNote(c: Coverage, period: 'daily' | 'hourly', what: string): string | null {
  if (c.partial.length === 0) return null
  const unit = period === 'daily' ? 'day' : 'hour'
  const parts = c.partial.map((p) => `${INPUT_LABEL[p.input].toLowerCase()} missing for ${p.rows} ${unit}${p.rows === 1 ? '' : 's'}`)
  return `${parts.join('; ')}: ${what} is not computed there.`
}

/* --------------------------------------------------------- soil profile */

export interface ProfileValues {
  depthsCm: number[]
  values: Nullable[][]
  frozen: boolean[][]
  anyFrozen: boolean
}

/**
 * Display-unit values for one Soil Profile sub-variable, with the frozen-soil
 * mask (soil temperature ≤ 0 °C / 32 °F hides VWC, EC, SWP and saturation;
 * legacy `plot_derived.update_value`) applied via compute `applyFrozenMask`.
 * Temperature itself is never masked. Returns null when the needed series
 * has not loaded.
 */
export function profileValues(
  variable: SoilProfileVar,
  soil: SoilSeries,
  extra: { swp?: SwpSeries; pct?: PercentSaturationSeries },
): ProfileValues | null {
  const mask = frozenMask(soil)
  const axis = { depthsCm: soil.depthsCm, time: soil.time, epochMs: soil.epochMs }
  const frozenFor = (depths: number[]) =>
    depths.map((d) => mask.frozen[mask.depthsCm.indexOf(d)] ?? soil.time.map(() => false))
  const done = (depthsCm: number[], values: Nullable[][], masked: boolean): ProfileValues => {
    const frozen = masked ? frozenFor(depthsCm) : depthsCm.map(() => soil.time.map(() => false))
    return { depthsCm, values, frozen, anyFrozen: frozen.some((r) => r.some(Boolean)) }
  }
  switch (variable) {
    case 'soil_temp':
      return done(soil.depthsCm, soil.tempC.map((col) => col.map((v) => cToF(v))), false)
    case 'soil_vwc':
      return done(soil.depthsCm, applyFrozenMask(axis, soil.vwcPct, mask), true)
    case 'soil_blk_ec': {
      const ec = soil.ecMsCm ?? soil.depthsCm.map(() => soil.time.map(() => null))
      return done(soil.depthsCm, applyFrozenMask(axis, ec, mask), true)
    }
    case 'swp': {
      const s = extra.swp
      if (!s) return null
      const bar = s.kPa.map((col) => col.map((v) => kPaToBar(v)))
      return done(s.depthsCm, applyFrozenMask(s, bar, mask), true)
    }
    case 'percent_saturation': {
      const p = extra.pct
      if (!p) return null
      return done(p.depthsCm, applyFrozenMask(p, p.pct, mask), true)
    }
  }
}

/* --------------------------------------------------------------- annual */

export interface AnnualResult {
  traces: AnnualTrace[]
  /** API column label of the element (e.g. `Total Precipitation [in]`). */
  header: string | null
  yLabel: string
  cumulative: boolean
}

/**
 * Per-year API results (any order, any subset loaded so far) → display-unit
 * day-of-year traces. Cumulative variables (precipitation) are running sums
 * within each year that stop at the year's last observed day, so the current
 * year does not run flat to Dec 31.
 */
export function annualTraces(element: string, years: AnnualDaily[]): AnnualResult {
  const cumulative = isCumulativeVariable(element)
  const header = years.flatMap((y) => y.years).find((y) => y.header)?.header ?? null
  const conv = fromSi(parseLabel(header).unit)
  const traces: AnnualTrace[] = []
  for (const res of years) {
    for (const y of res.years) {
      const values = y.value.map((v) => conv(v))
      const [trace] = groupByYear(y.date, values, { cumulative })
      if (!trace) continue
      if (cumulative) {
        let last = -1
        values.forEach((v, i) => {
          if (v != null) last = i
        })
        trace.values = trace.values.map((v, i) => (i > last ? null : v))
      }
      if (trace.values.some((v) => v != null)) traces.push(trace)
    }
  }
  traces.sort((a, b) => a.year - b.year)
  return { traces, header, yLabel: annualAxisLabel(header, cumulative), cumulative }
}
