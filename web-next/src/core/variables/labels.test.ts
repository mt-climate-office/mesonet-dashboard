import { describe, expect, it } from 'vitest'
import { ELEM_MAP } from '../params'
import { AG_TOOL_IDS } from '../params/ag'
import { LABELS, compassWord, formatReading, plainName } from './labels'

describe('LABELS', () => {
  it('covers every element family and every Ag tool', () => {
    const ids = [...Object.values(ELEM_MAP).map((l) => l[0]), ...AG_TOOL_IDS]
    expect(ids.filter((id) => !LABELS[id])).toEqual([])
  })
  it('names are sentence case and plain', () => {
    for (const { name } of Object.values(LABELS)) {
      expect(name[0]).toBe(name[0].toUpperCase())
      // After the first word, only acronyms in parentheses or "ET"/"GDD" keep capitals.
      expect(name.slice(1).replace(/\(EC\)|ET\b/g, '')).toBe(name.slice(1).replace(/\(EC\)|ET\b/g, '').toLowerCase())
    }
    expect(LABELS.sol_rad.name).toBe('Sunlight')
    expect(LABELS.rh.name).toBe('Humidity')
    expect(LABELS.ppt.name).toBe('Rain')
    expect(LABELS.soil_ec_blk.name).toBe('Soil salinity (EC)')
  })
  it('plainName falls back to the API name for an unknown element', () => {
    expect(plainName('rh', 'Relative Humidity')).toBe('Humidity')
    expect(plainName('lfwt_0100', 'Leaf Wetness')).toBe('Leaf Wetness')
  })
})

describe('formatReading', () => {
  it('temperature: integer on display, one decimal in tables', () => {
    expect(formatReading('air_temp', 53.96)).toBe('54 °F')
    expect(formatReading('air_temp', 53.96, 'table')).toBe('54.0 °F')
  })
  it('percent and degrees take no space; other units do', () => {
    expect(formatReading('rh', 54.4)).toBe('54%')
    expect(formatReading('wind_dir', 157.2)).toBe('157°')
    expect(formatReading('ppt', 0.05)).toBe('0.05 in')
    expect(formatReading('sol_rad', 0)).toBe('0 W/m²')
  })
  it('groups thousands, never shows -0, dashes a missing value', () => {
    expect(formatReading('gdd', 2412.4)).toBe('2,412 GDD')
    expect(formatReading('air_temp', -0.3)).toBe('0 °F')
    expect(formatReading('air_temp', null)).toBe('—')
    expect(formatReading('air_temp', Number.NaN)).toBe('—')
  })
  it('an unknown id shows the number alone', () => {
    expect(formatReading('lfwt_0100', 3.14159)).toBe('3.14')
  })
})

describe('compassWord', () => {
  it('16-point words, any angle', () => {
    expect(compassWord(0)).toBe('N')
    expect(compassWord(157.5)).toBe('SSE')
    expect(compassWord(359)).toBe('N')
    expect(compassWord(-90)).toBe('W')
    expect(compassWord(450)).toBe('E')
    expect(compassWord(null)).toBe('—')
  })
})
