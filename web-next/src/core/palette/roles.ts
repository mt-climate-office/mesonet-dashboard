// Every data color role → color per theme. The one file to edit to recolor a chart or map.
// Values are hex, or TokenRef to a kit CSS variable that resolve() turns into a color at render.
// Contrast figures are WCAG ratios against that theme's --bg-surface (tokens.snapshot.ts); palette.test.ts enforces ≥ 3:1.

import { BATLOW, BLUES, BR_BG, RD_BU, TOL_BRIGHT, YL_GN_BU, YL_OR_RD, colorAt, reversed, sample } from './ramps'
import { hexToRgb } from './contrast'

export type Theme = 'dark' | 'light' | 'high-contrast'
export const THEMES: readonly Theme[] = ['dark', 'light', 'high-contrast']

/** A kit CSS variable, optionally with an alpha (0–1) applied after lookup. */
export interface TokenRef {
  token: string
  alpha?: number
}
/** A concrete "#rrggbb"/"rgba(…)" string or a kit token reference. */
export type ColorOrToken = string | TokenRef

/**
 * Concrete CSS color for `c`. Strings pass through. Tokens are looked up with `getVar`
 * (the UI passes a getComputedStyle reader); alpha applies only when the value is #rgb/#rrggbb.
 */
export function resolve(c: ColorOrToken, getVar: (name: string) => string): string {
  if (typeof c === 'string') return c
  const v = getVar(c.token).trim()
  return c.alpha == null || !/^#([0-9a-f]{3}){1,2}$/i.test(v) ? v : withAlpha(v, c.alpha)
}

/** "#rgb"/"#rrggbb" + alpha (0–1) → "rgba(r,g,b,a)". */
export function withAlpha(hex: string, alpha: number): string {
  const full = hex.length === 4 ? '#' + [...hex.slice(1)].map((ch) => ch + ch).join('') : hex
  return `rgba(${hexToRgb(full).join(',')},${alpha})`
}

// Neutral grey for "no class"/"plain" markers. light 4.54, dark 4.46, HC 10.9.
const GREY: Record<Theme, string> = { light: '#767676', dark: '#8a8a8a', 'high-contrast': '#bbbbbb' }

/* ------------------------------------------------------------------ networks */

export type NetworkName = 'HydroMet' | 'AgriMet' | 'Cooperator'
/** Marker form; shape is the non-color channel that survives grayscale (HOUSE-STYLE §6). */
export type NetworkShape = 'circle' | 'circle-hollow' | 'ring'

export const NETWORK_SHAPE: Record<NetworkName, NetworkShape> = {
  HydroMet: 'circle',
  AgriMet: 'circle-hollow',
  Cooperator: 'ring',
}

// Tol bright blue / vibrant orange / vibrant teal. HydroMet light 4.70 dark 3.28 HC 4.46;
// Cooperator 3.55 / 4.34 / 5.91. AgriMet #EE7733 is 2.87 on white, so light darkens it.
export const NETWORK_COLOR: Record<Theme, Record<NetworkName, string>> = {
  light: { HydroMet: '#4477AA', AgriMet: '#CC6622' /* 3.82 */, Cooperator: '#009988' },
  dark: { HydroMet: '#4477AA', AgriMet: '#EE7733' /* 5.37 */, Cooperator: '#009988' },
  'high-contrast': { HydroMet: '#4477AA', AgriMet: '#EE7733' /* 7.32 */, Cooperator: '#009988' },
}

/** Selected-station ring: the kit's selection token in every theme. */
export const SELECTION_RING: TokenRef = { token: '--selection-ring' }

/* ------------------------------------------------------------- variable lines */

type Family = 'temperature' | 'moisture' | 'radiation' | 'wind' | 'pressure' | 'precipRate'

// Light = Tol muted, dark = Tol bright, HC = Tol high-contrast; a hue that misses 3:1
// is replaced by the nearest same-family hue that passes (ratio noted).
const FAMILY_COLOR: Record<Theme, Record<Family, string>> = {
  light: {
    temperature: '#CC6677', // muted rose 3.66
    moisture: '#3388BB', // muted cyan #88CCEE is 1.76; darkened 3.90
    radiation: '#998833', // muted sand #DDCC77 is 1.62; darkened 3.54
    wind: '#117733', // muted green 5.66
    pressure: '#AA4499', // muted purple 5.26
    precipRate: '#332288', // muted indigo 12.2
  },
  dark: {
    temperature: '#EE6677', // bright red 4.99
    moisture: '#66CCEE', // bright cyan 8.39
    radiation: '#CCBB44', // bright yellow 7.90
    wind: '#228833', // bright green 3.40
    pressure: '#CC66AA', // bright purple #AA3377 is 2.53; lightened 4.44
    precipRate: '#8877DD', // indigo (no Tol bright indigo) 4.21
  },
  'high-contrast': {
    temperature: '#BB5566', // HC red 4.60
    moisture: '#6699CC', // HC blue #004488 is 2.18; Tol medium-contrast light blue 6.99
    radiation: '#DDAA33', // HC yellow 9.87
    wind: '#228833', // no HC green; Tol bright green 4.64
    pressure: '#CC66AA', // no HC purple; 6.05
    precipRate: '#9988EE', // no HC indigo; 7.11
  },
}

