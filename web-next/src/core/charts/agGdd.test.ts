import { describe, expect, it } from 'vitest'
import type { DailyNormals, GddSeries } from '../ag/contract'
import { gdd, projectGdd } from '../ag/compute'
import { dailyMet, stageTable } from '../ag/__tests__/adapters'
import { GDD, GDD_STAGE_LINE, THEMES } from '../palette'
import { GDD_NAMES, gddAxisMax, gddBarName, gddChart, gddTable, stageLines } from './agGdd'
import { testCtx } from './testing'
import { paint } from './theme'

type S = { type: string; name: string; id?: string; data: unknown[][]; yAxisIndex?: number; color: string; markLine?: { data: { yAxis: number; name: string }[] }; lineStyle?: { type: string } }
const series = (o: { series?: unknown }) => o.series as S[]
const met = dailyMet('acebozem', 'season2025')

function withProjection() {
  const s: GddSeries = gdd(met, { crop: 'hemp', stages: stageTable('hemp') })
  const q = (m: number) => ({ q25: m - 3, median: m, q75: m + 3 })
  const normals: DailyNormals = { station: 'acebozem', byMonthDay: {} }
  for (let d = 0; d < 400; d++) {
    const md = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000).toISOString().slice(5, 10)
    normals.byMonthDay[md] = { tminC: q(8), tmaxC: q(24), prMm: 0, petMm: 0 }
  }
  const last = s.date.at(-1)!
  const fc = [1, 2, 3].map((n) => new Date(Date.parse(`${last}T00:00Z`) + n * 86_400_000).toISOString().slice(0, 10))
  const p = projectGdd(s, normals, { date: fc, tminC: [10, 10, 10], tmaxC: [30, 30, 30], source: 'nws' }, '2025-11-30', stageTable('hemp'))
  return { s, p, last, fc }
}

describe('gddChart', () => {
  it('bars + cumulative on y2 with stage lines from the table; palette colors per theme', () => {
    const s = gdd(met, { crop: 'wheat', stages: stageTable('wheat') })
    for (const t of THEMES) {
      const ctx = testCtx(t)
      const [bars, cum] = series(gddChart({ series: s, cutoffsF: [32, 70], stageMode: 'table', stages: stageTable('wheat').stages }, ctx))
      expect([bars.type, cum.type, cum.yAxisIndex]).toEqual(['bar', 'line', 1])
      expect([bars.color, cum.color]).toEqual([GDD[t].bar, GDD[t].cumulative])
      expect(bars.name).toBe('Daily GDDs (32–70 °F)')
      expect(cum.markLine!.data.length).toBeGreaterThan(0)
      expect((cum.markLine as unknown as { lineStyle: { color: string } }).lineStyle.color).toBe(paint(ctx.theme, GDD_STAGE_LINE))
    }
  })

  it('tooltip notes: stage text, "No stage table for corn", "n/a (custom cutoffs)"', () => {
    const notes = (o: ReturnType<typeof gddChart>) => new Set(series(o)[1].data.filter((p) => p.length === 3).map((p) => p[2]))
    const wheat = gddChart({ series: gdd(met, { crop: 'wheat', stages: stageTable('wheat') }), cutoffsF: [32, 70], stageMode: 'table' }, testCtx())
    expect([...notes(wheat)].some((n) => /Leaf/.test(String(n)))).toBe(true)
    const corn = gddChart({ series: gdd(met, { crop: 'corn', stages: { crop: 'corn', stages: [] } }), cutoffsF: [50, 86], stageMode: 'no-table', cropLabel: 'Corn' }, testCtx())
    expect(notes(corn)).toEqual(new Set(['No stage table for corn']))
    const custom = gddChart({ series: gdd(met, { crop: 'wheat', lowC: 0, highC: 30 }), cutoffsF: [32, 86], stageMode: 'custom' }, testCtx())
    expect(notes(custom)).toEqual(new Set(['n/a (custom cutoffs)']))
  })

  it('projection: q25 base (aux), band, forecast from the last observed day, normals from the last forecast day', () => {
    const { s, p, last, fc } = withProjection()
    const o = gddChart({ series: s, cutoffsF: [32, Infinity], stageMode: 'table', projection: p }, testCtx())
    const ss = series(o)
    expect(ss.map((x) => x.name)).toEqual(['Daily GDDs (32–∞ °F)', GDD_NAMES.cumulative, GDD_NAMES.q25, GDD_NAMES.band, GDD_NAMES.forecast, GDD_NAMES.normals])
    expect(ss[2].id).toMatch(/^aux:/)
    const day = (d: string) => Date.parse(`${d}T12:00Z`)
    expect(ss[4].data[0][0]).toBe(day(last))
    expect(ss[4].data).toHaveLength(4)
    expect(ss[4].lineStyle!.type).toBe('dotted')
    expect(ss[5].data[0][0]).toBe(day(fc[2]))
    expect(ss[5].data.at(-1)![0]).toBe(day('2025-11-30'))
    expect(ss[5].lineStyle!.type).toBe('dashed')
    const y2 = (o.yAxis as { max?: number }[])[1]
    expect(y2.max).toBe(gddAxisMax({ series: s, cutoffsF: [32, 1], stageMode: 'table', projection: p }))
    expect(y2.max!).toBeGreaterThanOrEqual(p.cumulativeQ75.at(-1)!)
    expect((o.legend as { data: unknown[] }).data).not.toContain(GDD_NAMES.q25)
  })

  it('stage lines are thinned so labels never stack', () => {
    const lines = stageLines([{ stage: 1, name: 'a', description: null, gdd: 100 }, { stage: 2, name: 'b', description: null, gdd: 110 }, { stage: 3, name: 'c', description: null, gdd: 900 }], 1600)
    expect(lines.map((l) => l.y)).toEqual([100, 900])
    expect(lines[0].label).toBe('1 – a')
    expect(gddBarName([50, 86])).toBe('Daily GDDs (50–86 °F)')
  })

  it('table: observed then projected rows', () => {
    const { s, p } = withProjection()
    const t = gddTable({ series: s, cutoffsF: [32, Infinity], stageMode: 'table', projection: p })
    expect(t.columns).toEqual(['Date', 'Source', 'Daily GDDs', 'Cumulative GDDs', 'Growth stage'])
    expect(t.rows).toHaveLength(s.date.length + p.date.length)
    expect(t.rows.at(-1)![1]).toBe('Projected (normals median)')
  })
})
