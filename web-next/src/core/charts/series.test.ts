import { describe, expect, it } from 'vitest'
import { LTTB_THRESHOLD, lineSeries, markerSeries, points } from './series'

const H = 3_600_000

describe('series', () => {
  it('points inserts a null midway across a long step and keeps notes', () => {
    const xs = [0, 1, 2, 3, 10, 11].map((h) => h * H)
    const p = points(xs, [1, 2, 3, 4, 5, 6])
    expect(p.map((q) => q[1])).toEqual([1, 2, 3, 4, null, 5, 6])
    expect(p[4][0]).toBe(6.5 * H)
    expect(points([0, 1, 2], [1, null, 3], ['a', 'b', 'c'])).toEqual([[0, 1, 'a'], [1, null, 'b'], [2, 3, 'c']])
  })
  it('lines break on nulls and sample with LTTB only when long', () => {
    const short = lineSeries('a', points([0, 1, 2], [1, 2, 3]), { color: '#000000' })
    expect(short).toMatchObject({ type: 'line', connectNulls: false, showSymbol: false })
    expect(short.sampling).toBeUndefined()
    const n = LTTB_THRESHOLD + 1
    const long = lineSeries('b', points([...Array(n).keys()], Array(n).fill(1)), { color: '#000000' })
    expect(long.sampling).toBe('lttb')
  })
  it('marker series drop null points', () => {
    expect(markerSeries('m', [[0, null], [1, 2]], { color: '#000000' }).data).toEqual([[1, 2]])
  })
})
