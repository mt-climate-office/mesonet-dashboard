import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { parseCsv } from '../csv'
import type { NormalRow } from '../normals'
import { denverToday } from '../today'
import {
  feelsLikeF,
  freshness,
  hasSnow,
  hourlyPrecip,
  isStale,
  normalMedianOn,
  precipSummary,
  readConditions,
  reportedTiles,
  sparkQuery,
  sparkSeries,
  stampEpochMs,
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
  it('rain since midnight follows the Denver day: 23:30 MDT keeps the day, 00:30 MDT starts a new one', () => {
    const late = denverToday(Date.parse('2026-10-01T05:30:00Z')) // Sep 30, 23:30 MDT
    const early = denverToday(Date.parse('2026-10-01T06:30:00Z')) // Oct 1, 00:30 MDT
    expect(hourlyPrecip(HOURLY, late)?.sinceMidnight).toBeCloseTo(0.2, 9)
    expect(hourlyPrecip(HOURLY.slice(0, 49), early)?.sinceMidnight).toBe(0)
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

describe('hasSnow', () => {
  const rows = (depths: (number | null)[]): ObservationRow[] =>
    depths.map((d, i) => ({ station: 'x', datetime: `2026-10-01 ${String(i).padStart(2, '0')}:00:00-06:00`, 'Snow Depth [in]': d }))
  it('latest depth ≥ 0.5 in', () => {
    expect(hasSnow(0.5, undefined)).toBe(true)
    expect(hasSnow(0.49, undefined)).toBe(false)
    expect(hasSnow(null, undefined)).toBe(false)
  })
  it('any hourly reading ≥ 0.5 in; sensor noise on bare ground is not snow', () => {
    expect(hasSnow(0, rows([0, 2.1, 0.8, 0]))).toBe(true)
    expect(hasSnow(0.02, rows([0.1, -0.3, null, 0.4]))).toBe(false)
    expect(hasSnow(0, [])).toBe(false)
  })
})

describe('freshness and reportedTiles', () => {
  const nowMs = Date.UTC(2026, 9, 2, 4, 0)
  const none = precipSummary(undefined, null)
  it('freshness: updated, stale after 2 h, provisional', () => {
    expect(freshness(readConditions(LATEST_BOZ), nowMs)).toEqual({ updated: 'Updated 5 min ago', stale: false, provisional: true })
    expect(freshness(readConditions(LATEST_KEOGH), Date.UTC(2026, 9, 2, 17, 0))).toMatchObject({ stale: true, provisional: false, updated: 'Updated 3 h ago' })
  })
  it('the tiles a station reports, in page order (no ppt source: no Rain; bare-ground snow: no snow)', () => {
    expect(reportedTiles(readConditions(LATEST_BOZ), undefined, none).map((t) => t.id)).toEqual(['wind', 'rh', 'solar', 'soil'])
    expect(reportedTiles(readConditions(LATEST_KEOGH), undefined, none).map((t) => t.id)).toEqual(['wind', 'rh', 'soil', 'vpd'])
    expect(reportedTiles(readConditions(LATEST_BOZ), undefined, { ...none, ytd: 13 }).map((t) => t.id)).toContain('precip')
  })
  it('snow depth: shown with snow now or in the 72 h rows', () => {
    expect(reportedTiles(readConditions({ ...LATEST_BOZ, 'Snow Depth [in]': 3.2 }), undefined, none).map((t) => t.id)).toContain('snow')
    const melted = HOURLY.map((r, i) => ({ ...r, 'Snow Depth [in]': i < 10 ? 1.4 : 0 }))
    expect(reportedTiles(readConditions(LATEST_BOZ), melted, none).map((t) => t.id)).toContain('snow')
  })
})
