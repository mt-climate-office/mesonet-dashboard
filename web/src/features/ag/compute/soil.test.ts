import { afterAll, describe, expect, it } from 'vitest'
import type { SoilParams, SoilSeries } from '../contract'
import { parseApiDatetime, rows, soilParams, soilSeries, type Window } from '../__tests__/adapters'
import { compareToFixture, parityLog, printParity } from '../__tests__/parity'
import { applyFrozenMask, frozenMask, fxInverse, percentSaturation, swp } from './soil'
import { kPaToBar } from './units'

afterAll(printParity)

const CASES: ['daily' | 'hourly', Window][] = [
  ['daily', 'season2025'],
  ['daily', 'winter2526'],
  ['hourly', 'jul2025'],
  ['hourly', 'jan2026'],
]

/**
 * SWP is reported in bar to 3 decimals; ψ grows steeply as VWC falls, so the
 * 3-decimal VWC inputs alone move ψ by up to ~0.1 % at the dry end. The
 * tolerance is relative (0.5 % or 0.001 bar, whichever is larger).
 * Station/depths whose vendored mesonet-soils fit differs from the API's DB
 * fit are listed in EXPECTED_SWP_DIVERGENCES (see DIVERGENCES.md D-SWP-2) and
 * asserted to *still* differ, so a data refresh that fixes them fails loudly.
 */
const EXPECTED_SWP_DIVERGENCES = new Set<string>([
  'acebozem@5',
  'acebozem@10',
  'acebozem@20',
  'acebozem@50',
  'acebozem@100',
  'arskeogh@10',
  'arskeogh@20',
  'arskeogh@50',
])

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

function relTolOk(e: number, a: number): boolean {
  return Math.abs(e - a) <= Math.max(0.001, 0.005 * Math.abs(e))
}

describe('swp golden parity', () => {
  for (const st of ['acebozem', 'arskeogh']) {
    for (const [period, w] of CASES) {
      const name = `${st}.${period}.${w}.derived-swp.csv`
      it(`${st} ${period} ${w}`, () => {
        const soil = soilSeries(st, period, w)
        const out = swp(soil, soilParams(st))
        const fx = rows(name)
        const key = period === 'daily' ? 'date' : 'local'
        const byTime = new Map(out.time.map((t, i) => [t, i]))
        const results: { id: string; bad: number; flagMismatch: number }[] = []
        for (const [d, depth] of out.depthsCm.entries()) {
          const col = `Soil Water Potential @ -${depth} cm [bar]`
          const p = compareToFixture(`swp|${st}|${period}|${w}|${depth}cm`, fx, col, out.time, out.kPa[d], kPaToBar, key)
          expect(p.nullMismatch).toBe(0)
          let bad = 0
          let flagMismatch = 0
          const rel: number[] = []
          for (const r of fx) {
            const i = byTime.get(parseApiDatetime(r.datetime)[key])!
            const e = Number(r[col])
            const a = kPaToBar(out.kPa[d][i]!)
            if (!relTolOk(e, a)) bad++
            rel.push(Math.abs(a - e) / Math.max(Math.abs(e), 1e-9))
            if ((r[`Soil VWC @ -${depth} cm Clipped?`] === 'True') !== out.clipped[d][i]) flagMismatch++
          }
          const id = `${st}@${depth}`
          parityLog(`SWP|${id}|${period}|${w}|n=${fx.length}|outOfTol=${bad}|flagMismatch=${flagMismatch}|maxAbsBar=${p.maxAbs.toFixed(3)}|medianRel=${median(rel).toFixed(3)}|maxRel=${Math.max(...rel).toFixed(3)}|worst=${JSON.stringify(p.worst)}`)
          results.push({ id, bad, flagMismatch })
        }
        for (const { id, bad, flagMismatch } of results) {
          if (EXPECTED_SWP_DIVERGENCES.has(id)) expect(bad, id).toBeGreaterThan(0)
          else expect(bad, id).toBe(0)
          expect(flagMismatch, `${id} clipped flags`).toBe(0)
        }
        // Depths the API reports are exactly the ones we report.
        const apiDepths = Object.keys(fx[0])
          .map((k) => /^Soil Water Potential @ -(\d+) cm/.exec(k)?.[1])
          .filter(Boolean)
          .map(Number)
          .sort((a, b) => a - b)
        expect(out.depthsCm).toEqual(apiDepths)
      })
    }
  }
})

