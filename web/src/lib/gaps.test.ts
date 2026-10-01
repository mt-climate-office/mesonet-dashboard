import { describe, expect, it } from 'vitest'
import { insertGaps } from './gaps'
import type { ObservationRow } from './api'

const row = (datetime: string, v: number | null = 1): ObservationRow => ({
  station: 'acebozem',
  datetime,
  'Air Temperature [°F]': v,
})

describe('insertGaps', () => {
  it('returns short inputs unchanged', () => {
    const rows = [row('2026-06-01T00:00:00Z'), row('2026-06-01T00:05:00Z')]
    expect(insertGaps(rows)).toBe(rows)
  })

  it('leaves a regular cadence alone', () => {
    const rows = [0, 5, 10, 15].map((m) =>
      row(`2026-06-01T00:${String(m).padStart(2, '0')}:00Z`),
    )
    expect(insertGaps(rows)).toEqual(rows)
  })

  it('inserts a null row one cadence after the sample preceding a gap', () => {
    const rows = [
      row('2026-06-01T00:00:00Z', 1),
      row('2026-06-01T00:15:00Z', 2),
      row('2026-06-01T00:30:00Z', 3),
      row('2026-06-01T02:00:00Z', 4),
      row('2026-06-01T02:15:00Z', 5),
    ]
    const out = insertGaps(rows)
    expect(out).toHaveLength(6)
    expect(out[3]).toEqual({
      station: 'acebozem',
      datetime: '2026-06-01T00:45:00.000Z',
      'Air Temperature [°F]': null,
    })
    expect(out[4]).toBe(rows[3])
  })

  it('respects thresholdRatio', () => {
    const rows = [
      row('2026-06-01T00:00:00Z'),
      row('2026-06-01T01:00:00Z'),
      row('2026-06-01T02:00:00Z'),
      row('2026-06-01T04:00:00Z'),
    ]
    expect(insertGaps(rows)).toHaveLength(5)
    expect(insertGaps(rows, 3)).toHaveLength(4)
  })

  it('returns rows unchanged when timestamps are unparseable', () => {
    const rows = [row('x'), row('y'), row('z')]
    expect(insertGaps(rows)).toBe(rows)
  })
})