// Keyed by the dashboard's display variable names (legacy COLOR_MAPPER).
// Soil Temperature / Soil VWC / Bulk EC use depthColor(); Precipitation uses PRECIP.
const VARIABLE_FAMILY: Record<string, Family> = {
  'Air Temperature': 'temperature',
  'Well Water Temperature': 'temperature',
  'Relative Humidity': 'moisture',
  VPD: 'moisture',
  'Well Water Level': 'moisture',
  'Well EC': 'moisture',
  'Solar Radiation': 'radiation',
  'Wind Speed': 'wind',
  'Gust Speed': 'wind',
  'Wind Direction': 'wind',
  'Atmospheric Pressure': 'pressure',
  'Snow Depth': 'pressure',
  'Max Precip Rate': 'precipRate',
}
const DASHED = new Set(['Gust Speed'])

/** Names variableStyle() colors (for tests and legends). */
export const STYLED_VARIABLES: readonly string[] = Object.keys(VARIABLE_FAMILY)

export interface LineStyle {
  color: string
  dash?: 'dashed'
}

/** Line style for a display variable name; null when that variable is colored by another role (depths, precip bars) or unknown. */
export function variableStyle(variable: string, theme: Theme): LineStyle | null {
  const family = VARIABLE_FAMILY[variable]
  if (!family) return null
  const color = FAMILY_COLOR[theme][family]
  return DASHED.has(variable) ? { color, dash: 'dashed' } : { color }
}

/* ------------------------------------------------------ precip / ETr / GDD */

export interface BarLine {
  bar: string
  cumulative: string
}

// Blues. light bar 5.13 / cum 12.8; dark 6.35 / 10.9; HC 12.0 / 17.3.
export const PRECIP: Record<Theme, BarLine> = {
  light: { bar: BLUES[6], cumulative: BLUES[8] },
  dark: { bar: BLUES[4], cumulative: BLUES[2] },
  'high-contrast': { bar: BLUES[3], cumulative: BLUES[1] },
}

/**
 * The running total over the Ag tools' daily bars (reference ET, GDD): the text color, so it reads
 * over bars of any hue (a same-ramp line vanished where it crossed the bars). light 17.1, dark 13.0,
 * HC 21.0 on the surface.
 */
export const CUMULATIVE_LINE: TokenRef = { token: '--text-primary' }

// BrBG teal bars in every theme: water going back to the air, a calm hue that stays apart from
// precipitation's Blues (YlOrRd red read as an alarm; the lighter #80cdc1 neared the HC rain bars).
// The running total is CUMULATIVE_LINE. light 3.51, dark 4.39, HC 5.97.
export const ETR: Record<Theme, { bar: string }> = {
  light: { bar: BR_BG[8] },
  dark: { bar: BR_BG[8] },
  'high-contrast': { bar: BR_BG[8] },
}

// YlOrRd bars when there is no stage table (light 3.35, dark 8.58, HC 11.7); the running total and
// its projection are CUMULATIVE_LINE, the projection band that color at `bandAlpha` (a fill).
export const GDD: Record<Theme, { bar: string; bandAlpha: number }> = {
  light: { bar: YL_OR_RD[5], bandAlpha: 0.15 },
  dark: { bar: YL_OR_RD[3], bandAlpha: 0.2 },
  'high-contrast': { bar: YL_OR_RD[3], bandAlpha: 0.25 },
}
/**
 * n growth-stage colors for the GDD chart, first stage → last (batlow, the house sequential:
 * development reads as one ordered ramp). Index 0 is "before the first stage". Same span as
 * binColors, so each clears 3:1 on the surface.
 */
export function gddStageColors(n: number, theme: Theme): string[] {
  return batlowSamples(n, theme)
}
/** GDD growth-stage markLines (labelled with the stage name). */
export const GDD_STAGE_LINE: TokenRef = { token: '--text-dim' }

