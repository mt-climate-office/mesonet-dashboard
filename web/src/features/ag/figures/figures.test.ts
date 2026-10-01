import { describe, expect, it } from 'vitest'
import type { DailyNormals, GddSeries } from '../contract'
import {
  cciDaily,
  etoDaily,
  etoHourly,
  feelsLikeDaily,
  gdd,
  groupByYear,
  projectGdd,
  swp,
} from '../compute'
import { dailyMet, hourlyMet, soilParams, soilSeries, stageTable, stationMeta } from '../__tests__/adapters'
import {
  annualAxisLabel,
  annualFigure,
  cciFigure,
  depthLabel,
  etoFigure,
  feelsLikeFigure,
  figureKey,
  fromSi,
  gddFigure,
  insertGapsColumnar,
  soilProfileFigure,
  stageText,
  swpFigure,
} from '.'

type T = Record<string, unknown>
const tr = (fig: { data: unknown[] }, i: number) => fig.data[i] as T
const names = (fig: { data: unknown[] }) => fig.data.map((d) => (d as T).name)

describe('common', () => {
  it('insertGapsColumnar breaks a line at a long step and is a no-op otherwise', () => {
    const e = [0, 1, 2, 3, 10, 11].map((h) => h * 3_600_000)
    const x = e.map(String)
    const y = [1, 2, 3, 4, 5, 6]
    const out = insertGapsColumnar(e, x, [y])
    expect(out.ys[0]).toEqual([1, 2, 3, 4, null, 5, 6])
    expect(out.x).toHaveLength(7)
    const even = insertGapsColumnar([0, 1, 2, 3], ['a', 'b', 'c', 'd'], [[1, null, 3, 4]])
    expect(even.ys[0]).toEqual([1, null, 3, 4])
  })

  it('depth labels use the dashboard inch names', () => {
    expect([5, 10, 20, 50, 70, 91, 100].map(depthLabel)).toEqual([
      '2 in', '4 in', '8 in', '20 in', '28 in', '36 in', '40 in',
    ])
  })

  it('figureKey changes with structure and extent, not with identical content', () => {
    const met = dailyMet('acebozem', 'season2025')
    const a = etoFigure(etoDaily(met, stationMeta('acebozem')), 'daily')
    const b = etoFigure(etoDaily(met, stationMeta('acebozem')), 'daily')
    const c = feelsLikeFigure(feelsLikeDaily(met), 'daily')
    const short = etoFigure(etoDaily({ ...met, date: met.date.slice(0, 10) } as never, stationMeta('acebozem')), 'daily')
    expect(figureKey(a)).toBe(figureKey(b))
    expect(figureKey(a)).not.toBe(figureKey(c))
    expect(figureKey(a)).not.toBe(figureKey(short))
  })
})

