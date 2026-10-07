import { describe, expect, it } from 'vitest'
import type { Station, StationElement } from '../../api'
import { readUrlState } from '../../url-schema'
import { agKeys, forecastNeedsRetry } from './keys'
import {
  annualElement,
  annualOptions,
  chartState,
  showsOptions,
  hasAllYears,
  cropPatch,
  cutoffSummary,
  dateWindow,
  pickOne,
  resolveAgTab,
  sliderPatch,
  sliderValue,
  urlFixups,
  variableGroup,
  variablePatch,
} from './tab'

const TODAY = '2026-10-01'
const st = (station: string, name: string, has_swp: boolean, nwsli: string | null = null) =>
  ({ station, name, sub_network: 'HydroMet', has_swp, nwsli_id: nwsli }) as Station
const BOZ = st('acebozem', 'Bozeman', true, 'BZMM8')
const CROW = st('acecrowa', 'Crow Agency', false)
const url = (q: string) => readUrlState(q)

describe('resolveAgTab', () => {
  it('defaults: no tool open (GDD behind it), wheat, daily, the crop season; other tools the last 365 days', () => {
    const t = resolveAgTab(url(''), BOZ, TODAY)
    expect(resolveAgTab(url('?v=etr'), BOZ, TODAY)).toMatchObject({ open: true, start: '2025-10-01', end: TODAY })
    expect(t).toMatchObject({ open: false, variable: 'gdd', crop: 'wheat', period: 'daily', start: '2026-04-15', end: '2026-09-30', soilVar: 'soil_vwc' })
    expect(resolveAgTab(url('?v=gdd&crop=corn'), BOZ, TODAY)).toMatchObject({ start: '2026-05-01', end: TODAY })
    expect(resolveAgTab(url('?v=gdd&ag_from=2026-06-01'), BOZ, TODAY)).toMatchObject({ start: '2026-06-01', end: '2026-09-30' })
    expect(resolveAgTab(url('?v=gdd&ag_from=2026-10-01'), BOZ, TODAY)).toMatchObject({ start: TODAY, end: TODAY })
    expect(t.cut.custom).toBe(false)
  })
  it('a non-Ag v and an unknown crop fall back; time agg only for etr/feels/cci/swp/ps', () => {
    expect(resolveAgTab(url('?v=air_temp&crop=rice'), BOZ, TODAY)).toMatchObject({ variable: 'gdd', crop: 'wheat' })
    expect(resolveAgTab(url('?v=gdd&ag_time=hourly'), BOZ, TODAY).period).toBe('daily')
    expect(resolveAgTab(url('?v=etr&ag_time=hourly'), BOZ, TODAY).period).toBe('hourly')
    expect(resolveAgTab(url('?v=swp&ag_time=hourly'), BOZ, TODAY)).toMatchObject({ period: 'hourly', swpOnly: true })
  })
  it('SWP / saturation chips only at has_swp stations', () => {
    const q = url('?v=soil_temp,soil_ec_blk&soilv=swp')
    expect(resolveAgTab(q, BOZ, TODAY).soilVar).toBe('swp')
    const crow = resolveAgTab(q, CROW, TODAY)
    expect(crow.soilVar).toBe('soil_vwc')
    expect(crow.soilOptions.map((o) => o.value)).toEqual(['soil_blk_ec', 'soil_vwc', 'soil_temp'])
  })
  it('date window: explicit dates kept, inverted ones collapse to the end', () => {
    expect(dateWindow('2026-05-01', '2026-06-01', TODAY)).toEqual({ start: '2026-05-01', end: '2026-06-01' })
    expect(dateWindow('2026-07-01', '2026-06-01', TODAY)).toEqual({ start: '2026-06-01', end: '2026-06-01' })
  })
})

describe('patches', () => {
  it('a variable change resets crop, cutoffs, time agg and soil var', () => {
    expect(variablePatch('etr')).toEqual({ v: 'etr', view: 'recent', tbl: false, cmp: false, crop: 'wheat', gdd_lo: null, gdd_hi: null, ag_time: 'daily', soilv: 'soil_vwc' })
    expect(cropPatch('corn')).toEqual({ crop: 'corn', gdd_lo: null, gdd_hi: null })
  })
  it('slider: crop cutoffs ↔ value; only a moved thumb is written; open cap = null', () => {
    const wheat = resolveAgTab(url(''), BOZ, TODAY)
    expect(sliderValue(wheat)).toEqual({ low: 32, high: 70 })
    expect(sliderPatch(wheat, { low: 40, high: 70 })).toEqual({ gdd_lo: '40' })
    expect(sliderPatch(wheat, { low: 32, high: null })).toEqual({ gdd_hi: 'none' })
    const sunflower = resolveAgTab(url('?crop=sunflower'), BOZ, TODAY)
    expect(sliderValue(sunflower)).toEqual({ low: 44, high: null })
    expect(sliderPatch(sunflower, { low: 45, high: null })).toEqual({ gdd_lo: '45' })
  })
  it('cutoff summary names NDAWN for wheat and says custom cutoffs drop stages', () => {
    expect(cutoffSummary(resolveAgTab(url(''), BOZ, TODAY))).toBe(
      'Wheat cutoffs: 32 °F to 70 °F, switching to 95 °F at Haun stage 2 (NDAWN). Move the slider for custom cutoffs.',
    )
    expect(cutoffSummary(resolveAgTab(url('?crop=hemp'), BOZ, TODAY))).toBe(
      'Hemp cutoffs: 32 °F to no upper cutoff. Move the slider for custom cutoffs.',
    )
    expect(cutoffSummary(resolveAgTab(url('?crop=corn&gdd_lo=45'), BOZ, TODAY))).toBe(
      'Custom cutoffs: 45 °F to 86 °F. Growth-stage labels are not shown.',
    )
  })
})

