import { describe, expect, it } from 'vitest'
import type { Station, StationElement } from '../api'
import {
  confirmKey,
  dateWindow,
  droppedSwpNotice,
  elementGroups,
  installDateOf,
  largeHourlyText,
  PICK_FIRST_HINT,
  pruneSelection,
  qcLevelOf,
  requestSummary,
  resultAnnouncement,
  runBlocker,
  shiftDate,
  standardOptions,
  stationItems,
  stationPatch,
} from './view'

const st = (station: string, name: string, extra: Partial<Station> = {}): Station => ({
  station,
  name,
  sub_network: 'HydroMet',
  latitude: 46,
  longitude: -110,
  date_installed: '2017-06-01',
  elevation: 1000,
  county: 'Gallatin',
  mesowest_id: null,
  gwic_id: null,
  nwsli_id: null,
  has_swp: false,
  funded: true,
  ...extra,
})

const el = (element: string, description_short: string): StationElement => ({
  element,
  description: description_short,
  description_short,
  base_units: '',
  us_units: '',
  sort_order: 0,
})

describe('stationItems', () => {
  it('sorts by name, labels with the network and makes the NWSLI searchable', () => {
    const items = stationItems([st('lololowr', 'Lolo Lower'), st('acebozem', 'Bozeman', { nwsli_id: 'BZMM8', sub_network: 'AgriMet' })])
    expect(items).toEqual([
      { id: 'acebozem', label: 'Bozeman (AgriMet)', keywords: ['BZMM8'] },
      { id: 'lololowr', label: 'Lolo Lower (HydroMet)', keywords: [] },
    ])
  })
})

describe('installDateOf', () => {
  it('trims to the date', () => {
    expect(installDateOf(st('a', 'A', { date_installed: '2017-06-01 00:00:00' }))).toBe('2017-06-01')
    expect(installDateOf(st('a', 'A', { date_installed: null }))).toBeNull()
    expect(installDateOf(undefined)).toBeNull()
  })
})

describe('standardOptions / elementGroups', () => {
  const opts = standardOptions([
    el('soil_vwc_1000', 'Soil VWC @ -100 cm'),
    el('soil_vwc_0100', 'Soil VWC @ -10 cm'),
    el('air_temp_0200', 'Air Temperature @ 2 m'),
    el('air_temp_0200', 'Air Temperature @ 2 m'),
    el('etr', 'Reference ET'),
  ])
  it('dedupes, drops derived codes, swaps units and sorts naturally', () => {
    expect(opts.map((o) => o.label)).toEqual(['Air Temperature @ 6.6 ft', 'Soil VWC @ 4 in', 'Soil VWC @ 40 in'])
  })
  it('groups standard and derived; SWP options only at has_swp stations', () => {
    expect(elementGroups(opts, false).map((g) => [g.label, g.options.length])).toEqual([
      ['Standard elements', 3],
      ['Derived variables', 3],
    ])
    expect(elementGroups(opts, true)[1].options.map((o) => o.value)).toEqual(['feels_like', 'etr', 'cci', 'swp', 'percent_saturation'])
  })
})

describe('pruneSelection', () => {
  const standard = [{ value: 'air_temp_0200', label: 'Air' }]
  it('keeps the URL selection until the station and its list load', () => {
    expect(pruneSelection(['swp', 'x'], { stationKnown: false, hasSwp: false, standard: null })).toEqual({
      selected: ['swp', 'x'],
      droppedSwp: [],
    })
  })
  it('drops SWP codes at a non-SWP station (with notice) and codes the station lacks', () => {
    expect(
      pruneSelection(['percent_saturation', 'x', 'air_temp_0200', 'etr', 'swp'], { stationKnown: true, hasSwp: false, standard }),
    ).toEqual({ selected: ['air_temp_0200', 'etr'], droppedSwp: ['percent_saturation', 'swp'] })
    expect(pruneSelection(['swp'], { stationKnown: true, hasSwp: true, standard }).selected).toEqual(['swp'])
  })
  it('names the dropped variables', () => {
    expect(droppedSwpNotice(['swp'], 'Lolo Lower')).toBe(
      'Soil Water Potential is not available at Lolo Lower (no soil water potential parameters), so it was removed from the request.',
    )
    expect(droppedSwpNotice(['swp', 'percent_saturation'], 'X')).toMatch(/^Soil Water Potential and Percent Saturation are .* so they were removed/)
  })
})

