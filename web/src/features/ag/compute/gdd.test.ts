import { afterAll, describe, expect, it } from 'vitest'
import type { DailyMet, DailyNormals, GddCrop } from '../contract'
import {
  dailyMet,
  parseApiDatetime,
  rows,
  stageTable,
  type Row,
  type Window,
} from '../__tests__/adapters'
import { compareToFixture, parityLog, printParity } from '../__tests__/parity'
import { cumulativeSum, gdd, gddDayF, labelStages, projectGdd, stageAt } from './gdd'
import { fToC } from './units'

const STATIONS = ['acebozem', 'arskeogh', 'acecrowa']
const WINDOWS: Window[] = ['season2025', 'winter2526']
const CROPS: GddCrop[] = ['wheat', 'barley', 'canola', 'corn', 'sugarbeet', 'sunflower', 'hemp']

afterAll(printParity)

/** Normalise a stage id for comparison: numbers compare numerically. */
function normStage(s: unknown): string | null {
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? String(n) : String(s)
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

/**
 * GDD daily values are exact to 3 decimals (the fixture rounding) except
 * where an input temperature sits on a cutoff, where the fixture's 3-decimal
 * inputs can tip a clip; allow one unit in the last place.
 */
const DAILY_TOL = 0.0005 + 1e-9
/**
 * Cumulative is a sum of up to 183 values that the API computed from
 * unrounded inputs; input rounding (≤ 0.0005 °F per input) accumulates. The
 * check is therefore against the API's own running sum of its rounded daily
 * column (exact) and the fixture cumulative within the observed drift.
 */
const CUM_TOL = 0.0005 + 1e-9

describe('gdd golden parity', () => {
  for (const st of STATIONS) {
    for (const w of WINDOWS) {
      const met = dailyMet(st, w)
      it(`${st} ${w} default 50/86 °F`, () => {
        const fx = rows(`${st}.daily.${w}.derived-gdd.csv`)
        const out = gdd(met)
        const d = compareToFixture(`gdd|${st}|${w}|default|daily`, fx, 'GDDs [GDD °F]', out.date, out.daily, (x) => x, 'date')
        expect(d.nullMismatch).toBe(0)
        expect(d.maxAbs).toBeLessThanOrEqual(DAILY_TOL)
        const c = compareToFixture(`gdd|${st}|${w}|default|cum`, fx, 'Cumulative GDDs [GDD °F]', out.date, out.cumulative, (x) => x, 'date')
        expect(c.maxAbs).toBeLessThanOrEqual(CUM_TOL)
        expect(out.stage.every((s) => s === null)).toBe(true)
        expect(out.crop).toBeNull()
      })

      for (const crop of CROPS) {
        it(`${st} ${w} ${crop}`, () => {
          const fx = rows(`${st}.daily.${w}.derived-gdd-${crop}.csv`)
          const table = stageTable(crop)
          const out = gdd(met, { crop, stages: table })
          const d = compareToFixture(`gdd|${st}|${w}|${crop}|daily`, fx, 'GDDs [GDD °F]', out.date, out.daily, (x) => x, 'date')
          expect(d.nullMismatch).toBe(0)
          expect(d.maxAbs).toBeLessThanOrEqual(DAILY_TOL)
          const c = compareToFixture(`gdd|${st}|${w}|${crop}|cum`, fx, 'Cumulative GDDs [GDD °F]', out.date, out.cumulative, (x) => x, 'date')
          expect(c.maxAbs).toBeLessThanOrEqual(CUM_TOL)
          // First pass without the NDAWN switch (no stage table → no switch).
          const firstPass = gdd(met, { crop }).cumulative
          checkStages(crop, fx, out.date, out.stage, out.stageName, out.cumulative, firstPass)
        })
      }
    }
  }
})

/**
 * Stage labels vs the API. Rows whose cumulative sits within the cumulative
 * drift of a threshold may legitimately fall on either side; skip them.
 */
function checkStages(
  crop: GddCrop,
  fx: Row[],
  dates: string[],
  stage: (number | string | null)[],
  name: (string | null)[],
  cumulative: (number | null)[],
  firstPass?: (number | null)[],
): void {
  const idx = new Map(dates.map((d, i) => [d, i]))
  const thresholds = stageTable(crop).stages.map((s) => s.gdd)
  const nearThreshold = (c: number | null) => c != null && thresholds.some((t) => Math.abs(c - t) <= CUM_TOL)
  let compared = 0
  let postSwitchDiffs = 0
  for (const r of fx) {
    const i = idx.get(parseApiDatetime(r.datetime).date)!
    if (nearThreshold(cumulative[i])) continue
    const apiStage = normStage(r['Growth Stage'])
    const apiName = r['Stage Name'] === undefined ? undefined : r['Stage Name'] || null
    if (crop === 'corn') {
      // D-GDD-2: the API has a DB-only corn stage table; the vendored sources
      // have none, so we emit no labels (never a fake "stage 0").
      expect(stage[i]).toBeNull()
      expect(name[i]).toBeNull()
      continue
    }
    if ((crop === 'wheat' || crop === 'barley') && apiStage != null && Number(apiStage) >= 2) {
      // D-GDD-1: the API's labels after the switch are those of the first,
      // 70 °F-capped cumulative (pinned here); ours are those of the final one.
      const table = stageTable(crop).stages
      if (firstPass && !nearThreshold(firstPass[i])) {
        expect(normStage(stageAt(firstPass[i], table).stage)).toBe(apiStage)
      }
      expect(stage[i]).toBe(stageAt(cumulative[i], table).stage)
      if (normStage(stage[i]) !== apiStage) postSwitchDiffs++
      continue
    }
    if (crop === 'hemp') {
      // DB hemp stage ids differ from write_hemp_table.sql for the first row
      // ("BBCH Stage 11" vs "BBCH Stages 0-11"); names and thresholds match.
      if (apiStage !== '0') expect(name[i]).toBe(apiName)
      else expect(stage[i]).toBe(0)
      compared++
      continue
    }
    expect(normStage(stage[i])).toBe(apiStage)
    // The API drops the Stage Name column when no row reached a named stage.
    if (apiName !== undefined) expect(name[i]).toBe(apiName)
    else expect(name[i]).toBeNull()
    compared++
  }
  if (crop === 'wheat' || crop === 'barley') {
    // Where the 95 °F cap changed the cumulative, the fix must change labels.
    const changed = firstPass?.some((c, i) => c != null && cumulative[i] != null && cumulative[i]! - c > 50)
    if (changed) expect(postSwitchDiffs).toBeGreaterThan(0)
    parityLog(`STAGES|${crop}|${fx[0]?.station}|rows=${fx.length}|labelFixes=${postSwitchDiffs}`)
  } else if (crop !== 'corn') {
    expect(compared).toBeGreaterThan(0)
    parityLog(`STAGES|${crop}|${fx[0]?.station}|rows=${fx.length}|matched=${compared}`)
  }
}

function met1(tminF: (number | null)[], tmaxF: (number | null)[], start = '2025-05-01'): DailyMet {
  const n = tminF.length
  const date = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.parse(`${start}T00:00Z`) + i * 86_400_000)
    return d.toISOString().slice(0, 10)
  })
  return {
    station: 'x',
    level: 2,
    provisional: Array(n).fill(false),
    date,
    tminC: tminF.map((v) => (v == null ? null : fToC(v))),
    tmaxC: tmaxF.map((v) => (v == null ? null : fToC(v))),
    tavgC: Array(n).fill(null),
    rhMin: Array(n).fill(null),
    rhMax: Array(n).fill(null),
    rhAvg: Array(n).fill(null),
    sradWm2: Array(n).fill(null),
    windMs: Array(n).fill(null),
  }
}

