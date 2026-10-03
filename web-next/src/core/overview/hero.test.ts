import { describe, expect, it } from 'vitest'
import type { ForecastPeriod, ObservationRow } from '../api'
import { buildHero, type HeroInput } from './hero'

const H = 3_600_000
const LATEST = {
  station: 'acebozem',
  datetime: '2026-10-01 21:55:00-06:00',
  'Air Temperature [°F]': 56.984,
  'Wind Speed [mi/h]': 12.994,
  'Wind Direction [deg]': 111.6,
  'Relative Humidity [%]': 60,
  provisional: true,
}
// Hourly rows from Sep 29 00:00 to Oct 1 21:00: 40–63 °F daily cycle; rain on Sep 29 only.
const HOURLY: ObservationRow[] = Array.from({ length: 70 }, (_, i) => {
  const day = ['2026-09-29', '2026-09-30', '2026-10-01'][Math.floor(i / 24)]
  return { station: 'x', datetime: `${day} ${String(i % 24).padStart(2, '0')}:00:00-06:00`, 'Air Temperature [°F]': 40 + (i % 24), 'Precipitation [in]': i === 10 ? 0.2 : 0 }
})
const period = (number: number, name: string, start: string, end: string, temperature: number, shortForecast: string, isDaytime: boolean): ForecastPeriod => ({
  number, name, startTime: start, endTime: end, isDaytime, temperature, temperatureUnit: 'F', windSpeed: '', windDirection: '', icon: 'https://api.weather.gov/icons/land/night/few', shortForecast, detailedForecast: '',
})
const PERIODS = [
  period(1, 'Tonight', '2026-10-01T18:00:00-06:00', '2026-10-02T06:00:00-06:00', 45, 'Mostly Clear', false),
  period(2, 'Thursday', '2026-10-02T06:00:00-06:00', '2026-10-02T18:00:00-06:00', 68, 'Sunny', true),
  period(3, 'Thursday Night', '2026-10-02T18:00:00-06:00', '2026-10-03T06:00:00-06:00', 43, 'Partly Cloudy', false),
]
const NOW = Date.UTC(2026, 9, 1, 21, 55)
const HOURLY_FC = Array.from({ length: 30 }, (_, i) => ({ t: Date.UTC(2026, 9, 1, 21) + i * H, tempF: 55 - i / 2, isDaytime: false, shortForecast: 'Clear', pop: 0 }))

const BASE: HeroInput = {
  latest: LATEST,
  hourly: HOURLY,
  ppt: undefined,
  normals: {},
  today: '2026-10-01',
  nowMs: Date.UTC(2026, 9, 2, 4, 0),
  forecast: { location: 'Bozeman, MT', periods: PERIODS, hourlyUrl: null },
  forecastHourly: HOURLY_FC,
}

describe('buildHero', () => {
  it('temperature, high/low, summary and freshness', () => {
    const h = buildHero(BASE)
    expect(h.temp).toBe('57°')
    expect(h.highLow).toBe('High 61° · Low 40°')
    expect(h.summary).toBe('Mostly clear tonight, breezy ESE wind, no rain in 2 days.')
    expect(h.freshness).toEqual({ updated: 'Updated 5 min ago', stale: false, provisional: true })
  })
  it('strip: observed (now − 24 h, now] ending at /latest, forecast (now, now + 24 h], periods by midpoint', () => {
    const s = buildHero(BASE).strip!
    expect(s.now).toEqual({ t: NOW, v: 56.984 })
    expect(s.observed.t[0]).toBe(Date.UTC(2026, 8, 30, 22))
    expect(s.observed.t.at(-1)).toBe(NOW)
    expect(s.observed.v.at(-1)).toBe(56.984)
    expect(s.forecast.t[0]).toBe(Date.UTC(2026, 9, 1, 22))
    expect(s.forecast.t.at(-1)).toBe(Date.UTC(2026, 9, 2, 21))
    expect(s.periods.map((p) => [p.t, p.label])).toEqual([
      [Date.UTC(2026, 9, 2, 0), 'Tonight 45°'],
      [Date.UTC(2026, 9, 2, 12), 'Thursday 68°'],
    ])
    expect(s.periods[0].icon).toMatch(/^https:\/\/api\.weather\.gov\//)
  })
  it('without the forecast: no sky in the summary, observed-only strip', () => {
    const h = buildHero({ ...BASE, forecast: undefined, forecastHourly: undefined })
    expect(h.summary).toBe('Breezy ESE wind, no rain in 2 days.')
    expect(h.strip?.forecast).toEqual({ t: [], v: [] })
    expect(h.strip?.periods).toEqual([])
  })
  it('a non-NWS icon URL is dropped', () => {
    const periods = [{ ...PERIODS[0], icon: 'https://example.com/x.png' }]
    expect(buildHero({ ...BASE, forecast: { location: null, periods, hourlyUrl: null } }).strip?.periods[0].icon).toBeNull()
  })
  it('empty until /latest arrives', () => {
    expect(buildHero({ ...BASE, latest: undefined })).toEqual({ temp: null, feels: null, feelsKind: null, highLow: null, normal: null, summary: '', strip: null, freshness: null })
  })
})
