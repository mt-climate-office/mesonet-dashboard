/* -------------------------------------------------------------------------- */
/* CVD-accessible palettes — perceptually uniform sequential and CVD-safe     */
/* qualitative. Inline so the rest of the app pulls the same swatches and we  */
/* don't ship a colormap library just for these.                              */
/* -------------------------------------------------------------------------- */

/**
 * Tol's "Muted" qualitative palette — 9 colors, distinguishable under all
 * three common CVD types (deuteranopia, protanopia, tritanopia) and in
 * grayscale. https://personal.sron.nl/~pault/
 */
export const PALETTE_QUAL_TOL_MUTED = [
  '#332288', // indigo
  '#117733', // green
  '#44AA99', // teal
  '#88CCEE', // light blue
  '#DDCC77', // sand
  '#CC6677', // rose
  '#AA4499', // purple
  '#882255', // wine
  '#999933', // olive
] as const

/** Tol's "Bright" qualitative — 7 high-contrast CVD-safe colors. */
export const PALETTE_QUAL_TOL_BRIGHT = [
  '#4477AA', // blue
  '#EE6677', // red
  '#228833', // green
  '#CCBB44', // yellow
  '#66CCEE', // cyan
  '#AA3377', // purple
  '#BBBBBB', // gray
] as const

/**
 * 8-stop discrete sample of Viridis (perceptually uniform sequential, CVD-
 * safe, grayscale-safe). Use for ordered/sequential data where higher values
 * map to brighter colors.
 */
export const PALETTE_VIRIDIS = [
  '#440154',
  '#46327E',
  '#365C8D',
  '#277F8E',
  '#1FA187',
  '#4AC16D',
  '#9FDA3A',
  '#FDE725',
] as const

/**
 * 7-stop ColorBrewer YlOrRd — sequential, CVD-safe, ordered light → dark.
 * Use where higher = more intense / more dangerous.
 */
export const PALETTE_YLORRD_7 = [
  '#FFFFCC',
  '#FFEDA0',
  '#FED976',
  '#FEB24C',
  '#FD8D3C',
  '#FC4E2A',
  '#E31A1C',
  '#BD0026',
  '#800026',
] as const

/**
 * Pick `n` evenly-spaced samples from a continuous palette.
 * Returns `n` colors interpolated between the existing stops (linear in RGB).
 */
export function sampleSequential(palette: readonly string[], n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [palette[0]]
  const result: string[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const idx = t * (palette.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.min(palette.length - 1, lo + 1)
    const frac = idx - lo
    result.push(lerpHex(palette[lo], palette[hi], frac))
  }
  return result
}

function lerpHex(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16)
  const ga = parseInt(a.slice(3, 5), 16)
  const ba = parseInt(a.slice(5, 7), 16)
  const rb = parseInt(b.slice(1, 3), 16)
  const gb = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ra + (rb - ra) * t)
  const g = Math.round(ga + (gb - ga) * t)
  const c = Math.round(ba + (bb - ba) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${c.toString(16).padStart(2, '0')}`.toUpperCase()
}

/**
 * Color palette for soil-depth lines. Sampled from Viridis so colors carry
 * the natural shallow→deep ordering visually, and are CVD/grayscale safe.
 */
export const SOIL_DEPTH_COLOR: Record<string, string> = (() => {
  const depths = ['2 in', '4 in', '8 in', '20 in', '28 in', '36 in', '40 in']
  const colors = sampleSequential(PALETTE_VIRIDIS, depths.length)
  const out: Record<string, string> = {}
  depths.forEach((d, i) => {
    out[d] = colors[i]
  })
  return out
})()

/**
 * GDD growth-stage markers. Categorical CVD-safe palette repeated to cover
 * crops with many stages.
 */
export const GDD_STAGE_COLORS: string[] = [
  ...PALETTE_QUAL_TOL_MUTED,
  ...PALETTE_QUAL_TOL_BRIGHT,
]

/**
 * Livestock CCI risk classes → marker colors.
 *
 * Risk is ordered (No Stress → Extreme Danger), so we use a CVD-safe
 * sequential palette (ColorBrewer YlOrRd) with a neutral gray for "no
 * stress". Light → dark traces the cold-stress risk gradient on the Comfort
 * Climate Index, matching the colorblind-safe ramps in `PALETTE_YLORRD_7`.
 */
export const CCI_RISK_COLORS: Record<string, string> = {
  'No Stress': '#BBBBBB',
  Mild: '#FED976',
  Moderate: '#FD8D3C',
  Severe: '#E31A1C',
  Extreme: '#BD0026',
  'Extreme Danger': '#800026',
}
