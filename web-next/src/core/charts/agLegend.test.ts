import { describe, expect, it } from 'vitest'
import { cciDaily, feelsLikeDaily } from '../ag/compute'
import { dailyMet } from '../ag/__tests__/adapters'
import { LEGEND_ROW, agLegend, legendRows, liftForLegend, sentenceCase } from './agLegend'
import { cciChart, feelsLikeChart } from './agMet'
import { testCtx } from './testing'

type Lg = { type: string; data: unknown[]; formatter: (n: string) => string }

describe('agLegend', () => {
  it('plain (wrapping), never the scroll legend; text on desktop, short on phones', () => {
    const items = [{ name: 'Wind Chill', text: 'Wind chill' }, { name: 'Average Temperature', text: 'Average temperature', short: 'Air temperature' }]
    const wide = agLegend(testCtx('light', 900), items, { title: 'Index used' })
    expect((wide.legend as Lg).type).toBe('plain')
    expect((wide.legend as Lg).formatter('Average Temperature')).toBe('Average temperature')
    expect(wide.graphic).toHaveLength(1)
    const phone = agLegend(testCtx('light', 340, true), items, { title: 'Index used' })
    expect((phone.legend as Lg).formatter('Average Temperature')).toBe('Air temperature')
    expect(phone.graphic).toEqual([])
    expect(phone.extra).toBe(0)
  })
  it('reserves a row for every wrapped line', () => {
    expect(legendRows([], 300, 8)).toBe(0)
    expect(legendRows([100, 100], 300, 8)).toBe(1)
    expect(legendRows([100, 100, 100], 300, 8)).toBe(2)
    expect(legendRows([400], 300, 8)).toBe(1)
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `Class number ${i}` }))
    expect(agLegend(testCtx('light', 340, true), many).extra).toBeGreaterThanOrEqual(LEGEND_ROW)
  })
  it('liftForLegend raises the grid and the slider, not the inside zoom', () => {
    const r = liftForLegend({ bottom: 84 }, [{ type: 'inside' }, { type: 'slider', bottom: 36 }], 22)
    expect(r.grid.bottom).toBe(106)
    expect(r.dataZoom).toEqual([{ type: 'inside' }, { type: 'slider', bottom: 58 }])
    expect(liftForLegend({ bottom: 56 }, [], 0).grid.bottom).toBe(56)
  })
  it('sentenceCase', () => {
    expect(sentenceCase('Extreme Danger')).toBe('Extreme danger')
    expect(sentenceCase('No Stress')).toBe('No stress')
  })
})

describe('Ag met legends on phones', () => {
  const winter = dailyMet('acebozem', 'winter2526')
  it('livestock risk: one short entry per marker group, no title, on one row', () => {
    const o = cciChart({ series: cciDaily(winter, 'adult'), period: 'daily' }, testCtx('light', 340, true))
    const lg = o.legend as Lg
    expect(lg.type).toBe('plain')
    expect(o.graphic).toEqual([])
    const shown = lg.data.map((d) => lg.formatter(typeof d === 'string' ? d : (d as { name: string }).name))
    expect(shown).toEqual(['Cold stress', 'No stress'])
    expect(agLegend(testCtx('light', 340, true), shown.map((name) => ({ name }))).extra).toBe(0)
  })
  it('the title sits beside the first row of a wrapped legend', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Class number ${i}` }))
    const lg = agLegend(testCtx('light', 600), many, { title: 'Livestock risk (adult)' })
    expect(lg.extra).toBeGreaterThan(0)
    expect((lg.graphic[0] as { bottom: number }).bottom).toBe(7 + lg.extra)
  })
  it('an icon fill: a color or a left-to-right gradient', () => {
    const lg = agLegend(testCtx(), [{ name: 'a', color: '#123456' }, { name: 'b', icon: 'diamond', color: { stops: ['#000000', '#ffffff'] } }])
    expect(lg.legend.data).toEqual([
      { name: 'a', itemStyle: { color: '#123456' } },
      { name: 'b', icon: 'diamond', itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] } } },
    ])
  })
  it('feels like: short names, no title', () => {
    const o = feelsLikeChart({ series: feelsLikeDaily(winter), period: 'daily' }, testCtx('light', 340, true))
    const lg = o.legend as Lg
    expect(o.graphic).toEqual([])
    expect((lg.data as string[]).map(lg.formatter)).not.toContain('Average temperature')
  })
})
