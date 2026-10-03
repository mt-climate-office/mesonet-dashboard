/**
 * The Charts section's fetches and its one timeseries model, shared by the
 * variable list, the variable page and Compare. Each fetch is one
 * `$store.data.cached` call (keys and TTLs from core/latest/requests); the
 * model is core/models/timeseries with the URL window as view and extent.
 */
import Alpine from 'alpinejs'
import { getStationElements, getStationRecord, type ObservationRow, type StationConfig, type StationElement } from '../../core/api'
import type { Resource } from '../../core/cache'
import type { LatestTimeseriesModel } from '../../core/charts'
import { TTL, axisExtent, elementsKey, endsToday, installDate, normalsKey, recordRequest, todayIso, windowRange, type RecordRequest } from '../../core/latest'
import { NORMALS_VARS, buildTimeseriesModel, type WindowPlan } from '../../core/models/timeseries'
import { fetchNormals, type StationNormals } from '../../core/normals'
import { explodeInstruments, type ConfigRow, type RawInstrument } from '../../core/sensorEvents'
import { loadErrorText } from '../../core/loadError'
import { stationVariables, type Variable } from '../../core/variables'
import type { LatestAgg } from '../../core/url-schema'
import { stationConfig } from '../station/resources'

const data = () => Alpine.store('data')
const raw = <T>(v: T): T => (v && typeof v === 'object' ? (Alpine.raw(v) as T) : v)

/** The station's `/elements/{id}/` resource, or null without a station. */
export function elementsResource(id: string | null): Resource<StationElement[]> | null {
  return id ? data().cached(elementsKey(id), () => getStationElements(id), { ttl: TTL.elements }) : null
}

/** Why Charts cannot list the station's variables: the station list or its element list failed ('' when neither did; core/loadError). */
export function variablesError(id: string | null): string {
  const catalog = Alpine.store('station').catalog
  if (!id && catalog?.status === 'error') return loadErrorText('The station list', catalog.error)
  const els = elementsResource(id)
  return els?.status === 'error' ? loadErrorText("This station's variables", els.error) : ''
}

/** The station's element list, or undefined while loading / without a station. */
export function stationElements(id: string | null): StationElement[] | undefined {
  return raw(elementsResource(id)?.data)
}

/** The station's Charts variables in list order (core/variables), or undefined while the elements load. */
export function chartVariables(id: string | null): Variable[] | undefined {
  const els = stationElements(id)
  return els ? stationVariables(els) : undefined
}

/**
 * One observation request (core/latest `recordRequest` shape) through the cache.
 * A window that reaches today is live (re-read on the freshness tick) unless
 * `live: false`; `slot` keeps its rows across the midnight key change.
 */
export function recordResource(req: RecordRequest | null, opts: { live?: boolean; slot?: string } = {}): Resource<ObservationRow[]> | null {
  return req ? data().cached(req.key, () => getStationRecord(req.query), { live: opts.live ?? endsToday(req), slot: opts.slot }) : null
}

/** The station's sensor-change config (hatched spans), or undefined while it loads. */
export function sensorConfig(id: string): ConfigRow[] | undefined {
  const cfg = raw(stationConfig(id).data) as StationConfig | undefined
  return cfg ? explodeInstruments(cfg.instruments as unknown as RawInstrument[]) : undefined
}

/** gridMET normals for the plotted variables that have them (daily + `gridmet` only). */
export function seriesNormals(id: string, vars: readonly string[], agg: LatestAgg, gridmet: boolean): Record<string, StationNormals | null> | undefined {
  if (!gridmet || agg !== 'daily') return undefined
  const out: Record<string, StationNormals | null> = {}
  for (const v of vars.filter((v) => (NORMALS_VARS as readonly string[]).includes(v))) {
    out[v] = raw(data().cached(normalsKey(id, v), () => fetchNormals(id, v), { ttl: TTL.normals }).data) ?? null
  }
  return out
}

export interface SeriesQuery {
  station: string
  window: WindowPlan
  agg: LatestAgg
  vars: readonly string[]
  gridmet: boolean
}

/** The request for a series query (null: nothing to ask for); `extremes`: its daily min/max instead (core/latest `recordRequest`). */
export function seriesRequest(q: SeriesQuery, extremes = false): RecordRequest | null {
  return recordRequest({ station: q.station, window: q.window, agg: q.agg, vars: q.vars, stationElements: stationElements(q.station), extremes })
}

/**
 * A memoized model builder for one chart. The returned function gives the
 * model for `q` (null on error, no rows or nothing to ask for); while the
 * same station/agg/vars loads a new window it keeps the last plot (no flash).
 */
export function seriesModel(): (q: SeriesQuery) => LatestTimeseriesModel | null {
  // Keyed by its inputs' identities (records are large).
  let memo: { inputs: unknown[]; model: LatestTimeseriesModel | null; scope: string } | null = null
  return (q) => {
    const res = recordResource(seriesRequest(q))
    const scope = `${q.station}|${q.agg}|${q.vars.join(',')}`
    if (!res || res.status === 'error') return null
    if (!res.data) return memo?.scope === scope ? memo.model : null
    const rows = raw(res.data)
    const config = sensorConfig(q.station)
    const normals = seriesNormals(q.station, q.vars, q.agg, q.gridmet)
    const w = q.window
    const inputs = [rows, config, ...(normals ? Object.values(normals) : []), w.start, w.end, scope]
    if (memo && memo.inputs.length === inputs.length && memo.inputs.every((v, i) => v === inputs[i])) return memo.model
    const ts = buildTimeseriesModel({ rows, vars: q.vars, period: q.agg, normalsByVar: normals, sensorConfig: config })
    const view = windowRange(w.start, w.end)
    const installed = installDate(Alpine.store('station').byId(q.station))
    const model = ts ? { ts, period: q.agg, view, extent: axisExtent(view, todayIso(), installed) } : null
    memo = { inputs, model, scope }
    return model
  }
}
