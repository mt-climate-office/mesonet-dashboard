// Approved data ramps (HOUSE-STYLE §6) as hex stops, low → high, plus sample().
// Theme-specific choices live in roles.ts; this file holds only published values.
// Spectral is banned (red→green, not CVD-safe) and deliberately absent.

import { hexToRgb } from './contrast'

/**
 * Crameri, F. (2018). Scientific colour maps (v8). Zenodo. doi:10.5281/zenodo.1243862
 * MIT license. https://www.fabiocrameri.ch/colourmaps/
 * 11 evenly spaced stops of the 256-step tables, copied from mesonet-explorer app.js RAMPS.
 */
export const BATLOW = ['#011959', '#103d5f', '#185562', '#30685c', '#577647', '#828231', '#b38e2f', '#e09651', '#fba689', '#fdb9c2', '#faccfa'] as const
/** Crameri romaO, cyclic (first stop === last). Only for cyclic quantities such as wind direction. */
export const ROMA_O = ['#733957', '#823c3d', '#94502e', '#aa752f', '#c3a34b', '#d5ce81', '#cbe1b3', '#a4d8cb', '#74bbcd', '#5495c0', '#516da6', '#62497d', '#733957'] as const

// ColorBrewer 2.0 (Brewer, Harrower & Penn State, colorbrewer2.org), max-class schemes.
export const RD_BU = ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'] as const
export const BR_BG = ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'] as const
export const YL_GN_BU = ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'] as const
export const YL_OR_RD = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] as const
export const BLUES = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] as const
export const PU_RD = ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256', '#980043', '#67001f'] as const

// Paul Tol (2021), "Colour Schemes", SRON/EPS/TN/09-002 issue 3.2. https://personal.sron.nl/~pault/
// Qualitative sets in Tol's published order; the "bad data" greys and the
// high-contrast white/black are omitted.
/** blue, cyan, green, yellow, red, purple, grey */
export const TOL_BRIGHT = ['#4477AA', '#66CCEE', '#228833', '#CCBB44', '#EE6677', '#AA3377', '#BBBBBB'] as const
/** rose, indigo, sand, green, cyan, wine, teal, olive, purple */
export const TOL_MUTED = ['#CC6677', '#332288', '#DDCC77', '#117733', '#88CCEE', '#882255', '#44AA99', '#999933', '#AA4499'] as const
/** yellow, red, blue */
export const TOL_HIGH_CONTRAST = ['#DDAA33', '#BB5566', '#004488'] as const

export type Ramp = readonly string[]

export interface SampleRange {
  /** Start position on the ramp, 0–1 (default 0). */
  from?: number
  /** End position on the ramp, 0–1 (default 1); may be < from to run backwards. */
  to?: number
}

/**
 * n evenly spaced colors from position `from` to `to` (0–1) of `ramp`, as lowercase #rrggbb.
 * Interpolates between neighbouring stops in OKLab so lightness steps stay even.
 * n ≤ 0 → []; n = 1 → the color at `from`.
 */
export function sample(ramp: Ramp, n: number, { from = 0, to = 1 }: SampleRange = {}): string[] {
  if (n <= 0) return []
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(colorAt(ramp, n === 1 ? from : from + ((to - from) * i) / (n - 1)))
  return out
}

/** Color at position t (0–1, clamped) of `ramp`, OKLab-interpolated, as lowercase #rrggbb. */
export function colorAt(ramp: Ramp, t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const lo = Math.floor(x)
  const hi = Math.min(ramp.length - 1, lo + 1)
  const a = toOklab(ramp[lo])
  const b = toOklab(ramp[hi])
  const f = x - lo
  return fromOklab([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f])
}

/** Reverse a ramp (high → low) without mutating it. */
export function reversed(ramp: Ramp): string[] {
  return [...ramp].reverse()
}

// OKLab conversion: Björn Ottosson (2020), https://bottosson.github.io/posts/oklab/

type Lab = [number, number, number]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** "#rrggbb" → OKLab [L, a, b]; L is perceptual lightness, 0–1. */
export function toOklab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map((c) => toLinear(c / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function fromOklab([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255).toString(16).padStart(2, '0')).join('')
}
