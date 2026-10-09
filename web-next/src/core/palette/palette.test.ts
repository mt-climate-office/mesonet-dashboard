// Palette invariants: valid hexes, ramp shapes, sample() behaviour, depth stability,
// and ≥ 3:1 contrast of every line/marker role against each theme's --bg-surface.

import { describe, expect, it } from 'vitest'
import * as ramps from './ramps'
import { colorAt, sample, toOklab } from './ramps'
import {
  ANNUAL_CURRENT,
  CCI_CLASSES,
  CUMULATIVE_LINE,
  ETR,
  FEELS_LIKE,
  FEELS_LIKE_LINE,
  GDD,
  GDD_STAGE_LINE,
  HEATMAP,
  INDEX_LINE,
  NETWORK_COLOR,
  NORMALS,
  SELECTION_RING,
  STYLED_VARIABLES,
  PRECIP,
  THEMES,
  type Theme,
  binColors,
  cciStyle,
  depthColor,
  depthStyle,
  sensorColor,
  gddStageColors,
  previewColor,
  resolve,
  variableStyle,
  withAlpha,
  yearColors,
} from './roles'
import { contrastRatio, hexToRgb as hexToRgbLocal, luminance } from './contrast'
import { TOKENS_SNAPSHOT } from './tokens.snapshot'

const HEX = /^#[0-9a-f]{6}$/i
/** Euclidean OKLab distance: ~0.1 is a just-clear difference between thin lines. */
const oklabDist = (a: string, b: string) => Math.hypot(...toOklab(a).map((x, i) => x - toOklab(b)[i]))
const RAMPS: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(ramps).filter(([, v]) => Array.isArray(v)),
) as Record<string, readonly string[]>

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(luminance('#ffffff')).toBe(1)
  })
})

describe('ramps', () => {
  it('every stop is a valid hex', () => {
    for (const [name, r] of Object.entries(RAMPS)) for (const c of r) expect(c, name).toMatch(HEX)
  })
  it('has the published lengths and endpoints', () => {
    expect(ramps.BATLOW).toHaveLength(11)
    expect([ramps.BATLOW[0], ramps.BATLOW[10]]).toEqual(['#011959', '#faccfa'])
    expect(ramps.ROMA_O[0]).toBe(ramps.ROMA_O[ramps.ROMA_O.length - 1])
    expect(ramps.RD_BU).toHaveLength(11)
    expect(ramps.BR_BG).toHaveLength(11)
    for (const r of [ramps.YL_GN_BU, ramps.YL_OR_RD, ramps.BLUES, ramps.PU_RD]) expect(r).toHaveLength(9)
    expect([ramps.YL_OR_RD[0], ramps.YL_OR_RD[8]]).toEqual(['#ffffcc', '#800026'])
    expect(ramps.TOL_BRIGHT).toHaveLength(7)
    expect(ramps.TOL_MUTED).toHaveLength(9)
    expect(ramps.TOL_HIGH_CONTRAST).toHaveLength(3)
  })
  it('contains no Spectral', () => {
    expect(Object.keys(ramps).some((k) => /spectral/i.test(k))).toBe(false)
    expect(RAMPS).not.toHaveProperty('SPECTRAL')
  })
})

describe('sample', () => {
  it('returns n colors and hits the requested endpoints', () => {
    expect(sample(ramps.BATLOW, 0)).toEqual([])
    expect(sample(ramps.BATLOW, 1, { from: 0.3 })).toEqual([colorAt(ramps.BATLOW, 0.3)])
    const s = sample(ramps.BATLOW, 5)
    expect(s).toHaveLength(5)
    expect([s[0], s[4]]).toEqual(['#011959', '#faccfa'])
    for (const c of s) expect(c).toMatch(HEX)
  })
  it('is monotone in OKLab lightness along batlow', () => {
    const L = sample(ramps.BATLOW, 64).map((c) => toOklab(c)[0])
    for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1])
  })
})

