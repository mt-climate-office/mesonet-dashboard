import { describe, expect, it } from 'vitest'
import {
  depthInchesFromLabel,
  depthLabelFromCol,
  depthLabelFromColumn,
  depthOrder,
  variableForColumn,
} from './columns'

describe('variableForColumn', () => {
  it.each([
    ['Air Temperature [°F]', 'Air Temperature'],
    ['Atmospheric Pressure [mbar]', 'Atmospheric Pressure'],
    ['Relative Humidity [%]', 'Relative Humidity'],
    ['Solar Radiation [W/m²]', 'Solar Radiation'],
    ['Snow Depth [in]', 'Snow Depth'],
    ['Snow Depth [in.]', 'Snow Depth'],
    ['Soil Temperature @ 4 in [°F]', 'Soil Temperature'],
    ['Soil VWC @ 8 in [%]', 'Soil VWC'],
    ['Bulk EC @ 2 in [mS/cm]', 'Bulk EC'],
    ['Gust Speed [mi/hr]', 'Gust Speed'],
    ['Wind Speed [mi/hr]', 'Wind Speed'],
    ['Wind Direction [deg]', 'Wind Direction'],
    ['Max Precip Rate [in/hr]', 'Max Precip Rate'],
    ['Max Precip Rate [in/h]', 'Max Precip Rate'],
    ['Precipitation [in]', 'Precipitation'],
    ['Reference ET (a=0.23) [in]', 'Reference ET'],
    ['Well Water Level [in]', 'Well Water Level'],
    ['Well Water Temperature [°F]', 'Well Water Temperature'],
  ])('%s → %s', (col, expected) => {
    expect(variableForColumn(col)).toBe(expected)
  })

  it('checks Max Precip Rate before Precipitation', () => {
    expect(variableForColumn('Max Precip Rate [in/hr]')).toBe('Max Precip Rate')
  })

  it('returns null for unknown / meta columns', () => {
    expect(variableForColumn('datetime')).toBeNull()
    expect(variableForColumn('provisional')).toBeNull()
  })
})

describe('depthLabelFromColumn', () => {
  it('extracts inch depths', () => {
    expect(depthLabelFromColumn('Soil Temperature @ 4 in [°F]')).toBe('4 in')
    expect(depthLabelFromColumn('Soil VWC @  20   in [%]')).toBe('20 in')
  })
  it('returns null for cm or depth-less columns', () => {
    expect(depthLabelFromColumn('Soil VWC @ -10 cm [%]')).toBeNull()
    expect(depthLabelFromColumn('Air Temperature [°F]')).toBeNull()
  })
})

describe('depthLabelFromCol', () => {
  it('handles inches and cm', () => {
    expect(depthLabelFromCol('Soil Water Potential @ 2 in [bar]')).toBe('2 in')
    expect(depthLabelFromCol('Soil Water Potential @ -5 cm [bar]')).toBe('-5 cm')
  })
  it('falls back to the column name', () => {
    expect(depthLabelFromCol('Soil Water Potential [bar]')).toBe(
      'Soil Water Potential [bar]',
    )
  })
})

describe('depthInchesFromLabel / depthOrder', () => {
  it('returns absolute depth numbers', () => {
    expect(depthInchesFromLabel('-5 cm')).toBe(5)
    expect(depthInchesFromLabel('20 in')).toBe(20)
    expect(depthInchesFromLabel('surface')).toBe(0)
  })
  it('sorts shallow → deep', () => {
    const labels = ['36 in', '2 in', '-50 cm', '8 in']
    expect([...labels].sort((a, b) => depthOrder(a) - depthOrder(b))).toEqual([
      '2 in',
      '8 in',
      '36 in',
      '-50 cm',
    ])
  })
  it('depthOrder is depthInchesFromLabel', () => {
    expect(depthOrder).toBe(depthInchesFromLabel)
  })
})
