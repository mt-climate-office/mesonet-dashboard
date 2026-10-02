/**
 * The newest `/latest` row (LAB_SWAP-renamed headers, core/csv) read into
 * typed current conditions for the Now overview, plus the NWS feels-like
 * (core/ag/compute/feelsLike: heat index ≥ 80 °F, wind chill ≤ 50 °F and
 * > 3 mph, else the air temperature), which replaces legacy "Real Feel".
 * US units as the API sends them: °F, %, mph, deg, mbar, W/m², in.
 */
import { feelsLikeValue } from '../ag/compute/feelsLike'
import { cToF, fToC, mphToMs } from '../ag/compute/units'
import type { FeelsLikeRegime } from '../ag/contract'
import { stampEpochMs } from './stamp'

export interface SoilDepth {
  /** Depth in inches (2, 4, 8, 20, 36, 40 …). */
  depthIn: number
  tempF: number | null
  vwc: number | null
}

export interface Conditions {
  /** API stamp as sent, and as epoch ms (null if unparseable). */
  stamp: string
  stampMs: number | null
  provisional: boolean
  airF: number | null
  rh: number | null
  windMph: number | null
  gustMph: number | null
  windDeg: number | null
  pressureMb: number | null
  solar: number | null
  snowIn: number | null
  vpdMb: number | null
  /** Soil sensors, shallowest first; only depths reporting temperature or VWC. */
  soil: SoilDepth[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** First finite value among columns matching `test`. */
function pick(row: Record<string, unknown>, test: (col: string) => boolean): number | null {
  for (const [k, v] of Object.entries(row)) if (test(k) && num(v) !== null) return v as number
  return null
}

const SOIL = /^Soil (Temperature|VWC) @ (\d+) in \[/

/** Read one `/latest` row; absent or non-numeric values are null. */
export function readConditions(row: Record<string, unknown>): Conditions {
  const depths = new Map<number, SoilDepth>()
  for (const [k, v] of Object.entries(row)) {
    const m = SOIL.exec(k)
    if (!m) continue
    const depthIn = Number(m[2])
    const d = depths.get(depthIn) ?? { depthIn, tempF: null, vwc: null }
    if (m[1] === 'Temperature') d.tempF = num(v)
    else d.vwc = num(v)
    depths.set(depthIn, d)
  }
  const stamp = typeof row.datetime === 'string' ? row.datetime : ''
  return {
    stamp,
    stampMs: stampEpochMs(stamp),
    provisional: row.provisional === true,
    airF: pick(row, (k) => k === 'Air Temperature [°F]'),
    rh: pick(row, (k) => k === 'Relative Humidity [%]'),
    windMph: pick(row, (k) => k.startsWith('Wind Speed')),
    gustMph: pick(row, (k) => k.startsWith('Gust Speed')),
    windDeg: pick(row, (k) => k.startsWith('Wind Direction')),
    pressureMb: pick(row, (k) => k.startsWith('Atmospheric Pressure')),
    solar: pick(row, (k) => k.startsWith('Solar Radiation')),
    snowIn: pick(row, (k) => k.startsWith('Snow Depth')),
    vpdMb: pick(row, (k) => k.startsWith('VPD')),
    soil: [...depths.values()].filter((d) => d.tempF !== null || d.vwc !== null).sort((a, b) => a.depthIn - b.depthIn),
  }
}

export interface FeelsLike {
  valueF: number
  regime: FeelsLikeRegime
}

/** NWS feels-like in °F from °F, % and mph; null without an air temperature. */
export function feelsLikeF(airF: number | null, rh: number | null, windMph: number | null): FeelsLike | null {
  if (airF === null) return null
  const v = feelsLikeValue(fToC(airF), rh, windMph === null ? null : mphToMs(windMph))
  return v.valueC === null || v.regime === null ? null : { valueF: cToF(v.valueC), regime: v.regime }
}
