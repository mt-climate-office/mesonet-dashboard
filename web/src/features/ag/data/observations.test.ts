import { describe, expect, it } from 'vitest'
import bozDaily from '../__fixtures__/acebozem.daily.season2025.obs-met.csv?raw'
import keoghDaily from '../__fixtures__/arskeogh.daily.season2025.obs-met.csv?raw'
import bozHourlyJan from '../__fixtures__/acebozem.hourly.jan2026.obs-met.csv?raw'
import bozSoilDaily from '../__fixtures__/acebozem.daily.season2025.obs-soil.csv?raw'
import keoghSoilHourly from '../__fixtures__/arskeogh.hourly.jan2026.obs-soil.csv?raw'
import bozElements from '../__fixtures__/acebozem.elements.csv?raw'
import keoghElements from '../__fixtures__/arskeogh.elements.csv?raw'
import stationsCsv from '../__fixtures__/stations.csv?raw'
import {
  dailyMetRequest,
  isNoData,
  parseDailyMet,
  parseHourlyMet,
  parseSoilSeries,
  parseStationMeta,
} from './observations'
import { parseCsvRaw, parseHeader } from './parse'
import { HttpError } from '../../../lib/api/http'
import type { Station, StationElement } from '../../../lib/api/types'

const meta = (station: string) => ({ station, level: 2 as const })
const close = (a: number | null, b: number, eps = 1e-9) => {
  expect(a).not.toBeNull()
  expect(Math.abs((a as number) - b)).toBeLessThan(eps)
}

describe('parseHeader', () => {
  it('splits aggregation, name, height and unit', () => {
    expect(parseHeader('Minimum Air Temperature @ 8 ft [°F]')).toEqual({
      agg: 'Minimum',
      name: 'Air Temperature',
      position: 8,
      positionUnit: 'ft',
      unit: '°F',
    })
    expect(parseHeader('Average Soil VWC @ -100 cm [%]')?.position).toBe(-100)
    expect(parseHeader('Average Relative Humidity [%]')).toMatchObject({
      agg: 'Average',
      name: 'Relative Humidity',
      position: null,
    })
    expect(parseHeader('provisional')).toBeNull()
  })
})

describe('dailyMetRequest', () => {
  it('reproduces the fixture query (explicit level, exclusive end)', () => {
    const r = dailyMetRequest({ station: 'acebozem', start: '2025-04-01', end: '2025-09-30' })
    expect(r.path).toBe('observations/daily/')
    expect(r.query).toEqual({
      stations: 'acebozem',
      start_time: '2025-04-01',
      end_time: '2025-10-01',
      level: 2,
      elements: 'air_temp,air_temp,air_temp,rh,rh,rh,sol_rad,wind_spd',
      agg_func: 'min,max,avg,min,max,avg,avg,avg',
    })
  })
})

describe('parseDailyMet', () => {
  it('converts the HydroMet 2 m / 10 m daily fixture to SI', () => {
    const d = parseDailyMet(parseCsvRaw(bozDaily), meta('acebozem'))
    expect(d.date.length).toBe(183) // 2025-04-01 … 2025-09-30, gap-filled
    expect(d.date[0]).toBe('2025-04-01')
    expect(d.date.at(-1)).toBe('2025-09-30')
    // First row: 35.337 / 24.746 / 31.422 °F, 6.859 mi/h
    close(d.tmaxC[0], ((35.337 - 32) * 5) / 9)
    close(d.tminC[0], ((24.746 - 32) * 5) / 9)
    close(d.tavgC[0], ((31.422 - 32) * 5) / 9)
    close(d.rhMax[0], 98.5)
    close(d.rhMin[0], 60.07)
    close(d.sradWm2[0], 138.481)
    close(d.windMs[0], 6.859 * 0.44704)
    expect(d.provisional.every((p) => p === false)).toBe(true)
    // Every array has the time axis length.
    for (const k of ['tminC', 'tmaxC', 'tavgC', 'rhMin', 'rhMax', 'rhAvg', 'sradWm2', 'windMs'] as const) {
      expect(d[k].length).toBe(d.date.length)
      expect(d[k].some((v) => Number.isNaN(v))).toBe(false)
    }
  })

  it('reads the AgriMet 8 ft labels', () => {
    const d = parseDailyMet(parseCsvRaw(keoghDaily), meta('arskeogh'))
    close(d.tmaxC[0], ((40.82 - 32) * 5) / 9)
    close(d.windMs[0], 6.731 * 0.44704)
  })

  it('fills gaps with nulls and keeps provisional flags', () => {
    const rows = parseCsvRaw(
      [
        'station,datetime,Minimum Air Temperature @ 2 m [°F],provisional',
        'x,2026-03-07 00:00:00-07:00,32,False',
        'x,2026-03-10 00:00:00-06:00,50,True',
      ].join('\n'),
    )
    const d = parseDailyMet(rows, meta('x'))
    expect(d.date).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
    expect(d.tminC).toEqual([0, null, null, 10])
    expect(d.provisional).toEqual([false, false, false, true])
    // Missing sensors → all-null columns, not errors.
    expect(d.windMs).toEqual([null, null, null, null])
  })

  it('returns an empty series for no rows', () => {
    const d = parseDailyMet([], meta('x'))
    expect(d.date).toEqual([])
    expect(d.tminC).toEqual([])
  })
})

