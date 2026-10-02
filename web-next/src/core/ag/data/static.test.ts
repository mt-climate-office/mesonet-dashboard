import { describe, expect, it } from 'vitest'
import soilJsonText from '../../../../public/data/soil_params.json?raw'
import stagesJsonText from '../../../../public/data/gdd_stages.json?raw'
import manifestText from '../../../../public/data/MANIFEST.json?raw'
import bozSoilRaw from '../__fixtures__/acebozem.soil-raw.csv?raw'
import { GDD_CROPS, loadGddStages, parseGddStagesJson, type GddStagesJson } from './gddStages'
import {
  fromCompatCsv,
  fromVendoredJson,
  loadSoilParams,
  soilParamsFor,
  type VendoredSoilJson,
} from './soilParams'
import { parseCsvRaw } from './parse'
import { DATA2_BASE, DATA2_STATIC_ENABLED } from './staticSource'

const soilJson = JSON.parse(soilJsonText) as VendoredSoilJson
const stagesJson = JSON.parse(stagesJsonText) as GddStagesJson

/** Minimal fetch stub: url → [status, contentType, body]. */
function stubFetch(routes: Record<string, [number, string, string]>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const hit = routes[url]
    if (!hit) return new Response('<Error>NoSuchKey</Error>', { status: 404, headers: { 'content-type': 'application/xml' } })
    const [status, type, body] = hit
    return new Response(body, { status, headers: { 'content-type': type } })
  }) as typeof fetch
}

const VENDORED = 'http://local/data/'
const vendoredRoutes: Record<string, [number, string, string]> = {
  [`${VENDORED}soil_params.json`]: [200, 'application/json', soilJsonText],
  [`${VENDORED}gdd_stages.json`]: [200, 'application/json', stagesJsonText],
}

describe('vendored soil params', () => {
  const rows = fromVendoredJson(soilJson)
  it('has one row per station/depth with FX params and lab range', () => {
    expect(soilJson.release).toBe('2026-09-25')
    expect(rows.length).toBe(507)
    const keys = new Set(rows.map((r) => `${r.station}|${r.depthCm}`))
    expect(keys.size).toBe(rows.length)
    for (const r of rows) {
      expect(r.depthCm).toBeGreaterThan(0)
      expect([5, 10, 20, 50, 70, 71, 91, 100]) // 71: nctbirne.toContain(r.depthCm)
      expect(r.source).toBe('vendored')
    }
    // All published rows carry a converged FX fit.
    expect(rows.every((r) => r.model === 'FX' && r.fx)).toBe(true)
  })

  it('acebozem lab VWC range matches the API /derived/swp retention points', () => {
    const api = new Map<number, number[]>()
    for (const r of parseCsvRaw(bozSoilRaw)) {
      const d = Number(r['Depth [cm]'])
      api.set(d, [...(api.get(d) ?? []), Number(r.VWC) * 100])
    }
    const boz = soilParamsFor({ source: 'vendored', release: soilJson.release, rows }, 'acebozem')
    expect(boz.map((r) => r.depthCm)).toEqual([5, 10, 20, 50, 100])
    for (const r of boz) {
      const v = api.get(r.depthCm)!
      expect(r.labVwcMin).toBeCloseTo(Math.min(...v), 9)
      expect(r.labVwcMax).toBeCloseTo(Math.max(...v), 9)
    }
  })

  it('fromCompatCsv applies the same transform', () => {
    const rows = fromCompatCsv(
      {
        parameters: [
          'station,depth,model,params',
          'x,-1000,FX,"[{""r"":0,""s"":0.5,""n"":0.7,""m"":0.8,""h"":3.6}]"',
          'x,-1000,VG,"[{""r"":0.04,""s"":0.53,""a"":0.53,""n"":1.2}]"',
          'x,-50,FX,"[{""r"":0,""s"":0.6,""n"":0.5,""m"":0.9,""h"":2.3}]"',
        ].join('\n'),
        porosity: 'station,depth,porosity\nx,-1000,51.2\nx,-50,56.5',
        rawData: 'station,depth,kpa,vwc\nx,-1000,0.2,0.51\nx,-1000,1500,0.05\ny,-1000,1,0.3',
      },
      'r1',
      'data2',
    )
    expect(rows).toEqual([
      {
        station: 'x',
        depthCm: 5,
        model: 'FX',
        source: 'data2',
        release: 'r1',
        fx: { r: 0, s: 0.6, n: 0.5, m: 0.9, h: 2.3 },
        porosityPct: 56.5,
      },
      {
        station: 'x',
        depthCm: 100,
        model: 'FX',
        source: 'data2',
        release: 'r1',
        fx: { r: 0, s: 0.5, n: 0.7, m: 0.8, h: 3.6 },
        vg: { r: 0.04, s: 0.53, a: 0.53, n: 1.2 },
        porosityPct: 51.2,
        labVwcMin: 5,
        labVwcMax: 51,
      },
    ])
  })
})

