import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { parseCsv } from '../csv'
import type { NormalRow } from '../normals'
import {
  buildOverview,
  feelsLikeF,
  hourlyPrecip,
  isStale,
  normalMedianOn,
  precipSummary,
  readConditions,
  sparkQuery,
  sparkSeries,
  stampEpochMs,
  todayHighLow,
  updatedText,
  ytdNormal,
} from './index'

// Real /latest rows (2026-10-01/02), parsed like the app (LAB_SWAP headers).
const LATEST_BOZ = parseCsv<ObservationRow>(
  'station,datetime,Air Temperature @ 2 m [°F],Precipitation [in],Max Precip Rate [in/h],Atmospheric Pressure [mbar],Relative Humidity [%],Soil Temperature @ -5 cm [°F],Soil Temperature @ -10 cm [°F],Soil VWC @ -5 cm [%],Soil VWC @ -10 cm [%],Solar Radiation [W/m²],Wind Direction @ 10 m [deg],Wind Speed @ 10 m [mi/h],Gust Speed @ 10 m [mi/h],Snow Depth [in],provisional\n' +
    'acebozem,2026-10-01 21:55:00-06:00,56.984,0.0,0.0,848.93,60.38,58.55,59.36,8.65,13.35,0.0,111.6,12.994,18.678,0.018,True\n',
)[0]
const LATEST_KEOGH = parseCsv<ObservationRow>(
  'station,datetime,Air Temperature @ 8 ft [°F],Precipitation [in],Relative Humidity [%],Soil VWC @ -10 cm [%],VPD [mbar],Wind Direction @ 8 ft [deg],Wind Speed @ 8 ft [mi/h],provisional\n' +
    'arskeogh,2026-10-02 08:00:00-06:00,48.2,0.0,64.4,25.7,4.1,149.8,7.494,False\n',
)[0]

const hourly = (rows: [string, number | null, number | null][]): ObservationRow[] =>
  rows.map(([dt, t, p]) => ({ station: 'x', datetime: dt, 'Air Temperature [°F]': t, 'Precipitation [in]': p, 'Soil VWC @ 4 in [%]': 10, 'Soil VWC @ 2 in [%]': 9 }))

const HOURLY = hourly(
  Array.from({ length: 72 }, (_, i) => {
    const day = ['2026-09-29', '2026-09-30', '2026-10-01'][Math.floor(i / 24)]
    const h = String(i % 24).padStart(2, '0')
    return [`${day} ${h}:00:00-06:00`, 40 + (i % 24), i === 70 ? 0.1 : i === 40 ? 0.2 : 0] as [string, number, number]
  }),
)

describe('stamp', () => {
  it('honours the offset', () => {
    expect(stampEpochMs('2026-10-01 21:55:00-06:00')).toBe(Date.UTC(2026, 9, 2, 3, 55))
    expect(stampEpochMs('2026-10-01T21:55:00+0000')).toBe(Date.UTC(2026, 9, 1, 21, 55))
    expect(stampEpochMs('2026-10-01 21:55:00')).toBeNull()
    expect(stampEpochMs('nope')).toBeNull()
    expect(stampEpochMs(null)).toBeNull()
  })
  it('updated text and staleness', () => {
    const t = Date.UTC(2026, 9, 2, 3, 55)
    expect(updatedText('', t, t + 20_000)).toBe('Updated just now')
    expect(updatedText('', t, t + 7 * 60_000)).toBe('Updated 7 min ago')
    expect(updatedText('', t, t + 3 * 3_600_000 + 5)).toBe('Updated 3 h ago')
    expect(updatedText('2026-10-01 21:55:00-06:00', t, t + 72 * 3_600_000)).toBe('Updated Oct 1, 2026 9:55 PM')
    expect(isStale(t, t + 2 * 3_600_000)).toBe(false)
    expect(isStale(t, t + 2 * 3_600_000 + 1)).toBe(true)
  })
})

