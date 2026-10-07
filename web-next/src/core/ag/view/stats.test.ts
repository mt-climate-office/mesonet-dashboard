import { describe, expect, it } from 'vitest'
import type { GddModel } from '../../charts/agGdd'
import { gddStats, metStats } from './stats'
import type { MetChart } from './results'

const met = (kind: MetChart['kind'], series: object) => ({ kind, model: { series, period: 'daily' } }) as unknown as MetChart

describe('metStats', () => {
  it('Reference ET: the total in inches', () => {
    expect(metStats(met('etr', { etoMm: [2.54, null, 25.4] }))).toEqual([{ label: 'Total', value: '1.10 in' }])
  })
  it('feels like and livestock risk: low and high °F', () => {
    expect(metStats(met('feels_like', { valueC: [0, null, 10] }))).toEqual([
      { label: 'Low', value: '32 °F' },
      { label: 'High', value: '50 °F' },
    ])
    expect(metStats(met('cci', { valueC: [null] }))).toEqual([])
    expect(metStats(null)).toEqual([])
  })
  it('daily ranges: the lowest low and the highest high', () => {
    const range = { kind: 'cci', model: { range: { lowC: [-10, null, 5], highC: [20, 30, null] }, period: 'daily' } } as unknown as MetChart
    expect(metStats(range)).toEqual([
      { label: 'Low', value: '14 °F' },
      { label: 'High', value: '86 °F' },
    ])
  })
})

describe('gddStats', () => {
  const m = (stageMode: GddModel['stageMode']) =>
    ({ stageMode, series: { cumulative: [10, 2412.4, null], stageName: ['Emergence', 'Haun 2', null] } }) as unknown as GddModel
  it('the accumulation so far and, with a stage table, the stage reached', () => {
    expect(gddStats(m('table'))).toEqual([
      { label: 'So far', value: '2,412 GDD' },
      { label: 'Stage', value: 'Haun 2', wide: true },
    ])
    expect(gddStats(m('custom'))).toEqual([{ label: 'So far', value: '2,412 GDD' }])
    expect(gddStats(null)).toEqual([])
  })
})