describe('loadSoilParams source selection', () => {
  it('falls back to vendored when data2 is missing (404 / SPA HTML 200)', async () => {
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({
        ...vendoredRoutes,
        'https://data2.climate.umt.edu/mesonet/soils/processed/latest/manifest.json': [
          200,
          'text/html',
          '<!DOCTYPE html><html></html>',
        ],
      }),
    })
    expect(b.source).toBe('vendored')
    expect(b.release).toBe('2026-09-25')
  })

  it('uses vendored when data2 advertises the same release', async () => {
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({
        ...vendoredRoutes,
        'https://data2.climate.umt.edu/mesonet/soils/processed/latest/manifest.json': [
          200,
          'application/json',
          '{"release_id":"2026-09-25"}',
        ],
      }),
    })
    expect(b.source).toBe('vendored')
    expect(b.data2Release).toBe('2026-09-25')
  })

  it('uses data2 when it has a newer release', async () => {
    const base = 'https://data2.climate.umt.edu/mesonet/soils/processed/latest/'
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({
        ...vendoredRoutes,
        [`${base}manifest.json`]: [200, 'application/json', '{"release_id":"2027-01-01"}'],
        [`${base}compat/soil_parameters.csv`]: [
          200,
          'text/csv',
          'station,depth,model,params\nz,-200,FX,"[{""r"":0,""s"":0.5,""n"":1,""m"":1,""h"":1}]"',
        ],
        [`${base}compat/soil_porosity.csv`]: [200, 'text/csv', 'station,depth,porosity\nz,-200,50'],
        [`${base}compat/soil_raw_data.csv`]: [200, 'text/csv', 'station,depth,kpa,vwc\nz,-200,1,0.4'],
      }),
    })
    expect(b.source).toBe('data2')
    expect(b.release).toBe('2027-01-01')
    expect(b.rows).toHaveLength(1)
    expect(b.rows[0]).toMatchObject({ station: 'z', depthCm: 20, source: 'data2', labVwcMax: 40 })
  })
})

describe('DATA2_STATIC_ENABLED gate', () => {
  it('is off until data2 publishes; the default loaders then never fetch data2', async () => {
    expect(DATA2_STATIC_ENABLED).toBe(false)
    const seen: string[] = []
    const f = stubFetch(vendoredRoutes)
    const spy: typeof fetch = (input, init) => {
      seen.push(String(input))
      return f(input, init)
    }
    const soil = await loadSoilParams({ vendoredBase: VENDORED, fetchImpl: spy })
    const stages = await loadGddStages({ vendoredBase: VENDORED, fetchImpl: spy })
    expect(soil.source).toBe('vendored')
    expect(stages.source).toBe('vendored')
    expect(seen.some((u) => u.startsWith(DATA2_BASE))).toBe(false)
  })
})

describe('GDD stage tables', () => {
  const b = parseGddStagesJson(stagesJson, 'vendored')
  it('covers every crop; corn is an explicit empty table', () => {
    for (const c of GDD_CROPS) expect(b.tables[c].crop).toBe(c)
    expect(b.tables.corn.stages).toEqual([])
  })
  it('wheat/barley stages are Haun numbers; others ordinal with published code', () => {
    const w = b.tables.wheat.stages
    expect(w[0]).toMatchObject({ stage: 0.5, gdd: 180, name: 'Emergence Date' })
    expect(w.map((s) => s.stage)).toContain(2)
    expect(b.tables.barley.stages[0]).toMatchObject({ stage: 0.5, gdd: 176 })
    const canola = b.tables.canola.stages
    expect(canola[0]).toMatchObject({ stage: 1, code: 'Planting', gdd: 0, name: null })
    expect(b.tables.sugarbeet.stages[0]).toMatchObject({ code: 'V1 (Emergence)', gdd: 237 })
    expect(b.tables.hemp.stages.map((s) => s.gdd)).toEqual([
      600, 825, 1050, 1250, 1350, 1425, 1475, 1550, 1650,
    ])
    expect(b.tables.hemp.stages[0]).toMatchObject({ stage: 1, name: 'Initial Growth' })
  })
  it('drops NA thresholds and sorts by gdd', () => {
    for (const c of GDD_CROPS) {
      const g = b.tables[c].stages.map((s) => s.gdd)
      expect(g.every(Number.isFinite)).toBe(true)
      expect([...g].sort((x, y) => x - y)).toEqual(g)
    }
  })
  it('loader falls back to vendored when data2 404s', async () => {
    const r = await loadGddStages({ vendoredBase: VENDORED, data2Enabled: true, fetchImpl: stubFetch(vendoredRoutes) })
    expect(r.source).toBe('vendored')
    expect(r.release).toMatch(/^mesonet-db-rds@/)
  })
  it('loader prefers data2 when present', async () => {
    const r = await loadGddStages({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({
        ...vendoredRoutes,
        'https://data2.climate.umt.edu/mesonet/derived/gdd_stages.json': [
          200,
          'application/json',
          JSON.stringify({ ...stagesJson, release: '2026-11-01' }),
        ],
      }),
    })
    expect(r.source).toBe('data2')
    expect(r.release).toBe('2026-11-01')
  })
  it('rejects a malformed document', () => {
    expect(() => parseGddStagesJson({ units: 'degF_day', crops: { wheat: [{ stage: 'x' }] } } as never, 'data2')).toThrow()
  })
})

describe('MANIFEST.json', () => {
  it('records provenance for every vendored file', () => {
    const m = JSON.parse(manifestText)
    for (const f of ['soil_params.json', 'gdd_stages.json']) {
      expect(m.files[f].source_repo).toMatch(/^mt-climate-office\//)
      expect(m.files[f].source_commit).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
