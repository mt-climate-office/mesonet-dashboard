import { afterEach, describe, expect, it, vi } from 'vitest'
import { latestElementCodes } from '../params'
import { getStationLatest } from './meta'
import { getStationRecord } from './record'
import { asDerivedVpd, asksVpd, VPD_COLUMN, withoutVpd } from './vpd'
import type { ObservationRow } from './types'

const DERIVED = 'Vapor Pressure Deficit [mbar]'
/** The app requests relative URLs (the API is proxied). */
const parse = (u: string) => new URL(u, 'https://x')

describe('asksVpd / withoutVpd', () => {
  it('finds vpd_atmo as a whole element code only', () => {
    expect(asksVpd('air_temp,vpd_atmo')).toBe(true)
    expect(asksVpd('air_temp,rh')).toBe(false)
    expect(asksVpd(undefined)).toBe(false)
    expect(withoutVpd('air_temp,vpd_atmo,rh')).toBe('air_temp,rh')
    expect(withoutVpd('vpd_atmo')).toBe('')
  })
})

describe('asDerivedVpd', () => {
  it('replaces the sensor value with the derived one and drops the derived column', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', [VPD_COLUMN]: 4.1, [DERIVED]: 4.12 }]
    expect(asDerivedVpd(rows)).toEqual([{ station: 's', datetime: 't', [VPD_COLUMN]: 4.12 }])
  })
  it('gives a station without the sensor the column', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', [DERIVED]: 3 }, { station: 's', datetime: 'u' }]
    expect(asDerivedVpd(rows).map((r) => r[VPD_COLUMN])).toEqual([3, null])
  })
  it('never falls back to the sensor: no derived value is null', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', [VPD_COLUMN]: 4.1 }]
    expect(asDerivedVpd(rows)[0][VPD_COLUMN]).toBeNull()
  })
  it('leaves rows without VPD alone', () => {
    const rows: ObservationRow[] = [{ station: 's', datetime: 't', x: 1 }]
    expect(asDerivedVpd(rows)).toEqual(rows)
  })
})

describe('latestElementCodes: VPD at a station without the sensor', () => {
  it('keeps vpd_atmo, which getStationRecord serves from /derived', () => {
    const els = [
      { element: 'air_temp_0200', description_short: 'Air Temperature @ 2 m' },
      { element: 'rh', description_short: 'Relative Humidity' },
    ]
    expect(latestElementCodes(['Air Temperature', 'VPD'], els)).toEqual(['air_temp', 'vpd_atmo'])
  })
})

/** Stub `fetch`: the first `routes` key found in the URL picks the CSV; records every URL. */
function stubApi(routes: Record<string, string | Error>) {
  const urls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    const u = parse(url)
    const hit = Object.keys(routes).find((k) => `${u.pathname}?${u.searchParams.get('elements') ?? ''}`.includes(k))
    const body = hit === undefined ? 'station,datetime\n' : routes[hit]
    if (body instanceof Error) return new Response('not found', { status: 404 })
    return new Response(body, { status: 200 })
  })
  return urls
}

