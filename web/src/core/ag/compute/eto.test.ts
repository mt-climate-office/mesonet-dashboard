import { afterAll, describe, expect, it } from 'vitest'
import type { DailyMet, HourlyMet } from '../contract'
import { dailyMet, hasFixture, hourlyMet, rows, stationMeta, type Window } from '../__tests__/adapters'
import { compareToFixture, printParity } from '../__tests__/parity'
import { etoDaily, etoHourly, hourUtcMinus7, windAt2m } from './eto'
import { mmToIn } from './units'

const STATIONS = ['acebozem', 'arskeogh', 'acecrowa']
const DAILY: Window[] = ['season2025', 'winter2526']
const HOURLY: Window[] = ['jul2025', 'jan2026']

afterAll(printParity)

describe('etoDaily golden parity (≤ 0.005 in/day)', () => {
  for (const st of STATIONS) {
    for (const w of DAILY) {
      const name = `${st}.daily.${w}.derived-etr.csv`
      it(`${st} ${w}`, () => {
        const out = etoDaily(dailyMet(st, w), stationMeta(st))
        if (!hasFixture(name)) {
          // The API 404s when sol_rad is absent for the window; compute must
          // return an all-null series rather than throw.
          expect(out.etoMm.every((v) => v === null)).toBe(true)
          return
        }
        const p = compareToFixture(
          `eto_daily|${st}|${w}`,
          rows(name),
          'Reference ET (a=0.23) [in]',
          out.time,
          out.etoMm,
          mmToIn,
          'date',
        )
        expect(p.n).toBeGreaterThan(0)
        expect(p.nullMismatch).toBe(0)
        expect(p.maxAbs).toBeLessThanOrEqual(0.005)
      })
    }
  }
})

describe('etoHourly golden parity (≤ 0.001 in/h)', () => {
  for (const st of STATIONS) {
    for (const w of HOURLY) {
      const name = `${st}.hourly.${w}.derived-etr.csv`
      it(`${st} ${w}`, () => {
        const out = etoHourly(hourlyMet(st, w), stationMeta(st))
        if (!hasFixture(name)) {
          expect(out.etoMm.every((v) => v === null)).toBe(true)
          return
        }
        const fx = rows(name)
        // Divergence D-ETO-1: the API emits 0 where an input is missing; we
        // emit null. Compare only rows the API computed from complete inputs.
        const complete = fx.filter((r) => r['Average Wind Speed [mph]'] !== '')
        const missing = fx.length - complete.length
        const p = compareToFixture(
          `eto_hourly|${st}|${w}`,
          complete,
          'Reference ET (a=0.23) [in]',
          out.time,
          out.etoMm,
          mmToIn,
        )
        expect(p.n).toBeGreaterThan(0)
        expect(p.nullMismatch).toBe(0)
        expect(p.maxAbs).toBeLessThanOrEqual(0.001)
        if (missing > 0) {
          const nulls = out.etoMm.filter((v) => v === null).length
          expect(nulls).toBe(missing)
        }
      })
    }
  }
})

describe('eto edge cases', () => {
  const st = stationMeta('acebozem')

  it('missing hourly input → null, not 0 (D-ETO-1)', () => {
    const met: HourlyMet = {
      station: 'x',
      level: 2,
      provisional: [false, true],
      time: ['2025-07-01T12:00', '2025-07-01T13:00'],
      epochMs: [Date.parse('2025-07-01T18:00Z'), Date.parse('2025-07-01T19:00Z')],
      tC: [25, 25],
      rh: [40, 40],
      sradWm2: [800, 800],
      windMs: [null, 3],
    }
    const out = etoHourly(met, st)
    expect(out.etoMm[0]).toBeNull()
    expect(out.etoMm[1]).toBeGreaterThan(0)
    expect(out.provisional).toEqual([false, true])
  })

  it('all-null solar (arskeogh winter) → all null', () => {
    const met: DailyMet = {
      station: 'x',
      level: 2,
      provisional: [false],
      date: ['2026-01-01'],
      tminC: [-10],
      tmaxC: [0],
      tavgC: [-5],
      rhMin: [50],
      rhMax: [90],
      rhAvg: [70],
      sradWm2: [null],
      windMs: [2],
    }
    expect(etoDaily(met, st).etoMm).toEqual([null])
  })

  it('wind height conversion matches FAO-56 eq. 47', () => {
    expect(windAt2m(1, 2)).toBe(1)
    expect(windAt2m(1, 10)).toBeCloseTo(0.748, 3)
    expect(windAt2m(1, 2.44)).toBeCloseTo(0.9596, 3)
  })

  it('solar-time hour is on a fixed UTC−7 clock (no DST)', () => {
    // 2025-07-01 00:00 MDT = 06:00Z → 23:00 on the UTC−7 clock.
    expect(hourUtcMinus7(Date.parse('2025-07-01T06:00Z'))).toBe(23)
    expect(hourUtcMinus7(Date.parse('2026-01-01T07:00Z'))).toBe(0)
  })
})
