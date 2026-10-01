/**
 * GDD crop stage tables → contract `GddStageTable` per crop.
 *
 * Source order: data2 `derived/gdd_stages.json` (planned; same schema as the
 * vendored file, so publishing `public/data/gdd_stages.json` there is all it
 * takes), then `public/data/gdd_stages.json`. Thresholds are °F·day as
 * published. Corn has no table and is always an explicit empty list.
 */
import type { GddCrop, GddStage, GddStageTable } from '../contract'
import {
  DATA2_GDD_STAGES,
  DATA2_TIMEOUT_MS,
  type StaticDeps,
  type StaticSource,
  data2Enabled,
  getJson,
  vendoredBase,
} from './staticSource'

export const GDD_CROPS: readonly GddCrop[] = [
  'wheat',
  'barley',
  'canola',
  'corn',
  'sugarbeet',
  'sunflower',
  'hemp',
]

/** Shape of `gdd_stages.json`. */
export interface GddStagesJson {
  units: 'degF_day'
  /** Optional release tag (data2 publishes may set it). */
  release?: string
  crops: Partial<Record<GddCrop, GddStage[]>>
}

export interface GddStagesBundle {
  source: StaticSource
  release: string
  tables: Record<GddCrop, GddStageTable>
}

const isStage = (s: unknown): s is GddStage => {
  const o = s as Record<string, unknown>
  return (
    !!o &&
    typeof o.stage === 'number' &&
    typeof o.gdd === 'number' &&
    Number.isFinite(o.gdd) &&
    (o.name === null || typeof o.name === 'string') &&
    (o.description === null || typeof o.description === 'string')
  )
}

/** Validate + normalise; throws on a malformed document. */
export function parseGddStagesJson(
  j: GddStagesJson,
  source: StaticSource,
  fallbackRelease = 'unversioned',
): GddStagesBundle {
  if (!j || j.units !== 'degF_day' || typeof j.crops !== 'object') {
    throw new Error('gdd_stages.json: unexpected shape')
  }
  const tables = {} as Record<GddCrop, GddStageTable>
  for (const crop of GDD_CROPS) {
    const raw = j.crops[crop] ?? []
    if (!Array.isArray(raw) || !raw.every(isStage)) {
      throw new Error(`gdd_stages.json: bad stages for ${crop}`)
    }
    const stages = [...raw]
      .map((s) => ({ ...s, code: s.code ?? String(s.stage) }))
      .sort((a, b) => a.gdd - b.gdd)
    tables[crop] = { crop, stages }
  }
  // Corn: no published table, regardless of what a file says.
  tables.corn = { crop: 'corn', stages: [] }
  return { source, release: j.release ?? fallbackRelease, tables }
}

export async function loadVendoredGddStages(deps?: StaticDeps): Promise<GddStagesBundle> {
  const j = await getJson<GddStagesJson>(`${vendoredBase(deps)}gdd_stages.json`, deps)
  return parseGddStagesJson(j, 'vendored', 'mesonet-db-rds@vendored')
}

export async function loadData2GddStages(deps?: StaticDeps): Promise<GddStagesBundle> {
  const j = await getJson<GddStagesJson>(
    DATA2_GDD_STAGES,
    deps,
    deps?.timeoutMs ?? DATA2_TIMEOUT_MS,
  )
  return parseGddStagesJson(j, 'data2', 'data2')
}

/** data2 first (when `DATA2_STATIC_ENABLED`), vendored fallback. */
export async function loadGddStages(deps: StaticDeps = {}): Promise<GddStagesBundle> {
  if (deps.only === 'vendored') return loadVendoredGddStages(deps)
  if (deps.only === 'data2') return loadData2GddStages(deps)
  if (!data2Enabled(deps)) return loadVendoredGddStages(deps)
  try {
    return await loadData2GddStages(deps)
  } catch {
    return loadVendoredGddStages(deps)
  }
}