describe('getStationRecord: VPD from /derived', () => {
  afterEach(() => vi.unstubAllGlobals())

  const obs = `station,datetime,Air Temperature @ 2 m [°F],provisional
s1,2026-11-01 00:00:00-06:00,30,False
s1,2026-11-01 01:00:00-06:00,29,False
`
  const vpd = `station,datetime,${DERIVED}
s1,2026-11-01 00:00:00-06:00,1.25
s1,2026-11-01 01:00:00-06:00,1.5
`

  it('serves VPD without asking observations for vpd_atmo', async () => {
    const urls = stubApi({ 'observations/hourly': obs, 'derived/hourly?vpd': vpd })
    const rows = await getStationRecord({ station: 's1', start: '2026-11-01', end: '2026-11-01', period: 'hourly', elements: 'air_temp,vpd_atmo' })
    expect(rows.map((r) => r[VPD_COLUMN])).toEqual([1.25, 1.5])
    expect(rows.every((r) => !(DERIVED in r))).toBe(true)
    const o = parse(urls.find((u) => u.includes('observations'))!)
    expect(o.searchParams.get('elements')).toBe('air_temp')
    const d = parse(urls.find((u) => u.includes('derived'))!)
    expect(d.searchParams.get('elements')).toBe('vpd')
    expect(d.searchParams.has('public')).toBe(false)
  })

  it('a VPD-only request makes no observations request', async () => {
    const urls = stubApi({ 'derived/hourly?vpd': vpd })
    const rows = await getStationRecord({ station: 's1', start: '2026-11-01', period: 'hourly', elements: 'vpd_atmo' })
    expect(rows.map((r) => r[VPD_COLUMN])).toEqual([1.25, 1.5])
    expect(urls.some((u) => u.includes('observations'))).toBe(false)
  })

  it('asks native /derived/ rows for the raw view', async () => {
    const urls = stubApi({ observations: obs, 'derived?vpd': vpd })
    await getStationRecord({ station: 's1', start: '2026-11-01', period: 'raw', elements: 'air_temp,vpd_atmo' })
    const p = urls.map((u) => parse(u).pathname).find((x) => x.includes('derived'))!
    expect(p.endsWith('/derived') || p.endsWith('/derived/')).toBe(true)
  })

  it('drops VPD from a daily min/max request (the API has no daily extremes of it)', async () => {
    const urls = stubApi({ 'observations/daily': 'station,datetime\n' })
    await getStationRecord({ station: 's1', start: '2026-11-01', period: 'daily', elements: 'air_temp,vpd_atmo', aggFunc: ['min', 'max'] })
    expect(urls.some((u) => u.includes('derived'))).toBe(false)
    expect(parse(urls[0]).searchParams.get('elements')!.split(',')).not.toContain('vpd_atmo')
  })

  it('leaves VPD empty, keeping the observations, when the derived request fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubApi({ 'observations/hourly': obs, 'derived/hourly?vpd': new Error('404') })
    const rows = await getStationRecord({ station: 's1', start: '2026-11-01', period: 'hourly', elements: 'air_temp,vpd_atmo' })
    expect(rows.map((r) => r['Air Temperature [°F]'] ?? r['Air Temperature @ 2 m [°F]'])).toEqual([30, 29])
    expect(rows.every((r) => r[VPD_COLUMN] === undefined || r[VPD_COLUMN] === null)).toBe(true)
  })
})

describe('getStationLatest: VPD from /derived', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('adds the derived VPD to a station without the sensor, at the same instant', async () => {
    stubApi({
      latest: 'station,datetime,Air Temperature @ 2 m [°F],Relative Humidity [%],provisional\ns1,2026-11-03 12:20:00-07:00,48.2,41,True\n',
      'derived?vpd': `station,datetime,${DERIVED}\ns1,2026-11-03 12:20:00-07:00,4.26\n`,
    })
    const [row] = await getStationLatest('s1')
    expect(row[VPD_COLUMN]).toBe(4.26)
    expect(row.provisional).toBe(true)
  })

  it('replaces the sensor reading where there is one', async () => {
    stubApi({
      latest: `station,datetime,${VPD_COLUMN}\ns1,2026-11-03 12:20:00-07:00,4.1\n`,
      'derived?vpd': `station,datetime,${DERIVED}\ns1,2026-11-03 12:20:00-07:00,4.12\n`,
    })
    const [row] = await getStationLatest('s1')
    expect(row[VPD_COLUMN]).toBe(4.12)
  })

  it('a station without the inputs (derived 404) gets no VPD column', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubApi({ latest: 'station,datetime,Precipitation [in]\ns1,2026-11-03 12:20:00-07:00,0\n', 'derived?vpd': new Error('404') })
    const [row] = await getStationLatest('s1')
    expect(VPD_COLUMN in row).toBe(false)
  })
})
