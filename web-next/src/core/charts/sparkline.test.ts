import { describe, expect, it } from 'vitest'
import { sparkline } from './sparkline'

describe('sparkline', () => {
  it('maps the series into the viewBox, highest value at the top', () => {
    const s = sparkline({ t: [0, 1, 2], v: [0, 10, 5] })!
    expect(s.viewBox).toBe('0 0 100 28')
    expect(s.d).toBe('M0 26.5L50 1.5L100 14')
    expect([s.min, s.max, s.points]).toEqual([0, 10, 3])
  })
  it('breaks the line at nulls', () => {
    const s = sparkline({ t: [0, 1, 2, 3], v: [1, null, 2, 3] })!
    expect(s.d.match(/M/g)).toHaveLength(2)
    expect(s.points).toBe(3)
  })
  it('a flat series sits at the bottom without dividing by zero', () => {
    const s = sparkline({ t: [0, 1], v: [4, 4] })!
    expect(s.d).toBe('M0 26.5L100 26.5')
  })
  it('null when there is nothing finite', () => {
    expect(sparkline({ t: [0, 1], v: [null, null] })).toBeNull()
    expect(sparkline({ t: [], v: [] })).toBeNull()
  })
  it('bars from zero, only for positive values', () => {
    const s = sparkline({ t: [0, 1, 2, 3], v: [0, 0.1, 0, 0.2] }, { kind: 'bars' })!
    expect(s.d.match(/Z/g)).toHaveLength(3) // baseline + two bars
    expect(sparkline({ t: [0, 1], v: [0, 0] }, { kind: 'bars' })?.d).toBe('M0 27h100v1h-100Z')
    expect(s.bars).toHaveLength(2)
    expect(s.min).toBe(0)
    expect(s.bars[1].h).toBe(28)
    expect(s.bars[0].h).toBe(14)
    for (const b of s.bars) expect(b.x + b.w).toBeLessThanOrEqual(100)
  })
  it('is deterministic', () => {
    const a = { t: [0, 5, 9], v: [3, 1, 2] }
    expect(sparkline(a)).toEqual(sparkline(a))
  })
})
