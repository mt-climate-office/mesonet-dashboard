import { describe, expect, it } from 'vitest'
import { SWP_BANDS } from '../palette'
import { bandSeries, hBandSeries, hatchDecal, labelledLines, normalsSeries, sensorEventSeries } from './overlays'
import { testCtx } from './testing'
import { paint } from './theme'

const H = 3_600_000

describe('overlays', () => {
  const ctx = testCtx('dark')
  it('band: invisible aux base + stacked fill whose notes give lo–hi', () => {
    const [base, fill] = bandSeries('Band', 'Base', [0, 1], [1, 2], [3, 5], { color: '#000000', stack: 's' })
    expect(base.id).toMatch(/^aux:/)
    expect(base.stack).toBe(fill.stack)
    expect(fill.data).toEqual([[0, 2, '1–3'], [1, 3, '2–5']])
  })
  it('normals use NORMALS band/line roles', () => {
    const s = normalsSeries(ctx, [0, 1], { q25: [1, 1], median: [2, 2], q75: [3, 3] })
    expect(s).toHaveLength(3)
    expect((s[1].areaStyle as { color: string }).color).toBe('rgba(132,148,171,0.18)')
    expect(s[2].lineStyle).toMatchObject({ type: 'dashed', color: '#8494ab' })
  })
  it('hBandSeries: markArea per band with corner labels and dashed markLines', () => {
    const s = hBandSeries(ctx, [0, 10], [{ from: 0.1, to: 0.33, label: 'FC', labelAt: 'insideTopLeft' }], [{ y: 0.33 }])
    expect(s.id).toBe('aux:bands')
    const area = s.markArea!.data as unknown as [{ yAxis: number; name: string; label: { position: string } }, { yAxis: number }][]
    expect(area[0][0]).toMatchObject({ yAxis: 0.1, name: 'FC', label: { position: 'insideTopLeft' } })
    expect(s.markArea!.itemStyle!.color).toBe(paint(ctx.theme, SWP_BANDS.fill))
    // Boxed labels (AG-SWP-003): text-colored 2 px border on the surface at 0.8.
    expect(s.markArea!.label).toMatchObject({ borderWidth: 2, borderColor: ctx.theme.text, fontSize: 14 })
    expect(String(s.markArea!.label!.backgroundColor)).toMatch(/^rgba\(.*,0\.8\)$/)
    expect(s.markLine!.lineStyle!.type).toBe('dashed')
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
