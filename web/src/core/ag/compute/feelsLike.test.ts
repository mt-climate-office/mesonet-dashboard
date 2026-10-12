import { afterAll, describe, expect, it } from 'vitest'
import { dailyMet, hourlyMet, rows, type Window } from '../__tests__/adapters'
import { compareToFixture, printParity } from '../__tests__/parity'
import {
  feelsLikeDaily,
  feelsLikeHourly,
  feelsLikeValue,
  heatIndexC,
  heatIndexUnmaskedF,
  windChillC,
} from './feelsLike'
import { cToF, fToC, mphToMs } from './units'

const STATIONS = ['acebozem', 'arskeogh', 'acecrowa']
const TOL_F = 0.1

afterAll(printParity)

function check(
  label: string,
  name: string,
  times: string[],
  t: (number | null)[],
  rh: (number | null)[],
  wind: (number | null)[],
  key: 'date' | 'local',
  feels: (number | null)[],
) {
  const fx = rows(name)
  const wc = times.map((_, i) => windChillC(t[i], wind[i]))
  const hi = times.map((_, i) => heatIndexC(t[i], rh[i]))
  for (const [col, vals, tag] of [
    ['Wind Chill [°F]', wc, 'wind_chill'],
    ['Heat Index [°F]', hi, 'heat_index'],
    ['Feels Like Temperature [°F]', feels, 'feels_like'],
  ] as const) {
    const p = compareToFixture(`${tag}|${label}`, fx, col, times, vals, cToF, key)
    expect(p.nullMismatch, `${tag} null mismatch ${JSON.stringify(p.worst)}`).toBe(0)
    expect(p.maxAbs, `${tag} ${JSON.stringify(p.worst)}`).toBeLessThanOrEqual(TOL_F)
  }
}

describe('feels_like golden parity (≤ 0.1 °F)', () => {
  for (const st of STATIONS) {
    for (const w of ['season2025', 'winter2526'] as Window[]) {
      it(`${st} daily ${w}`, () => {
        const met = dailyMet(st, w)
        const out = feelsLikeDaily(met)
        check(`${st}|daily|${w}`, `${st}.daily.${w}.derived-feels_like.csv`, out.time, met.tavgC, met.rhAvg, met.windMs, 'date', out.valueC)
      })
    }
    for (const w of ['jul2025', 'jan2026'] as Window[]) {
      it(`${st} hourly ${w}`, () => {
        const met = hourlyMet(st, w)
        const out = feelsLikeHourly(met)
        check(`${st}|hourly|${w}`, `${st}.hourly.${w}.derived-feels_like.csv`, out.time, met.tC, met.rh, met.windMs, 'local', out.valueC)
      })
    }
  }
})

describe('feels_like semantics', () => {
  it('matches MetPy docstring examples', () => {
    expect(fToC(heatIndexUnmaskedF(cToF(30), 90))).toBeCloseTo(40.774647, 5)
    expect(heatIndexUnmaskedF(90, 90)).toBeCloseTo(121.901204, 5)
    expect(heatIndexUnmaskedF(60, 90)).toBeCloseTo(59.93, 5)
    expect(heatIndexC(fToC(60), 90)).toBeNull()
  })

  it('heat index branches: T ≤ 40 °F, simple < 79 °F, adjustments', () => {
    expect(heatIndexUnmaskedF(35, 50)).toBe(35)
    // simple formula: −10.3 + 1.1·60 + 4.7·0.5 = 58.05
    expect(heatIndexUnmaskedF(60, 50)).toBeCloseTo(58.05, 9)
    // low-RH adjustment lowers, high-RH adjustment raises
    const dry = heatIndexUnmaskedF(95, 10)
    const rothfuszDry =
      -42.379 + 2.04901523 * 95 + 1014.333127 * 0.1 - 22.475541 * 95 * 0.1 - 6.83783e-3 * 95 * 95 -
      5.481717e2 * 0.01 + 1.22874e-1 * 95 * 95 * 0.1 + 8.5282 * 95 * 0.01 - 1.99e-2 * 95 * 95 * 0.01
    expect(dry).toBeCloseTo(rothfuszDry - (3 / 4) * 1, 9)
    expect(heatIndexUnmaskedF(85, 95)).toBeGreaterThan(heatIndexUnmaskedF(85, 85.0000001) + 0.5)
  })

  it('wind chill masked when T > 50 °F or V ≤ 3 mph', () => {
    expect(windChillC(fToC(50.5), mphToMs(10))).toBeNull()
    expect(windChillC(fToC(30), mphToMs(3))).toBeNull()
    // NWS table: 0 °F, 15 mph → −19 °F
    expect(cToF(windChillC(fToC(0), mphToMs(15))!)).toBeCloseTo(-19, 0)
  })

  it('regime order HI → WC → T; null in → null out', () => {
    expect(feelsLikeValue(fToC(95), 50, 5).regime).toBe('heat_index')
    expect(feelsLikeValue(fToC(20), 50, 5).regime).toBe('wind_chill')
    expect(feelsLikeValue(fToC(65), 50, 5)).toEqual({ valueC: fToC(65), regime: 'air_temp' })
    // missing wind at 20 °F: no wind chill → air temperature (API: same)
    expect(feelsLikeValue(fToC(20), 50, null).regime).toBe('air_temp')
    expect(feelsLikeValue(null, 50, 5)).toEqual({ valueC: null, regime: null })
  })
})
