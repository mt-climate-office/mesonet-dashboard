import { describe, expect, it } from 'vitest'
import { withGaps } from './previewRows'

const h = (hh: string, v: number) => ({
  station: 's',
  datetime: `2026-09-20 ${hh}:00:00-06:00`,
  x: v,
})

describe('withGaps', () => {
  it('inserts a null row in local wall time between real samples', () => {
    const rows = [h('00', 1), h('01', 2), h('02', 3), h('03', 4), h('06', 5)]
    const out = withGaps(rows)
    expect(out).toHaveLength(6)
    expect(out[4]).toMatchObject({ datetime: '2026-09-20 04:00:00', x: null })
    // real rows keep their timestamps (T-normalised, offset intact)
    expect(out[3].datetime).toBe('2026-09-20T03:00:00-06:00')
    expect(out[5].datetime).toBe('2026-09-20T06:00:00-06:00')
  })

  it('leaves contiguous series alone', () => {
    const rows = [h('00', 1), h('01', 2), h('02', 3)]
    expect(withGaps(rows).map((r) => r.x)).toEqual([1, 2, 3])
  })
})