describe('annual options', () => {
  it('annual: unique elements, US-unit labels, natural sort', () => {
    const els = [
      { element: 'soil_vwc_1000', description_short: 'Soil VWC @ -100 cm' },
      { element: 'soil_vwc_0010', description_short: 'Soil VWC @ -10 cm' },
      { element: 'soil_vwc_0010', description_short: 'Soil VWC @ -10 cm' },
      { element: 'air_temp_0200', description_short: 'Air Temperature @ 2 m' },
    ] as StationElement[]
    expect(annualOptions(els)).toEqual([
      { value: 'air_temp_0200', label: 'Air temperature at 6.6 ft' },
      { value: 'soil_vwc_0010', label: 'Soil moisture at 4 in' },
      { value: 'soil_vwc_1000', label: 'Soil moisture at 40 in' },
    ])
  })
})

describe('urlFixups', () => {
  it('strips legacy cutoff pairs on GDD only', () => {
    const q = url('?v=gdd&crop=wheat&gdd_lo=32&gdd_hi=95')
    expect(urlFixups(resolveAgTab(q, BOZ, TODAY), q, true, null)).toEqual({ gdd_lo: null, gdd_hi: null })
    const e = url('?v=etr&gdd_lo=32&gdd_hi=95')
    expect(urlFixups(resolveAgTab(e, BOZ, TODAY), e, true, null)).toBeNull()
  })
  it('falls back to VWC once the station is known; Annual defaults to the first element', () => {
    const q = url('?v=soil_temp,soil_ec_blk&soilv=swp')
    expect(urlFixups(resolveAgTab(q, CROW, TODAY), q, true, null)).toEqual({ soilv: 'soil_vwc' })
    expect(urlFixups(resolveAgTab(q, undefined, TODAY), q, false, null)).toBeNull()
    const a = url('?v=annual&annv=gone')
    expect(urlFixups(resolveAgTab(a, BOZ, TODAY), a, true, [{ value: 'air_temp' }])).toEqual({ annv: 'air_temp' })
    expect(urlFixups(resolveAgTab(a, BOZ, TODAY), a, true, [])).toBeNull()
  })
})

describe('cache keys', () => {
  it('encode every fetcher input', () => {
    const q = { station: 'acebozem', start: '2026-09-01', end: '2026-10-01' }
    expect(agKeys.dailyMet(q)).toBe('ag:dailyMet:acebozem:2026-09-01:2026-10-01:L2')
    expect(agKeys.soil(q, 'hourly')).toBe('ag:soil:hourly:acebozem:2026-09-01:2026-10-01:L2')
    expect(agKeys.annual('acebozem', 'ppt', 2024)).toBe('ag:annual:acebozem:ppt:L2:2024')
    expect(agKeys.forecast(45.66, -111.05)).toBe('ag:forecast:45.6600:-111.0500')
  })
  it('a degraded forecast is retried after 5 minutes', () => {
    expect(forecastNeedsRetry(true, 0, 299_999)).toBe(false)
    expect(forecastNeedsRetry(true, 0, 300_000)).toBe(true)
    expect(forecastNeedsRetry(false, 0, 1e9)).toBe(false)
  })
})

it('pickOne: chips as a single choice', () => {
  expect(pickOne(['wheat', 'corn'], 'wheat')).toBe('corn')
  expect(pickOne([], 'wheat')).toBe('wheat')
})

it('hasAllYears: Reference ET only', () => {
  expect(hasAllYears('etr')).toBe(true)
  expect(hasAllYears('gdd')).toBe(false)
})

it('variableGroup + chartState', () => {
  const vars = ['etr', 'feels_like', 'cci', 'gdd', 'soil_temp,soil_ec_blk', 'swp', 'percent_saturation', 'annual'] as const
  expect(vars.map((v) => variableGroup(v))).toEqual(['met', 'met', 'met', 'gdd', 'soil', 'soil', 'soil', 'annual'])
  const swp = { swpOnly: true, hasSwp: false }
  expect(chartState(swp, 'acecrowa', null, false)).toBe('loading-stations')
  expect(chartState(swp, 'acecrowa', 'acecrowa', true)).toBe('not-here')
  expect(chartState({ swpOnly: false, hasSwp: false }, 'acecrowa', 'acecrowa', true)).toBe('chart')
  expect(chartState({ swpOnly: false, hasSwp: false }, null, null, true)).toBe('no-station')
  expect((['chart', 'loading-stations', 'no-station', 'not-here'] as const).map(showsOptions)).toEqual([true, true, false, false])
})

it('annualElement: waits for the list; a stale annv falls to the first option', () => {
  expect(annualElement('ppt', null)).toBeNull()
  expect(annualElement('ppt', [{ value: 'air_temp' }])).toBe('air_temp')
  expect(annualElement('ppt', [{ value: 'air_temp' }, { value: 'ppt' }])).toBe('ppt')
  expect(annualElement(null, [{ value: 'ppt' }])).toBe('ppt')
  expect(annualElement('ppt', [])).toBeNull()
})

it('date range hidden for Annual only', () => {
  expect(resolveAgTab(url('?v=annual'), BOZ, TODAY).showDates).toBe(false)
  expect(resolveAgTab(url('?v=etr'), BOZ, TODAY).showDates).toBe(true)
})
