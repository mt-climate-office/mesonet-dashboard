import { describe, expect, it } from 'vitest'
import type { Station } from '../../api'
import { DERIVED_VAR_OPTIONS } from '../../params/ag'
import { readUrlState } from '../../url-schema'
import { dateRangeText, optionsSummary } from './summary'
import { resolveAgTab } from './tab'

const TODAY = '2026-10-02'
const BOZ = { station: 'acebozem', name: 'Bozeman', sub_network: 'HydroMet', has_swp: true, nwsli_id: null } as Station
const tab = (q: string) => resolveAgTab(readUrlState(q), BOZ, TODAY)

describe('dateRangeText', () => {
  it('names the year once within a year, twice across years', () => {
    expect(dateRangeText('2026-01-05', '2026-10-02')).toBe('Jan 5 – Oct 2, 2026')
    expect(dateRangeText('2025-10-02', '2026-10-02')).toBe('Oct 2, 2025 – Oct 2, 2026')
  })
})

describe('optionsSummary', () => {
  it('GDD: crop, cutoffs, projection', () => {
    expect(optionsSummary(tab('?var=gdd'), null)).toBe('Wheat · 32–70 °F · to Oct 31')
    expect(optionsSummary(tab('?var=gdd&crop=sunflower&gdd_proj=30'), null)).toBe('Sunflower · from 44 °F · +30 days')
    expect(optionsSummary(tab('?var=gdd&crop=corn&gdd_lo=45&gdd_proj=off'), null)).toBe('Corn · 45–86 °F · no projection')
  })
  it('time-series tools: period and window', () => {
    expect(optionsSummary(tab('?var=etr'), null)).toBe('Daily · Oct 2, 2025 – Oct 2, 2026')
    expect(optionsSummary(tab('?var=feels_like&ag_time=hourly&ag_from=2026-01-01&ag_to=2026-01-07'), null)).toBe(
      'Hourly · Jan 1 – Jan 7, 2026',
    )
    expect(optionsSummary(tab('?var=swp&ag_from=2026-05-01'), null)).toBe('Daily · May 1 – Oct 2, 2026')
  })
  it('livestock adds the animal; soil profile names its variable', () => {
    expect(optionsSummary(tab('?var=cci&lt=newborn&ag_from=2026-09-01'), null)).toBe('Daily · Newborn · Sep 1 – Oct 2, 2026')
    expect(optionsSummary(tab('?var=soil_temp,soil_ec_blk&soilv=soil_temp&ag_from=2026-09-01'), null)).toBe(
      'Temperature · Sep 1 – Oct 2, 2026',
    )
  })
  it('annual: the comparison variable, or a prompt while it loads', () => {
    expect(optionsSummary(tab('?var=annual'), 'Air Temperature [°F]')).toBe('Air Temperature [°F]')
    expect(optionsSummary(tab('?var=annual'), null)).toBe('Choose a variable')
  })
  it('every tool has a summary and a card description', () => {
    for (const o of DERIVED_VAR_OPTIONS) {
      expect(optionsSummary(tab(`?var=${o.value}`), 'x'), o.value).not.toBe('')
      expect(o.description, o.value).toMatch(/\.$/)
    }
  })
})
