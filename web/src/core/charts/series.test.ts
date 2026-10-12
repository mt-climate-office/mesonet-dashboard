import { describe, expect, it } from 'vitest'
import { LTTB_THRESHOLD, barSeries, lineSeries, markerSeries } from './series'
import { LINE_WIDTH, points } from './style'

describe('series', () => {
  it('lines: one width, straight, no symbols, break on nulls, LTTB only when long', () => {
    const short = lineSeries('a', points([0, 1, 2], [1, 2, 3], 1), { color: '#000000' })
    expect(short).toMatchObject({ type: 'line', connectNulls: false, showSymbol: false, smooth: false, lineStyle: { width: LINE_WIDTH } })
    expect(short.sampling).toBeUndefined()
    const n = LTTB_THRESHOLD + 1
    const long = lineSeries('b', points([...Array(n).keys()], Array(n).fill(1), 1), { color: '#000000' })
    expect(long.sampling).toBe('lttb')
  })
  it('bars keep a 1 px minimum (5-min bars over a week) and an 18 px maximum', () => {
    expect(barSeries('p', [[0, 1]], '#000000')).toMatchObject({ type: 'bar', barMinWidth: 1, barMaxWidth: 18 })
  })
  it('marker series drop null points', () => {
    expect(markerSeries('m', [[0, null], [1, 2]], { color: '#000000' }).data).toEqual([[1, 2]])
  })
})
