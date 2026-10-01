import { describe, expect, it } from 'vitest'
import { buildQuery, META_COLUMNS, parseCsv } from './csv'
import { LAB_SWAP } from './params'

describe('buildQuery', () => {
  it('returns an empty string when nothing is set', () => {
    expect(buildQuery({})).toBe('')
    expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('')
  })

  it('keeps commas unencoded and joins arrays', () => {
    expect(buildQuery({ elements: 'air_temp,ppt', stations: ['a', 'b'] })).toBe(
      '?elements=air_temp,ppt&stations=a,b',
    )
  })

  it('stringifies numbers/booleans and encodes other reserved characters', () => {
    expect(buildQuery({ level: 1, rm_na: false, q: 'a b&c' })).toBe(
      '?level=1&rm_na=false&q=a%20b%26c',
    )
  })
})

describe('parseCsv', () => {
  it('applies LAB_SWAP to headers and types values', () => {
    const csv = [
      'station,datetime,Air Temperature @ 2 m [°F],Soil VWC @ -10 cm [%],provisional',
      'acebozem,2026-06-01T00:00:00-06:00,61.5,22.1,true',
      '',
      'acebozem,2026-06-01T01:00:00-06:00,,23,false',
    ].join('\n')
    const rows = parseCsv<Record<string, unknown>>(csv)
    expect(rows).toHaveLength(2)
    expect(Object.keys(rows[0])).toEqual([
      'station',
      'datetime',
      'Air Temperature [°F]',
      'Soil VWC @ 4 in [%]',
      'provisional',
    ])
    expect(rows[0]['Air Temperature [°F]']).toBe(61.5)
    expect(rows[0].provisional).toBe(true)
    expect(rows[1]['Air Temperature [°F]']).toBeNull()
  })

  it('turns the API\'s Python-style True/False into booleans (/stations row)', () => {
    const csv = [
      'station,name,date_installed,sub_network,longitude,latitude,elevation,county,mesowest_id,gwic_id,nwsli_id,has_swp,funded',
      'aceabsar,Absarokee,2021-06-02,HydroMet,-109.61,45.56,1400.4,Stillwater,,,KEEM8,True,False',
    ].join('\n')
    const [row] = parseCsv<Record<string, unknown>>(csv)
    expect(row.has_swp).toBe(true)
    expect(row.funded).toBe(false)
    expect(row.nwsli_id).toBe('KEEM8')
    expect(row.mesowest_id).toBeNull()
  })

  it('types provisional / has_na flag columns from True/False', () => {
    const csv = [
      'station,datetime,Precipitation [in],has_na,obs_count,provisional',
      'acebozem,2026-08-28 00:00:00-06:00,0.0,False,288,True',
      'acebozem,2026-08-29 00:00:00-06:00,0.369,True,280,False',
    ].join('\n')
    const rows = parseCsv<Record<string, unknown>>(csv, { labSwap: false })
    expect(rows.map((r) => r.provisional)).toEqual([true, false])
    expect(rows.map((r) => r.has_na)).toEqual([false, true])
    // datetimes stay verbatim strings
    expect(rows[0].datetime).toBe('2026-08-28 00:00:00-06:00')
  })

  it('only converts exact matches', () => {
    const [row] = parseCsv<Record<string, unknown>>('a,b,c\nTrue story,FALSE,tRuE')
    expect(row.a).toBe('True story')
    expect(row.b).toBe(false)
    expect(row.c).toBe('tRuE')
  })

  it('passes unknown headers through', () => {
    const rows = parseCsv<Record<string, unknown>>('foo,bar\n1,x')
    expect(rows).toEqual([{ foo: 1, bar: 'x' }])
  })
})

describe('LAB_SWAP', () => {
  it('collapses sensor heights onto canonical columns', () => {
    expect(LAB_SWAP['Air Temperature @ 8 ft [°F]']).toBe('Air Temperature [°F]')
    expect(LAB_SWAP['Wind Speed @ 10 m [mi/h]']).toBe('Wind Speed [mi/hr]')
    expect(LAB_SWAP.index).toBe('datetime')
  })

  it('maps every cm soil depth to inches', () => {
    const cmToIn: Record<string, string> = {
      '-5': '2',
      '-10': '4',
      '-20': '8',
      '-50': '20',
      '-70': '28',
      '-91': '36',
      '-100': '40',
    }
    for (const [k, v] of Object.entries(LAB_SWAP)) {
      const m = k.match(/@ (-\d+) cm/)
      if (!m) continue
      expect(v).toContain(`@ ${cmToIn[m[1]]} in`)
    }
  })
})

describe('META_COLUMNS', () => {
  it('lists bookkeeping columns', () => {
    for (const c of ['station', 'datetime', 'provisional', 'has_na', 'obs_count']) {
      expect(META_COLUMNS.has(c)).toBe(true)
    }
  })
})
