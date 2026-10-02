import { describe, expect, it } from 'vitest'
import { carryState, categoryMs, fromAxisRange, sameRange, toAxisRange } from './zoom'

const cats = [100, 200, 300, 400, 500]

describe('zoom conversions', () => {
  it('categoryMs only for a category x axis of numbers', () => {
    expect(categoryMs({ xAxis: { type: 'category', data: ['100', 200] } })).toEqual([100, 200])
    expect(categoryMs({ xAxis: [{ type: 'time' }] })).toBeNull()
    expect(categoryMs({ xAxis: { type: 'category', data: ['Jul 1'] } })).toBeNull()
  })
  it('wall-clock ↔ category index round trip', () => {
    expect(toAxisRange([150, 420], cats)).toEqual([1, 3])
    expect(fromAxisRange([1, 3], cats)).toEqual([200, 400])
    expect(toAxisRange(fromAxisRange([1, 3], cats), cats)).toEqual([1, 3])
    expect(fromAxisRange([-2, 9.6], cats)).toEqual([100, 500])
    expect(toAxisRange([600, 700], cats)).toEqual([4, 4])
  })
  it('time axes pass through', () => {
    expect(toAxisRange([1, 2], null)).toEqual([1, 2])
    expect(fromAxisRange([1, 2], null)).toEqual([1, 2])
  })
  it('sameRange tolerates rounding, not real moves', () => {
    expect(sameRange([0, 3_600_000], [30_000, 3_600_000])).toBe(true)
    expect(sameRange([0, 3_600_000], [0, 7_200_000])).toBe(false)
    expect(sameRange(null, [0, 1])).toBe(false)
  })
  it('carryState keeps zoom and legend selection', () => {
    const o = carryState({ dataZoom: [{ type: 'inside' }, { type: 'slider' }], legend: { data: ['a'] } }, { zoom: { start: 10, end: 40 }, selected: { a: false } })
    expect(o.dataZoom).toEqual([{ type: 'inside', start: 10, end: 40 }, { type: 'slider', start: 10, end: 40 }])
    expect(o.legend).toEqual({ data: ['a'], selected: { a: false } })
  })
})
