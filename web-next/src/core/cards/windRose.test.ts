import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { windRoseRequest } from './windRose'

describe('windRoseRequest', () => {
  const today = dayjs('2026-10-01T12:00:00')

  it('is hourly wind over the 14 days ending today (legacy default Latest window)', () => {
    const r = windRoseRequest('acebozem', today)
    expect(r.query).toEqual({
      station: 'acebozem',
      start: '2026-09-17',
      end: '2026-10-01',
      period: 'hourly',
      elements: 'wind_spd,wind_dir',
      rmNa: true,
      publicOnly: true,
    })
    expect(r.key).toBe('obs:acebozem:hourly:2026-09-17:2026-10-01:wind_spd,wind_dir:rmna')
  })
})
