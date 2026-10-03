import { describe, expect, it } from 'vitest'
import { countUrl, shouldCount } from './analytics'

describe('shouldCount', () => {
  const env = { hostname: 'mt-climate-office.github.io', doNotTrack: null, gpc: false }
  it('counts on the production host', () => expect(shouldCount(env)).toBe(true))
  it('skips local hosts', () => {
    expect(shouldCount({ ...env, hostname: 'localhost' })).toBe(false)
    expect(shouldCount({ ...env, hostname: '127.0.0.1' })).toBe(false)
  })
  it('honours Do Not Track and Global Privacy Control', () => {
    expect(shouldCount({ ...env, doNotTrack: '1' })).toBe(false)
    expect(shouldCount({ ...env, gpc: true })).toBe(false)
  })
})

describe('countUrl', () => {
  it('sends only the path, section and title', () => {
    const u = new URL(countUrl('/mesonet-dashboard/next/', 'charts', 'Charts'))
    expect(u.origin + u.pathname).toBe('https://mt-climate-office.goatcounter.com/count')
    expect(u.searchParams.get('p')).toBe('/mesonet-dashboard/next/#charts')
    expect(u.searchParams.get('t')).toBe('Charts')
    expect([...u.searchParams.keys()].sort()).toEqual(['p', 'rnd', 't'])
  })
})
