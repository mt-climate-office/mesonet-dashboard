import { describe, expect, it } from 'vitest'
import sample from './__fixtures__/nws-hourly-tfx-97-54.json?raw'
import { fetchNwsHourly, isNwsUrl, parseNwsHourly } from './nwsForecast'

// Recorded 2026-10-02 from api.weather.gov/gridpoints/TFX/97,54/forecast/hourly (first 6 hours, trimmed fields).
const SAMPLE: unknown = JSON.parse(sample)

describe('parseNwsHourly', () => {
  it('parses the recorded sample into Denver wall-clock hours, °F', () => {
    const h = parseNwsHourly(SAMPLE)
    expect(h).toHaveLength(6)
    expect(h[0]).toEqual({ t: Date.UTC(2026, 9, 2, 21), tempF: 58, isDaytime: false, shortForecast: 'Mostly Clear', pop: 1 })
    expect(h[1].t - h[0].t).toBe(3_600_000)
  })
  it('converts Celsius (unit "C" or a degC quantity) and drops unusable hours', () => {
    const h = parseNwsHourly({
      properties: {
        periods: [
          { startTime: '2026-10-03T01:00:00-06:00', temperature: { unitCode: 'wmoUnit:degC', value: 10 } },
          { startTime: '2026-10-03T00:00:00-06:00', temperature: 0, temperatureUnit: 'C', probabilityOfPrecipitation: { value: null } },
          { startTime: '2026-10-03T02:00:00-06:00', temperature: null },
          { temperature: 50, temperatureUnit: 'F' },
        ],
      },
    })
    expect(h.map((p) => [p.t, p.tempF, p.pop])).toEqual([
      [Date.UTC(2026, 9, 3, 0), 32, null],
      [Date.UTC(2026, 9, 3, 1), 50, null],
    ])
  })
  it('empty or malformed input gives no hours', () => {
    expect(parseNwsHourly(null)).toEqual([])
    expect(parseNwsHourly({})).toEqual([])
  })
})

describe('isNwsUrl', () => {
  it('accepts only https://api.weather.gov/ URLs; the fetches refuse any other before the network', async () => {
    expect(isNwsUrl('https://api.weather.gov/gridpoints/TFX/97,54/forecast/hourly')).toBe(true)
    expect(isNwsUrl('https://api.weather.gov.evil.com/x')).toBe(false)
    expect(isNwsUrl('http://api.weather.gov/x')).toBe(false)
    expect(isNwsUrl(undefined)).toBe(false)
    await expect(fetchNwsHourly('https://example.com/hourly')).rejects.toThrow(/not on api\.weather\.gov/)
  })
})