describe('readConditions', () => {
  it('reads a HydroMet row', () => {
    const c = readConditions(LATEST_BOZ)
    expect(c.airF).toBe(56.984)
    expect(c.windMph).toBe(12.994)
    expect(c.gustMph).toBe(18.678)
    expect(c.windDeg).toBe(111.6)
    expect(c.pressureMb).toBe(848.93)
    expect(c.snowIn).toBe(0.018)
    expect(c.vpdMb).toBeNull()
    expect(c.provisional).toBe(true)
    expect(c.soil).toEqual([
      { depthIn: 2, tempF: 58.55, vwc: 8.65 },
      { depthIn: 4, tempF: 59.36, vwc: 13.35 },
    ])
  })
  it('reads an AgriMet row (8 ft sensors, VPD, no pressure)', () => {
    const c = readConditions(LATEST_KEOGH)
    expect(c.airF).toBe(48.2)
    expect(c.vpdMb).toBe(4.1)
    expect(c.pressureMb).toBeNull()
    expect(c.provisional).toBe(false)
    expect(c.soil).toEqual([{ depthIn: 4, tempF: null, vwc: 25.7 }])
  })
})

describe('feelsLikeF (NWS)', () => {
  it('wind chill when cold and windy', () => {
    const f = feelsLikeF(20, 50, 15)!
    expect(f.regime).toBe('wind_chill')
    expect(f.valueF).toBeCloseTo(6.2, 0)
  })
  it('heat index when hot', () => {
    const f = feelsLikeF(95, 50, 5)!
    expect(f.regime).toBe('heat_index')
    expect(f.valueF).toBeGreaterThan(100)
  })
  it('air temperature in between; null without a temperature', () => {
    expect(feelsLikeF(57, 60, 13)).toEqual({ valueF: expect.closeTo(57, 9), regime: 'air_temp' })
    expect(feelsLikeF(null, 60, 13)).toBeNull()
  })
})

describe('series', () => {
  it('48 h sparkline series ending at the newest row; soil = shallowest VWC', () => {
    const s = sparkSeries(HOURLY)
    expect(s.air?.t).toHaveLength(48)
    expect(s.air?.v.at(-1)).toBe(40 + 23)
    expect(s.soil?.v[0]).toBe(9)
    expect(s.wind).toBeUndefined()
    expect(sparkSeries([])).toEqual({})
  })
  it('today high/low from the hourly rows of that local date', () => {
    expect(todayHighLow(HOURLY, '2026-09-30')).toEqual({ hi: 63, lo: 40 })
    expect(todayHighLow(HOURLY, '2026-10-05')).toBeNull()
  })
  it('hourly precipitation sums', () => {
    const p = hourlyPrecip(HOURLY, '2026-10-01')!
    expect(p.sinceMidnight).toBeCloseTo(0.1, 9)
    expect(p.last24h).toBeCloseTo(0.1, 9)
    expect(hourlyPrecip(HOURLY, '2026-09-30')?.sinceMidnight).toBeCloseTo(0.2, 9)
  })
  it('sparkQuery: two days back, level 2, optional elements the station reports', () => {
    const q = sparkQuery('acebozem', '2026-10-01', LATEST_BOZ)
    expect(q.query).toEqual({ station: 'acebozem', start: '2026-09-29', period: 'hourly', elements: 'air_temp,rh,wind_spd,ppt,sol_rad,soil_vwc,bp,snow_depth', level: 2 })
    expect(q.key).toContain('acebozem:hourly:2026-09-29')
    expect(sparkQuery('arskeogh', '2026-03-01', LATEST_KEOGH).query.elements).toMatch(/,vpd_atmo$/)
    expect(sparkQuery('arskeogh', '2026-03-01', LATEST_KEOGH).query.start).toBe('2026-02-27')
  })
})

describe('precip & normals', () => {
  it('prefers the /derived/ppt/ summary, else hourly sums', () => {
    const row = { station: 'x', 'Year to Date Precipitation [in]': 13.119, '7-day Precipitation [in]': 0.05, '24-hour Precipitation [in]': 0, 'Precipitation Since Midnight [in]': '0.0' }
    expect(precipSummary(row, null)).toEqual({ sinceMidnight: 0, last24h: 0, last7d: 0.05, ytd: 13.119 })
    expect(precipSummary(undefined, { sinceMidnight: 0.1, last24h: 0.2 })).toEqual({ sinceMidnight: 0.1, last24h: 0.2, last7d: null, ytd: null })
  })
  const rows = (vals: [number, number, number][]): NormalRow[] =>
    vals.map(([month, day, v]) => ({ type: 'daily', variable: 'pr', month, day, q25: null, q75: null, median: v, mean: v }))
  it('normal median on a day', () => {
    expect(normalMedianOn(rows([[10, 1, 66.83]]), '2026-10-01')).toBe(66.83)
    expect(normalMedianOn(rows([[10, 1, 66.83]]), '2026-10-02')).toBeNull()
  })
  it('YTD normal sums daily means through today; Feb 29 only in leap years', () => {
    const r = rows([[1, 1, 0.1], [2, 28, 0.1], [2, 29, 0.1], [3, 1, 0.1], [3, 2, 5]])
    expect(ytdNormal(r, '2026-03-01')).toBeCloseTo(0.3, 9)
    expect(ytdNormal(r, '2028-03-01')).toBeCloseTo(0.4, 9)
    expect(ytdNormal([], '2026-03-01')).toBeNull()
  })
})

