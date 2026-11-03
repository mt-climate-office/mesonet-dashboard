import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStationLatest } from './meta'
import { asksPressure, asSeaLevel, PRESSURE_COLUMN, withoutPressure } from './pressure'
import { getStationRecord } from './record'
import type { ObservationRow } from './types'

const MSLP = 'Sea Level Pressure (NWS-style) [mbar]'
/** The app requests relative URLs (the API is proxied). */
const parse = (u: string) => new URL(u, 'https://x')

describe('asksPressure / withoutPressure', () => {
  it('finds bp as a whole element code only', () => {
    expect(asksPressure('air_temp,bp,rh')).toBe(true)
    expect(asksPressure('bp')).toBe(true)
    expect(asksPressure('air_temp,rh')).toBe(false)
    expect(asksPressure(undefined)).toBe(false)
    expect(withoutPressure('air_temp,bp,rh')).toBe('air_temp,rh')
    expect(withoutPressure('bp')).toBe('')
  })
})

describe('asSeaLevel', () => {
  it('moves the sea-level value into the pressure column and drops its own', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', [PRESSURE_COLUMN]: 845.1, [MSLP]: 1012.6, provisional: false }]
    expect(asSeaLevel(rows)).toEqual([{ station: 's', datetime: 't', [PRESSURE_COLUMN]: 1012.6, provisional: false }])
  })
  it('never falls back to station pressure: no sea-level value is null', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', [PRESSURE_COLUMN]: 845.1 }]
    expect(asSeaLevel(rows)[0][PRESSURE_COLUMN]).toBeNull()
  })
  it('leaves rows without pressure alone', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', x: 1 }]
    expect(asSeaLevel(rows)).toEqual(rows)
  })
})

/** Stub `fetch`: the first `routes` key found in the URL picks the CSV; records every URL. */
function stubApi(routes: Record<string, string | Error>) {
  const urls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    const path = parse(url).pathname
    const hit = Object.keys(routes).find((k) => path.includes(k))
    const body = hit === undefined ? 'station,datetime\n' : routes[hit]
    if (body instanceof Error) return new Response('bad request', { status: 400 })
    return new Response(body, { status: 200 })
  })
  return urls
}

describe('getStationRecord: pressure as sea-level pressure', () => {
  afterEach(() => vi.unstubAllGlobals())

  const obs = `station,datetime,Air Temperature @ 2 m [°F],Atmospheric Pressure [mbar],provisional
s1,2026-11-01 00:00:00-06:00,30,845.0,False
s1,2026-11-01 01:00:00-06:00,29,846.0,False
`
  const mslp = `station,datetime,${MSLP}
s1,2026-11-01 00:00:00-06:00,1012.5
`

  it('replaces station pressure with the derived series on the same rows', async () => {
    const urls = stubApi({ 'observations/hourly': obs, 'derived/hourly': mslp })
    const rows = await getStationRecord({ station: 's1', start: '2026-11-01', end: '2026-11-01', period: 'hourly', elements: 'air_temp,bp' })
    expect(rows.map((r) => r[PRESSURE_COLUMN])).toEqual([1012.5, null])
    expect(rows.every((r) => !(MSLP in r))).toBe(true)
    expect(rows[0].provisional).toBe(false)
    const derived = urls.find((u) => u.includes('derived/hourly'))!
    expect(parse(derived).searchParams.get('elements')).toBe('mslp')
    expect(parse(derived).searchParams.has('public')).toBe(false)
  })

  it('asks native /derived/ rows for the raw view, not hourly', async () => {
    const urls = stubApi({ observations: obs, derived: mslp })
    await getStationRecord({ station: 's1', start: '2026-11-01', period: 'raw', elements: 'bp' })
    const derived = urls.map((u) => parse(u).pathname).find((p) => p.includes('derived'))!
    expect(derived.endsWith('/derived') || derived.endsWith('/derived/')).toBe(true)
  })

  it('makes no sea-level request when pressure is not asked for', async () => {
    const urls = stubApi({ 'observations/hourly': obs })
    await getStationRecord({ station: 's1', start: '2026-11-01', period: 'hourly', elements: 'air_temp' })
    expect(urls.some((u) => u.includes('derived'))).toBe(false)
  })

  it('drops pressure from a daily min/max request (the API has no daily extremes of it)', async () => {
    const urls = stubApi({ 'observations/daily': 'station,datetime\n' })
    await getStationRecord({ station: 's1', start: '2026-11-01', period: 'daily', elements: 'air_temp,bp', aggFunc: ['min', 'max'] })
    expect(urls.some((u) => u.includes('derived'))).toBe(false)
    const q = parse(urls[0]).searchParams
    expect(q.get('elements')!.split(',')).not.toContain('bp')
  })

  it('leaves pressure empty, not station pressure, when the sea-level request fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubApi({ 'observations/hourly': obs, 'derived/hourly': new Error('400') })
    const rows = await getStationRecord({ station: 's1', start: '2026-11-01', period: 'hourly', elements: 'air_temp,bp' })
    expect(rows.map((r) => r[PRESSURE_COLUMN])).toEqual([null, null])
    expect(rows.map((r) => r['Air Temperature [°F]'] ?? r['Air Temperature @ 2 m [°F]'])).toEqual([30, 29])
  })
})

describe('getStationLatest: pressure as sea-level pressure', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('swaps in the latest sea-level value at the same instant', async () => {
    const urls = stubApi({
      latest: 'station,datetime,Atmospheric Pressure [mbar],provisional\ns1,2026-11-02 17:20:00-07:00,854.7,True\n',
      derived: `station,datetime,${MSLP}\ns1,2026-11-02 17:20:00-07:00,1024.865\n`,
    })
    const [row] = await getStationLatest('s1')
    expect(row[PRESSURE_COLUMN]).toBe(1024.865)
    expect(row.provisional).toBe(true)
    const derived = parse(urls.find((u) => u.includes('derived'))!)
    expect(derived.searchParams.get('elements')).toBe('mslp')
    expect(derived.searchParams.has('start_time')).toBe(false)
  })

  it('returns a station without a barometer unchanged', async () => {
    stubApi({ latest: 'station,datetime,Air Temperature @ 2 m [°F]\ns1,2026-11-02 17:20:00-07:00,36.4\n', derived: 'station,datetime\n' })
    const [row] = await getStationLatest('s1')
    expect(PRESSURE_COLUMN in row).toBe(false)
  })
})
