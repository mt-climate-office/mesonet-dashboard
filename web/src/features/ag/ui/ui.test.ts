import { describe, expect, it } from 'vitest'
import type { SoilSeries } from '../contract'
import { percentSaturation, swp } from '../compute'
import { parseCsvRaw } from '../data/parse'
import { dailyMet, soilParams, soilSeries } from '../__tests__/adapters'
import { annualTraces, coverage, partialNote, profileValues, unavailableMessage } from './derive'
import { LEARN_MORE_BASE, learnMoreUrl } from './learnMore'
import { projectionThrough } from './projection'
import { SWP_SOURCE, swpFromApiRows, swpFromParams } from './swpSource'

describe('learnMoreUrl (legacy slugs, app.py ~686-717)', () => {
  it('maps gdd/soil profile/cci and passes the rest through', () => {
    expect(learnMoreUrl('gdd', 'wheat')).toBe(`${LEARN_MORE_BASE}gdds/#wheat-growing-degree-days`)
    expect(learnMoreUrl('soil_temp,soil_ec_blk', null)).toBe(`${LEARN_MORE_BASE}soil_profile/`)
    expect(learnMoreUrl('cci', null)).toBe(`${LEARN_MORE_BASE}risk/`)
    for (const v of ['etr', 'feels_like', 'swp', 'percent_saturation'])
      expect(learnMoreUrl(v, 'corn')).toBe(`${LEARN_MORE_BASE}${v}/`)
  })
  it('annual links the base page, not ".../ag_tools//"', () => {
    expect(learnMoreUrl('annual', null)).toBe(LEARN_MORE_BASE)
    expect(learnMoreUrl('', null)).toBe(LEARN_MORE_BASE)
  })
})

describe('projectionThrough', () => {
  it('season → Oct 31, falling back to +60 days near/after season end', () => {
    expect(projectionThrough('2026-07-01', 'season', '2026-07-02')).toBe('2026-10-31')
    expect(projectionThrough('2026-10-01', 'season', '2026-10-01')).toBe('2026-10-31')
    expect(projectionThrough('2026-10-20', 'season', '2026-10-20')).toBe('2026-12-19')
    expect(projectionThrough('2026-07-01', '30', '2026-07-01')).toBe('2026-07-31')
    expect(projectionThrough('2026-07-01', '60', '2026-07-01')).toBe('2026-08-30')
  })
  it('off, or a window ending in the past → no projection', () => {
    expect(projectionThrough('2026-07-01', 'off', '2026-07-01')).toBeNull()
    expect(projectionThrough('2026-06-01', 'season', '2026-07-01')).toBeNull()
    expect(projectionThrough(undefined, 'season', '2026-07-01')).toBeNull()
  })
})

describe('SWP source', () => {
  it('defaults to the API until mesonet-db-rds#186', () => {
    expect(SWP_SOURCE).toBe('api')
  })

  it('swpFromApiRows aligns API rows (bar) onto the soil axis (kPa), daily and hourly', () => {
    const axis: SoilSeries = {
      station: 'x',
      level: 2,
      provisional: [false, false, false],
      depthsCm: [5, 10],
      time: ['2026-09-20', '2026-09-21', '2026-09-22'],
      epochMs: [0, 1, 2],
      vwcPct: [[1, 1, 1], [1, 1, 1]],
      tempC: [[1, 1, 1], [1, 1, 1]],
    }
    const rows = parseCsvRaw(
      [
        'station,datetime,Soil Water Potential @ -10 cm [bar],Soil Water Potential @ -5 cm [bar]',
        'x,2026-09-20 00:00:00-06:00,0.449,0.459',
        'x,2026-09-22 00:00:00-06:00,0.46,',
      ].join('\n'),
    )
    const s = swpFromApiRows(rows, axis, 'daily')
    expect(s.depthsCm).toEqual([5, 10])
    expect(s.kPa[0]).toEqual([45.9, null, null])
    expect(s.kPa[1][0]).toBeCloseTo(44.9, 10)
    expect(s.kPa[1][2]).toBeCloseTo(46, 10)
    expect(s.time).toEqual(axis.time)

    const t0 = Date.parse('2026-09-20T06:00:00Z')
    const hourly = { ...axis, time: ['a', 'b', 'c'], epochMs: [t0, t0 + 3_600_000, t0 + 7_200_000] }
    const hrows = parseCsvRaw(
      ['station,datetime,Soil Water Potential @ -5 cm [bar]', 'x,2026-09-20 01:00:00-06:00,0.3'].join('\n'),
    )
    expect(swpFromApiRows(hrows, hourly, 'hourly').kPa[0]).toEqual([null, 30, null])
    expect(swpFromApiRows([], axis, 'daily').depthsCm).toEqual([])
  })

  it('client path is compute swp() and shares the soil axis', () => {
    const soil = soilSeries('acebozem', 'daily', 'season2025')
    const s = swpFromParams(soil, soilParams('acebozem'))
    expect(s).toEqual(swp(soil, soilParams('acebozem')))
    expect(s.time).toEqual(soil.time)
  })
})