describe('gdd unit behaviour', () => {
  it('clips both Tmin and Tmax to [low, high] then mean − low', () => {
    expect(gddDayF(20, 60, 32, 95)).toBe(14)
    expect(gddDayF(60, 100, 50, 86)).toBe(23)
    // Tmin above the cap is clipped too (method B), unlike a floor-only rule.
    expect(gddDayF(90, 100, 50, 86)).toBe(36)
    expect(gddDayF(10, 20, 32, 95)).toBe(0)
  })

  it('cumulative skips nulls and carries forward (D-GDD-3)', () => {
    expect(cumulativeSum([null, 1, null, 2])).toEqual([null, 1, 1, 3])
    const out = gdd(met1([40, null, 40], [80, null, 80]))
    expect(out.daily[1]).toBeNull()
    expect(out.cumulative).toEqual([15, 15, 30])
  })

  it('custom cutoffs in °C override the crop and report back in °C (D-GDD-5)', () => {
    // The API ignores low/high when a crop is given; here explicit cutoffs win
    // (and disable the NDAWN switch).
    const out = gdd(met1([50], [104]), { crop: 'wheat', lowC: 10, highC: 30, stages: stageTable('wheat') })
    expect(out.crop).toBeNull()
    expect(out.ndawnSwitch).toBeNull()
    // 10/30 °C = 50/86 °F → (50 + 86)/2 − 50 = 18
    expect(out.daily[0]).toBeCloseTo(18, 9)
    expect(out.cutoffs.lowC).toBeCloseTo(10, 9)
    expect(out.cutoffs.highC).toBeCloseTo(30, 9)
  })

  it('crop without a stage table → null labels, not stage 0 (D-GDD-2)', () => {
    const out = gdd(met1([60, 60], [90, 90]), { crop: 'corn', stages: { crop: 'corn', stages: [] } })
    expect(out.stage).toEqual([null, null])
    expect(out.stageName).toEqual([null, null])
  })

  it('wheat switches to 32/95 at Haun 2 and relabels on the final cumulative (D-GDD-1)', () => {
    const stages = stageTable('wheat')
    // 60/90 °F: 32/70 → (60+70)/2−32 = 33/day; 32/95 → (60+90)/2−32 = 43/day.
    const n = 20
    const out = gdd(met1(Array(n).fill(60), Array(n).fill(90)), { crop: 'wheat', stages })
    // Haun 2 is at 395: first-pass cumulative 33·12 = 396 → day 12 (index 11) switches.
    expect(out.daily.slice(0, 11)).toEqual(Array(11).fill(33))
    expect(out.daily.slice(11)).toEqual(Array(n - 11).fill(43))
    const final = out.cumulative[n - 1]!
    expect(final).toBe(33 * 11 + 43 * 9)
    // API would report the label for first-pass 33·20 = 660 (Leaf 3, stage 3);
    // the final cumulative 750 is Leaf 4 (681).
    expect(stageAt(33 * n, stages.stages).stage).toBe(3)
    expect(out.stage[n - 1]).toBe(4)
    expect(out.stageName[n - 1]).toBe('Leaf 4')
  })

  it('"Planted" only when some row reached a named stage (API name rule)', () => {
    const wheat = stageTable('wheat').stages
    // No row reaches Emergence (180): names stay null, as the API drops them.
    expect(labelStages([10, 50], wheat)).toEqual([
      { stage: 0, name: null },
      { stage: 0, name: null },
    ])
    expect(labelStages([10, 200], wheat)).toEqual([
      { stage: 0, name: 'Planted' },
      { stage: 0.5, name: 'Emergence Date' },
    ])
    expect(labelStages([10], wheat, true)).toEqual([{ stage: 0, name: 'Planted' }])
    expect(labelStages([null], wheat, true)).toEqual([{ stage: null, name: null }])
    const early = gdd(met1([40, 40], [60, 60]), { crop: 'wheat', stages: stageTable('wheat') })
    expect(early.stage).toEqual([0, 0])
    expect(early.stageName).toEqual([null, null])
  })

  it('records the NDAWN switch on the series', () => {
    const w = gdd(met1([60], [90]), { crop: 'wheat', stages: stageTable('wheat') })
    expect(w.ndawnSwitch?.atStage).toBe(2)
    expect(w.ndawnSwitch?.cutoffs.highC).toBeCloseTo(fToC(95), 9)
    expect(gdd(met1([60], [90]), { crop: 'wheat' }).ndawnSwitch).toBeNull()
    expect(gdd(met1([60], [90]), { crop: 'corn', stages: stageTable('wheat') }).ndawnSwitch).toBeNull()
    expect(gdd(met1([60], [90]), { crop: 'sunflower' }).cutoffs.highC).toBe(Infinity)
  })

  it('stage before the first threshold is stage 0', () => {
    expect(stageAt(10, stageTable('wheat').stages)).toEqual({ stage: 0, name: null })
    expect(stageAt(10, stageTable('sugarbeet').stages)).toEqual({ stage: 0, name: null })
    expect(stageAt(0, stageTable('canola').stages)).toEqual({ stage: 'Planting', name: null })
  })
})

