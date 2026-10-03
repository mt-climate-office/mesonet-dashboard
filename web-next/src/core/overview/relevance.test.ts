import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { dewPointF, nowTiles, pressureChange3h, pressureTrend, shallowestSwpBar, soilState, sunUp } from './relevance'
import type { OverviewInput } from './tiles'

const LATEST = {
  station: 'acebozem',
  datetime: '2026-10-01 13:55:00-06:00',
  'Air Temperature [°F]': 68,
  'Relative Humidity [%]': 50,
  'Wind Speed [mi/h]': 5,
  'Atmospheric Pressure [mbar]': 850,
  'Solar Radiation [W/m²]': 400,
  'Soil VWC @ 2 in [%]': 12,
  'Snow Depth [in]': 0,
  provisional: true,
}
const PPT = { station: 'x', 'Year to Date Precipitation [in]': 13.119, '7-day Precipitation [in]': 0, '24-hour Precipitation [in]': 0, 'Precipitation Since Midnight [in]': 0 }
const PR = [{ type: 'daily', variable: 'pr', month: 1, day: 1, q25: null, q75: null, median: 0, mean: 15 }]
const BASE: OverviewInput = { latest: LATEST, hourly: undefined, ppt: PPT, normals: { pr: PR }, today: '2026-10-01', nowMs: Date.UTC(2026, 9, 1, 20) }

describe('sunUp', () => {
  it.each([
    [null, false],
    [0, false],
    [4.9, false],
    [5, true],
    [400, true],
  ] as const)('%s W/m² → %s', (v, out) => expect(sunUp(v)).toBe(out))
})

describe('dewPointF (Magnus)', () => {
  it.each([
    [68, 50, 48.7],
    [32, 100, 32],
    [90, 30, 54.4],
    [-10, 70, -17.1],
  ] as const)('%s °F at %s%% → %s °F', (t, rh, dp) => expect(dewPointF(t, rh)).toBeCloseTo(dp, 1))
  it('null without both inputs or with RH ≤ 0', () => {
    expect(dewPointF(null, 50)).toBeNull()
    expect(dewPointF(50, null)).toBeNull()
    expect(dewPointF(50, 0)).toBeNull()
  })
})

describe('pressure trend', () => {
  it.each([
    [1.01, 'rising'],
    [1, 'steady'],
    [0, 'steady'],
    [-1, 'steady'],
    [-1.01, 'falling'],
    [-4, 'falling'],
  ] as const)('%s mb/3 h → %s', (d, out) => expect(pressureTrend(d)).toBe(out))
  const rows = (vals: (number | null)[]): ObservationRow[] =>
    vals.map((v, i) => ({ station: 'x', datetime: `2026-10-01 ${String(10 + i).padStart(2, '0')}:00:00-06:00`, 'Atmospheric Pressure [mbar]': v }))
  it('3 h change: newest reading minus the one 3 h before', () => {
    expect(pressureChange3h(rows([848, 849, 850, 851.5]))).toBeCloseTo(3.5, 9)
    expect(pressureChange3h([...rows([848, 849, 850, 847]), ...rows([null]).map((r) => ({ ...r, datetime: '2026-10-01 09:00:00-06:00' }))])).toBeCloseTo(-1, 9)
  })
  it('null when either end is missing', () => {
    expect(pressureChange3h(rows([null, 849, 850, 851]))).toBeNull()
    expect(pressureChange3h(rows([850, 851]))).toBeNull()
    expect(pressureChange3h(undefined)).toBeNull()
  })
})

describe('soil state (SWP against field capacity and wilting point)', () => {
  it.each([
    [0.1, 'Wet'],
    [0.33, 'Wet'],
    [0.34, null],
    [14.9, null],
    [15, 'Dry'],
    [40, 'Dry'],
    [null, null],
    [undefined, null],
  ] as const)('%s bar → %s', (v, out) => expect(soilState(v)).toBe(out))
  it('shallowest finite SWP in a /derived row', () => {
    expect(shallowestSwpBar({ 'Soil Water Potential @ -20 cm [bar]': 2, 'Soil Water Potential @ -5 cm [bar]': null, 'Soil Water Potential @ -10 cm [bar]': 0.8 })).toBe(0.8)
    expect(shallowestSwpBar({ station: 'x' })).toBeNull()
    expect(shallowestSwpBar(undefined)).toBeNull()
  })
})

describe('nowTiles', () => {
  it('daytime: sunlight shown, no pressure tile, Rain even in a dry week; each with its Charts id', () => {
    const t = nowTiles(BASE)
    expect(t.map((x) => [x.id, x.v])).toEqual([['wind', 'wind_spd'], ['precip', 'ppt'], ['rh', 'rh'], ['solar', 'sol_rad'], ['soil', 'soil_vwc']])
  })
  it('night: no sunlight tile', () => {
    expect(nowTiles({ ...BASE, latest: { ...LATEST, 'Solar Radiation [W/m²]': 0 } }).map((x) => x.id)).not.toContain('solar')
  })
  it('Rain from the hourly rows without the ppt summary; none with no source', () => {
    const hourly: ObservationRow[] = [{ station: 'x', datetime: '2026-10-01 10:00:00-06:00', 'Precipitation [in]': 0.12 }]
    expect(nowTiles({ ...BASE, ppt: undefined, hourly }).map((x) => x.id)).toContain('precip')
    expect(nowTiles({ ...BASE, ppt: undefined }).map((x) => x.id)).not.toContain('precip')
  })
  it('snow keeps its rule; VPD where reported', () => {
    expect(nowTiles(BASE).map((x) => x.id)).not.toContain('snow')
    expect(nowTiles({ ...BASE, latest: { ...LATEST, 'Snow Depth [in]': 2 } }).map((x) => x.id)).toContain('snow')
    expect(nowTiles({ ...BASE, latest: { ...LATEST, 'VPD [mbar]': 4.1 } }).map((x) => x.id)).toContain('vpd')
  })
  it('empty until /latest arrives', () => {
    expect(nowTiles({ ...BASE, latest: undefined })).toEqual([])
  })
})
