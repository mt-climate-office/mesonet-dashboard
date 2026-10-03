import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { daysSinceRain, isEvening, rainPhrase, skyPhrase, summarize, windClass, windPhrase, type SummaryInput } from './summary'

const P = { sinceMidnight: null, last24h: null, last7d: null, ytd: null }
const NOON = Date.UTC(2026, 9, 2, 12)
const NIGHT = Date.UTC(2026, 9, 2, 21)

describe('skyPhrase', () => {
  it.each([
    ['Sunny', 'clear'],
    ['Clear', 'clear'],
    ['Mostly Clear', 'mostly clear'],
    ['Mostly Sunny', 'mostly clear'],
    ['Partly Sunny', 'partly cloudy'],
    ['Partly Cloudy', 'partly cloudy'],
    ['Mostly Cloudy', 'mostly cloudy'],
    ['Cloudy', 'cloudy'],
    ['Rain Showers', 'rain'],
    ['Slight Chance Rain Showers', 'chance of rain'],
    ['Snow Showers Likely', 'snow likely'],
    ['Chance Rain And Snow', 'chance of rain and snow'],
    ['Showers And Thunderstorms Likely then Mostly Sunny', 'thunderstorms likely'],
    ['Mostly Sunny then Chance Showers', 'mostly clear'],
    ['Patchy Fog', 'fog'],
    ['Areas Of Smoke', 'smoke'],
    ['Freezing Drizzle', 'freezing rain'],
    ['Frost', null],
    ['', null],
    [null, null],
  ])('%s → %s', (input, out) => expect(skyPhrase(input)).toBe(out))
})

describe('wind', () => {
  it.each([
    [0, 'calm'],
    [2.9, 'calm'],
    [3, 'light'],
    [9.9, 'light'],
    [10, 'breezy'],
    [19.9, 'breezy'],
    [20, 'windy'],
  ] as const)('%s mph is %s', (mph, c) => expect(windClass(mph)).toBe(c))
  it.each([
    [2, 160, 'calm'],
    [5, 157.5, 'light SSE wind'],
    [12, 270, 'breezy W wind'],
    [25, 0, 'strong N wind'],
    [12, null, 'breezy wind'],
  ] as const)('%s mph from %s → %s', (mph, deg, out) => expect(windPhrase(mph, deg)).toBe(out))
})

describe('daysSinceRain', () => {
  const rows = (byDate: Record<string, number>): ObservationRow[] =>
    Object.entries(byDate).map(([d, v]) => ({ station: 'x', datetime: `${d} 12:00:00-06:00`, 'Precipitation [in]': v }))
  const DRY = rows({ '2026-09-30': 0, '2026-10-01': 0, '2026-10-02': 0 })
  it.each([
    ['rain today (summary)', { ...P, sinceMidnight: 0.2 }, undefined, 0],
    ['rain today (hourly only)', P, rows({ '2026-10-01': 0, '2026-10-02': 0.05 }), 0],
    ['last rain yesterday', { ...P, sinceMidnight: 0 }, rows({ '2026-09-30': 0.3, '2026-10-01': 0.01, '2026-10-02': 0 }), 1],
    ['last rain 2 days ago; a trace is not rain', P, rows({ '2026-09-30': 0.02, '2026-10-01': 0.005, '2026-10-02': 0 }), 2],
    ['dry rows, wet week: the dry days covered', { ...P, last7d: 0.4 }, DRY, 3],
    ['dry rows, no 7 d total: still the dry days covered', P, DRY, 3],
    ['dry week', { ...P, last7d: 0 }, DRY, Infinity],
    ['dry week, no rows', { ...P, sinceMidnight: 0, last7d: 0 }, undefined, Infinity],
    ['24 h only (rain before midnight)', { ...P, sinceMidnight: 0, last24h: 0.1 }, undefined, 1],
    ['nothing known', P, undefined, null],
    ['rows after today are ignored', P, rows({ '2026-10-01': 0, '2026-10-03': 1 }), 2],
  ] as const)('%s', (_name, p, hourly, days) => expect(daysSinceRain(p, hourly, '2026-10-02')).toBe(days))
})

describe('rainPhrase', () => {
  it.each([
    [0.123, 0, '0.12 in of rain today'],
    [null, 0, 'rain today'],
    [0, 1, 'no rain since yesterday'],
    [0, 5, 'no rain in 5 days'],
    [0, 7, 'no rain in 7 days'],
    [0, 8, 'no rain in over a week'],
    [0, Infinity, 'no rain in over a week'],
    [null, null, null],
  ] as const)('%s in, %s days → %s', (today, days, out) => expect(rainPhrase(today, days)).toBe(out))
})

describe('summarize', () => {
  const base: SummaryInput = { shortForecast: 'Partly Cloudy', windMph: 6, windDeg: 157.5, rainTodayIn: 0, daysSinceRain: 5, nowWallMs: NOON }
  it.each([
    ['all parts by day', base, 'Partly cloudy, light SSE wind, no rain in 5 days.'],
    ['tonight', { ...base, shortForecast: 'Mostly Clear', nowWallMs: NIGHT }, 'Mostly clear tonight, light SSE wind, no rain in 5 days.'],
    ['no forecast', { ...base, shortForecast: null }, 'Light SSE wind, no rain in 5 days.'],
    ['raining, windy', { ...base, shortForecast: 'Rain', windMph: 24, windDeg: 270, rainTodayIn: 0.42, daysSinceRain: 0 }, 'Rain, strong W wind, 0.42 in of rain today.'],
    ['calm, dry week', { ...base, windMph: 1, daysSinceRain: Infinity }, 'Partly cloudy, calm, no rain in over a week.'],
    ['nothing known', { ...base, shortForecast: null, windMph: null, daysSinceRain: null }, ''],
  ] as const)('%s', (_name, input, out) => expect(summarize(input)).toBe(out))
  it('evening is 18:00–05:59 wall clock', () => {
    expect(isEvening(Date.UTC(2026, 9, 2, 17, 59))).toBe(false)
    expect(isEvening(Date.UTC(2026, 9, 2, 18))).toBe(true)
    expect(isEvening(Date.UTC(2026, 9, 2, 5, 59))).toBe(true)
    expect(isEvening(Date.UTC(2026, 9, 2, 6))).toBe(false)
  })
})
