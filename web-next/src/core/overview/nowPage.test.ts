import { describe, expect, it } from 'vitest'
import type { SoilParams, SoilSeries } from '../ag/contract'
import { SWP_CAP_BAR } from '../ag/view/labels'
import type { ObservationRow } from '../api'
import { buildNowPage, latestSwpBar, nowSwpQuery, rainNow, stationMeta, type NowPageInput } from './nowPage'
import { CALM_MPH } from './summary'

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
    expect(tile('precip')).toMatchObject({ value: '0.05', unit: 'in', sub: 'Last 7 days', detail: 'This year: 87% of normal' })
  })
  it('wind with gust rows: "now · SSE" beside the value, the 24 h peak gust below; "Calm" under 1 mph', () => {
    const hourly: ObservationRow[] = [{ station: 'x', datetime: '2026-10-01 02:00:00-06:00', 'Gust Speed [mi/hr]': 43.24 }]
    const wind = (w: number) => buildNowPage({ ...BASE, latest: { ...LATEST, 'Wind Speed [mi/h]': w }, hourly }).tiles.find((t) => t.id === 'wind')
    expect(wind(1.2)).toMatchObject({ value: '1', unit: 'mph', note: 'now · SSE', sub: 'Peak gust 43 mph (24 h)' })
    expect(wind(0.4)).toMatchObject({ value: 'Calm', unit: '', note: '', sub: 'Peak gust 43 mph (24 h)' })
  })
  it('one calm threshold (CALM_MPH, Beaufort 0): the tile and the summary agree on either side of it', () => {
    const hourly: ObservationRow[] = [{ station: 'x', datetime: '2026-10-01 02:00:00-06:00', 'Gust Speed [mi/hr]': 9 }]
    const page = (w: number) => buildNowPage({ ...BASE, latest: { ...LATEST, 'Wind Speed [mi/h]': w }, hourly })
    const below = page(CALM_MPH - 0.01)
    expect(below.tiles.find((t) => t.id === 'wind')?.value).toBe('Calm')
    expect(below.hero.summary).toMatch(/\bcalm\b/i)
    const at = page(CALM_MPH)
    expect(at.tiles.find((t) => t.id === 'wind')?.value).toBe('1')
    expect(at.hero.summary).toMatch(/light SSE wind/i)
  })
  it('rain now, after the window: the latest rate, or whether any fell in the latest interval', () => {
    expect(rainNow({ pptIn: 0.01, pptRateInH: 0.123 })).toBe('0.12 in/h now')
    expect(rainNow({ pptIn: 0, pptRateInH: 0.002 })).toBe('raining now')
    expect(rainNow({ pptIn: 0.01, pptRateInH: null })).toBe('raining now') // AgriMet: no rate column
    expect(rainNow({ pptIn: 0, pptRateInH: 0 })).toBe('dry now')
    expect(rainNow({ pptIn: null, pptRateInH: null })).toBe('')
    const page = buildNowPage({ ...BASE, latest: { ...LATEST, 'Precipitation [in]': 0, 'Max Precip Rate [in/h]': 0 } })
    expect(page.tiles.find((t) => t.id === 'precip')?.sub).toBe('Last 7 days · dry now')
  })
  it('rain without the ppt summary: the last 24 h from the hourly rows', () => {
    const hourly: ObservationRow[] = [{ station: 'x', datetime: '2026-10-01 10:00:00-06:00', 'Precipitation [in]': 0.12 }]
    expect(buildNowPage({ ...BASE, ppt: undefined, hourly }).tiles.find((t) => t.id === 'precip')).toMatchObject({ value: '0.12', sub: 'Last 24 hours', detail: '' })
  })
  it('rain: 7 daily bars when it rained this week, a bare zero baseline in a dry week, nothing before the rows load', () => {
    const daily = (vals: number[]): ObservationRow[] => vals.map((v, i) => ({ station: 'x', datetime: ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'][i], 'Precipitation [in]': v }))
    const rain = (rainDaily?: ObservationRow[]) => buildNowPage({ ...BASE, rainDaily }).tiles.find((t) => t.id === 'precip')!
    expect(rain(daily([0, 0, 0.3, 0, 0, 0, 0])).spark).toMatchObject({ kind: 'bars', points: 7 })
    expect(rain(daily([0, 0, 0.3, 0, 0, 0, 0])).spark?.bars).toHaveLength(1)
    expect(rain(daily([0, 0, 0, 0, 0, 0, 0]))).toMatchObject({ spark: { kind: 'bars', bars: [] }, sparkLabel: 'Last 7 days: no rain.' })
    expect(rain(undefined).spark).toBeNull()
  })
  it('sparkline sentences in the plain unit and display precision (mb, not mbar)', () => {
    const hourly: ObservationRow[] = [3, 4.12].map((v, i) => ({ station: 'x', datetime: `2026-10-01 1${i}:00:00-06:00`, 'VPD [mbar]': v, 'Relative Humidity [%]': 40 + i * 10 }))
    const p = buildNowPage({ ...BASE, latest: { ...LATEST, 'VPD [mbar]': 4.1 }, hourly })
    expect(p.tiles.find((t) => t.id === 'vpd')?.sparkLabel).toBe('Last 48 hours: from 3.0 to 4.1 mb.')
    expect(p.tiles.find((t) => t.id === 'rh')?.sparkLabel).toBe('Last 48 hours: from 40 to 50%.')
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
    const bare = Object.fromEntries(Object.entries(LATEST).filter(([k]) => !/^(Atmospheric Pressure|Snow Depth)/.test(k)))
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
  it('request: hourly level-2 soil VWC from yesterday through today; the key encodes every input', () => {
    const q = nowSwpQuery('acebozem', '2026-10-01')
    expect(q.key).toBe('soil:acebozem:hourly:2026-09-30:2026-10-01:l2')
    expect(q.query).toEqual({ station: 'acebozem', start: '2026-09-30', end: '2026-10-01', period: 'hourly', level: 2 })
  })

  // FX with n = 0.5 makes the dry tail steep: VWC 5 % → ~4.9e6 bar.
  const fx = { r: 0, s: 0.5, n: 0.5, m: 1, h: 1 }
  const params: SoilParams[] = [5, 10].map((depthCm) => ({ station: 'x', depthCm, model: 'FX', fx, labVwcMin: 5, labVwcMax: 50, source: 'vendored', release: 'r' }))
  const soil = (vwc5: (number | null)[], vwc10: (number | null)[], temp10 = [10, 10, 10]): SoilSeries => ({
    station: 'x',
    level: 2,
    provisional: [false, false, false],
    depthsCm: [10, 5],
    time: ['2026-10-01T10:00', '2026-10-01T11:00', '2026-10-01T12:00'],
    epochMs: [0, 3_600_000, 7_200_000],
    vwcPct: [vwc10, vwc5],
    tempC: [temp10, [10, 10, 10]],
  })
  const bar = (theta: number) => (Math.exp(0.5 / theta) - Math.E) ** 2 / 100

  it('the shallowest depth of the newest hour that has one', () => {
    expect(latestSwpBar(soil([30, 25, 40], [30, 28, 27]), params)).toBeCloseTo(bar(0.4), 9)
    expect(latestSwpBar(soil([30, 25, null], [30, 28, 27]), params)).toBeCloseTo(bar(0.27), 9)
    expect(latestSwpBar(soil([null, null, null], [null, null, null]), params)).toBeNull()
    expect(latestSwpBar(undefined, params)).toBeNull()
    expect(latestSwpBar(soil([30, 25, 40], [30, 28, 27]), undefined)).toBeNull()
  })
  it('skips frozen readings', () => {
    expect(latestSwpBar(soil([30, 25, null], [30, 28, 27], [10, 10, -1]), params)).toBeCloseTo(bar(0.25), 9)
  })
  it('a dry-end clip (VWC below the lab range) reads as the capped lower bound', () => {
    expect(latestSwpBar(soil([30, 25, 2], [30, 28, 27]), params)).toBe(SWP_CAP_BAR)
  })
})
