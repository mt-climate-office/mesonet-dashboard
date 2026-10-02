import { describe, expect, it } from 'vitest'
import type { DailyNormals } from '../contract'
import type { AnnualDaily } from '../data'
import { parseCsvRaw } from '../data/parse'
import { dailyMet, fixtureText, hourlyMet, soilSeries, stageTable, stationMeta } from '../__tests__/adapters'
import { parseGddCutoffs } from './gddCutoffs'
import { ELEMENTS_ERROR, annualView, annualYears, elementsGate, gate, gddView, metView, soilView, viewAnnouncement, type Loaded } from './results'

const met = dailyMet('acebozem', 'season2025')
const meta = stationMeta('acebozem')
const ok = <T>(data: T): Loaded<T> => ({ status: 'success', data, error: null })
const loading: Loaded<never> = { status: 'loading', data: undefined, error: null }

describe('gate', () => {
  it('loading wins until every resource has data; an error without data shows its message', () => {
    expect(gate([ok(1), loading])?.status).toBe('loading')
    expect(gate([ok(1), { status: 'error', data: undefined, error: new Error('HTTP 500') }])).toMatchObject({ status: 'error', message: 'HTTP 500' })
    expect(gate([ok(1), null, { status: 'loading', data: 2, error: null }])).toBeNull()
  })
})

describe('metView', () => {
  it('ETr daily/hourly, feels-like and CCI models; wind-height note for 8 ft stations', () => {
    expect(metView('etr', 'daily', 'adult', met, meta)).toMatchObject({ status: 'ready', model: { kind: 'etr', model: { period: 'daily' } } })
    expect(metView('etr', 'daily', 'adult', met, undefined).status).toBe('loading')
    const h = metView('feels_like', 'hourly', 'adult', hourlyMet('acebozem', 'jul2025'), undefined)
    expect(h.model?.kind).toBe('feels_like')
    const cci = metView('cci', 'daily', 'newborn', met, undefined)
    expect(cci.model?.kind === 'cci' && cci.model.model.series.livestock).toBe('newborn')
    const ars = metView('feels_like', 'daily', 'adult', dailyMet('arskeogh', 'season2025'), undefined)
    expect(ars.status).toBe('ready')
    const arsEtr = metView('etr', 'daily', 'adult', dailyMet('arskeogh', 'season2025'), stationMeta('arskeogh'))
    if (arsEtr.status === 'ready') expect(arsEtr.notes.join(' ')).toMatch(/Wind measured at 8 ft/)
  })
  it('a wholly missing pyranometer → "Solar radiation unavailable for this period."', () => {
    const v = metView('etr', 'daily', 'adult', dailyMet('arskeogh', 'winter2526'), stationMeta('arskeogh'))
    expect(v).toMatchObject({ status: 'empty', message: 'Solar radiation unavailable for this period.' })
  })
})