describe('depthColor', () => {
  it('depends only on depth and theme', () => {
    for (const t of THEMES) {
      expect(depthColor(8, t)).toBe(depthColor(8, t))
      expect(depthColor(20, t)).not.toBe(depthColor(8, t))
      expect(depthColor(50, t)).toBe(depthColor(40, t))
      expect(depthColor(1, t)).toBe(depthColor(2, t))
    }
  })
  it('shallow → deep runs from roma\'s red end to its blue end in every theme', () => {
    for (const t of THEMES) {
      // OKLab b: positive is yellow-red, negative blue.
      expect(toOklab(depthColor(2, t))[2], t).toBeGreaterThan(0)
      expect(toOklab(depthColor(40, t))[2], t).toBeLessThan(0)
    }
  })
  it('the common depths (2, 4, 8, 20, 40 in) stay distinguishable by color alone (lines are solid)', () => {
    // Neighbours at least this far apart in OKLab, from roma's 11 stops (batlow managed 0.11 at 3:1, with dashes to help).
    const floor: Record<string, number> = { light: 0.13, dark: 0.16, 'high-contrast': 0.19 }
    for (const t of THEMES) {
      const c = [2, 4, 8, 20, 40].map((d) => depthColor(d, t))
      for (let i = 1; i < c.length; i++) expect(oklabDist(c[i], c[i - 1]), `${t} ${i}`).toBeGreaterThan(floor[t])
    }
  })
  it('light: a depth between two steps never lands in roma\'s pale middle (≥ 3:1 on white)', () => {
    for (let d = 2; d <= 40; d += 0.5) expect(contrastRatio(depthColor(d, 'light'), '#ffffff'), `${d} in`).toBeGreaterThanOrEqual(3)
  })
  it('depthStyle: depthColor, solid', () => {
    for (const t of THEMES) {
      expect([2, 4, 8, 20, 28, 36, 40].map((d) => depthStyle(d, t))).toEqual([2, 4, 8, 20, 28, 36, 40].map((d) => ({ color: depthColor(d, t) })))
      expect(depthStyle(50, t)).toEqual(depthStyle(40, t))
    }
  })
  it('sensorColor: the depth steps in order, then around again', () => {
    for (const t of THEMES) {
      expect(sensorColor(0, t)).toBe(depthColor(2, t))
      expect(sensorColor(1, t)).toBe(depthColor(4, t))
      expect(sensorColor(5, t)).toBe(sensorColor(0, t))
    }
  })
})

describe('yearColors', () => {
  it('older years fade to grey; last year and the year before stay apart from each other and the current year', () => {
    for (const t of THEMES) {
      const current = resolve(ANNUAL_CURRENT.color, (n) => TOKENS_SNAPSHOT[t][n])
      const y = yearColors(10, t)
      const [prev, last] = y.slice(-2)
      for (const [a, b] of [[last, current], [prev, current], [last, prev]]) expect(oklabDist(a, b), `${t} ${a} ${b}`).toBeGreaterThan(0.14)
      // The year before that (the first grey) is as far from its neighbour; every grey stays clear of both.
      expect(oklabDist(y[7], prev), t).toBeGreaterThan(0.14)
      for (const old of y.slice(0, -2)) {
        expect(oklabDist(old, last), `${t} ${old}`).toBeGreaterThan(0.1)
        expect(oklabDist(old, prev), `${t} ${old}`).toBeGreaterThan(0.1)
        // Muted: OKLab chroma near zero (dark's fade leans to the slate surface).
        const [, a, b] = toOklab(old)
        expect(Math.hypot(a, b), `${t} ${old}`).toBeLessThan(0.03)
      }
      // Oldest faintest: closest to the surface in contrast.
      const bg = TOKENS_SNAPSHOT[t]['--bg-surface']
      for (let i = 1; i < 8; i++) expect(contrastRatio(y[i], bg)).toBeGreaterThan(contrastRatio(y[i - 1], bg))
    }
  })
  it('a year keeps its color by age, whatever the count', () => {
    for (const t of THEMES) {
      expect(yearColors(1, t)).toEqual(yearColors(10, t).slice(-1))
      expect(yearColors(2, t)).toEqual(yearColors(10, t).slice(-2))
      expect(yearColors(0, t)).toEqual([])
    }
  })
})

describe('ETR', () => {
  it('is a calm teal, apart from the precipitation bars', () => {
    for (const t of THEMES) {
      const [, a, b] = toOklab(ETR[t].bar)
      // Hue between green and blue (OKLab a < 0, b ≈ 0): not the red/orange of an alarm.
      expect(a, t).toBeLessThan(0)
      expect(oklabDist(ETR[t].bar, PRECIP[t].bar), t).toBeGreaterThan(0.1)
      expect(Math.abs(b), t).toBeLessThan(0.05)
    }
  })
})

describe('resolve', () => {
  const getVar = (n: string) => ` ${TOKENS_SNAPSHOT.light[n]} `
  it('passes strings through and looks up tokens', () => {
    expect(resolve('#123456', getVar)).toBe('#123456')
    expect(resolve(SELECTION_RING, getVar)).toBe('#1563a0')
    expect(resolve(NORMALS.band, getVar)).toBe('rgba(95,102,117,0.18)')
  })
  it('expands #rgb for alpha', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
  })
})

