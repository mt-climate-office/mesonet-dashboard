import { describe, expect, it } from 'vitest'
import type { TimeseriesPanel } from '../models/timeseries'
import { fmtStat, panelStats } from './stats'

type S = { name: string; depth?: string; values: (number | null)[]; band?: { lo: (number | null)[]; hi: (number | null)[] } }
const panel = (series: S[]): TimeseriesPanel => ({
  variable: 'X',
  axisTitle: 'X',
  isSoil: false,
  noData: false,
  legend: false,
  series: series.map((s) => ({ name: s.name, type: 'line', depth: s.depth ?? null, values: s.values, hoverLabel: s.name, band: s.band })),
  normals: null,
  sensorSpans: [],
})

describe('panelStats', () => {
  const x = [0, 10, 20, 30]
  it('low / high / average over the view, with the unit', () => {
    const [row] = panelStats(panel([{ name: 'Air Temperature [°F]', values: [40, 50, null, 99] }]), x, [0, 30], false)
    expect(row).toEqual({
      label: '',
      items: [
        { label: 'Low', value: '40 °F' },
        { label: 'High', value: '50 °F' },
        { label: 'Average', value: '45 °F' },
      ],
    })
  })
  it('with a daily band, Low and High are the true extremes; Average stays the mean of the means', () => {
    const band = { lo: [30, 41, null, 1], hi: [55, 62, null, 120] }
    const [row] = panelStats(panel([{ name: 'Air Temperature [°F]', values: [40, 50, null, 99], band }]), x, [0, 30], false)
    expect(row.items).toEqual([
      { label: 'Low', value: '30 °F' },
      { label: 'High', value: '62 °F' },
      { label: 'Average', value: '45 °F' },
    ])
  })
  it('a total for summed variables', () => {
    const [row] = panelStats(panel([{ name: 'Precipitation [in]', values: [0.1, 0.25, 0, 1] }]), x, [0, 25], true)
    expect(row.items).toEqual([{ label: 'Total', value: '0.35 in' }])
  })
  it('one row per depth, "—" without values', () => {
    const rows = panelStats(panel([
      { name: 'Soil VWC @ 2 in [%]', depth: '2 in', values: [10, 11, 12, 13] },
      { name: 'Soil VWC @ 4 in [%]', depth: '4 in', values: [null, null, null, null] },
    ]), x, [0, 40], false)
    expect(rows.map((r) => r.label)).toEqual(['2 in', '4 in'])
    expect(rows[1].items[0].value).toBe('—')
  })
  it('in the plain unit and table precision with the variable id', () => {
    const [row] = panelStats(panel([{ name: 'Wind Speed [mi/hr]', values: [4.04, 10.06, null, 1] }]), x, [0, 30], false, 'wind_spd')
    expect(row.items.map((i) => i.value)).toEqual(['4.0 mph', '10.1 mph', '7.1 mph'])
  })
  it('formats by magnitude', () => {
    expect([0.0349, 5.678, 56.78, 848.93, -12.34].map(fmtStat)).toEqual(['0.03', '5.68', '56.8', '849', '-12.3'])
  })
})
