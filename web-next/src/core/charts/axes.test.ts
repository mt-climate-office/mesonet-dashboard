import { describe, expect, it } from 'vitest'
import { dualAxis, logAxis, logExtent, niceCeil, timeAxis, timeZoom } from './axes'
import { testCtx } from './testing'

describe('axes', () => {
  it('time axis has level label templates (read in UTC = Denver wall clock)', () => {
    const a = timeAxis() as { type: string; axisLabel: { formatter: Record<string, string> } }
    expect(a.type).toBe('time')
    expect(a.axisLabel.formatter.hour).toBe('{HH}:{mm}')
  })
  it('dual axis: both from 0, y2 on the right, aligned, no split lines', () => {
    const [l, r] = dualAxis('A', 'B', { rightMax: 50 }) as Record<string, unknown>[]
    expect(l).toMatchObject({ type: 'value', name: 'A', min: 0, position: 'left' })
    expect(r).toMatchObject({ name: 'B', min: 0, max: 50, position: 'right', alignTicks: true, splitLine: { show: false } })
  })
  it('log axis with prefix and inverse', () => {
    const a = logAxis('SWP', 0.1, 100, { inverse: true, prefix: '-' }) as { type: string; inverse: boolean; axisLabel: { formatter: (v: number) => string } }
    expect(a).toMatchObject({ type: 'log', inverse: true })
    expect(a.axisLabel.formatter(15)).toBe('-15')
  })
  it('niceCeil / logExtent', () => {
    expect([0, 0.7, 1, 1.3, 5100, 9001].map(niceCeil)).toEqual([1, 0.8, 1, 1.5, 6000, 10000])
    expect(logExtent(0.4, 30, [0.33, 15])).toEqual([0.1, 100])
    expect(logExtent(NaN, NaN)).toEqual([0.1, 100])
  })
  it('zoom: inside always, slider only on wide screens, no drag-pan on compact', () => {
    expect(timeZoom(testCtx('dark', 900, false)).map((z) => z.type)).toEqual(['inside', 'slider'])
    const [inside] = timeZoom(testCtx('dark', 390, true))
    expect(timeZoom(testCtx('dark', 390, true))).toHaveLength(1)
    expect(inside).toMatchObject({ moveOnMouseMove: false, zoomOnMouseWheel: 'shift' })
  })
})
