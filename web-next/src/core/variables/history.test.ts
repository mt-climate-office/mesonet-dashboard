import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStationRecord, type ObservationRow } from '../api'
import { stationVariables } from './catalog'
import { HISTORY_MAX_YEARS, historyModel, historyNote, historyRequest, historyRows, historyYears, requestGroups } from './history'

const ELEMENTS = [
  ['air_temp_0200', 'Air Temperature @ 2 m'],
  ['ppt', 'Precipitation'],
].map(([element, description_short]) => ({ element, description_short }))
const [AIR, PPT, ETR] = stationVariables(ELEMENTS)

const daily = (year: number, days: number, col: string, v: (i: number) => number | null): ObservationRow[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(year, 0, 1 + i)).toISOString().slice(0, 10)
    return { station: 'acebozem', datetime: d, [col]: v(i) }
  })

describe('historyYears', () => {
  it('newest first, from the install year, capped', () => {
    expect(historyYears('2023-06-01', '2026-10-02')).toEqual([2026, 2025, 2024, 2023])
    expect(historyYears(null, '2026-10-02')).toEqual([2026])
    expect(historyYears('1990-01-01', '2026-10-02')).toHaveLength(HISTORY_MAX_YEARS)
  })
})

describe('requestGroups', () => {
  it('one year each; the install year rides with the year after it', () => {
    expect(requestGroups([2026, 2025, 2024, 2023, 2022, 2021, 2020], '2020-10-30')).toEqual([[2026], [2025], [2024], [2023], [2022], [2021, 2020]])
    // Install year outside the cap, unknown, or the only year: no folding.
    expect(requestGroups([2026, 2025], '2016-08-11')).toEqual([[2026], [2025]])
    expect(requestGroups([2026, 2025], null)).toEqual([[2026], [2025]])
    expect(requestGroups([2026], '2026-03-01')).toEqual([[2026]])
    expect(requestGroups([2026, 2025], '2025-06-01')).toEqual([[2026, 2025]])
  })
})

describe('historyRequest', () => {
  it('one daily request per group, ending today this year and starting at the install date', () => {
    expect(historyRequest('acebozem', [2025], AIR, ELEMENTS, '2026-10-02', '2016-08-11')?.key).toBe('obs:acebozem:daily:2025-01-01:2025-12-31:air_temp:')
    expect(historyRequest('acebozem', [2026], AIR, ELEMENTS, '2026-10-02', null)?.query).toMatchObject({ period: 'daily', start: '2026-01-01', end: '2026-10-02' })
    expect(historyRequest('acebozem', [2016], AIR, ELEMENTS, '2026-10-02', '2016-08-11')?.query.start).toBe('2016-08-11')
    expect(historyRequest('acebozem', [2025], ETR, ELEMENTS, '2026-10-02', null)?.query).toMatchObject({ elements: '', hasEtr: true })
    // The install year with the next: install date through Dec 31 of the newer year (or today).
    expect(historyRequest('acebozem', [2021, 2020], AIR, ELEMENTS, '2026-10-02', '2020-10-30')?.query).toMatchObject({ start: '2020-10-30', end: '2021-12-31' })
    expect(historyRequest('acebozem', [2026, 2025], AIR, ELEMENTS, '2026-10-02', '2025-06-01')?.query).toMatchObject({ start: '2025-06-01', end: '2026-10-02' })
  })
})

describe('historyModel', () => {
  it('overlays the loaded years by day of year', () => {
    const m = historyModel(AIR, [daily(2026, 3, 'Air Temperature [°F]', (i) => 30 + i), daily(2025, 2, 'Air Temperature [°F]', () => 20)], 2026)!
    expect(m.traces.map((t) => t.year)).toEqual([2025, 2026])
    expect(m.traces[1]).toMatchObject({ doy: [1, 2, 3], values: [30, 31, 32] })
    expect(m).toMatchObject({ currentYear: 2026, yLabel: 'Air temperature (°F)', column: 'Air Temperature [°F]' })
  })
  it('summed variables accumulate within each year', () => {
    const m = historyModel(PPT, [daily(2026, 3, 'Precipitation [in]', (i) => (i === 1 ? null : 0.5))], 2026)!
    expect(m.traces[0].values).toEqual([0.5, 0.5, 1])
    expect(m.yLabel).toBe('Cumulative rain (in)')
  })
  it('null until a year has a value', () => {
    expect(historyModel(AIR, [], 2026)).toBeNull()
    expect(historyModel(AIR, [daily(2026, 2, 'Air Temperature [°F]', () => null)], 2026)).toBeNull()
  })
})

describe('historyRows', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (status: number, body: string) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
  const year = (y: number) => historyRequest('acebozem', [y], AIR, ELEMENTS, '2026-10-02', '2020-10-30')!.query

  it("the API's 404 for a year without data is an empty year", async () => {
    stub(404, '{"detail":"No data available for the specified time period."}')
    await expect(historyRows(() => getStationRecord(year(2020)))).resolves.toEqual([])
  })
  it('a year with data parses its rows', async () => {
    stub(200, 'station,datetime,Air Temperature @ 2 m [°F],provisional\nacebozem,2021-09-03 00:00:00-06:00,62.051,False\n')
    const rows = await historyRows(() => getStationRecord(year(2021)))
    expect(rows).toHaveLength(1)
    expect(Object.values(rows[0])).toContain(62.051)
  })
  it('other failures still fail (the cache retries or shows the error)', async () => {
    stub(503, 'busy')
    await expect(historyRows(() => getStationRecord(year(2025)))).rejects.toMatchObject({ status: 503 })
    await expect(historyRows(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow('Failed to fetch')
  })
})

describe('historyNote', () => {
  it('says how each year is drawn: dots for wind direction, a running total for a sum, else a line', () => {
    expect(historyNote({ name: 'Wind Direction', sum: false })).toBe('Daily values, each year as its own set of dots.')
    expect(historyNote({ name: 'Precipitation', sum: true })).toBe('Daily values, one line per year, as a running total within each year.')
    expect(historyNote({ name: 'Air Temperature', sum: false })).toBe('Daily values, one line per year.')
    expect(historyNote(undefined)).toBe('Daily values, one line per year.')
  })
})