describe('qcLevelOf', () => {
  it('qc wins; rmna=true maps to 2; default 2', () => {
    expect(qcLevelOf(1, true)).toBe(1)
    expect(qcLevelOf(null, true)).toBe(2)
    expect(qcLevelOf(null, false)).toBe(2)
    expect(qcLevelOf(0, false)).toBe(0)
  })
})

describe('dateWindow', () => {
  const today = '2026-10-01'
  it('daily/monthly start at the install date, end today', () => {
    expect(dateWindow({ period: 'daily', from: null, to: null, installDate: '2017-06-01', today })).toMatchObject({
      start: '2017-06-01',
      end: today,
      clamped: false,
      error: null,
    })
    expect(dateWindow({ period: 'monthly', from: null, to: null, installDate: null, today }).start).toBe('2025-10-01')
  })
  it('hourly defaults to the last 30 days (or the install date if later)', () => {
    const w = dateWindow({ period: 'hourly', from: null, to: null, installDate: '2017-06-01', today })
    expect(w).toMatchObject({ start: '2026-09-02', span: 30, largeHourly: false })
    expect(dateWindow({ period: 'hourly', from: null, to: null, installDate: '2026-09-20', today }).start).toBe('2026-09-20')
  })
  it('clamps an early start with the install-specific error past the end', () => {
    expect(dateWindow({ period: 'daily', from: '2015-01-01', to: '2018-01-01', installDate: '2017-06-01', today })).toMatchObject({
      start: '2017-06-01',
      clamped: true,
      error: null,
    })
    expect(dateWindow({ period: 'daily', from: '2015-01-01', to: '2016-01-01', installDate: '2017-06-01', today })).toMatchObject({
      clamped: true,
      error: 'This station was installed on 2017-06-01; choose an end date on or after it.',
      span: 0,
    })
  })
  it('flags hourly ranges over 366 days', () => {
    const w = dateWindow({ period: 'hourly', from: '2024-01-01', to: '2025-12-31', installDate: '2017-06-01', today })
    expect(w).toMatchObject({ span: 731, largeHourly: true })
    expect(largeHourlyText(w.span, true)).toBe(
      'This hourly request spans 731 days (about 17,544 rows per variable) and may be slow. Run Request will ask you to confirm; or shorten the range.',
    )
    expect(largeHourlyText(w.span, false)).toMatch(/Click "Confirm large request" to fetch it\.$/)
    expect(confirmKey('acebozem', w, 'hourly')).toBe('acebozem|2024-01-01|2025-12-31|hourly')
  })
})

describe('shiftDate', () => {
  it('crosses month and leap-year boundaries', () => {
    expect(shiftDate('2026-10-01', -29)).toBe('2026-09-02')
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29')
  })
})

describe('guards and text', () => {
  it('runBlocker', () => {
    expect(runBlocker(null, ['x'], null)).toBe(PICK_FIRST_HINT)
    expect(runBlocker('s', [], null)).toBe(PICK_FIRST_HINT)
    expect(runBlocker('s', ['x'], 'bad')).toBe('bad')
    expect(runBlocker('s', ['x'], null)).toBeNull()
  })
  it('resultAnnouncement', () => {
    expect(resultAnnouncement(0, 3)).toBe('Request finished: no data for this selection.')
    expect(resultAnnouncement(1234, 6)).toBe('Request finished: 1,234 rows, 6 columns. Download CSV is ready.')
  })
  it('requestSummary recaps the request in parts', () => {
    expect(requestSummary({ station: 'Bozeman', elements: 2, period: 'daily', start: '2026-09-01', end: '2026-09-30' }))
      .toEqual(['Bozeman', '2 variables', 'Daily', '2026-09-01 to 2026-09-30'])
    expect(requestSummary({ station: 'Bozeman', elements: 1, period: 'hourly', start: '2026-09-24', end: '2026-09-30' }))
      .toEqual(['Bozeman', '1 variable', 'Hourly', '2026-09-24 to 2026-09-30'])
  })
  it('stationPatch resets the start date and the Latest cards', () => {
    expect(stationPatch('acebozem')).toEqual({ s: 'acebozem', card: null, info: null, dl_from: null })
  })
})
