import { describe, expect, it } from 'vitest'
import { testCtx } from './testing'
import { axisTooltip, legend, tipText } from './tooltip'

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
  it('legend with a title adds a text graphic and shifts the legend right', () => {
    const l = legend(ctx, { title: 'Index Used', data: ['x'] })
    expect(l.graphic[0]).toMatchObject({ type: 'text', style: { text: 'Index Used' } })
    expect(Number(l.legend.left)).toBeGreaterThan(60)
    expect(legend(ctx).legend.left).toBe('center')
  })
})