describe('swp formula and vendored parameters', () => {
  /** Fredlund–Xing forward model θ(ψ). */
  const fxForward = (psi: number, p: { r: number; s: number; n: number; m: number; h: number }) =>
    p.r + (p.s - p.r) / Math.log(Math.E + (psi / p.h) ** p.n) ** p.m

  it('fxInverse is the exact inverse of the FX forward model', () => {
    for (const psi of [1, 33, 1500, 30000]) {
      expect(fxInverse(fxForward(psi, FX), FX)!).toBeCloseTo(psi, 6)
    }
  })

  it('vendored params reproduce the lab retention data (θ RMSE < 0.01)', () => {
    for (const st of ['acebozem', 'arskeogh']) {
      const lab = rows(`${st}.soil-raw.csv`)
      for (const p of soilParams(st)) {
        const pts = lab.filter((r) => Number(r['Depth [cm]']) === p.depthCm)
        const se = pts.map((r) => (fxForward(Number(r.KPA), p.fx!) - Number(r.VWC)) ** 2)
        const rmse = Math.sqrt(se.reduce((a, b) => a + b, 0) / se.length)
        expect(rmse, `${st}@${p.depthCm}`).toBeLessThan(0.01)
      }
    }
  })
})

describe('percent saturation golden parity', () => {
  for (const st of ['acebozem', 'arskeogh']) {
    for (const [period, w] of CASES) {
      it(`${st} ${period} ${w}`, () => {
        const out = percentSaturation(soilSeries(st, period, w), soilParams(st))
        const fx = rows(`${st}.${period}.${w}.derived-percent_saturation.csv`)
        for (const [d, depth] of out.depthsCm.entries()) {
          const p = compareToFixture(
            `percent_saturation|${st}|${period}|${w}|${depth}cm`,
            fx,
            `Percent Saturation @ -${depth} cm [%]`,
            out.time,
            out.pct[d],
            (x) => x,
            period === 'daily' ? 'date' : 'local',
          )
          expect(p.nullMismatch).toBe(0)
          // Inputs are 3-decimal VWC; v/por·100 amplifies by ~2.2×.
          expect(p.maxAbs).toBeLessThanOrEqual(0.0015)
        }
      })
    }
  }
})

function synthetic(station: string, vwc: (number | null)[], temp: (number | null)[] = vwc.map(() => 5)): SoilSeries {
  return {
    station,
    level: 2,
    provisional: vwc.map(() => false),
    depthsCm: [10],
    time: vwc.map((_, i) => `2025-07-0${i + 1}`),
    epochMs: vwc.map((_, i) => i),
    vwcPct: [vwc],
    tempC: [temp],
  }
}

const FX = { r: 0, s: 0.45, n: 1.3, m: 0.8, h: 10 }

describe('soil semantics', () => {
  it('clips each station to its own lab range (D-SWP-1)', () => {
    const params: SoilParams[] = [
      // The API would apply this first station's range to every station.
      { station: 'aaa', depthCm: 10, model: 'FX', fx: FX, labVwcMin: 20, labVwcMax: 30, source: 'vendored', release: 't' },
      { station: 'bbb', depthCm: 10, model: 'FX', fx: FX, labVwcMin: 5, labVwcMax: 40, source: 'vendored', release: 't' },
    ]
    const out = swp(synthetic('bbb', [10, 35, 45, null]), params)
    expect(out.clipped[0]).toEqual([false, false, true, false])
    expect(out.kPa[0][0]).toBeCloseTo(fxInverse(0.1, FX)!, 12)
    expect(out.kPa[0][2]).toBeCloseTo(fxInverse(0.4, FX)!, 12)
    expect(out.kPa[0][3]).toBeNull()
  })

  it('no params for the station → depth omitted; NaN inversions → null', () => {
    expect(swp(synthetic('zzz', [10]), []).depthsCm).toEqual([])
    // θ above θs gives a negative base → NaN in the API → null here.
    expect(fxInverse(0.5, FX)).toBeNull()
  })

  it('percent saturation clips to [0, 100]', () => {
    const params: SoilParams[] = [{ station: 'x', depthCm: 10, model: 'FX', porosityPct: 40, source: 'vendored', release: 't' }]
    expect(percentSaturation(synthetic('x', [20, 50, -1, null]), params).pct[0]).toEqual([50, 100, 0, null])
  })

  it('frozen mask: soil temperature ≤ 0 °C hides values', () => {
    const soil = synthetic('x', [20, 20, 20, 20], [1, 0, -3, null])
    const mask = frozenMask(soil)
    expect(mask.frozen[0]).toEqual([false, true, true, false])
    expect(applyFrozenMask([10], [[1, 2, 3, 4]], mask)).toEqual([[1, null, null, 4]])
    // Real fixture: January at 5 cm is frozen on some days.
    const jan = frozenMask(soilSeries('acebozem', 'daily', 'winter2526'))
    expect(jan.frozen[0].some(Boolean)).toBe(true)
  })
})
