import { describe, expect, it } from 'vitest'
import soilJsonText from '../../../../public/data/soil_params.json?raw'
import { percentSaturation } from '../compute'
import { fromVendoredJson, type VendoredSoilJson } from '../data/soilParams'
import { parseCsvRaw } from '../data/parse'
import { fixtureText, soilSeries, type Window } from '../__tests__/adapters'
import { compareToFixture } from '../__tests__/parity'
import { POROSITY_SOURCE, derivedPorosityRequest, percentSaturationFromApiPorosity } from './porositySource'

const CASES: [string, 'daily' | 'hourly', Window][] = [
  ['acebozem', 'daily', 'season2025'],
  ['acebozem', 'hourly', 'jul2025'],
  ['arskeogh', 'daily', 'season2025'],
  ['arskeogh', 'hourly', 'jul2025'],
  // AG-PS-001: API DB porosity differs from mesonet-soils; no API porosity at 91 cm.
  ['mdamalta', 'daily', 'season2025'],
  ['mdamalta', 'hourly', 'jul2025'],
]

const derived = (st: string, period: string, w: string) =>
  parseCsvRaw(fixtureText(`${st}.${period}.${w}.derived-percent_saturation.csv`))

describe('percent saturation with API porosity (D-PS-1)', () => {
  it('defaults to the API porosity and requests keep=true at the Ag level', () => {
    expect(POROSITY_SOURCE).toBe('api')
    const r = derivedPorosityRequest({ station: 'mdamalta', start: '2026-09-01', end: '2026-09-30', period: 'daily', level: 2 })
    expect(r.path).toBe('derived/daily/')
    expect(r.query).toMatchObject({ elements: 'percent_saturation', keep: true, level: 2, end_time: '2026-10-01' })
  })

  for (const [st, period, w] of CASES) {
    it(`${st} ${period} ${w} matches /derived`, () => {
      const fx = derived(st, period, w)
      const out = percentSaturationFromApiPorosity(fx, soilSeries(st, period, w), period)
      const apiDepths = Object.keys(fx[0])
        .map((k) => /^Percent Saturation @ -(\d+) cm/.exec(k)?.[1])
        .filter((x): x is string => x != null)
        .map(Number)
        .sort((a, b) => a - b)
      // Same depths as the API: mdamalta's 91 cm (no DB porosity) is dropped.
      expect(out.depthsCm).toEqual(apiDepths)
      for (const [d, depth] of out.depthsCm.entries()) {
        const p = compareToFixture(
          `percent_saturation(api porosity)|${st}|${period}|${w}|${depth}cm`,
          fx,
          `Percent Saturation @ -${depth} cm [%]`,
          out.time,
          out.pct[d],
          (x) => x,
          period === 'daily' ? 'date' : 'local',
        )
        expect(p.nullMismatch).toBe(0)
        expect(p.n).toBeGreaterThan(0)
        expect(p.maxAbs).toBeLessThanOrEqual(0.0015)
      }
    })
  }

  it('mdamalta: the vendored mesonet-soils porosity still differs from the API DB (reason for D-PS-1)', () => {
    // If a parameter refresh brings these into agreement, this fails: then
    // consider flipping POROSITY_SOURCE to 'vendored' and updating D-PS-1.
    const vendored = fromVendoredJson(JSON.parse(soilJsonText) as VendoredSoilJson)
    const soil = soilSeries('mdamalta', 'daily', 'season2025')
    const ven = percentSaturation(soil, vendored)
    expect(ven.depthsCm).toEqual([10, 20, 50, 91])
    const fx = derived('mdamalta', 'daily', 'season2025')
    for (const depth of [10, 20, 50]) {
      const p = compareToFixture(
        `percent_saturation(vendored)|mdamalta|${depth}cm`,
        fx,
        `Percent Saturation @ -${depth} cm [%]`,
        ven.time,
        ven.pct[ven.depthsCm.indexOf(depth)],
        (x) => x,
        'date',
      )
      expect(p.n).toBeGreaterThan(0)
      expect(p.maxAbs).toBeGreaterThan(1)
    }
  })

  it('per-row porosity, axis rows without an API row are null, clipped to [0, 100]', () => {
    const rows = parseCsvRaw(
      [
        'station,datetime,Porosity @ -10 cm [%],Porosity @ -91 cm [%]',
        'x,2026-09-20 00:00:00-06:00,40,',
        'x,2026-09-22 00:00:00-06:00,20,',
      ].join('\n'),
    )
    const out = percentSaturationFromApiPorosity(
      rows,
      {
        station: 'x',
        level: 2,
        provisional: [false, false, false],
        depthsCm: [10, 91],
        time: ['2026-09-20', '2026-09-21', '2026-09-22'],
        epochMs: [0, 1, 2],
        vwcPct: [[20, 20, 30], [30, 30, 30]],
        tempC: [[1, 1, 1], [1, 1, 1]],
      },
      'daily',
    )
    expect(out.depthsCm).toEqual([10])
    expect(out.pct[0]).toEqual([50, null, 100])
  })
})
