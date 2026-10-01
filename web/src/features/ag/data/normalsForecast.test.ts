import { describe, expect, it } from 'vitest'
import { buildDailyNormals } from './normals'
import { durationMs, fetchForecastDaily, parseGridpointDaily, type GridpointDoc } from './forecast'
import { parseCsvRaw } from './parse'

const HEADER = 'month,day,mean,std_dev,median,min,max,q25,q75,type,variable,station'

describe('buildDailyNormals', () => {
  it('maps tmmn/tmmx quantiles to °C and pr/pet medians to mm', () => {
    const n = buildDailyNormals('acebozem', {
      tmmn: parseCsvRaw(`${HEADER}\n1,1,12.1,11.4,12.83,-10.39,32.09,3.74,19.67,daily,tmmn,acebozem\n1,NA,15,9,16.79,-27,38,9.59,22.73,monthly,tmmn,acebozem`),
      tmmx: parseCsvRaw(`${HEADER}\n1,1,30,9,32,0,50,23,41,daily,tmmx,acebozem`),
      pr: parseCsvRaw(`${HEADER}\n1,1,0.0362,0.06,0.0157,0,0.2,0,0.03,daily,pr,acebozem`),
      pet: [],
    })
    expect(Object.keys(n.byMonthDay)).toEqual(['01-01'])
    const d = n.byMonthDay['01-01']
    expect(d.tminC.median).toBeCloseTo(((12.83 - 32) * 5) / 9, 9)
    expect(d.tminC.q25).toBeCloseTo(((3.74 - 32) * 5) / 9, 9)
    expect(d.tmaxC.q75).toBeCloseTo(5, 9)
    expect(d.prMm).toBeCloseTo(0.0157 * 25.4, 9)
    expect(d.petMm).toBeNull()
  })
})

describe('NWS gridpoint → ForecastDaily', () => {
  // Trimmed from api.weather.gov/gridpoints/TFX/93,63 on 2026-10-01.
  const doc: GridpointDoc = {
    properties: {
      updateTime: '2026-10-01T16:26:56+00:00',
      maxTemperature: {
        uom: 'wmoUnit:degC',
        values: [
          { validTime: '2026-10-01T14:00:00+00:00/PT13H', value: 19.444 },
          { validTime: '2026-10-02T14:00:00+00:00/PT13H', value: 23.889 },
          { validTime: '2026-10-03T14:00:00+00:00/PT13H', value: 21.667 },
        ],
      },
      minTemperature: {
        uom: 'wmoUnit:degC',
        values: [
          { validTime: '2026-10-01T10:00:00+00:00/PT6H', value: 7.222 },
          { validTime: '2026-10-02T02:00:00+00:00/PT14H', value: 3.889 },
          { validTime: '2026-10-03T02:00:00+00:00/PT14H', value: null },
        ],
      },
    },
  }

  it('assigns values to the Denver date of the interval midpoint', () => {
    const f = parseGridpointDaily(doc, Date.parse('2026-10-01T18:00:00Z'))
    expect(f.date).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(f.tmaxC).toEqual([19.444, 23.889, 21.667])
    expect(f.tminC).toEqual([7.222, 3.889, null])
    expect(f.issued).toBe('2026-10-01T16:26:56+00:00')
  })

  it('drops past days and caps at 7', () => {
    const f = parseGridpointDaily(doc, Date.parse('2026-10-03T18:00:00Z'))
    expect(f.date).toEqual(['2026-10-03'])
    const many: GridpointDoc = {
      properties: {
        maxTemperature: {
          uom: 'wmoUnit:degF',
          values: Array.from({ length: 10 }, (_, i) => ({
            validTime: `2026-10-${String(i + 1).padStart(2, '0')}T14:00:00+00:00/PT13H`,
            value: 50,
          })),
        },
      },
    }
    const g = parseGridpointDaily(many, Date.parse('2026-10-01T18:00:00Z'))
    expect(g.date).toHaveLength(7)
    expect(g.tmaxC[0]).toBeCloseTo(10, 9) // °F → °C
  })

  it('parses durations', () => {
    expect(durationMs('PT14H')).toBe(14 * 3_600_000)
    expect(durationMs('P1DT6H')).toBe(30 * 3_600_000)
    expect(durationMs('PT30M')).toBe(30 * 60_000)
  })

  it('degrades instead of throwing on NWS errors', async () => {
    const f = (async () => new Response('busy', { status: 503 })) as unknown as typeof fetch
    const r = await fetchForecastDaily(45.66, -111.07, { fetchImpl: f })
    expect(r).toMatchObject({ status: 'degraded', httpStatus: 503 })
    const g = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect((await fetchForecastDaily(45.66, -111.07, { fetchImpl: g })).status).toBe('degraded')
  })

  it('requests trimmed /points coordinates then forecastGridData', async () => {
    const seen: string[] = []
    const f = (async (u: RequestInfo | URL) => {
      seen.push(String(u))
      if (String(u).includes('/points/')) {
        return Response.json({ properties: { forecastGridData: 'https://api.weather.gov/gridpoints/TFX/93,63' } })
      }
      return Response.json(doc)
    }) as typeof fetch
    const r = await fetchForecastDaily(45.66, -111.07, {
      fetchImpl: f,
      now: Date.parse('2026-10-01T18:00:00Z'),
    })
    expect(seen).toEqual([
      'https://api.weather.gov/points/45.66,-111.07',
      'https://api.weather.gov/gridpoints/TFX/93,63',
    ])
    expect(r.status).toBe('ok')
  })
})
