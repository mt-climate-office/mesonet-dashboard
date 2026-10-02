import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildWindRoseModel, quantileEdges, roundHalfEven, speedBins, windDateSpan } from './windRose'

describe('roundHalfEven', () => {
  it('rounds like numpy', () => {
    expect([0.5, 1.5, 2.5, 3.5, 2.6, -0.5].map(roundHalfEven)).toEqual([0, 2, 2, 4, 3, -0])
  })
})

describe('quantileEdges', () => {
  it('uses numpy linear quantiles, duplicates dropped', () => {
    expect(quantileEdges([1, 2, 3, 4, 5], 4)).toEqual([1, 2, 3, 4, 5])
    expect(quantileEdges([1, 2, 3, 4], 4)).toEqual([1, 1.75, 2.5, 3.25, 4])
    expect(quantileEdges([], 8)).toEqual([])
  })
})

describe('speedBins', () => {
  // rounded (half-even): 0 1 3 3 4 6 6 7 8 9 10 12 15 15 18 18
  const raw = [0.2, 1.4, 2.6, 3.1, 4.4, 5.5, 6.2, 7.3, 7.6, 8.9, 10.2, 12.4, 14.6, 15.1, 17.8, 18.4]
  const bins = speedBins(raw)

  it('matches pd.qcut(q=8) edges', () => {
    expect(bins.edges).toEqual([0, 2.75, 3.75, 6, 7.5, 9.375, 12.75, 15.375, 18])
    expect(bins.numBins).toBe(8)
  })

  it('bins right-closed on the rounded speed, matching the labels', () => {
    expect(bins.labels).toEqual(['0 – 2', '3', '4 – 6', '7', '8 – 9', '10 – 12', '13 – 15', '16 – 18'])
    expect(bins.labels[bins.binFor(7.3)]).toBe('7')
    expect(bins.labels[bins.binFor(8.4)]).toBe('8 – 9')
    expect(bins.labels[bins.binFor(6.4)]).toBe('4 – 6')
    expect(bins.labels[bins.binFor(18.4)]).toBe('16 – 18')
    expect(bins.binFor(0.2)).toBe(0)
  })

  it('every input lands in a bin whose label contains its rounded value', () => {
    for (const s of raw) {
      const label = bins.labels[bins.binFor(s)]
      const [lo, hi = lo] = label.split(' – ').map(Number)
      const r = roundHalfEven(s)
      expect(r).toBeGreaterThanOrEqual(lo)
      expect(r).toBeLessThanOrEqual(hi)
    }
  })

  it('collapses duplicate edges', () => {
    const b = speedBins([3, 3, 3, 3, 3, 3, 3, 4.2])
    expect(b.edges).toEqual([3, 3.125, 4])
    expect(b.labels).toEqual(['3', '4'])
  })
})

describe('windDateSpan', () => {
  it('returns the min and max local dates', () => {
    expect(
      windDateSpan(['2026-09-30 23:00:00-06:00', '2026-09-17 00:00:00-06:00', '2026-10-01']),
    ).toEqual(['2026-09-17', '2026-10-01'])
    expect(windDateSpan([])).toBeNull()
  })
})

describe('buildWindRoseModel', () => {
  it('counts by compass point and speed bin, skipping incomplete rows', () => {
    const rows = [
      { datetime: '2026-07-02 01:00:00-06:00', 'Wind Direction [deg]': 0, 'Wind Speed [mi/hr]': 2 },
      { datetime: '2026-07-01 01:00:00-06:00', 'Wind Direction [deg]': 90, 'Wind Speed [mi/hr]': 10 },
      { datetime: '2026-07-03 01:00:00-06:00', 'Wind Direction [deg]': 90, 'Wind Speed [mi/hr]': null },
    ] as unknown as ObservationRow[]
    const m = buildWindRoseModel(rows)!
    expect(m.n).toBe(2)
    expect(m.directions).toHaveLength(16)
    expect(m.span).toEqual(['2026-07-01', '2026-07-03'])
    const total = m.bins.reduce((a, b) => a + b.counts.reduce((x, y) => x + y, 0), 0)
    expect(total).toBe(2)
    expect(m.bins[0].counts[0]).toBe(1) // N, slowest bin
    expect(m.bins.at(-1)!.counts[4]).toBe(1) // E, fastest bin
  })
  it('null when no row has both values', () => {
    expect(buildWindRoseModel([])).toBeNull()
  })
})
