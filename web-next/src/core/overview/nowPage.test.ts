import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildNowPage, latestSwpBar, nowSwpQuery, stationMeta, type NowPageInput } from './nowPage'

const LATEST = {
  station: 'acebozem',
  datetime: '2026-10-01 13:55:00-06:00',
  'Air Temperature [°F]': 68,
  'Relative Humidity [%]': 50,
  'Wind Speed [mi/h]': 7.4,
  'Gust Speed [mi/h]': 12.2,
  'Wind Direction [deg]': 157,
  'Atmospheric Pressure [mbar]': 847.2,
  'Solar Radiation [W/m²]': 400,
  'Soil VWC @ 2 in [%]': 8.36,
  'Soil Temperature @ 2 in [°F]': 60,
  'Snow Depth [in]': 0,
  provisional: true,
}
const PPT = { station: 'x', 'Year to Date Precipitation [in]': 13.119, '7-day Precipitation [in]': 0.049, '24-hour Precipitation [in]': 0, 'Precipitation Since Midnight [in]': 0 }
const PR = [{ type: 'daily', variable: 'pr', month: 1, day: 1, q25: null, q75: null, median: 0, mean: 15 }]
const BASE: NowPageInput = {
  latest: LATEST,
  hourly: undefined,
  ppt: PPT,
  normals: { pr: PR },
  today: '2026-10-01',
  nowMs: Date.UTC(2026, 9, 1, 20),
  forecast: undefined,
  forecastHourly: undefined,
  station: { sub_network: 'HydroMet', elevation: 1495.09 },
}
const pressure = (vals: number[]): ObservationRow[] =>
  vals.map((v, i) => ({ station: 'x', datetime: `2026-10-01 ${String(10 + i).padStart(2, '0')}:00:00-06:00`, 'Atmospheric Pressure [mbar]': v }))

describe('buildNowPage tiles', () => {
  const page = buildNowPage(BASE)
  const tile = (id: string) => page.tiles.find((t) => t.id === id)!
  it('plain names, the Charts id, display precision and units from core/variables/labels', () => {
    expect(page.tiles.map((t) => [t.id, t.v, t.name])).toEqual([
      ['wind', 'wind_spd', 'Wind'],
      ['precip', 'ppt', 'Rain'],
      ['rh', 'rh', 'Humidity'],
      ['solar', 'sol_rad', 'Sunlight'],
      ['soil', 'soil_vwc', 'Soil moisture'],
    ])
    expect(tile('soil')).toMatchObject({ value: '8', unit: '%', sub: '2 in deep', chip: null })
    expect(tile('solar')).toMatchObject({ value: '400', unit: 'W/m²' })
  })
  it('wind: compass word and gusts; humidity: dew point; rain: window and YTD share', () => {
    expect(tile('wind')).toMatchObject({ value: '7', unit: 'mph', sub: 'SSE · gusts 12' })
    expect(tile('rh').sub).toBe('Dew point 49°')
    expect(tile('precip')).toMatchObject({ value: '0.05', unit: 'in', sub: 'Last 7 days · 87% of normal this year' })
  })
  it('rain without the ppt summary: the last 24 h from the hourly rows', () => {
    const hourly: ObservationRow[] = [{ station: 'x', datetime: '2026-10-01 10:00:00-06:00', 'Precipitation [in]': 0.12 }]
    expect(buildNowPage({ ...BASE, ppt: undefined, hourly }).tiles.find((t) => t.id === 'precip')).toMatchObject({ value: '0.12', sub: 'Last 24 hours' })
  })
  it('the Dry/Wet chip from SWP', () => {
    expect(buildNowPage({ ...BASE, swpBar: 20 }).tiles.find((t) => t.id === 'soil')?.chip).toBe('Dry')
    expect(buildNowPage({ ...BASE, swpBar: 0.1 }).tiles.find((t) => t.id === 'soil')?.chip).toBe('Wet')
  })
})

