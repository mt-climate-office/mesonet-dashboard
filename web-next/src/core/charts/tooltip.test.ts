import { describe, expect, it } from 'vitest'
import { testCtx } from './testing'
import { axisTooltip, legend, tipText, tooltipBase } from './tooltip'

describe('tooltip / legend', () => {
  const ctx = testCtx('light')
  it('axis tooltip: kit class, header + one row per finite, non-aux series', () => {
    const tip = axisTooltip(ctx, (x) => `x=${x}`, (n, y, note) => tipText(n, y.toFixed(1), note))
    expect(tip.className).toBe('mco-tooltip')
    expect(tip.extraCssText).toContain(ctx.theme.tooltipBorder)
    const f = tip.formatter as (p: unknown) => string
    const html = f([
      { seriesName: 'A', seriesId: 'a', value: [5, 1.25], axisValue: 5, marker: '' },
      { seriesName: 'Aux', seriesId: 'aux:x', value: [5, 9], axisValue: 5 },
      { seriesName: 'B<', seriesId: 'b', value: [5, null], axisValue: 5 },
      { seriesName: 'C', seriesId: 'c', value: [5, 2, 'stage 1'], axisValue: 5 },
    ])
    expect(html).toContain('x=5')
    expect(html).toContain('A: ')
    expect(html).not.toContain('Aux')
    expect(html).not.toContain('B&lt;')
    expect(html).toContain('stage 1')
  })
  it('mouse: hover tooltip confined to the chart', () => {
    expect(tooltipBase(ctx)).toMatchObject({ className: 'mco-tooltip', confine: true })
    expect(tooltipBase(ctx).triggerOn).toBeUndefined()
  })
  it('touch: tap to show; compact touch pins it under the chart at full width', () => {
    expect(tooltipBase(testCtx('light', 900, false, true))).toMatchObject({ triggerOn: 'click', confine: true })
    const tip = tooltipBase(testCtx('light', 390, true, true))
    expect(tip).toMatchObject({ triggerOn: 'click', confine: false })
    expect(tip.extraCssText).toContain('width:390px')
    const pos = tip.position as (p: number[], ...rest: unknown[]) => number[]
    expect(pos([120, 80], null, null, null, { viewSize: [390, 420] })).toEqual([0, 424])
    const under = tooltipBase(testCtx('light', 390, true, true), (y) => (y < 200 ? 200 : 400)).position as typeof pos
    expect(under([10, 80], null, null, null, { viewSize: [390, 900] })).toEqual([0, 204])
  })
  it('legend with a title adds a text graphic and shifts the legend right', () => {
    const l = legend(ctx, { title: 'Index Used', data: ['x'] })
    expect(l.graphic[0]).toMatchObject({ type: 'text', style: { text: 'Index Used' } })
    expect(Number(l.legend.left)).toBeGreaterThan(60)
    expect(legend(ctx).legend.left).toBe('center')
  })
})
