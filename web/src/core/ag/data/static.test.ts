import { describe, expect, it } from 'vitest'
import soilJsonText from '../../../../public/data/soil_params.json?raw'
import stagesJsonText from '../../../../public/data/gdd_stages.json?raw'
import manifestText from '../../../../public/data/MANIFEST.json?raw'
import bozSoilRaw from '../__fixtures__/acebozem.soil-raw.csv?raw'
import { GDD_CROPS, loadGddStages, parseGddStagesJson, type GddStagesJson } from './gddStages'
import {
  fromVendoredJson,
  loadSoilParams,
  soilParamsFor,
  type VendoredSoilJson,
} from './soilParams'
import { parseCsvRaw } from './parse'
import { swp } from '../compute'
import { SWP_CAP_BAR, swpBar } from '../view/labels'
import { DATA2_BASE, DATA2_GDD_ENABLED, DATA2_SOILS_ENABLED, DATA2_SOIL_PARAMS } from './staticSource'

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
    expect(soilJson.release).toBe('2026-10-04T17:21:00Z')
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
      // mesonet-soils rounds to 6 significant digits.
      expect(r.labVwcMin).toBeCloseTo(Math.min(...v), 4)
      expect(r.labVwcMax).toBeCloseTo(Math.max(...v), 4)
    }
  })
})

describe('shipped bundle vs. the #75 reference values', () => {
  // acebozem daily level-2 VWC on 2026-09-01 (mesonet2), and the SWP the
  // issue reports from mesonet-soils' parameters for that day.
  it('acebozem 2026-09-01: mid-range depths agree; 5 / 100 cm are dry-end clips, capped for display', () => {
    const params = soilParamsFor({ source: 'vendored', release: soilJson.release, rows: fromVendoredJson(soilJson) }, 'acebozem')
    const depthsCm = [5, 10, 20, 50, 100]
    const vwc = [5.274, 10.336, 12.044, 17.135, 3.282]
    const s = swp(
      { station: 'acebozem', level: 2, provisional: [false], depthsCm, time: ['2026-09-01'], epochMs: [0], vwcPct: vwc.map((v) => [v]), tempC: vwc.map(() => [null]) },
      params,
    )
    const bar = s.kPa.map((c) => c[0]! / 100)
    expect(bar[0]).toBeCloseTo(3945, -1)
    expect(bar[1]).toBeCloseTo(107, 0)
    expect(bar[2]).toBeCloseTo(61, 0)
    expect(bar[3]).toBeCloseTo(4.0, 1)
    expect(bar[4]).toBeCloseTo(12771, -1)
    expect(s.clipped.map((c) => c[0])).toEqual([true, false, false, false, true])
    expect(swpBar(s).bar.map((c) => c[0])).toEqual([SWP_CAP_BAR, bar[1], bar[2], bar[3], SWP_CAP_BAR])
  })
})

describe('loadSoilParams source selection', () => {
  const data2 = (release: string, rows: VendoredSoilJson['rows'] = soilJson.rows): [number, string, string] => [
    200,
    'application/json',
    JSON.stringify({ ...soilJson, release, rows }),
  ]

  it('reads data2 soils/soil_params.json', () => {
    expect(DATA2_SOIL_PARAMS).toBe('https://data2.climate.umt.edu/mesonet/soils/soil_params.json')
  })

  it('falls back to vendored when data2 is missing (404 / SPA HTML 200)', async () => {
    for (const hit of [undefined, [200, 'text/html', '<!DOCTYPE html><html></html>'] as [number, string, string]]) {
      const b = await loadSoilParams({
        vendoredBase: VENDORED,
        data2Enabled: true,
        fetchImpl: stubFetch(hit ? { ...vendoredRoutes, [DATA2_SOIL_PARAMS]: hit } : vendoredRoutes),
      })
      expect(b.source).toBe('vendored')
      expect(b.release).toBe(soilJson.release)
    }
  })

  it('uses vendored when data2 has the same release', async () => {
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({ ...vendoredRoutes, [DATA2_SOIL_PARAMS]: data2(soilJson.release) }),
    })
    expect(b.source).toBe('vendored')
    expect(b.data2Release).toBe(soilJson.release)
  })

  it('uses data2 when it has a newer release', async () => {
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({
        ...vendoredRoutes,
        [DATA2_SOIL_PARAMS]: data2('2027-01-01T00:00:00Z', [['z', 20, [0, 0.5, 1, 1, 1], null, 50, 10, 40]]),
      }),
    })
    expect(b.source).toBe('data2')
    expect(b.release).toBe('2027-01-01T00:00:00Z')
    expect(b.rows).toEqual([
      { station: 'z', depthCm: 20, model: 'FX', source: 'data2', release: '2027-01-01T00:00:00Z', fx: { r: 0, s: 0.5, n: 1, m: 1, h: 1 }, porosityPct: 50, labVwcMin: 10, labVwcMax: 40 },
    ])
  })

  it('uses data2 when the vendored copy is unreachable', async () => {
    const b = await loadSoilParams({
      vendoredBase: VENDORED,
      data2Enabled: true,
      fetchImpl: stubFetch({ [DATA2_SOIL_PARAMS]: data2(soilJson.release) }),
    })
    expect(b.source).toBe('data2')
  })
})

describe('data2 gates', () => {
  it('soils probe data2 by default; GDD stages stay vendored until data2 publishes them', async () => {
    expect(DATA2_SOILS_ENABLED).toBe(true)
    expect(DATA2_GDD_ENABLED).toBe(false)
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
    expect(seen.filter((u) => u.startsWith(DATA2_BASE))).toEqual([DATA2_SOIL_PARAMS])
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
