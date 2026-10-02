import { describe, expect, it } from 'vitest'
import { configKey, elementsKey, normalsKey, recordRequest } from './requests'

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
  it('names the metadata keys by station', () => {
    expect([elementsKey('a'), configKey('a'), normalsKey('a', 'Precipitation')]).toEqual(['elements:a', 'config:a', 'normals:a:Precipitation'])
  })
})
