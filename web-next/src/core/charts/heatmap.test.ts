import { describe, expect, it } from 'vitest'
import { FROZEN, HEATMAP } from '../palette'
import { colorBar, frozenSeries } from './heatmap'
import { hatchDecal } from './overlays'
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
  it('vertical bar: the title sits above the plot, below the card’s ⓘ button', () => {
    const cb = colorBar(ctx, HEATMAP.soil_vwc, [1, 35], { title: 'Soil moisture (%)', fmt: String, seriesIndex: 0 })
    const title = cb.graphic.find((g) => (g as { style?: { text?: string } }).style?.text === 'Soil moisture (%)') as { top: number }
    expect(title.top).toBeGreaterThanOrEqual(28)
    expect(cb.gridTop).toBeGreaterThan(title.top + 12)
    expect(colorBar(testCtx('light', 390, true), HEATMAP.soil_vwc, [1, 35], { title: 'T', fmt: String, seriesIndex: 0 }).gridTop).toBeUndefined()
  })
  it('frozen cells use the FROZEN role per theme', () => {
    const ctx = testCtx('high-contrast')
    // The decal on the series style too, so the legend swatch is hatched like the cells.
    expect(frozenSeries(ctx, 'Frozen', [[0, 0]]).itemStyle).toEqual({ color: FROZEN['high-contrast'].color, decal: hatchDecal(ctx.theme.textMuted) })
  })
})
