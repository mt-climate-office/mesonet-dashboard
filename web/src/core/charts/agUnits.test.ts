import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Station } from '../api'
import type { GddSeries, SwpSeries } from '../ag/contract'
import { cciDaily, etoDaily, feelsLikeDaily, gdd } from '../ag/compute'
import { dailyMet, stageTable, stationMeta } from '../ag/__tests__/adapters'
import { annualAxisLabel, depthLabel, dropCappedDepths, fromSi, profileMeta, swpText } from '../ag/view/labels'
import { optionChips } from '../ag/view/summary'
import { resolveAgTab } from '../ag/view/tab'
import { setUnitsSource } from '../units'
import { readUrlState } from '../url-schema'
import { displayModel, gddBarName, gddChart, gddTable } from './agGdd'
import { cciChart, cciTable, etrAxis, etrChart, etrTable, feelsLikeTable } from './agMet'
import { frozenName, soilProfileTable, swpChart, swpTable } from './agSoil'
import { drawn, shownY, testCtx } from './testing'

type S = { type: string; name: string; id?: string; data: unknown[][]; markLine?: { data: { yAxis: number }[] } }
const series = (o: { series?: unknown }) => drawn<S>(o).filter((x) => !String(x.id).startsWith('aux:halo'))
const met = dailyMet('acebozem', 'season2025')

beforeEach(() => setUnitsSource(() => 'si'))
afterEach(() => setUnitsSource(() => 'us'))

describe('Ag labels in SI', () => {
  it('depths, SWP text, profile units and the frozen line', () => {
    expect(depthLabel(10)).toBe('10 cm')
    expect(swpText(0.33, false)).toBe('-33.0 kPa')
    expect(swpText(1000, true)).toBe('≤ -100000.0 kPa (drier than the lab range)')
    expect(profileMeta('soil_temp')).toMatchObject({ units: '°C', mid: 0 })
    expect(profileMeta('swp').units).toBe('kPa')
    expect(frozenName()).toBe('Frozen soil (≤ 0 °C)')
  })
  it('contract SI passes through; snow depth mm → cm; annual label metric', () => {
    expect(fromSi('°F')(10)).toBe(10)
    expect(fromSi('in', 'Snow Depth [in]')(100)).toBe(10)
    expect(annualAxisLabel('Average Air Temperature @ 2 m [°F]', false)).toBe('Air temperature at 2 m (°C)')
    expect(annualAxisLabel('Total Precipitation [in]', true)).toBe('Cumulative precipitation (mm)')
    expect(annualAxisLabel('Average Air Temperature @ 2 m [°F]', false, 'us')).toBe('Air temperature at 2 m (°F)')
  })
  it('capped-depth notes name the cap in kPa', () => {
    const s: SwpSeries = { depthsCm: [10], time: ['2025-07-01'], epochMs: [0], kPa: [[1e6]], clipped: [[true]] } as unknown as SwpSeries
    expect(dropCappedDepths(s).notes).toEqual(['10 cm: drier than -100,000 kPa for the whole period, so it is not drawn.'])
  })
})

describe('GDD in SI', () => {
  const s: GddSeries = gdd(met, { crop: 'hemp', stages: stageTable('hemp') })
  const model = { series: s, cutoffsF: [34, Infinity] as const, stageMode: 'table' as const, stages: stageTable('hemp').stages }
  it('totals and stage thresholds are °C·days (×5/9)', () => {
    const d = displayModel(model)
    const last = s.cumulative.findLastIndex((v) => v != null)
    expect(d.series.cumulative[last]).toBeCloseTo((s.cumulative[last]! * 5) / 9, 9)
    expect(d.stages![0].gdd).toBeCloseTo((model.stages[0].gdd * 5) / 9, 9)
    expect(displayModel(model).series).not.toBe(s)
  })
  it('axis names, bar name and table say °C', () => {
    const o = gddChart(model, testCtx())
    expect(shownY<{ name: string }>(o).map((a) => a.name)).toEqual(['Daily GDD (°C)', 'Cumulative GDD (°C)'])
    expect(gddBarName([50, 86])).toBe('Daily GDDs (10–30 °C)')
    expect(gddTable(model).columns).toEqual(['Date', 'Source', 'Daily GDD (°C)', 'Cumulative GDD (°C)', 'Growth stage'])
  })
})

describe('met charts in SI', () => {
  it('reference ET in mm', () => {
    const eto = etoDaily(met, stationMeta('acebozem'))
    const [bars] = series(etrChart({ series: eto, period: 'daily' }, testCtx()))
    const i = eto.etoMm.findIndex((v) => v != null)
    expect(bars.data[i][1]).toBeCloseTo(eto.etoMm[i]!, 10)
    expect(etrAxis()).toBe('Reference ET (mm)')
    expect(etrTable({ series: eto, period: 'daily' }).caption).toBe('Reference ET (a=0.23), millimeters')
  })
  it('livestock risk: °C values and onset lines, classes still from °F', () => {
    const cci = cciDaily(met, 'adult')
    const m = { series: cci, period: 'daily' as const }
    const t = cciTable(m)
    const us = (() => {
      setUnitsSource(() => 'us')
      const r = cciTable(m)
      setUnitsSource(() => 'si')
      return r
    })()
    expect(t.columns[1]).toBe('Livestock risk (°C)')
    // Same risk classes either way.
    expect(t.rows.map((r) => r[2])).toEqual(us.rows.map((r) => r[2]))
    const i = cci.valueC.findIndex((v) => v != null)
    expect(Number(t.rows[i][1])).toBeCloseTo(cci.valueC[i]!, 1)
    const o = cciChart(m, testCtx())
    const ref = series(o).flatMap((x) => x.markLine?.data ?? []).map((d) => d.yAxis)
    expect(ref).toContain(25)
  })
  it('feels like in °C', () => {
    expect(feelsLikeTable({ series: feelsLikeDaily(met), period: 'daily' }).columns).toContain('Feels like (°C)')
  })
})

describe('soil in SI', () => {
  it('SWP chart and table in kPa', () => {
    const s = { depthsCm: [10], time: ['2025-07-01', '2025-07-02'], epochMs: [0, 1], kPa: [[50, 200]], clipped: [[false, false]] } as unknown as SwpSeries
    expect(swpTable({ series: s, period: 'daily' }).rows).toEqual([['2025-07-01', '-50.0'], ['2025-07-02', '-200.0']])
    expect(swpTable({ series: s, period: 'daily' }).caption).toBe('Soil water potential by depth, kPa (negative = suction)')
    const lines = series(swpChart({ series: s, period: 'daily' }, testCtx())).filter((x) => x.name === '10 cm')
    expect(lines[0].data.map((p) => p[1])).toEqual([50, 200])
  })
  it('profile table columns in cm', () => {
    const t = soilProfileTable({ variable: 'soil_temp', time: ['2025-07-01'], depthsCm: [5, 10], values: [[1], [2]], period: 'daily' })
    expect(t.columns).toEqual(['Date', '5 cm', '10 cm'])
  })
})

describe('option chips in SI', () => {
  const BOZ = { station: 'acebozem', name: 'Bozeman', sub_network: 'HydroMet', has_swp: true, nwsli_id: null } as Station
  it('GDD cutoffs in °C', () => {
    const t = resolveAgTab(readUrlState('?v=gdd&units=si'), BOZ, '2026-10-02')
    expect(optionChips(t, null, '2026-10-02')[1].text).toBe('0–21/35 °C')
  })
})
