import { describe, expect, it } from 'vitest'
import { configKey, elementsKey, endsToday, normalsKey, recordRequest } from './requests'

describe('recordRequest', () => {
  const window = { start: '2026-09-17', end: '2026-10-01', valid: true }
  it('keys every input and keeps gaps (rm_na=false)', () => {
    const r = recordRequest({ station: 'acebozem', window, agg: 'hourly', vars: ['Air Temperature', 'Reference ET'] })!
    expect(r.key).toBe('obs:acebozem:hourly:2026-09-17:2026-10-01:air_temp:etr')
    expect(r.query).toMatchObject({ station: 'acebozem', start: '2026-09-17', end: '2026-10-01', elements: 'air_temp', hasEtr: true, rmNa: false })
  })
  it('asks for nothing with no vars or an invalid window', () => {
    expect(recordRequest({ station: 'x', window, agg: 'daily', vars: [] })).toBeNull()
    expect(recordRequest({ station: 'x', window: { ...window, valid: false }, agg: 'daily', vars: ['Air Temperature'] })).toBeNull()
  })
  it('extremes: the daily min and max, without Reference ET, keyed apart from the mean', () => {
    const r = recordRequest({ station: 'acebozem', window, agg: 'daily', vars: ['Air Temperature'], extremes: true })!
    expect(r.key).toBe('obs:acebozem:daily:2026-09-17:2026-10-01:air_temp::minmax')
    expect(r.query).toMatchObject({ elements: 'air_temp', hasEtr: false, aggFunc: ['min', 'max'] })
    expect(recordRequest({ station: 'x', window, agg: 'daily', vars: ['Reference ET'], extremes: true })).toBeNull()
  })
  it('names the metadata keys by station', () => {
    expect([elementsKey('a'), configKey('a'), normalsKey('a', 'Precipitation')]).toEqual(['elements:a', 'config:a', 'normals:a:Precipitation'])
  })
})

describe('endsToday', () => {
  const req = (end: string) => recordRequest({ station: 'x', window: { start: '2026-09-17', end, valid: true }, agg: 'hourly', vars: ['Air Temperature'] })!
  it('is live when the window reaches today, not when it ended before', () => {
    expect(endsToday(req('2026-10-01'), '2026-10-01')).toBe(true)
    expect(endsToday(req('2026-10-01'), '2026-10-02')).toBe(false)
    expect(endsToday({ key: 'k', query: { station: 'x', start: '2026-09-17', period: 'hourly' } }, '2026-10-02')).toBe(true)
  })
})
