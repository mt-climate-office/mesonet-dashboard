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
  it('livestock risk: sentence-case classes, no title, room for each row', () => {
    const o = cciChart({ series: cciDaily(winter, 'adult'), period: 'daily' }, testCtx('light', 340, true))
    const lg = o.legend as Lg
    expect(lg.type).toBe('plain')
    expect(o.graphic).toEqual([])
    const shown = (lg.data as string[]).map(lg.formatter)
    expect(shown.every((t) => t === sentenceCase(t))).toBe(true)
    expect((o.grid as { bottom: number }).bottom).toBeGreaterThanOrEqual(56)
  })
  it('feels like: short names, no title', () => {
    const o = feelsLikeChart({ series: feelsLikeDaily(winter), period: 'daily' }, testCtx('light', 340, true))
    const lg = o.legend as Lg
    expect(o.graphic).toEqual([])
    expect((lg.data as string[]).map(lg.formatter)).not.toContain('Average temperature')
  })
})