describe('etoFigure', () => {
  it('daily: bars in inches + cumulative on y2 (SI → in at the edge)', () => {
    const s = etoDaily(dailyMet('acebozem', 'season2025'), stationMeta('acebozem'))
    const fig = etoFigure(s, 'daily')
    expect(fig.data).toHaveLength(2)
    const bars = tr(fig, 0).y as (number | null)[]
    const i = s.etoMm.findIndex((v) => v != null)
    expect(bars[i]).toBeCloseTo(s.etoMm[i]! / 25.4, 10)
    expect(tr(fig, 1).yaxis).toBe('y2')
    const cum = tr(fig, 1).y as number[]
    const total = s.etoMm.reduce<number>((a, v) => a + (v ?? 0), 0) / 25.4
    expect(cum.at(-1)).toBeCloseTo(total, 8)
    expect((fig.layout.yaxis as T).title).toEqual({ text: '<b>Reference ET<br>(a=0.23) [in]</b>' })
  })

  it('hourly hover shows the time', () => {
    const s = etoHourly(hourlyMet('acebozem', 'jul2025'), stationMeta('acebozem'))
    const fig = etoFigure(s, 'hourly')
    expect(String(tr(fig, 0).hovertemplate)).toContain('%H:%M')
    expect(String((tr(fig, 0).x as string[])[0])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})

describe('feelsLikeFigure / cciFigure', () => {
  it('feels-like: black line + one marker trace per regime present, in °F', () => {
    const s = feelsLikeDaily(dailyMet('acebozem', 'winter2526'))
    const fig = feelsLikeFigure(s, 'daily')
    expect(tr(fig, 0).hoverinfo).toBe('skip')
    expect(names(fig).slice(1)).toEqual(
      ['Wind Chill', 'Heat Index', 'Average Temperature'].filter((n) =>
        s.regime.some((r) => ({ wind_chill: 'Wind Chill', heat_index: 'Heat Index', air_temp: 'Average Temperature' })[r!] === n),
      ),
    )
    const markers = fig.data.slice(1).reduce((a, d) => a + ((d as T).x as unknown[]).length, 0)
    expect(markers).toBe(s.valueC.filter((v) => v != null).length)
    const i = s.valueC.findIndex((v) => v != null)
    expect((tr(fig, 0).y as number[])[i]).toBeCloseTo((s.valueC[i]! * 9) / 5 + 32, 10)
  })

  it('cci: classes in severity order, adult vs newborn differ in winter', () => {
    const met = dailyMet('acebozem', 'winter2526')
    const adult = cciFigure(cciDaily(met, 'adult'), 'daily')
    const newborn = cciFigure(cciDaily(met, 'newborn'), 'daily')
    const order = ['No Stress', 'Mild', 'Moderate', 'Severe', 'Extreme', 'Extreme Danger']
    const an = names(adult).slice(1) as string[]
    expect([...an].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(an)
    expect(names(newborn)).not.toEqual(names(adult))
  })
})

describe('gddFigure', () => {
  const met = dailyMet('acebozem', 'season2025')

  it('stage hover from the table; markers colored per stage', () => {
    const s = gdd(met, { crop: 'wheat', stages: stageTable('wheat') })
    const fig = gddFigure(s, { cutoffsF: [32, 70], stageMode: 'table', cropLabel: 'Wheat' })
    expect(fig.data).toHaveLength(2)
    const cd = tr(fig, 1).customdata as string[]
    expect(cd.some((c) => /Leaf/.test(c))).toBe(true)
    expect(Array.isArray((tr(fig, 1).marker as T).color)).toBe(true)
    expect(tr(fig, 0).name).toBe('Daily GDDs (32–70 °F)')
  })

  it('corn: "No stage table for corn"; custom cutoffs: no stage labels', () => {
    const corn = gddFigure(gdd(met, { crop: 'corn', stages: { crop: 'corn', stages: [] } }), {
      cutoffsF: [50, 86],
      stageMode: 'no-table',
      cropLabel: 'corn',
    })
    expect(new Set(tr(corn, 1).customdata as string[])).toEqual(new Set(['No stage table for corn']))
    const custom = gddFigure(gdd(met, { crop: 'wheat', lowC: 0, highC: 30 }), {
      cutoffsF: [32, 86],
      stageMode: 'custom',
    })
    expect(new Set(tr(custom, 1).customdata as string[])).toEqual(new Set(['n/a (custom cutoffs)']))
  })

  it('projection overlay: band + forecast + normals traces anchored on the last observed point', () => {
    const s: GddSeries = gdd(met, { crop: 'hemp', stages: stageTable('hemp') })
    const q = (m: number) => ({ q25: m - 3, median: m, q75: m + 3 })
    const normals: DailyNormals = { station: 'acebozem', byMonthDay: {} }
    for (let d = 0; d < 400; d++) {
      const md = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000).toISOString().slice(5, 10)
      normals.byMonthDay[md] = { tminC: q(8), tmaxC: q(24), prMm: 0, petMm: 0 }
    }
    const last = s.date.at(-1)!
    const fcDates = [1, 2, 3].map((n) => new Date(Date.parse(`${last}T00:00Z`) + n * 86_400_000).toISOString().slice(0, 10))
    const p = projectGdd(s, normals, { date: fcDates, tminC: [10, 10, 10], tmaxC: [30, 30, 30], source: 'nws' }, '2025-11-30', stageTable('hemp'))
    const fig = gddFigure(s, { cutoffsF: [32, Infinity], stageMode: 'table', projection: p })
    expect(names(fig)).toEqual([
      'Daily GDDs (32–∞ °F)',
      'Cumulative GDDs',
      'Projected 25th percentile',
      'Projected range (normals 25th–75th pct.)',
      'Projected (NWS forecast)',
      'Projected (normals median)',
    ])
    const fc = tr(fig, 4)
    expect((fc.x as string[])[0]).toBe(last)
    expect((fc.x as string[]).length).toBe(4)
    const normalsLine = tr(fig, 5)
    expect((normalsLine.x as string[])[0]).toBe(fcDates[2])
    expect((normalsLine.x as string[]).at(-1)).toBe('2025-11-30')
    const y2 = fig.layout.yaxis2 as { range: number[] }
    expect(y2.range[1]).toBeGreaterThanOrEqual(p.cumulativeQ75.at(-1)!)
  })

  it('stageText', () => {
    expect(stageText(2, 'Leaf 2 fully extended')).toBe('2 – Leaf 2 fully extended')
    expect(stageText('V1 (Emergence)', null)).toBe('V1 (Emergence)')
    expect(stageText(0, 'Planted')).toBe('Planted')
    expect(stageText(null, null)).toBe('')
  })
})

describe('soil figures', () => {
  it('swpFigure: bar on a reversed log axis, one line per depth after the bands', () => {
    const soil = soilSeries('acebozem', 'daily', 'season2025')
    const s = swp(soil, soilParams('acebozem'))
    const fig = swpFigure(s, 'daily')
    expect(fig.data).toHaveLength(5 + s.depthsCm.length)
    expect(names(fig).slice(5)).toEqual(s.depthsCm.map(depthLabel))
    const i = s.kPa[1].findIndex((v) => v != null)
    expect((tr(fig, 6).y as number[])[i]).toBeCloseTo(s.kPa[1][i]! / 100, 10)
    expect(fig.layout.yaxis).toMatchObject({ type: 'log', autorange: 'reversed', tickprefix: '-' })
  })

  it('soilProfileFigure: drops all-null depths; frozen cells get a grey layer', () => {
    const fig = soilProfileFigure({
      variable: 'soil_vwc',
      time: ['2026-01-01', '2026-01-02'],
      depthsCm: [5, 10, 20],
      values: [[null, 20], [30, 31], [null, null]],
      frozen: [[true, false], [false, false], [false, false]],
      period: 'daily',
    })
    expect(fig.data).toHaveLength(2)
    expect(tr(fig, 0).y).toEqual(['2 in', '4 in'])
    expect(tr(fig, 1).z).toEqual([[1, null], [null, null]])
    const temp = soilProfileFigure({
      variable: 'soil_temp',
      time: ['2026-01-01'],
      depthsCm: [5],
      values: [[28]],
      period: 'daily',
    })
    expect(temp.data).toHaveLength(1)
    expect(tr(temp, 0).zmid).toBe(32)
    const swpFig = soilProfileFigure({ variable: 'swp', time: ['d'], depthsCm: [5], values: [[10]], period: 'daily' })
    expect((tr(swpFig, 0).z as number[][])[0][0]).toBeCloseTo(1, 10)
    expect(soilProfileFigure({ variable: 'soil_blk_ec', time: ['d'], depthsCm: [5], values: [[null]], period: 'daily' }).data).toEqual([])
  })
})

describe('annual', () => {
  it('current year black width 3, prior years sampled colors, legacy cumulative label', () => {
    const traces = [2024, 2025, 2026].flatMap((y) =>
      groupByYear([`${y}-01-01`, `${y}-01-02`], [1, 2], { cumulative: true }),
    )
    const fig = annualFigure(traces, { yLabel: annualAxisLabel('Total Precipitation [in]', true), currentYear: 2026 })
    expect(names(fig)).toEqual(['2024', '2025', '2026'])
    expect(tr(fig, 2).line).toEqual({ color: '#000000', width: 3 })
    expect((tr(fig, 0).line as T).color).not.toBe((tr(fig, 1).line as T).color)
    expect((fig.layout.yaxis as T).title).toEqual({ text: 'Annual Cumulative Precipitation [in]' })
    expect(annualAxisLabel('Average Air Temperature @ 2 m [°F]', false)).toBe('Air Temperature @ 2 m [°F]')
  })

  it('fromSi inverts the data layer conversions', () => {
    expect(fromSi('°F')(0)).toBe(32)
    expect(fromSi('in')(25.4)).toBe(1)
    expect(fromSi('mi/h')(0.44704)).toBeCloseTo(1, 12)
    expect(fromSi('%')(42)).toBe(42)
    expect(fromSi('°F')(null)).toBeNull()
  })
})
