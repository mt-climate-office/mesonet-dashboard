import { describe, expect, it } from 'vitest'
import { forecastDetailUrl } from './forecast'

describe('forecastDetailUrl', () => {
  it('builds the MapClick URL', () => {
    expect(forecastDetailUrl(45.6, -111.1)).toBe('https://forecast.weather.gov/MapClick.php?lat=45.6&lon=-111.1')
  })
})