describe('buildNowPage rows', () => {
  it('pressure with its 3 h trend once the hourly rows are in; snow none or its depth', () => {
    expect(buildNowPage(BASE).readingsMeta).toBe('Pressure 847 mb · Snow none')
    expect(buildNowPage({ ...BASE, hourly: pressure([846, 847, 848, 849.5]) }).readingsMeta).toBe('Pressure 847 mb, rising · Snow none')
    expect(buildNowPage({ ...BASE, latest: { ...LATEST, 'Snow Depth [in]': 3.24 } }).readingsMeta).toBe('Pressure 847 mb · Snow 3.2 in')
  })
  it('leaves out what the station does not report', () => {
    const { 'Atmospheric Pressure [mbar]': _p, 'Snow Depth [in]': _s, ...bare } = LATEST
    expect(buildNowPage({ ...BASE, latest: bare }).readingsMeta).toBe('')
  })
  it('station meta: network and elevation in feet', () => {
    expect(stationMeta({ sub_network: 'HydroMet', elevation: 1495.09 })).toBe('HydroMet · 4,905 ft')
    expect(stationMeta({ sub_network: 'AgriMet', elevation: Number.NaN })).toBe('AgriMet')
  })
  it('empty tiles and meta until /latest arrives; the station meta still shows', () => {
    const p = buildNowPage({ ...BASE, latest: undefined })
    expect(p).toMatchObject({ tiles: [], readingsMeta: '', icons: [], stationMeta: 'HydroMet · 4,905 ft' })
    expect(p.hero.temp).toBeNull()
  })
})

describe('icons', () => {
  it('only strip periods with an api.weather.gov icon', () => {
    const period = (n: number, name: string, start: string, end: string, icon: string) => ({
      number: n, name, startTime: start, endTime: end, isDaytime: false, temperature: 45, temperatureUnit: 'F', windSpeed: '', windDirection: '', icon, shortForecast: 'Clear', detailedForecast: '',
    })
    const forecast = { location: null, hourlyUrl: null, periods: [
      period(1, 'Tonight', '2026-10-01T18:00:00-06:00', '2026-10-02T06:00:00-06:00', 'https://api.weather.gov/icons/land/night/skc'),
      period(2, 'Thursday', '2026-10-02T06:00:00-06:00', '2026-10-02T18:00:00-06:00', 'https://example.com/sun.png'),
    ] }
    const p = buildNowPage({ ...BASE, forecast })
    expect(p.icons.map((i) => [i.label, i.icon, i.short])).toEqual([['Tonight 45°', 'https://api.weather.gov/icons/land/night/skc', 'Clear']])
  })
})

describe('soil water potential', () => {
  it('request: yesterday through today, hourly, level 2; the key encodes every input', () => {
    const q = nowSwpQuery('acebozem', '2026-10-01')
    expect(q.key).toBe('swp:acebozem:hourly:2026-09-30:2026-10-01:l2')
    expect(q.request).toEqual({ path: 'derived/hourly/', query: { stations: 'acebozem', start_time: '2026-09-30', end_time: '2026-10-02', elements: 'swp', level: 2 } })
  })
  it('the shallowest depth of the newest row that has one', () => {
    const rows = [
      { datetime: '2026-10-01 12:00:00-06:00', 'Soil Water Potential @ -5 cm [bar]': 3, 'Soil Water Potential @ -10 cm [bar]': 1 },
      { datetime: '2026-10-01 13:00:00-06:00', 'Soil Water Potential @ -5 cm [bar]': 4 },
      { datetime: '2026-10-01 14:00:00-06:00', 'Soil Water Potential @ -5 cm [bar]': null },
    ]
    expect(latestSwpBar(rows)).toBe(4)
    expect(latestSwpBar([])).toBeNull()
    expect(latestSwpBar(undefined)).toBeNull()
  })
})