describe('roles', () => {
  it('variableStyle covers every styled variable, solid; depth/precip vars are null', () => {
    for (const t of THEMES) for (const v of STYLED_VARIABLES) expect(variableStyle(v, t)).toEqual({ color: expect.stringMatching(HEX) })
    expect(variableStyle('Gust Speed', 'light')).toEqual(variableStyle('Wind Speed', 'light'))
    expect(variableStyle('Soil VWC', 'dark')).toBeNull()
    expect(variableStyle('Precipitation', 'dark')).toBeNull()
  })
  it('cciStyle: grey for No Stress, blues for cold, reds for heat, distinct per class', () => {
    for (const t of THEMES) {
      const all = (['cold', 'heat'] as const).flatMap((side) => CCI_CLASSES.map((c) => cciStyle(c, side, t).color))
      expect(new Set(all).size).toBe(11)
      const [r, , b] = hexToRgbLocal(cciStyle('Severe', 'cold', t).color)
      expect(b).toBeGreaterThan(r)
      const [r2, , b2] = hexToRgbLocal(cciStyle('Severe', 'heat', t).color)
      expect(r2).toBeGreaterThan(b2)
    }
    expect(cciStyle('Mild', 'cold', 'light').symbol).toBe('diamond')
    expect(cciStyle('Mild', 'heat', 'light').symbol).toBe('triangle')
  })
  it('heatmap soil temperature is RdBu reversed around 32 °F', () => {
    expect(HEATMAP.soil_temp.midpoint).toBe(32)
    expect(HEATMAP.soil_temp.colors[0]).toBe('#053061')
  })
  it('previewColor cycles', () => {
    expect(previewColor(0, 'light')).toBe(previewColor(4, 'light'))
  })
})

/** Every line/marker/bar color drawn directly on the chart surface, per theme. */
function lineMarkerColors(t: Theme): Record<string, string> {
  const get = (n: string) => TOKENS_SNAPSHOT[t][n]
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(NETWORK_COLOR[t])) out[`network ${k}`] = v
  for (const v of STYLED_VARIABLES) out[`var ${v}`] = variableStyle(v, t)!.color
  for (const [name, r] of Object.entries({ PRECIP, ETR, GDD })) out[`${name} bar`] = r[t].bar
  out['precip cumulative'] = PRECIP[t].cumulative
  out['cumulative line'] = resolve(CUMULATIVE_LINE, get)
  for (const side of ['cold', 'heat'] as const) for (const c of CCI_CLASSES) out[`cci ${side} ${c}`] = cciStyle(c, side, t).color
  for (const [k, v] of Object.entries(FEELS_LIKE[t])) out[`feels ${k}`] = v.color
  for (const d of [2, 4, 8, 20, 28, 36, 40, 3, 15.7]) out[`depth ${d}`] = depthColor(d, t)
  binColors(8, t).forEach((c, i) => (out[`bin ${i}`] = c))
  for (const n of [1, 2, 3, 12]) yearColors(n, t).forEach((c, i) => (out[`year ${i}/${n}`] = c))
  gddStageColors(18, t).forEach((c, i) => (out[`gdd stage ${i}`] = c))
  for (let i = 0; i < 7; i++) out[`preview ${i}`] = previewColor(i, t)
  out['annual current'] = resolve(ANNUAL_CURRENT.color, get)
  out['gdd stage'] = resolve(GDD_STAGE_LINE, get)
  out['index line'] = resolve(INDEX_LINE, get)
  out['feels-like line'] = resolve(FEELS_LIKE_LINE, get)
  out['normals line'] = resolve(NORMALS.line, get)
  out['selection'] = resolve(SELECTION_RING, get)
  return out
}

describe('contrast against --bg-surface (kit 0.7.1 snapshot)', () => {
  for (const t of THEMES) {
    it(`${t}: every line/marker role ≥ 3:1`, () => {
      const bg = TOKENS_SNAPSHOT[t]['--bg-surface']
      const fails = Object.entries(lineMarkerColors(t))
        .map(([role, c]) => [role, c, contrastRatio(c, bg).toFixed(2)])
        .filter(([, , r]) => Number(r) < 3)
      expect(fails).toEqual([])
    })
  }
})

describe('heatmap midpoints', () => {
  it('every diverging heatmap has a labelled midpoint', () => {
    for (const key of ['soil_temp', 'swp'] as const) {
      expect(HEATMAP[key].midpoint, key).toBeTypeOf('number')
      expect(HEATMAP[key].midpointLabel, key).toBeTruthy()
    }
    expect(HEATMAP.swp.midpoint).toBe(15)
  })
})
