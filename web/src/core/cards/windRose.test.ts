import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { nowWindRoseRequest, windRoseRequest } from './windRose'

describe('windRoseRequest', () => {
  it('asks for wind speed + direction only, flagged rows dropped; the key encodes every input', () => {
    const r = windRoseRequest('acebozem', '2026-09-24', '2026-10-01', 'hourly')
    expect(r.query).toEqual({
      station: 'acebozem',
      start: '2026-09-24',
      end: '2026-10-01',
      period: 'hourly',
      elements: 'wind_spd,wind_dir',
      rmNa: true,
      publicOnly: true,
    })
    expect(r.key).toBe('obs:acebozem:hourly:2026-09-24:2026-10-01:wind_spd,wind_dir:rmna')
    expect(windRoseRequest('acebozem', '2026-09-24', '2026-10-01', 'raw').key).toBe('obs:acebozem:raw:2026-09-24:2026-10-01:wind_spd,wind_dir:rmna')
  })
})

describe('nowWindRoseRequest', () => {
  it("is Now's last 24 hours: raw readings for yesterday and today, whatever the URL window", () => {
    const r = nowWindRoseRequest('arskeogh', dayjs('2026-10-01T12:00:00'))
    expect(r.query).toMatchObject({ start: '2026-09-30', end: '2026-10-01', period: 'raw', elements: 'wind_spd,wind_dir' })
    expect(r.key).toBe('obs:arskeogh:raw:2026-09-30:2026-10-01:wind_spd,wind_dir:rmna')
  })
})