describe('coverage', () => {
  it('flags a wholly missing pyranometer and partial gaps', () => {
    const met = dailyMet('acebozem', 'season2025')
    const dead = { ...met, sradWm2: met.sradWm2.map(() => null) }
    const c = coverage(dead, ['temperature', 'solar'])
    expect(unavailableMessage(c)).toBe('Solar radiation unavailable for this period.')
    const partial = { ...met, sradWm2: met.sradWm2.map((v, i) => (i < 3 ? null : v)) }
    const p = coverage(partial, ['solar'])
    expect(unavailableMessage(p)).toBeNull()
    expect(partialNote(p, 'daily', 'ETr')).toBe('solar radiation missing for 3 days: ETr is not computed there.')
    expect(unavailableMessage(coverage({ ...met, date: [] }, ['solar']))).toBe('No data for the current selection.')
  })
})

describe('profileValues (frozen mask)', () => {
  const soil = soilSeries('acebozem', 'daily', 'winter2526')
  const frozenCells = soil.tempC.flat().filter((t) => t != null && t <= 0).length

  it('hides VWC/EC/SWP/saturation where soil ≤ 0 °C; temperature is never masked', () => {
    expect(frozenCells).toBeGreaterThan(0)
    const vwc = profileValues('soil_vwc', soil, {})!
    expect(vwc.anyFrozen).toBe(true)
    soil.tempC.forEach((col, d) =>
      col.forEach((t, i) => {
        if (t != null && t <= 0) expect(vwc.values[d][i]).toBeNull()
        else expect(vwc.values[d][i]).toBe(soil.vwcPct[d][i])
      }),
    )
    const temp = profileValues('soil_temp', soil, {})!
    expect(temp.anyFrozen).toBe(false)
    expect(temp.values[0][0]).toBeCloseTo((soil.tempC[0][0]! * 9) / 5 + 32, 10)
    const params = soilParams('acebozem')
    const s = profileValues('swp', soil, { swp: swp(soil, params) })!
    const p = profileValues('percent_saturation', soil, { pct: percentSaturation(soil, params) })!
    for (const v of [s, p]) {
      v.frozen.forEach((row, d) => row.forEach((f, i) => f && expect(v.values[d][i]).toBeNull()))
    }
    expect(profileValues('swp', soil, {})).toBeNull()
    // No EC requested → all-null (the figure then shows "no data").
    expect(profileValues('soil_blk_ec', soil, {})!.values.flat().every((v) => v === null)).toBe(true)
  })
})

describe('annualTraces', () => {
  const year = (y: number, values: (number | null)[], header: string | null) => ({
    station: 'x',
    element: 'ppt',
    agg: 'sum' as const,
    level: 2 as const,
    source: 'api' as const,
    years: [
      {
        year: y,
        date: values.map((_, i) => `${y}-01-0${i + 1}`),
        value: values,
        provisional: values.map(() => false),
        header,
      },
    ],
  })

  it('precipitation: cumulative inches per year, stopping at the last observed day', () => {
    const a = annualTraces('ppt', [
      year(2026, [25.4, null, 25.4, null, null], 'Total Precipitation [in]'),
      year(2025, [25.4, 25.4, 25.4, 25.4, 25.4], 'Total Precipitation [in]'),
    ])
    expect(a.traces.map((t) => t.year)).toEqual([2025, 2026])
    expect(a.traces[1].values).toEqual([1, 1, 2, null, null])
    expect(a.traces[0].values.at(-1)).toBe(5)
    expect(a.yLabel).toBe('Annual Cumulative Precipitation [in]')
  })

  it('non-cumulative values convert SI → US; empty years are dropped', () => {
    const a = annualTraces('air_temp_0200', [
      year(2025, [0, 10], 'Average Air Temperature @ 2 m [°F]'),
      year(2024, [null, null], null),
    ])
    expect(a.traces).toHaveLength(1)
    expect(a.traces[0].values).toEqual([32, 50])
    expect(a.cumulative).toBe(false)
  })
})
