import { describe, expect, it } from 'vitest'
import type { Station } from '../../api'
import { DERIVED_VAR_OPTIONS } from '../../params/ag'
import { readUrlState } from '../../url-schema'
import { dateRangeText, optionChips } from './summary'
import { resolveAgTab } from './tab'

const TODAY = '2026-10-02'
const BOZ = { station: 'acebozem', name: 'Bozeman', sub_network: 'HydroMet', has_swp: true, nwsli_id: null } as Station
const tab = (q: string) => resolveAgTab(readUrlState(q), BOZ, TODAY)
const texts = (q: string, annual: string | null = null) => optionChips(tab(q), annual, TODAY).map((c) => c.text)
const ids = (q: string) => optionChips(tab(q), null, TODAY).map((c) => c.id)

describe('dateRangeText', () => {
  it('names the year once within a year, twice across years', () => {
    expect(dateRangeText('2026-01-05', '2026-10-02')).toBe('Jan 5 – Oct 2, 2026')
    expect(dateRangeText('2025-10-02', '2026-10-02')).toBe('Oct 2, 2025 – Oct 2, 2026')
  })
})

describe('optionChips', () => {
  it('GDD: crop, cutoffs, dates, projection', () => {
    expect(texts('?v=gdd')).toEqual(['Wheat', '32–70 °F', 'Since Oct 2, 2025', 'Projected to Oct 31'])
    expect(texts('?v=gdd&crop=sunflower&gdd_proj=30')).toEqual(['Sunflower', 'from 44 °F', 'Since Oct 2, 2025', 'Projected +30 days'])
    expect(texts('?v=gdd&crop=corn&gdd_lo=45&gdd_proj=off')).toEqual(['Corn', '45–86 °F', 'Since Oct 2, 2025', 'No projection'])
  })
  it('time-series tools: interval and window ("Since" when it ends today)', () => {
    expect(texts('?v=etr')).toEqual(['Daily', 'Since Oct 2, 2025'])
    expect(texts('?v=feels_like&ag_time=hourly&ag_from=2026-01-01&ag_to=2026-01-07')).toEqual(['Hourly', 'Jan 1 – Jan 7, 2026'])
    expect(texts('?v=swp&ag_from=2026-05-01')).toEqual(['Daily', 'Since May 1, 2026'])
  })
  it('livestock adds the animal; soil profile names its variable', () => {
    expect(texts('?v=cci&lt=newborn&ag_from=2026-09-01')).toEqual(['Daily', 'Newborn', 'Since Sep 1, 2026'])
    expect(texts('?v=soil_temp,soil_ec_blk&soilv=soil_temp&ag_from=2026-09-01')).toEqual(['Temperature', 'Since Sep 1, 2026'])
  })
  it('annual: the comparison variable, or a prompt while it loads', () => {
    expect(texts('?v=annual', 'Air Temperature [°F]')).toEqual(['Air Temperature [°F]'])
    expect(texts('?v=annual')).toEqual(['Choose a variable'])
  })
  it('every tool has chips, each named, and a card description', () => {
    expect(ids('?v=cci')).toEqual(['interval', 'livestock', 'dates'])
    for (const o of DERIVED_VAR_OPTIONS) {
      const chips = optionChips(tab(`?v=${o.value}`), 'x', TODAY)
      expect(chips.length, o.value).toBeGreaterThan(0)
      for (const c of chips) expect(c.name && c.text, `${o.value} ${c.id}`).toBeTruthy()
      expect(o.description, o.value).toMatch(/\.$/)
    }
  })
})
