/**
 * Soil hydraulic parameters (mesonet-soils `compat/` release) → contract
 * `SoilParams`, one row per (station, depth) with FX + VG fits, porosity and
 * the lab VWC range used to clip VWC before the FX inversion.
 *
 * Source order:
 *  1. data2 `soils/processed/latest/manifest.json` → `release_id`. If that
 *     release is newer than the vendored one, read the three compat CSVs from
 *     data2 (source `'data2'`). If it is the same release, the vendored JSON is
 *     byte-for-byte the same data, so it is used without re-downloading the
 *     2.3 MB `soil_raw_data.csv` (source `'vendored'`).
 *  2. Otherwise / on any failure or timeout: `public/data/soil_params.json`.
 *
 * Step 1 is skipped while `DATA2_STATIC_ENABLED` is false (staticSource.ts).
 */
import type { FxParams, SoilParams, VgParams } from '../contract'
import { parseCsvRaw, toNum } from './parse'
import {
  DATA2_SOILS_LATEST,
  DATA2_TIMEOUT_MS,
  type StaticDeps,
  type StaticSource,
  data2Enabled,
  getJson,
  getText,
  vendoredBase,
} from './staticSource'

export interface SoilParamsBundle {
  source: StaticSource
  release: string
  /** Release advertised by data2, when reachable (diagnostics). */
  data2Release?: string
  rows: SoilParams[]
}

/** Shape of `public/data/soil_params.json` (written by vendor-static.mjs). */
export interface VendoredSoilJson {
  release: string
  fxKeys: string[]
  vgKeys: string[]
  columns: string[]
  rows: [
    string,
    number,
    number[] | null,
    number[] | null,
    number | null,
    number | null,
    number | null,
  ][]
}

const obj = (keys: string[], vals: number[]) =>
  Object.fromEntries(keys.map((k, i) => [k, vals[i]]))

/** Vendored compact JSON → SoilParams[]. */
export function fromVendoredJson(j: VendoredSoilJson, source: StaticSource = 'vendored'): SoilParams[] {
  if (!j || !Array.isArray(j.rows) || typeof j.release !== 'string') {
    throw new Error('soil_params.json: unexpected shape')
  }
  return j.rows.map(([station, depthCm, fx, vg, por, min, max]) => {
    const p: SoilParams = {
      station,
      depthCm,
      model: fx ? 'FX' : 'VG',
      source,
      release: j.release,
    }
    if (fx) p.fx = obj(j.fxKeys, fx) as unknown as FxParams
    if (vg) p.vg = obj(j.vgKeys, vg) as unknown as VgParams
    if (por !== null) p.porosityPct = por
    if (min !== null) p.labVwcMin = min
    if (max !== null) p.labVwcMax = max
    return p
  })
}

const tidy = (x: number) => Number(x.toPrecision(12))

/**
 * The three mesonet-soils compat CSVs → SoilParams[]. Same transform as
 * `vendor-static.mjs` (depth = −10 × cm; params[0]; lab range = vwc × 100).
 */
