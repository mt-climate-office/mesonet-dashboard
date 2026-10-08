import { describe, expect, it } from 'vitest'
import { SWP_BANDS } from '../palette'
import { bandSeries, hBandGutter, hBandSeries, hatchDecal, labelledLines, sensorEventSeries } from './overlays'
import { testCtx } from './testing'
import { paint } from './theme'

const H = 3_600_000

describe('overlays', () => {
  const ctx = testCtx('dark')
  it('band: invisible aux base + stacked fill whose notes give lo–hi', () => {
    const [base, fill] = bandSeries('Band', 'Base', [0, 1, 5], [1, 2, 2], [3, 5, 4], { color: '#000000', stack: 's', step: 1 })
    expect(base.id).toMatch(/^aux:/)
    expect(base.stack).toBe(fill.stack)
    // A gap (5 > 1.5 steps) breaks both edges at the same x; the band sits under its line (z 1).
    expect(fill.data).toEqual([[0, 2, '1–3'], [1, 3, '2–5'], [3, null], [5, 2, '2–4']])
    expect((base.data as unknown[]).length).toBe(4)
    expect([base.z, fill.z, fill.smooth, fill.areaStyle?.opacity]).toEqual([1, 1, false, 1])
  })
  it('band: stacks with stackStrategy "all", so a low edge below zero still carries the fill', () => {
    const [base, fill] = bandSeries('Band', 'Base', [0, 1], [-15, -5], [10, 20], { color: '#000000', stack: 's', step: 1 })
    expect([base.stackStrategy, fill.stackStrategy]).toEqual(['all', 'all'])
  })
  it('hBandSeries: unlabelled bands, dashed lines labelled right of the plot; a gutter that fits the labels', () => {
    const s = hBandSeries(ctx, [0, 10], [{ from: 0.1, to: 0.33 }], [{ y: 0.33, label: 'Field capacity\n-0.33 bar' }])
    expect(s.id).toBe('aux:bands')
    const area = s.markArea!.data as unknown as [{ yAxis: number }, { yAxis: number }][]
    expect(area[0]).toEqual([{ yAxis: 0.1 }, { yAxis: 0.33 }])
    expect(s.markArea!.label).toMatchObject({ show: false })
    expect(s.markArea!.itemStyle!.color).toBe(paint(ctx.theme, SWP_BANDS.fill))
    expect(s.markLine!.lineStyle!.type).toBe('dashed')
    expect(s.markLine!.label).toMatchObject({ show: true, position: 'end', color: ctx.theme.text })
    expect(s.markLine!.data).toEqual([{ yAxis: 0.33, name: 'Field capacity\n-0.33 bar' }])
    // The longest line of the label, not the whole text.
    expect(hBandGutter(ctx, ['Field capacity\n-0.33 bar'])).toBe(hBandGutter(ctx, ['Field capacity']))
    expect(hBandGutter(ctx, ['Field capacity'])).toBeGreaterThan(hBandGutter(ctx, ['-15 bar']))
  })
  it('sensor events: hatched custom series with hover text', () => {
    const s = sensorEventSeries(ctx, [{ x0: 0, x1: 6 * H, text: 'Sensor added' }])
    expect(s).toMatchObject({ type: 'custom', name: 'Sensor change', data: [[0, 6 * H, 'Sensor added']] })
    expect(hatchDecal('#fff')).toMatchObject({ color: '#fff', rotation: -Math.PI / 4 })
  })
  it('labelled lines carry the stage name as {b}', () => {
    const ml = labelledLines('#000000', [{ y: 100, label: 'Leaf 2' }], ctx)
    expect(ml.data).toEqual([{ yAxis: 100, name: 'Leaf 2' }])
    expect(ml.label).toMatchObject({ show: true, position: 'end', formatter: '{b}' })
    expect(labelledLines('#000000', [], ctx, { labels: false }).label).toMatchObject({ show: false })
  })
})