/** Line under the colored markers of the feels-like and CCI charts. */
export const INDEX_LINE: TokenRef = { token: '--text-dim' }

/** The feels-like line (the plotted quantity; the air temperature beside it is INDEX_LINE, dashed). Same contrast as CUMULATIVE_LINE. */
export const FEELS_LIKE_LINE: TokenRef = { token: '--text-primary' }

/* ------------------------------------------------------------ CCI classes */

/** Livestock CCI classes, mild → worst (No Stress is the grey class). */
export const CCI_CLASSES = ['No Stress', 'Mild', 'Moderate', 'Severe', 'Extreme', 'Extreme Danger'] as const
export type CciClass = (typeof CCI_CLASSES)[number]
/** Which end of the index a stress class is at. */
export type StressSide = 'cold' | 'heat'

// Cold stress is the blue half of RdBu, heat stress the red half, each run light → dark from
// Mild to Extreme Danger (5 OKLab samples); No Stress is grey. The span is the part of each half
// that clears 3:1 on the surface, as wide as it can be so neighbouring classes stay apart:
// light 0.6–1 (cold ≥3.39, heat ≥3.72); dark 0.2–0.7 (cold ≥3.46, heat ≥3.06; 0.3–0.7 left Mild
// and Moderate near-identical); HC 0.3–0.8 (cold ≥3.56, heat ≥3.06; from 0.2 Mild cold read grey).
// Dark and HC skip the near-white end, so the mild classes keep their hue and mild cold stays
// apart from mild heat.
const RD_BU_COLD = RD_BU.slice(5)
const RD_BU_HEAT = reversed(RD_BU.slice(0, 6))
const STRESS_SPAN: Record<Theme, [number, number]> = { light: [0.6, 1], dark: [0.2, 0.7], 'high-contrast': [0.3, 0.8] }

/**
 * Marker for a CCI class on the cold or heat side: blues for cold, reds for heat, grey for No
 * Stress. Shape is the second channel, as on the feels-like chart: cold ◆, heat ▲, none ●.
 */
export function cciStyle(cls: CciClass, side: StressSide, theme: Theme): MarkerStyle {
  if (cls === 'No Stress') return { color: GREY[theme], symbol: 'circle' }
  const [from, to] = STRESS_SPAN[theme]
  const ramp = side === 'cold' ? RD_BU_COLD : RD_BU_HEAT
  return { color: sample(ramp, 5, { from, to })[CCI_CLASSES.indexOf(cls) - 1], symbol: side === 'cold' ? 'diamond' : 'triangle' }
}

/* -------------------------------------------------------------- feels-like */

export type FeelsLikeRegime = 'wind_chill' | 'heat_index' | 'air_temp'
export interface MarkerStyle {
  color: string
  /** ECharts symbol name: the second channel next to color. */
  symbol: 'circle' | 'triangle' | 'diamond'
}

// RdBu blue/red; dark and HC step toward the ramp's light end to clear 3:1.
export const FEELS_LIKE: Record<Theme, Record<FeelsLikeRegime, MarkerStyle>> = {
  light: {
    wind_chill: { color: '#2166ac', symbol: 'diamond' }, // 5.90
    heat_index: { color: '#b2182b', symbol: 'triangle' }, // 6.87
    air_temp: { color: GREY.light, symbol: 'circle' },
  },
  dark: {
    wind_chill: { color: '#4393c3', symbol: 'diamond' }, // #2166ac is 2.61; 4.55
    heat_index: { color: '#d6604d', symbol: 'triangle' }, // #b2182b is 2.24; 4.14
    air_temp: { color: GREY.dark, symbol: 'circle' },
  },
  'high-contrast': {
    wind_chill: { color: '#92c5de', symbol: 'diamond' }, // 11.3
    heat_index: { color: '#f4a582', symbol: 'triangle' }, // 10.6
    air_temp: { color: GREY['high-contrast'], symbol: 'circle' },
  },
}

/* ----------------------------------------------- batlow: depths, bins, years */

// Part of batlow that clears 3:1 on each surface (batlow is lightness-monotonic, so
// light themes keep the dark end and dark themes the light end).
// light 0–0.55 (≥3.52), dark 0.45–1 (≥3.38), HC 0.35–1 (≥3.65).
const BATLOW_SPAN: Record<Theme, [number, number]> = { light: [0, 0.55], dark: [0.45, 1], 'high-contrast': [0.35, 1] }

