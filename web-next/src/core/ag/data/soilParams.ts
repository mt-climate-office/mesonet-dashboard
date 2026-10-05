/**
 * Soil hydraulic parameters (mesonet-soils `soil_params.json`) → contract
 * `SoilParams`, one row per (station, depth) with FX + VG fits, porosity and
 * the lab VWC range used to clip VWC before the FX inversion.
 *
 * Source order:
 *  1. data2 `soils/soil_params.json`, used if its `release` is newer than the
 *     vendored one (source `'data2'`). mesonet-soils bumps `release` only when
 *     the rows change, so an equal release is the same data (source
 *     `'vendored'`, with `data2Release` recorded).
 *  2. Otherwise / on any failure or timeout: `public/data/soil_params.json`.
 *
 * Both files share one shape (`VendoredSoilJson`). Step 1 is skipped while
 * `DATA2_SOILS_ENABLED` is false (staticSource.ts).
 */
import type { FxParams, SoilParams, VgParams } from '../contract'
import {
  DATA2_SOILS_ENABLED,
  DATA2_SOIL_PARAMS,
  DATA2_TIMEOUT_MS,
  type StaticDeps,
  type StaticSource,
  data2Enabled,
  getJson,
  vendoredBase,
} from './staticSource'

export interface SoilParamsBundle {
  source: StaticSource
  release: string
  /** Release advertised by data2, when reachable (diagnostics). */
  data2Release?: string
  rows: SoilParams[]
}

/** Shape of mesonet-soils `soil_params.json` (data2, and vendored by vendor-static.mjs). */
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

export async function loadVendoredSoilParams(deps?: StaticDeps): Promise<SoilParamsBundle> {
  const j = await getJson<VendoredSoilJson>(`${vendoredBase(deps)}soil_params.json`, deps)
  return { source: 'vendored', release: j.release, rows: fromVendoredJson(j) }
}

export async function loadData2SoilParams(deps?: StaticDeps): Promise<SoilParamsBundle> {
  const j = await getJson<VendoredSoilJson>(DATA2_SOIL_PARAMS, deps, deps?.timeoutMs ?? DATA2_TIMEOUT_MS)
  return { source: 'data2', release: j.release, data2Release: j.release, rows: fromVendoredJson(j, 'data2') }
}

/** data2 first (when `DATA2_SOILS_ENABLED`), vendored fallback. Never throws unless both fail. */
export async function loadSoilParams(deps: StaticDeps = {}): Promise<SoilParamsBundle> {
  if (deps.only === 'vendored') return loadVendoredSoilParams(deps)
  if (deps.only === 'data2') return loadData2SoilParams(deps)
  if (!data2Enabled(deps, DATA2_SOILS_ENABLED)) return loadVendoredSoilParams(deps)
  // Both files are ~85 KB: fetch in parallel, keep the newer release.
  const vendored = loadVendoredSoilParams(deps)
  // Avoid an unhandled rejection if data2 wins and vendored fails.
  vendored.catch(() => undefined)
  let data2: SoilParamsBundle
  try {
    data2 = await loadData2SoilParams(deps)
  } catch {
    return vendored
  }
  let v: SoilParamsBundle
  try {
    v = await vendored
  } catch {
    return data2
  }
  return data2.release > v.release ? data2 : { ...v, data2Release: data2.release }
}

/** Rows for one station, shallow → deep. */
export function soilParamsFor(bundle: SoilParamsBundle, station: string): SoilParams[] {
  return bundle.rows.filter((r) => r.station === station).sort((a, b) => a.depthCm - b.depthCm)
}
