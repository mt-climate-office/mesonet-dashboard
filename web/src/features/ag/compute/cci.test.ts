import { afterAll, describe, expect, it } from 'vitest'
import type { HourlyMet } from '../contract'
import { dailyMet, hasFixture, hourlyMet, rows, type Window } from '../__tests__/adapters'
import { compareToFixture, printParity } from '../__tests__/parity'
import { cciDaily, cciHourly, cciValueC, cciWindCorrection, classifyCciC, classifyCciF } from './cci'
import { classifyCci } from './legacy'
import { cToF, fToC } from './units'

const STATIONS = ['acebozem', 'arskeogh', 'acecrowa']
const COL = 'Comprehensive Climate Index [°F]'

afterAll(printParity)

describe('cci golden parity (≤ 0.1 °F)', () => {
  for (const st of STATIONS) {
    for (const [period, w] of [
      ['daily', 'season2025'],
      ['daily', 'winter2526'],
      ['hourly', 'jul2025'],
      ['hourly', 'jan2026'],
    ] as [string, Window][]) {
      const name = `${st}.${period}.${w}.derived-cci.csv`
      it(`${st} ${period} ${w}`, () => {
        const out = period === 'daily' ? cciDaily(dailyMet(st, w)) : cciHourly(hourlyMet(st, w))
        if (!hasFixture(name)) {
          // API 404 (no sol_rad in the window): all-null, no throw.
          expect(out.valueC.every((v) => v === null)).toBe(true)
          expect(out.class.every((v) => v === null)).toBe(true)
          return
        }
        const p = compareToFixture(`cci|${st}|${period}|${w}`, rows(name), COL, out.time, out.valueC, cToF, period === 'daily' ? 'date' : 'local')
        expect(p.n).toBeGreaterThan(0)
        expect(p.nullMismatch).toBe(0)
        expect(p.maxAbs).toBeLessThanOrEqual(0.1)
      })
    }
  }
})

describe('cci semantics', () => {
  it('wind < 1 m/s contributes no correction', () => {
    expect(cciWindCorrection(0.99)).toBe(0)
    expect(cciWindCorrection(1)).not.toBe(0)
  })

  it('negative night-time solar is clamped to 0, not NaN (D-CCI-1)', () => {
    const neg = cciValueC(5, 80, 3, -2.5)
    expect(neg).not.toBeNull()
    expect(neg).toBe(cciValueC(5, 80, 3, 0))
    const met: HourlyMet = {
      station: 'x',
      level: 2,
      provisional: [false],
      time: ['2026-01-01T02:00'],
      epochMs: [Date.parse('2026-01-01T09:00Z')],
      tC: [-10],
      rh: [80],
      sradWm2: [-1.2],
      windMs: [4],
    }
    expect(cciHourly(met).valueC[0]).not.toBeNull()
  })

  it('classification: legacy re-export, °C wrapper and newborn thresholds', () => {
    expect(classifyCci).toBe(classifyCciF)
    expect(classifyCciC(fToC(100), 'adult')).toBe('Severe')
    expect(classifyCciC(fToC(30), 'adult')).toBe('Mild')
    expect(classifyCciC(fToC(30), 'newborn')).toBe('Moderate')
    expect(classifyCciC(null, 'adult')).toBeNull()
    const out = cciDaily(dailyMet('acebozem', 'winter2526'), 'newborn')
    expect(out.livestock).toBe('newborn')
    out.valueC.forEach((v, i) => expect(out.class[i]).toBe(classifyCciC(v, 'newborn')))
  })
})