// Mesonet soil sensor depths (in) and their place in the depth order: the five depths most stations
// carry (2, 4, 8, 20, 40) are steps 0–4; 28 and 36 sit between 20 and 40.
const SOIL_DEPTHS_IN = [2, 4, 8, 20, 28, 36, 40]
const DEPTH_STEP = [0, 1, 2, 3, 10 / 3, 11 / 3, 4]

// Batlow position of each step, per theme: the spacing that keeps the closest neighbours furthest
// apart (OKLab) inside the part of batlow that clears 3:1. light 0–0.6 (≥3.08), dark 0.41–1 (≥3.07),
// HC 0.28–1 (≥3.08). That best is still only 0.11–0.13 OKLab between neighbours (0.137 in HC): batlow
// can't do better at 3:1, so neighbours also differ in dash (depthStyle).
const DEPTH_T: Record<Theme, readonly number[]> = {
  light: [0, 0.12, 0.29, 0.45, 0.6], // navy, blue-teal, teal, olive, ochre
  dark: [0.41, 0.56, 0.7, 0.85, 1], // olive, ochre, orange, salmon, pink
  'high-contrast': [0.28, 0.47, 0.64, 0.81, 1], // teal, olive, ochre, salmon, pink
}

/** A depth's fractional step (see DEPTH_STEP): 1 in → 0, 4 in → 1, 30 in → 3.5, ≥ 40 in → 4. */
function depthStep(depthInches: number): number {
  const d = SOIL_DEPTHS_IN
  if (depthInches >= d[d.length - 1]) return DEPTH_STEP[d.length - 1]
  if (depthInches <= d[0]) return 0
  const i = d.findIndex((x) => x >= depthInches)
  return DEPTH_STEP[i - 1] + ((DEPTH_STEP[i] - DEPTH_STEP[i - 1]) * (depthInches - d[i - 1])) / (d[i] - d[i - 1])
}

/**
 * Line color for a soil depth in inches (cm callers divide by 2.54). Depends only on depth and theme,
 * so a depth keeps its color whichever other depths are present. Shallow → batlow start; ≥ 40 in → end.
 */
export function depthColor(depthInches: number, theme: Theme): string {
  const s = depthStep(depthInches)
  const t = DEPTH_T[theme]
  const i = Math.min(t.length - 2, Math.floor(s))
  return colorAt(BATLOW, t[i] + (t[i + 1] - t[i]) * (s - i))
}

/**
 * Line style for a soil depth: depthColor, dashed at every other sensor depth (4, 20, 36 in; other
 * depths follow the nearest), so neighbouring depths differ in dash as well as in color.
 */
export function depthStyle(depthInches: number, theme: Theme): LineStyle {
  const color = depthColor(depthInches, theme)
  const near = SOIL_DEPTHS_IN.reduce((a, b) => (Math.abs(b - depthInches) < Math.abs(a - depthInches) ? b : a))
  return SOIL_DEPTHS_IN.indexOf(near) % 2 === 1 ? { color, dash: 'dashed' } : { color }
}

function batlowSamples(n: number, theme: Theme): string[] {
  const [from, to] = BATLOW_SPAN[theme]
  return sample(BATLOW, n, { from, to })
}

/** n wind-rose speed-bin colors, slowest → fastest. */
export function binColors(n: number, theme: Theme): string[] {
  return batlowSamples(n, theme)
}

// Last year and the year before in batlow, picked to sit furthest (OKLab ≥ 0.14) from each other, from
// the current year (ANNUAL_CURRENT, the text color) and from the greys: light ochre 3.24 / blue-teal
// 10.4; dark orange 5.92 / salmon 8.88; HC ochre 5.96 / teal 3.17. (A batlow ramp over every year left
// neighbouring years ~0.03 apart, and dark's newest was the near-white of the current year.)
const RECENT_YEAR_T: Record<Theme, readonly [number, number]> = { light: [0.58, 0.13], dark: [0.67, 0.86], 'high-contrast': [0.55, 0.29] }
// Older years fade from GREY (three years back) toward the surface, oldest faintest: light
// #8f8f8f 3.23, dark #6c7380 3.23, HC #7a7a7a 4.89 (fainter neared the dim teal of the year before).
const OLD_YEAR_FADE: Record<Theme, string> = { light: '#8f8f8f', dark: '#6c7380', 'high-contrast': '#7a7a7a' }

/**
 * n colors for past years in the annual chart, oldest → newest. The current year uses ANNUAL_CURRENT;
 * last year and the year before get their own colors; older years are muted greys, fainter with age.
 */
