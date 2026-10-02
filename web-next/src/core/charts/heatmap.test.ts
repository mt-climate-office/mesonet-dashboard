import { describe, expect, it } from 'vitest'
import { FROZEN, HEATMAP } from '../palette'
import { colorBar, frozenSeries } from './heatmap'
import { testCtx } from './testing'

describe('heatmap', () => {
  const ctx = testCtx('light', 800)
  it('diverging color bar centres on the midpoint and labels it', () => {
    const cb = colorBar(ctx, HEATMAP.soil_temp, [20, 60], { title: 'T', midpoint: 32, fmt: (v) => v.toFixed(0), seriesIndex: 0 })
    expect(cb.visualMap).toMatchObject({ min: 4, max: 60, show: false, dimension: 2, seriesIndex: 0 })
    expect((cb.visualMap as { inRange: { color: string[] } }).inRange.color).toEqual([...HEATMAP.soil_temp.colors])
    const texts = cb.graphic.flatMap((g) => ((g as { type: string }).type === 'text' ? [(g as { style: { text: string } }).style.text] : []))
    expect(texts).toEqual(['T', 'Freezing (32 °F)', '60', '4'])
    expect(cb.gridRight).toBeGreaterThan(100)
  })
  it('sequential bar: no midpoint label; degenerate extent widened', () => {
    const cb = colorBar(ctx, HEATMAP.soil_vwc, [5, 5], { title: 'V', fmt: String, seriesIndex: 0 })
    expect(cb.visualMap).toMatchObject({ min: 4.5, max: 5.5 })
  })
  it('frozen cells use the FROZEN role per theme', () => {
    expect(frozenSeries(testCtx('high-contrast'), 'Frozen', [[0, 0]]).itemStyle).toEqual({ color: FROZEN['high-contrast'].color })
  })
})
