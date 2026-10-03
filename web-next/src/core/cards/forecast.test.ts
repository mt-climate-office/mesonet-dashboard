import { describe, expect, it } from 'vitest'
import type { ForecastPeriod } from '../api'
import { forecastDetailUrl, forecastHeading, forecastRows } from './forecast'

const period = (n: number, extra: Partial<ForecastPeriod> = {}): ForecastPeriod => ({
  number: n,
  name: `P${n}`,
  startTime: '',
  endTime: '',
  isDaytime: n % 2 === 1,
  temperature: 50 + n,
  temperatureUnit: 'F',
  windSpeed: '5 mph',
  windDirection: 'W',
  icon: `https://api.weather.gov/icons/land/day/few?size=medium`,
  shortForecast: 'Sunny',
  detailedForecast: 'Sunny, with a high near 52.',
  ...extra,
})

describe('forecastRows', () => {
  it('keeps the first 8 periods with legacy text', () => {
    const rows = forecastRows(Array.from({ length: 14 }, (_, i) => period(i + 1)))
    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ key: 1, name: 'P1', temp: '51°F', short: 'Sunny', precip: null, isDaytime: true })
  })
  it('shows precipitation chance only above 0', () => {
    const rows = forecastRows([
      period(1, { probabilityOfPrecipitation: { value: 30, unitCode: 'wmoUnit:percent' } }),
      period(2, { probabilityOfPrecipitation: { value: 0, unitCode: 'wmoUnit:percent' } }),
      period(3, { probabilityOfPrecipitation: { value: null, unitCode: 'wmoUnit:percent' } }),
    ])
    expect(rows.map((r) => r.precip)).toEqual(['30%', null, null])
  })
  it('drops icons from any host but api.weather.gov over https', () => {
    expect(forecastRows([period(1, { icon: 'http://api.weather.gov/x' })])[0].icon).toBeNull()
    expect(forecastRows([period(1, { icon: 'https://evil.example/x' })])[0].icon).toBeNull()
    expect(forecastRows([period(1)])[0].icon).toMatch(/^https:\/\/api\.weather\.gov\//)
  })
})

describe('heading + link', () => {
  it('prefers the NWS place name', () => {
    expect(forecastHeading({ location: 'Bozeman, MT', periods: [], hourlyUrl: null }, 'Bozeman Ag')).toBe('Bozeman, MT · NWS forecast')
    expect(forecastHeading(undefined, 'Bozeman Ag')).toBe('Bozeman Ag · NWS forecast')
  })
  it('builds the MapClick URL', () => {
    expect(forecastDetailUrl(45.6, -111.1)).toBe('https://forecast.weather.gov/MapClick.php?lat=45.6&lon=-111.1')
  })
})