describe('parseHourlyMet', () => {
  it('keeps hour-beginning local time + epochMs', () => {
    const h = parseHourlyMet(parseCsvRaw(bozHourlyJan), meta('acebozem'))
    expect(h.time[0]).toBe('2026-01-01T00:00')
    expect(h.epochMs[0]).toBe(Date.parse('2026-01-01T07:00:00Z'))
    close(h.tC[0], ((27.441 - 32) * 5) / 9)
    close(h.windMs[1], 6.494 * 0.44704)
    expect(h.time.length).toBe(h.epochMs.length)
    // Monotone hourly grid.
    for (let i = 1; i < h.epochMs.length; i++) {
      expect(h.epochMs[i] - h.epochMs[i - 1]).toBe(3_600_000)
    }
  })

  it('is DST-safe (spring-forward skips 02:00 local)', () => {
    const rows = parseCsvRaw(
      [
        'station,datetime,Average Air Temperature @ 2 m [°F],provisional',
        'x,2026-03-08 01:00:00-07:00,32,False',
        'x,2026-03-08 03:00:00-06:00,41,False',
      ].join('\n'),
    )
    const h = parseHourlyMet(rows, meta('x'))
    expect(h.time).toEqual(['2026-03-08T01:00', '2026-03-08T03:00'])
    expect(h.tC).toEqual([0, 5])
  })
})

describe('parseSoilSeries', () => {
  it('builds per-depth arrays (positive cm, shallow → deep)', () => {
    const s = parseSoilSeries(parseCsvRaw(bozSoilDaily), { ...meta('acebozem'), period: 'daily' })
    expect(s.depthsCm).toEqual([5, 10, 20, 50, 100])
    expect(s.time[0]).toBe('2025-04-01')
    close(s.vwcPct[0][0], 30.688)
    close(s.vwcPct[4][0], 20.541)
    close(s.tempC[0][0], ((38.014 - 32) * 5) / 9)
    expect(s.vwcPct.every((a) => a.length === s.time.length)).toBe(true)
  })

  it('handles AgriMet 91 cm hourly', () => {
    const s = parseSoilSeries(parseCsvRaw(keoghSoilHourly), {
      ...meta('arskeogh'),
      period: 'hourly',
    })
    expect(s.depthsCm).toEqual([10, 20, 50, 91])
    expect(s.time[0]).toBe('2026-01-01T00:00')
    close(s.vwcPct[3][0], 11.0)
  })
})

describe('parseStationMeta', () => {
  const stations = parseCsvRaw(stationsCsv) as unknown as Station[]
  const st = (id: string) => stations.find((s) => s.station === id)!
  it('HydroMet: 10 m wind from elements', () => {
    const m = parseStationMeta(st('acebozem'), parseCsvRaw(bozElements) as unknown as StationElement[])
    expect(m).toEqual({
      id: 'acebozem',
      lat: 45.66,
      lon: -111.07,
      elevationM: 1495.09,
      network: 'HydroMet',
      windHeightM: 10,
      hasSwp: true,
      installed: '2020-10-30',
    })
  })
  it('AgriMet: 2.44 m wind', () => {
    const m = parseStationMeta(st('arskeogh'), parseCsvRaw(keoghElements) as unknown as StationElement[])
    expect(m.network).toBe('AgriMet')
    expect(m.windHeightM).toBe(2.44)
  })
  it('falls back to network when elements lack a wind sensor', () => {
    expect(parseStationMeta(st('arskeogh'), []).windHeightM).toBe(2.44)
    expect(parseStationMeta(st('acebozem'), []).windHeightM).toBe(10)
  })
})

describe('isNoData', () => {
  const e = (status: number, body: string) => new HttpError(status, 'u', body)
  it('matches only the API no-data details', () => {
    expect(isNoData(e(404, '{"detail":"No data available for the specified time period."}'))).toBe(true)
    expect(isNoData(e(404, `{"detail":"Element 'sol_rad' not found in the data."}`))).toBe(true)
  })
  it('lets generic 404s and other statuses throw', () => {
    expect(isNoData(e(404, '{"detail":"Not Found"}'))).toBe(false)
    expect(isNoData(e(500, '{"detail":"No data available"}'))).toBe(false)
    expect(isNoData(new Error('No data available'))).toBe(false)
  })
})