export function yearColors(n: number, theme: Theme): string[] {
  const recent = RECENT_YEAR_T[theme].slice(0, n).map((t) => colorAt(BATLOW, t))
  const old = n - recent.length
  const greys = old === 1 ? [GREY[theme]] : sample([OLD_YEAR_FADE[theme], GREY[theme]], old)
  return [...greys, ...recent.reverse()]
}
/** Current-year line in the annual chart. */
export const ANNUAL_CURRENT: { color: TokenRef; width: number } = { color: { token: '--text-primary' }, width: 3 }

/* ---------------------------------------------------------------- heatmaps */

export type HeatmapVar = 'soil_temp' | 'soil_vwc' | 'soil_blk_ec' | 'swp' | 'percent_saturation'
export interface HeatmapScale {
  /** Stops, low value → high value (already reversed where needed). */
  colors: readonly string[]
  /** Value the neutral stop marks; diverging ramps must label it. */
  midpoint?: number
  /** Text for the midpoint on the color bar (HOUSE-STYLE §6). */
  midpointLabel?: string
}

// Theme-independent: cells are opaque fills, so surface contrast does not apply.
export const HEATMAP: Record<HeatmapVar, HeatmapScale> = {
  soil_temp: { colors: reversed(RD_BU), midpoint: 32, midpointLabel: 'Freezing (32 °F)' },
  soil_vwc: { colors: YL_GN_BU },
  soil_blk_ec: { colors: BATLOW }, // no house rule; the default sequential
  // Bar magnitude, drier = higher = brown. Midpoint at the wilting point (user decision 2026-10-01).
  swp: { colors: reversed(BR_BG), midpoint: 15, midpointLabel: 'Wilting point (15 bar)' },
  percent_saturation: { colors: BLUES },
}

/** Frozen-soil cells: flat grey plus a hatch decal so the mask reads without color. */
export const FROZEN: Record<Theme, { color: string; hatch: true }> = {
  light: { color: '#d9d9d9', hatch: true },
  dark: { color: '#4a5160', hatch: true },
  'high-contrast': { color: '#5a5a5a', hatch: true },
}

/* --------------------------------------------------- reference overlays */

/** Climate normals: q25–q75 band plus dashed median; precip/ETr normal markers use `line`. */
export const NORMALS = {
  band: { token: '--text-dim', alpha: 0.18 } as TokenRef,
  line: { token: '--text-dim' } as TokenRef,
  dash: 'dashed' as const,
}

/**
 * The variable page's Daily interval: the daily low–high band behind the mean line, in the line's own
 * color at this alpha (`withAlpha`). A fill, not a mark: the mean line, the tooltip and the table carry
 * the values, so it needs no 3:1 against the surface (WCAG 1.4.11 applies to the line).
 */
export const DAILY_RANGE = { alpha: 0.22, label: 'Daily low–high' } as const

/** Sensor-change overlay: hatched grey area with a text label. */
export const SENSOR_EVENT = {
  fill: { token: '--text-dim', alpha: 0.25 } as TokenRef,
  hatch: true as const,
  label: 'Sensor change',
}

/**
 * Now hero 48 h strip: the observed area fill (this alpha on the air
 * temperature line color; decorative, so no contrast floor) and the "now"
 * rule (`--text-dim`, the same neutral as the other reference lines).
 */
export const HERO_STRIP = {
  areaAlpha: 0.15,
  nowRule: { token: '--text-dim' } as TokenRef,
}

/** SWP field-capacity / wilting-point bands and their dashed boundary lines. */
export const SWP_BANDS = {
  fill: { token: '--text-dim', alpha: 0.12 } as TokenRef,
  line: { token: '--text-dim' } as TokenRef,
  dash: 'dashed' as const,
  labels: { fieldCapacity: 'Field capacity', wiltingPoint: 'Wilting point' },
}

/* ------------------------------------------------------- downloader preview */

// Tol bright in Tol's order, keeping only hues that clear 3:1 on the surface.
// light drops cyan/yellow/grey (<2); dark drops purple (2.53); HC keeps all.
const PREVIEW: Record<Theme, readonly string[]> = {
  light: ['#4477AA', '#228833', '#EE6677', '#AA3377'],
  dark: ['#4477AA', '#66CCEE', '#228833', '#CCBB44', '#EE6677', '#BBBBBB'],
  'high-contrast': TOL_BRIGHT,
}

/** Line color for the i-th (0-based) downloader preview series, cycling. */
export function previewColor(i: number, theme: Theme): string {
  const list = PREVIEW[theme]
  return list[((i % list.length) + list.length) % list.length]
}
