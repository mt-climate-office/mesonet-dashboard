import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { stationVariables } from './catalog'
import { parseWallClock } from '../sensorEvents'
import type { TimeseriesPanel } from '../models/timeseries'
import { rangeView } from './range'
import { panelStats } from './stats'
import { currentReading, listRequest, primaryColumn, variableRows } from './summary'

const ELEMENTS = [
  ['air_temp_0200', 'Air Temperature @ 2 m'],
  ['ppt', 'Precipitation'],
  ['soil_vwc_0005', 'Soil VWC @ -5 cm'],
  ['soil_vwc_0010', 'Soil VWC @ -10 cm'],
  ['bp', 'Atmospheric Pressure'],
].map(([element, description_short]) => ({ element, description_short }))
const VARS = stationVariables(ELEMENTS)

// 72 hourly rows (LAB_SWAP headers); 0.1 in of rain in each of the last 3 hours.
const HOURLY: ObservationRow[] = Array.from({ length: 72 }, (_, i) => ({
  station: 'acebozem',
  datetime: `${['2026-09-30', '2026-10-01', '2026-10-02'][Math.floor(i / 24)]} ${String(i % 24).padStart(2, '0')}:00:00-06:00`,
  'Air Temperature [°F]': 40 + (i % 24),
  'Precipitation [in]': i >= 69 ? 0.1 : 0,
  'Soil VWC @ 4 in [%]': 20,
  'Soil VWC @ 2 in [%]': 10,
  'Atmospheric Pressure [mbar]': null,
}))
const LATEST = { station: 'acebozem', datetime: '2026-10-02 23:55:00-06:00', 'Air Temperature [°F]': 56.984, 'Soil VWC @ 2 in [%]': 8.65, 'Soil VWC @ 4 in [%]': 13.35 }

describe('primaryColumn', () => {
  it('picks the variable column, shallowest depth first', () => {
    expect(primaryColumn(Object.keys(HOURLY[0]), 'Soil VWC')).toBe('Soil VWC @ 2 in [%]')
    expect(primaryColumn(Object.keys(HOURLY[0]), 'Precipitation')).toBe('Precipitation [in]')
    expect(primaryColumn(['station', 'datetime'], 'Precipitation')).toBeNull()
  })
})

describe('listRequest', () => {
  it('asks for 72 h hourly of every listed variable (ETr through /derived)', () => {
    const r = listRequest('acebozem', VARS, ELEMENTS, dayjs('2026-10-02'))!
    expect(r.key).toBe('obs:acebozem:hourly:2026-09-30:2026-10-02:air_temp,bp,ppt,soil_vwc:etr')
    expect(r.query).toMatchObject({ period: 'hourly', start: '2026-09-30', end: '2026-10-02', hasEtr: true })
  })
})

describe('variableRows', () => {
  const rows = variableRows(VARS, LATEST, HOURLY)
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
  it('names rows plainly (core/variables/labels)', () => {
    expect(byId.air_temp.name).toBe('Air temperature')
    expect(byId.soil_vwc.name).toBe('Soil moisture')
    expect(byId.ppt.name).toBe('Rain')
  })
  it('takes current values from /latest, with the depth for soil', () => {
    expect(byId.air_temp).toMatchObject({ value: '57 °F', note: '' })
    expect(byId.soil_vwc).toMatchObject({ value: '9%', note: 'at 2 in' })
  })
  it('summed variables show the last 24 h total and bars', () => {
    expect(byId.ppt).toMatchObject({ value: '0.30 in', note: 'last 24 h' })
    expect(byId.ppt.spark?.kind).toBe('bars')
    expect(byId.ppt.sparkLabel).toBe('Last 48 hours: 0.3 in in total.')
  })
  it('draws a 48 h line and describes its range', () => {
    expect(byId.air_temp.spark?.kind).toBe('line')
    expect(byId.air_temp.sparkLabel).toBe('Last 48 hours: from 40 °F to 63 °F.')
  })
  it('shows "—" and no sparkline without values, and works before the hourly rows load', () => {
    expect(byId.bp).toMatchObject({ value: '—', spark: null, sparkLabel: '' })
    expect(variableRows(VARS, LATEST, undefined).find((r) => r.id === 'air_temp')).toMatchObject({ value: '57 °F', spark: null })
    expect(variableRows(VARS, undefined, HOURLY).find((r) => r.id === 'air_temp')?.value).toBe('63 °F')
  })
})

describe('24 h totals', () => {
  it("the variable page's 24 h total equals the list's: the 24 readings ending at the newest", () => {
    // 1 in exactly 24 h before the newest reading (outside), 0.1 in at the newest (inside).
    const rows = HOURLY.map((r, i) => ({ ...r, 'Precipitation [in]': i === 47 ? 1 : i === 71 ? 0.1 : 0 }))
    const list = variableRows(VARS, undefined, rows).find((r) => r.id === 'ppt')!
    const x = rows.map((r) => parseWallClock(r.datetime)!)
    const panel = {
      series: [{ name: 'Precipitation [in]', type: 'bar', depth: null, values: rows.map((r) => r['Precipitation [in]'] as number), hoverLabel: '' }],
    } as unknown as TimeseriesPanel
    const [page] = panelStats(panel, x, rangeView('24h', '2026-10-01', '2026-10-02', x[x.length - 1]), true, 'ppt')
    expect(list.value).toBe('0.10 in')
    expect(page.items).toEqual([{ label: 'Total', value: list.value }])
  })
})

describe('currentReading', () => {
  const v = (id: string) => VARS.find((x) => x.id === id)!
  it('the /latest reading in plain units at the shallowest depth; none for totals or without a reading', () => {
    expect(currentReading(v('air_temp'), LATEST)).toBe('57 °F')
    expect(currentReading(v('soil_vwc'), LATEST)).toBe('9% at 2 in')
    expect(currentReading(v('ppt'), LATEST)).toBeNull()
    expect(currentReading(v('bp'), LATEST)).toBeNull()
    expect(currentReading(v('air_temp'), undefined)).toBeNull()
  })
})