export function fromCompatCsv(
  csv: { parameters: string; porosity: string; rawData: string },
  release: string,
  source: StaticSource,
): SoilParams[] {
  const byKey = new Map<string, SoilParams>()
  const key = (s: string, d: string) => `${s}|${Number(d)}`
  const get = (station: string, depth: string) => {
    const k = key(station, depth)
    let p = byKey.get(k)
    if (!p) {
      p = { station, depthCm: Math.round(-Number(depth) / 10), model: 'FX', source, release }
      byKey.set(k, p)
    }
    return p
  }
  for (const r of parseCsvRaw(csv.parameters)) {
    const params = (JSON.parse(r.params) as Record<string, number>[])[0]
    const p = get(r.station, r.depth)
    if (r.model === 'FX') {
      p.fx = { r: params.r, s: params.s, n: params.n, m: params.m, h: params.h }
    } else if (r.model === 'VG') {
      p.vg = { r: params.r, s: params.s, a: params.a, n: params.n }
    }
  }
  for (const r of parseCsvRaw(csv.porosity)) {
    const v = toNum(r.porosity)
    if (v !== null) get(r.station, r.depth).porosityPct = v
  }
  for (const r of parseCsvRaw(csv.rawData)) {
    const p = byKey.get(key(r.station, r.depth))
    const v = toNum(r.vwc)
    if (!p || v === null) continue
    const pct = v * 100
    p.labVwcMin = p.labVwcMin === undefined ? pct : Math.min(p.labVwcMin, pct)
    p.labVwcMax = p.labVwcMax === undefined ? pct : Math.max(p.labVwcMax, pct)
  }
  const rows = [...byKey.values()]
  for (const p of rows) {
    if (!p.fx) p.model = 'VG'
    if (p.labVwcMin !== undefined) p.labVwcMin = tidy(p.labVwcMin)
    if (p.labVwcMax !== undefined) p.labVwcMax = tidy(p.labVwcMax)
  }
  return rows.sort((a, b) => a.station.localeCompare(b.station) || a.depthCm - b.depthCm)
}

export async function loadVendoredSoilParams(deps?: StaticDeps): Promise<SoilParamsBundle> {
  const j = await getJson<VendoredSoilJson>(`${vendoredBase(deps)}soil_params.json`, deps)
  return { source: 'vendored', release: j.release, rows: fromVendoredJson(j) }
}

interface SoilsManifest {
  release_id?: string
}

export async function loadData2SoilParams(
  deps?: StaticDeps,
  /** Skip the download when data2's release is not newer than this. */
  ifNewerThan?: string,
): Promise<SoilParamsBundle | { notNewer: string }> {
  const ms = deps?.timeoutMs ?? DATA2_TIMEOUT_MS
  const manifest = await getJson<SoilsManifest>(`${DATA2_SOILS_LATEST}manifest.json`, deps, ms)
  const release = manifest.release_id
  if (typeof release !== 'string' || !release) throw new Error('data2 soils manifest: no release_id')
  if (ifNewerThan && release <= ifNewerThan) return { notNewer: release }
  const base = `${DATA2_SOILS_LATEST}compat/`
  // The raw retention points are ~2.3 MB; allow a longer timeout for them.
  const [parameters, porosity, rawData] = await Promise.all([
    getText(`${base}soil_parameters.csv`, deps, ms),
    getText(`${base}soil_porosity.csv`, deps, ms),
    getText(`${base}soil_raw_data.csv`, deps, ms * 6),
  ])
  return {
    source: 'data2',
    release,
    data2Release: release,
    rows: fromCompatCsv({ parameters, porosity, rawData }, release, 'data2'),
  }
}

/** data2 first (when `DATA2_STATIC_ENABLED`), vendored fallback. Never throws unless both fail. */
export async function loadSoilParams(deps: StaticDeps = {}): Promise<SoilParamsBundle> {
  if (deps.only === 'vendored') return loadVendoredSoilParams(deps)
  if (deps.only === 'data2') {
    const r = await loadData2SoilParams(deps)
    if ('notNewer' in r) throw new Error('unreachable')
    return r
  }
  if (!data2Enabled(deps)) return loadVendoredSoilParams(deps)
  const vendored = loadVendoredSoilParams(deps)
  // Avoid an unhandled rejection if data2 wins and vendored fails.
  vendored.catch(() => undefined)
  let vendoredRelease: string | undefined
  try {
    vendoredRelease = (await vendored).release
  } catch {
    vendoredRelease = undefined
  }
  try {
    const r = await loadData2SoilParams(deps, vendoredRelease)
    if (!('notNewer' in r)) return r
    return { ...(await vendored), data2Release: r.notNewer }
  } catch (err) {
    if (vendoredRelease === undefined) throw err
    return vendored
  }
}

/** Rows for one station, shallow → deep. */
export function soilParamsFor(bundle: SoilParamsBundle, station: string): SoilParams[] {
  return bundle.rows.filter((r) => r.station === station).sort((a, b) => a.depthCm - b.depthCm)
}