describe('gddView', () => {
  const tab = (q: { lo?: string; hi?: string } = {}) => ({
    crop: 'wheat' as const,
    cropLabel: 'Wheat',
    cut: parseGddCutoffs('wheat', q.lo ?? null, q.hi ?? null),
    gddProj: 'season' as const,
  })
  const table = stageTable('wheat')
  it('crop cutoffs: stage table, NDAWN note, stage lines', () => {
    const v = gddView({ tab: tab(), met, table, through: null, normals: undefined, forecast: undefined })
    expect(v.status).toBe('ready')
    expect(v.model).toMatchObject({ stageMode: 'table', cutoffsF: [32, 70] })
    expect(v.model?.stages?.length).toBeGreaterThan(0)
    expect(v.notes.join(' ')).toMatch(/follows NDAWN: 32–70 °F until Haun stage 2, then 32–95 °F/)
    expect(v.notes.join(' ')).toMatch(/projection is shown when the date range ends today/)
  })
  it('custom cutoffs drop stages and say so', () => {
    const v = gddView({ tab: tab({ lo: '40' }), met, table, through: null, normals: undefined, forecast: undefined })
    expect(v.model).toMatchObject({ stageMode: 'custom', cutoffsF: [40, 70], stages: undefined })
    expect(v.notes[0]).toMatch(/^Custom temperature cutoffs/)
  })
  it('projection: normals-only note when NWS is degraded; "no normals" note', () => {
    const last = met.date.at(-1)!
    const normals: DailyNormals = { station: 'acebozem', byMonthDay: {} }
    for (let m = 1; m <= 12; m++)
      for (let d = 1; d <= 31; d++) {
        const q = (x: number) => ({ q25: x - 2, median: x, q75: x + 2 })
        normals.byMonthDay[`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = { tminC: q(2), tmaxC: q(18), prMm: 0, petMm: 2 }
      }
    const through = `${last.slice(0, 4)}-10-31` > last ? `${last.slice(0, 4)}-10-31` : last
    const v = gddView({ tab: tab(), met, table, through, normals, forecast: { status: 'degraded', reason: 'x' } })
    expect(v.notes.join(' ')).toMatch(/NWS forecast unavailable right now/)
    const none = gddView({ tab: tab(), met, table, through, normals: null, forecast: undefined })
    expect(none.notes.join(' ')).toMatch(/No climate normals/)
  })
})

describe('soilView', () => {
  const daily = soilSeries('acebozem', 'daily', 'season2025')
  it('SWP from the API rows; percent saturation from API porosity', () => {
    const swpRows = parseCsvRaw(fixtureText('acebozem.daily.season2025.derived-swp.csv'))
    const s = soilView({ variable: 'swp', soilVar: 'soil_vwc', period: 'daily', soil: daily, swpRows })
    expect(s).toMatchObject({ status: 'ready', model: { kind: 'swp' } })
    expect(soilView({ variable: 'swp', soilVar: 'soil_vwc', period: 'daily', soil: daily }).status).toBe('loading')
    const porosityRows = parseCsvRaw(fixtureText('acebozem.daily.season2025.derived-percent_saturation.csv'))
    const p = soilView({ variable: 'percent_saturation', soilVar: 'soil_vwc', period: 'daily', soil: daily, porosityRows })
    expect(p.model?.kind).toBe('percent_saturation')
    expect(p.notes[0]).toMatch(/API’s soil porosity/)
  })
  it('profile: frozen note in winter; temperature has none', () => {
    const winter = soilSeries('acebozem', 'daily', 'winter2526')
    const vwc = soilView({ variable: 'soil_temp,soil_ec_blk', soilVar: 'soil_vwc', period: 'daily', soil: winter })
    expect(vwc.model?.kind).toBe('profile')
    expect(vwc.notes.join(' ')).toMatch(/Grey cells: frozen soil/)
    const t = soilView({ variable: 'soil_temp,soil_ec_blk', soilVar: 'soil_temp', period: 'daily', soil: winter })
    expect(t.notes).toEqual([])
  })
  it('no soil rows → empty', () => {
    const empty = { ...daily, time: [], epochMs: [], depthsCm: [] }
    expect(soilView({ variable: 'swp', soilVar: 'soil_vwc', period: 'daily', soil: empty }).message).toBe('No soil data for the current selection.')
  })
})

describe('annual', () => {
  it('years from install (or 5 back), newest first', () => {
    expect(annualYears('2023-08-27', 2026)).toEqual([2026, 2025, 2024, 2023])
    expect(annualYears(null, 2026)).toHaveLength(6)
    expect(annualYears(undefined, 2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021])
  })
  it('progressive: draws loaded years while others load; no element → prompt', () => {
    expect(annualView(null, [], [], 2026).message).toBe('Select a comparison variable to continue.')
    const year: AnnualDaily = {
      station: 'acebozem', element: 'air_temp', agg: 'avg', level: 2, source: 'api',
      years: [{ year: 2026, date: ['2026-01-01', '2026-01-02'], value: [0, 1], header: 'Average Air Temperature [°F]' } as never],
    }
    const v = annualView('air_temp', [2026, 2025], [ok(year), loading], 2026)
    expect(v.status).toBe('ready')
    expect(v.notes).toEqual(['Loading 1 of 2 years…'])
    expect(annualView('air_temp', [2026], [loading], 2026).status).toBe('loading')
  })
})

it('announcements', () => {
  expect(viewAnnouncement('Growing Degree Days', { status: 'ready', message: null }, 'Bozeman')).toBe('Growing Degree Days chart updated for Bozeman.')
  expect(viewAnnouncement('Reference ET', { status: 'loading', message: null }, 'Bozeman')).toBeNull()
})

it('elementsGate: loading, failed (with its own message), loaded', () => {
  expect(elementsGate(loading)?.status).toBe('loading')
  expect(elementsGate({ status: 'error', data: undefined, error: new Error('x') })).toMatchObject({ status: 'error', message: ELEMENTS_ERROR })
  expect(elementsGate(ok([]))).toBeNull()
})
