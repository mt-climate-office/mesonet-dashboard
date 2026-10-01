import { describe, expect, it } from 'vitest'
import { quantileCuts, speedBins, windDateSpan } from './windRose'

describe('quantileCuts', () => {
  it('takes floor-index quantiles', () => {
    expect(quantileCuts([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([3, 5, 7])
    expect(quantileCuts([], 8)).toEqual([])
  })
})

describe('speedBins', () => {
  // Raw speeds whose rounding matters: 7.3 → 7, 7.6 → 8.
  const raw = [0.2, 1.4, 2.6, 3.1, 4.4, 5.5, 6.2, 7.3, 7.6, 8.9, 10.2, 12.4, 14.6, 15.1, 17.8, 18.4]
  const bins = speedBins(raw)

  it('uses whole-number, strictly increasing cuts', () => {
    // rounded: 0 1 3 3 4 6 6 7 8 9 10 12 15 15 18 18
    expect(bins.cuts).toEqual([3, 4, 6, 8, 10, 15, 18])
    expect(bins.numBins).toBe(8)
  })

  it('bins on the rounded speed, matching the labels', () => {
    expect(bins.labels).toEqual(['0 – 3', '4', '5 – 6', '7 – 8', '9 – 10', '11 – 15', '16 – 18', ''])
    // 7.3 rounds to 7 → "7 – 8"; raw 8.4 rounds to 8 (≤ cut 8) → same bin.
    expect(bins.labels[bins.binFor(7.3)]).toBe('7 – 8')
    expect(bins.labels[bins.binFor(8.4)]).toBe('7 – 8')
    // 6.4 rounds to 6 → "5 – 6", even though raw 6.4 > cut 6.
    expect(bins.labels[bins.binFor(6.4)]).toBe('5 – 6')
    // 18.4 rounds to 18 = top cut, so it stays out of the empty last bin.
    expect(bins.labels[bins.binFor(18.4)]).toBe('16 – 18')
    expect(bins.binFor(0.2)).toBe(0)
  })

  it('every input lands in a bin whose label contains its rounded value', () => {
    for (const s of raw) {
      const label = bins.labels[bins.binFor(s)]
      const [lo, hi = lo] = label.split(' – ').map(Number)
      const r = Math.round(s)
      expect(r).toBeGreaterThanOrEqual(lo)
      expect(r).toBeLessThanOrEqual(hi)
    }
  })

  it('collapses duplicate cuts and never repeats labels', () => {
    const b = speedBins([3, 3, 3, 3, 3, 3, 3, 4.2])
    expect(b.cuts).toEqual([3, 4])
    expect(b.labels).toEqual(['3', '4', ''])
    const nonEmpty = b.labels.filter(Boolean)
    expect(new Set(nonEmpty).size).toBe(nonEmpty.length)
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