describe('projectGdd', () => {
  const normals: DailyNormals = {
    station: 'x',
    byMonthDay: Object.fromEntries(
      ['05-03', '05-04', '05-05', '05-06'].map((md) => [
        md,
        {
          tminC: { q25: fToC(40), median: fToC(50), q75: fToC(60) },
          tmaxC: { q25: fToC(60), median: fToC(70), q75: fToC(80) },
          prMm: null,
          petMm: null,
        },
      ]),
    ),
  }

  it('uses forecast first, then the normals median with a q25/q75 envelope', () => {
    const series = gdd(met1([40, 40], [80, 80]), { crop: 'corn' }) // 2 days of (50+80)/2−50 = 15
    expect(series.cumulative).toEqual([15, 30])
    const proj = projectGdd(
      series,
      normals,
      { date: ['2025-05-03'], tminC: [fToC(60)], tmaxC: [fToC(90)], source: 'nws' },
      '2025-05-05',
    )
    expect(proj.date).toEqual(['2025-05-03', '2025-05-04', '2025-05-05'])
    expect(proj.basis).toEqual(['forecast', 'normals', 'normals'])
    // forecast: (60+86)/2−50 = 23; normals median: (50+70)/2−50 = 10
    proj.daily.forEach((v, i) => expect(v).toBeCloseTo([23, 10, 10][i], 9))
    expect(proj.cumulative[2]).toBeCloseTo(30 + 23 + 20, 9)
    // q25: (50+60)/2−50 = 5/day; q75: (60+80)/2−50 = 20/day
    expect(proj.cumulativeQ25[2]).toBeCloseTo(30 + 23 + 10, 9)
    expect(proj.cumulativeQ75[2]).toBeCloseTo(30 + 23 + 40, 9)
    expect(proj.stage.every((s) => s === null)).toBe(true)
  })

  it('projection follows the series NDAWN decision, not the crop name', () => {
    const stages = stageTable('wheat')
    const hot: DailyNormals = {
      station: 'x',
      byMonthDay: { '05-02': { tminC: { q25: fToC(60), median: fToC(60), q75: fToC(60) }, tmaxC: { q25: fToC(90), median: fToC(90), q75: fToC(90) }, prMm: null, petMm: null } },
    }
    // 12 days of 33 → 396 ≥ Haun 2 (395): switched series.
    const switched = gdd(met1(Array(12).fill(60), Array(12).fill(90), '2025-04-20'), { crop: 'wheat', stages })
    expect(switched.ndawnSwitch).not.toBeNull()
    expect(projectGdd(switched, hot, undefined, '2025-05-02', stages).daily[0]).toBeCloseTo(43, 9)
    // Custom 32/70 °F cutoffs: crop null, no switch even with a wheat table.
    const custom = gdd(met1(Array(12).fill(60), Array(12).fill(90), '2025-04-20'), {
      crop: 'wheat',
      lowC: 0,
      highC: fToC(70),
      stages,
    })
    expect(custom.crop).toBeNull()
    expect(projectGdd(custom, hot, undefined, '2025-05-02', stages).daily[0]).toBeCloseTo(33, 9)
    // Labels carry "Planted"-style naming from the observed series.
    expect(projectGdd(switched, hot, undefined, '2025-05-02', stages).stageName[0]).toBe('Leaf 2 fully extended')
  })

  it('returns an empty projection when `through` is not after the series', () => {
    const series = gdd(met1([40], [80]))
    expect(projectGdd(series, normals, undefined, '2025-05-01').date).toEqual([])
  })

  it('missing normals → null daily, cumulative carries', () => {
    const series = gdd(met1([40], [80]))
    const proj = projectGdd(series, { station: 'x', byMonthDay: {} }, undefined, '2025-05-02')
    expect(proj.daily).toEqual([null])
    expect(proj.cumulative[0]).toBeCloseTo(series.cumulative[0]!, 9)
    expect(round3(proj.cumulative[0]!)).toBe(15)
  })
})
