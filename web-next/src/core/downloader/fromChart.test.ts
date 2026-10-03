import { describe, expect, it } from 'vitest'
import { readUrlState } from '../url-schema'
import { PREFILL_RESET, agToolElements, fromChart, prefillsFromChart, variableElements } from './fromChart'

const els = [
  { element: 'air_temp_0200', description_short: 'Air Temperature @ 2 m' },
  { element: 'soil_vwc_0005', description_short: 'Soil VWC @ -5 cm' },
  { element: 'soil_vwc_0005', description_short: 'Soil VWC @ -5 cm' },
  { element: 'soil_vwc_0010', description_short: 'Soil VWC @ -10 cm' },
  { element: 'soil_temp_0005', description_short: 'Soil Temperature @ -5 cm' },
  { element: 'ppt', description_short: 'Precipitation' },
  { element: 'ppt_corrected', description_short: 'Precipitation' },
]

describe('PREFILL_RESET', () => {
  it('resets exactly the keys fromChart writes, to their URL defaults', () => {
    const written = fromChart({ elements: ['ppt'], start: '2026-09-01', end: '2026-09-30', interval: 'hourly' })
    expect(Object.keys(PREFILL_RESET).sort()).toEqual(Object.keys(written).sort())
    const defaults = readUrlState('')
    for (const [k, v] of Object.entries(PREFILL_RESET)) expect(defaults[k as keyof typeof defaults]).toEqual(v)
  })
})

describe('fromChart', () => {
  it('writes els, the dates and the period; 5-min downloads hourly', () => {
    expect(fromChart({ elements: ['air_temp_0200'], start: '2026-09-18', end: '2026-10-02', interval: 'hourly' })).toEqual({
      els: ['air_temp_0200'],
      dl_from: '2026-09-18',
      dl_to: '2026-10-02',
      period: 'hourly',
    })
    expect(fromChart({ elements: ['a', 'a'], start: 's', end: 'e', interval: 'raw' })).toMatchObject({ els: ['a'], period: 'hourly' })
    expect(fromChart({ elements: [], start: 's', end: 'e', interval: 'daily' }).period).toBe('daily')
  })
})

describe('variableElements', () => {
  it('every code of the display variable, once; Reference ET is the derived etr', () => {
    expect(variableElements('Soil VWC', els)).toEqual(['soil_vwc_0005', 'soil_vwc_0010'])
    expect(variableElements('Precipitation', els)).toEqual(['ppt'])
    expect(variableElements('Reference ET', els)).toEqual(['etr'])
    expect(variableElements('Snow Depth', els)).toEqual([])
  })
})

describe('agToolElements', () => {
  const o = { soilVar: 'soil_vwc', annualVar: 'ppt' }
  it('derived tools are their own code', () => {
    for (const t of ['etr', 'feels_like', 'cci', 'swp', 'percent_saturation'] as const) expect(agToolElements(t, o, els)).toEqual([t])
  })
  it('GDD is air temperature; the soil profile its sub-variable; Annual its element', () => {
    expect(agToolElements('gdd', o, els)).toEqual(['air_temp_0200'])
    expect(agToolElements('soil_temp,soil_ec_blk', o, els)).toEqual(['soil_vwc_0005', 'soil_vwc_0010'])
    expect(agToolElements('soil_temp,soil_ec_blk', { ...o, soilVar: 'soil_temp' }, els)).toEqual(['soil_temp_0005'])
    expect(agToolElements('soil_temp,soil_ec_blk', { ...o, soilVar: 'swp' }, els)).toEqual(['swp'])
    expect(agToolElements('annual', o, els)).toEqual(['ppt'])
    expect(agToolElements('annual', { ...o, annualVar: null }, els)).toEqual([])
  })
})

describe('prefillsFromChart', () => {
  const at = (q: string) => readUrlState(q)
  it('prefills a URL-opened sheet over a variable page or an Ag tool', () => {
    expect(prefillsFromChart(at('?s=acebozem&v=air_temp&dl=1'))).toBe(true)
    expect(prefillsFromChart(at('?s=acebozem&v=gdd&dl=1'))).toBe(true)
  })
  it('not when the sheet is closed, or over the list or Compare', () => {
    expect(prefillsFromChart(at('?s=acebozem&v=air_temp'))).toBe(false)
    expect(prefillsFromChart(at('?s=acebozem&dl=1'))).toBe(false)
    expect(prefillsFromChart(at('?s=acebozem&v=air_temp&cmp=1&dl=1'))).toBe(false)
  })
  it('keeps whatever an old link (or an earlier prefill) carries', () => {
    expect(prefillsFromChart(at('?v=air_temp&dl=1&els=ppt'))).toBe(false)
    expect(prefillsFromChart(at('?v=air_temp&dl=1&dl_from=2024-01-01'))).toBe(false)
    expect(prefillsFromChart(at('?v=air_temp&dl=1&dl_to=2024-01-31'))).toBe(false)
    expect(prefillsFromChart(at('?v=air_temp&dl=1&period=hourly'))).toBe(false)
  })
})
