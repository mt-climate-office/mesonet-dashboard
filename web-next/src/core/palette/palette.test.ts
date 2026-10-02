// Palette invariants: valid hexes, ramp shapes, sample() behaviour, depth stability,
// and ≥ 3:1 contrast of every line/marker role against each theme's --bg-surface.

import { describe, expect, it } from 'vitest'
import * as ramps from './ramps'
import { colorAt, sample, toOklab } from './ramps'
import {
  ANNUAL_CURRENT,
  CCI_CLASSES,
  ETR,
  FEELS_LIKE,
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
  cciColor,
  depthColor,
  previewColor,
  resolve,
  variableStyle,
  withAlpha,
  yearColors,
} from './roles'
import { contrastRatio, luminance } from './contrast'
import { TOKENS_SNAPSHOT } from './tokens.snapshot'

const HEX = /^#[0-9a-f]{6}$/i
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
  it('deeper is lighter in every theme', () => {
    expect(toOklab(depthColor(40, 'light'))[0]).toBeGreaterThan(toOklab(depthColor(2, 'light'))[0])
    expect(toOklab(depthColor(40, 'dark'))[0]).toBeGreaterThan(toOklab(depthColor(2, 'dark'))[0])
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
  it('variableStyle covers every styled variable; gust is dashed; depth/precip vars are null', () => {
    for (const t of THEMES) for (const v of STYLED_VARIABLES) expect(variableStyle(v, t)?.color).toMatch(HEX)
    expect(variableStyle('Gust Speed', 'light')).toEqual({ ...variableStyle('Wind Speed', 'light'), dash: 'dashed' })
    expect(variableStyle('Soil VWC', 'dark')).toBeNull()
    expect(variableStyle('Precipitation', 'dark')).toBeNull()
  })
  it('cciColor: grey for No Stress, distinct YlOrRd per class', () => {
    for (const t of THEMES) expect(new Set(CCI_CLASSES.map((c) => cciColor(c, t))).size).toBe(6)
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
  for (const [name, r] of Object.entries({ PRECIP, ETR, GDD })) {
    out[`${name} bar`] = r[t].bar
    out[`${name} cumulative`] = r[t].cumulative
  }
  for (const c of CCI_CLASSES) out[`cci ${c}`] = cciColor(c, t)
  for (const [k, v] of Object.entries(FEELS_LIKE[t])) out[`feels ${k}`] = v.color
  for (const d of [2, 4, 8, 20, 28, 36, 40, 3, 15.7]) out[`depth ${d}`] = depthColor(d, t)
  binColors(8, t).forEach((c, i) => (out[`bin ${i}`] = c))
  yearColors(12, t).forEach((c, i) => (out[`year ${i}`] = c))
  for (let i = 0; i < 7; i++) out[`preview ${i}`] = previewColor(i, t)
  out['annual current'] = resolve(ANNUAL_CURRENT.color, get)
  out['gdd stage'] = resolve(GDD_STAGE_LINE, get)
  out['index line'] = resolve(INDEX_LINE, get)
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
