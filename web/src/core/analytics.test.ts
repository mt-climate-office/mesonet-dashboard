import { describe, expect, it } from 'vitest'
import { campaignQuery, countUrl, eventUrl, referrerHost, screenSize, shouldCount, viewPath } from './analytics'

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
  it('sends only the path, view and title by default', () => {
    const u = new URL(countUrl('/mesonet-dashboard/next/', 'charts', 'Charts'))
    expect(u.origin + u.pathname).toBe('https://mt-climate-office.goatcounter.com/count')
    expect(u.searchParams.get('p')).toBe('/mesonet-dashboard/next/#charts')
    expect(u.searchParams.get('t')).toBe('Charts')
    expect([...u.searchParams.keys()].sort()).toEqual(['p', 'rnd', 't'])
  })
  it('adds screen, referrer and campaign when given', () => {
    const u = new URL(countUrl('/x/', 'now', 'Now', { screen: '390,844,3', referrer: 'google.com', campaign: '?utm_source=news' }))
    expect(u.searchParams.get('s')).toBe('390,844,3')
    expect(u.searchParams.get('r')).toBe('google.com')
    expect(u.searchParams.get('q')).toBe('?utm_source=news')
  })
})

describe('eventUrl', () => {
  it('marks the count as an event', () => {
    const u = new URL(eventUrl('download/csv', 'Download data', '1280,800,2'))
    expect(u.searchParams.get('p')).toBe('download/csv')
    expect(u.searchParams.get('e')).toBe('true')
    expect(u.searchParams.get('s')).toBe('1280,800,2')
  })
})

describe('viewPath', () => {
  it('names the chart or Ag tool on Charts only', () => {
    expect(viewPath('now', { v: 'air_temp' })).toBe('now')
    expect(viewPath('charts', { v: null })).toBe('charts')
    expect(viewPath('charts', { v: 'air_temp' })).toBe('charts/air_temp')
    expect(viewPath('charts', { v: 'gdd' })).toBe('charts/gdd')
    expect(viewPath('charts', { v: 'air_temp', cmp: true })).toBe('charts/compare')
  })
})

describe('referrerHost', () => {
  const own = 'mt-climate-office.github.io'
  it('keeps only the host, without www', () => {
    expect(referrerHost('https://www.google.com/search?q=mesonet', own)).toBe('google.com')
    expect(referrerHost('https://climate.umt.edu/mesonet/stations/', own)).toBe('climate.umt.edu')
  })
  it('drops the app itself, none and junk', () => {
    expect(referrerHost(`https://${own}/mesonet-dashboard/next/`, own)).toBe('')
    expect(referrerHost('', own)).toBe('')
    expect(referrerHost('not a url', own)).toBe('')
  })
})

describe('campaignQuery', () => {
  it('keeps utm tags and nothing else', () => {
    expect(campaignQuery('?s=acewetz&utm_source=newsletter&utm_campaign=fall&v=air_temp')).toBe('?utm_source=newsletter&utm_campaign=fall')
    expect(campaignQuery('?s=acewetz')).toBe('')
  })
})

describe('screenSize', () => {
  it('formats width, height and pixel ratio', () => expect(screenSize(390, 844, 3)).toBe('390,844,3'))
})
