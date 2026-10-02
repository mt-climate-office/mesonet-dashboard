import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { windRoseRequest } from './windRose'

describe('windRoseRequest', () => {
  const today = dayjs('2026-10-01T12:00:00')

  it('follows the plotted window and aggregation', () => {
    const r = windRoseRequest('acebozem', '2026-09-01', '2026-09-10', 'daily', today)!
    expect(r.query).toEqual({
      station: 'acebozem',
      start: '2026-09-01',
      end: '2026-09-10',
      period: 'daily',
      elements: 'wind_spd,wind_dir',
      rmNa: true,
      publicOnly: true,
    })
    expect(r.key).toBe('obs:acebozem:daily:2026-09-01:2026-09-10:wind_spd,wind_dir:rmna')
  })
  it('defaults to the 14 days ending today', () => {
    const r = windRoseRequest('acebozem', null, null, 'hourly', today)!
    expect([r.query.start, r.query.end]).toEqual(['2026-09-17', '2026-10-01'])
  })
  it('invalid window → null', () => {
    expect(windRoseRequest('acebozem', '2026-10-05', '2026-10-01', 'hourly', today)).toBeNull()
  })
})
