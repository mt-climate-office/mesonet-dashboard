import { afterEach, describe, expect, it } from 'vitest'
import {
  columnValue,
  degreeDays,
  depthText,
  depthsIn,
  digitsFor,
  displayUnit,
  fromUs,
  quantityOfColumn,
  readUnits,
  saveUnits,
  setUnitsSource,
  toUs,
  unitLabel,
  units,
  type Units,
} from './units'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('units source', () => {
  afterEach(() => setUnitsSource(() => 'us'))
  it('defaults to US and follows the injected reader', () => {
    expect(units()).toBe('us')
    let u: Units = 'si'
    setUnitsSource(() => u)
    expect(units()).toBe('si')
    u = 'us'
    expect(units()).toBe('us')
  })
})

describe('conversions', () => {
  it('converts US values to SI and leaves US alone', () => {
    expect(fromUs('temp', 50, 'si')).toBe(10)
    expect(fromUs('temp', 50, 'us')).toBe(50)
    expect(fromUs('precip', 1, 'si')).toBe(25.4)
    expect(fromUs('snow', 1, 'si')).toBeCloseTo(2.54)
    expect(fromUs('speed', 10, 'si')).toBeCloseTo(4.4704)
    expect(fromUs('pressure', 849, 'si')).toBeCloseTo(84.9)
    expect(fromUs('swp', 1.5, 'si')).toBe(150)
    expect(fromUs('elev', 4905, 'si')).toBeCloseTo(1495.0, 0)
    expect(fromUs('temp', null, 'si')).toBeNull()
  })
  it('degree days scale by 5/9 (1800 °F·d = 1000 °C·d)', () => {
    expect(degreeDays(1800, 'si')).toBe(1000)
    expect(degreeDays(1800, 'us')).toBe(1800)
  })
  it('toUs inverts fromUs', () => {
    expect(toUs('temp', 10, 'si')).toBeCloseTo(50)
    expect(toUs('temp', -1, 'si')).toBeCloseTo(30.2)
    expect(toUs('precip', 25.4, 'si')).toBeCloseTo(1)
    expect(toUs('temp', 50, 'us')).toBe(50)
  })
  it('unit text and precision per system', () => {
    expect(unitLabel('temp', 'us')).toBe('°F')
    expect(unitLabel('temp', 'si')).toBe('°C')
    expect(unitLabel('pressure', 'si')).toBe('kPa')
    expect(digitsFor('precip', 2, 'si')).toBe(1)
    expect(digitsFor('speed', 0, 'si')).toBe(1)
    expect(digitsFor('swp', 0, 'si')).toBe(0)
    expect(digitsFor('precip', 2, 'us')).toBe(2)
  })
})

describe('columns', () => {
  it('finds the quantity from an API header', () => {
    expect(quantityOfColumn('Air Temperature [°F]')).toBe('temp')
    expect(quantityOfColumn('Snow Depth [in]')).toBe('snow')
    expect(quantityOfColumn('Precipitation [in]')).toBe('precip')
    expect(quantityOfColumn('Wind Speed [mi/hr]')).toBe('speed')
    expect(quantityOfColumn('Atmospheric Pressure [mbar]')).toBe('pressure')
    expect(quantityOfColumn('Max Precip Rate [in/hr]')).toBe('rate')
    expect(quantityOfColumn('Relative Humidity [%]')).toBeNull()
    expect(quantityOfColumn('station')).toBeNull()
  })
  it('converts a column value and its unit text together', () => {
    expect(columnValue('Air Temperature [°F]', 212, 'si')).toBe(100)
    expect(columnValue('Relative Humidity [%]', 40, 'si')).toBe(40)
    expect(displayUnit('mi/hr', '', 'si')).toBe('m/s')
    expect(displayUnit('in', 'Snow Depth [in]', 'si')).toBe('cm')
    expect(displayUnit('%', '', 'si')).toBe('%')
    expect(displayUnit('°F', '', 'us')).toBe('°F')
  })
  it('soil depths show the probe’s cm in SI', () => {
    expect(depthText(4, 'si')).toBe('10 cm')
    expect(depthText(36, 'si')).toBe('91 cm')
    expect(depthText(4, 'us')).toBe('4 in')
    expect(depthsIn('Soil moisture at 2 in', 'si')).toBe('Soil moisture at 5 cm')
    expect(depthsIn('Soil moisture at 2 in', 'us')).toBe('Soil moisture at 2 in')
  })
})

describe('saved choice', () => {
  it('reads only us/si; writes survive a throwing storage', () => {
    expect(readUnits(memory({ 'mco-dashboard-units': 'si' }))).toBe('si')
    expect(readUnits(memory({ 'mco-dashboard-units': 'metric' }))).toBeNull()
    expect(readUnits(memory())).toBeNull()
    const s = memory()
    saveUnits(s, 'si')
    expect(s.m.get('mco-dashboard-units')).toBe('si')
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readUnits(broken)).toBeNull()
    expect(() => saveUnits(broken, 'si')).not.toThrow()
  })
})