describe('buildOverview', () => {
  const base = { hourly: undefined, ppt: undefined, normals: {}, today: '2026-10-01', nowMs: Date.UTC(2026, 9, 2, 4, 0) }
  it('empty until /latest arrives', () => {
    expect(buildOverview({ ...base, latest: undefined })).toEqual({ freshness: null, hero: null, tiles: [] })
  })
  it('tier 1 only: header, hero and tiles without sparklines (no ppt source → no precip tile)', () => {
    const o = buildOverview({ ...base, latest: LATEST_BOZ })
    expect(o.freshness).toEqual({ updated: 'Updated 5 min ago', stale: false, provisional: true })
    expect(o.hero).toMatchObject({ temp: '57°', feels: 'Feels like 57°', feelsKind: null, highLow: null, normal: null, spark: null })
    expect(o.tiles.map((t) => t.id)).toEqual(['wind', 'rh', 'solar', 'pressure', 'soil', 'snow'])
    const wind = o.tiles[0]
    expect(wind).toMatchObject({ value: '13', unit: 'mph', detail: ['Gust 19 mph', 'From ESE 112°'], windDeg: 111.6, vars: ['Wind Speed'] })
    expect(o.tiles.find((t) => t.id === 'soil')?.soil?.[0]).toEqual({ depth: '2 in', temp: '59°', vwc: '8.7%', bar: 17.3 })
  })
  it('tier 2: sparklines, today high/low and normals', () => {
    const tmmx = rows2(66.83)
    const tmmn = rows2(38.39)
    const o = buildOverview({ ...base, latest: LATEST_BOZ, hourly: HOURLY, normals: { tmmx, tmmn } })
    expect(o.hero?.highLow).toBe('High 63° · Low 40°')
    expect(o.hero?.normal).toBe('Normal 67° / 38°')
    expect(o.hero?.spark?.d).toMatch(/^M/)
    expect(o.hero?.sparkLabel).toBe('Last 48 hours: from 40 to 63 °F.')
    expect(o.tiles.find((t) => t.id === 'precip')?.spark?.kind).toBe('bars')
  })
  it('YTD vs normal on the precipitation tile', () => {
    const pr: NormalRow[] = [{ type: 'daily', variable: 'pr', month: 1, day: 1, q25: null, q75: null, median: 0, mean: 15 }]
    const ppt = { station: 'x', 'Year to Date Precipitation [in]': 13.119, '7-day Precipitation [in]': 0.05, '24-hour Precipitation [in]': 0, 'Precipitation Since Midnight [in]': 0 }
    const t = buildOverview({ ...base, latest: LATEST_BOZ, ppt, normals: { pr } }).tiles.find((x) => x.id === 'precip')!
    expect(t.value).toBe('0.00')
    expect(t.detail).toEqual(['24 h 0.00 in · 7 d 0.05 in', 'Year to date 13.12 in · 87% of normal'])
  })
  it('AgriMet: VPD tile, no pressure, stale after 2 h', () => {
    const o = buildOverview({ ...base, latest: LATEST_KEOGH, nowMs: Date.UTC(2026, 9, 2, 17, 0) })
    expect(o.tiles.map((t) => t.id)).toEqual(['wind', 'rh', 'soil', 'vpd'])
    expect(o.freshness).toMatchObject({ stale: true, provisional: false, updated: 'Updated 3 h ago' })
  })
})

function rows2(median: number): NormalRow[] {
  return [{ type: 'daily', variable: 'x', month: 10, day: 1, q25: null, q75: null, median }]
}
