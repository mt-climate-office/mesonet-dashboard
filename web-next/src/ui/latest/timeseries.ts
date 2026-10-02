/**
 * `latestTimeseries`: the Latest station plot. Fetches the record, sensor
 * config and gridMET normals through `$store.data`, builds the panel model
 * (core/models/timeseries) and hands it to the chart host with
 * `latestTimeseriesChart`; zoom writes `from`/`to`. Markup in partials/latest/index.html.
 */
import Alpine from 'alpinejs'
import { getStationConfig, getStationRecord, type ObservationRow, type StationConfig } from '../../core/api'
import { latestTimeseriesChart, latestTimeseriesHeight, latestTimeseriesTable, type LatestTimeseriesModel } from '../../core/charts'
import { TTL, axisExtent, configKey, datesPatch, installDate, normalsKey, recordRequest, todayIso, viewAnnouncement, windowRange, zoomDates } from '../../core/latest'
import { NORMALS_VARS, availableVars, buildTimeseriesModel, chartWindow, emptyState, noData, type TimeseriesEmpty } from '../../core/models/timeseries'
import { fetchNormals, type StationNormals } from '../../core/normals'
import { explodeInstruments, type ConfigRow, type RawInstrument } from '../../core/sensorEvents'
import { latestVars } from '../../core/url-schema'
import { component } from '../component'
import { announce } from '../shell/live'
import { elementsResource, stationElements } from './sidebar'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')
const data = () => Alpine.store('data')
const raw = <T>(v: T): T => (v && typeof v === 'object' ? (Alpine.raw(v) as T) : v)

const compactQuery = matchMedia('(max-width: 640px)')

export function latestTimeseries() {
  // Memo of the last built model, keyed by its inputs' identities (records are large).
  let memo: { inputs: unknown[]; model: LatestTimeseriesModel | null; scope: string } | null = null

  return component({
    compact: compactQuery.matches,
    latestTimeseriesChart,
    latestTimeseriesTable,

    init() {
      compactQuery.addEventListener('change', (e) => (this.compact = e.matches))
      this.$watch('announceKey', (key: string) => {
        if (key) announce(key)
      })
      // Details go to the console; the user sees the legacy no-data message.
      this.$watch('recordError', (err: unknown) => {
        if (err) console.error('Latest Data request failed:', err)
      })
    },

    get recordError(): unknown {
      const res = this.record()
      return res?.status === 'error' ? res.error : null
    },

    window() {
      return chartWindow(url().state.from, url().state.to)
    },
    vars(): string[] | null {
      const id = stations().id
      // Wait for the element list (it decides the request) unless it failed.
      if (id && elementsResource(id)?.status === 'loading') return null
      return availableVars(latestVars(url().state), stationElements(id))
    },
    empty(): TimeseriesEmpty | null {
      const c = stations().catalog
      return emptyState({
        selection: latestVars(url().state),
        available: this.vars(),
        param: url().state.s,
        station: stations().id,
        catalogLoaded: !!c?.data || c?.status === 'error',
        windowValid: this.window().valid,
      })
    },
    record() {
      const id = stations().id
      const vars = this.vars()
      if (!id || !vars || this.empty()) return null
      const req = recordRequest({ station: id, window: this.window(), agg: url().state.agg, vars, stationElements: stationElements(id) })
      return req ? data().cached(req.key, () => getStationRecord(req.query)) : null
    },
    sensorConfig(): ConfigRow[] | undefined {
      const id = stations().id
      if (!id) return undefined
      const res = data().cached(configKey(id), () => getStationConfig(id), { ttl: TTL.config })
      const cfg = raw(res.data) as StationConfig | undefined
      return cfg ? explodeInstruments(cfg.instruments as unknown as RawInstrument[]) : undefined
    },
    normals(): Record<string, StationNormals | null> | undefined {
      const id = stations().id
      const s = url().state
      if (!id || !s.gridmet || s.agg !== 'daily') return undefined
      const out: Record<string, StationNormals | null> = {}
      for (const v of (this.vars() ?? []).filter((v) => (NORMALS_VARS as readonly string[]).includes(v))) {
        out[v] = raw(data().cached(normalsKey(id, v), () => fetchNormals(id, v), { ttl: TTL.normals }).data) ?? null
      }
      return out
    },

    /** The chart model, or null (empty state, loading with nothing to keep, error, no rows). */
    model(): LatestTimeseriesModel | null {
      const res = this.record()
      const vars = this.vars() ?? []
      const s = url().state
      const scope = `${stations().id}|${s.agg}|${vars.join(',')}`
      if (!res || res.status === 'error') return null
      // Same station/agg/vars still loading a new window: keep the last plot (no flash).
      if (!res.data) return memo?.scope === scope ? memo.model : null
      const rows = raw(res.data) as ObservationRow[]
      const config = this.sensorConfig()
      const normals = this.normals()
      const normalsRefs = normals ? Object.values(normals) : []
      const w = this.window()
      const inputs = [rows, config, ...normalsRefs, w.start, w.end, scope]
      if (memo && memo.inputs.length === inputs.length && memo.inputs.every((v, i) => v === inputs[i])) return memo.model
      const ts = buildTimeseriesModel({ rows, vars, period: s.agg, normalsByVar: normals, sensorConfig: config })
      const view = windowRange(w.start, w.end)
      const model = ts ? { ts, period: s.agg, view, extent: axisExtent(view, todayIso(), installDate(stations().current)) } : null
      memo = { inputs, model, scope }
      return model
    },

    /** What to show instead of (or over) the chart. */
    status(): { kind: 'empty' | 'loading' | 'ready'; title?: string; hint?: string } {
      const e = this.empty()
      if (e) return { kind: 'empty', title: e.title, hint: 'hint' in e ? e.hint : undefined }
      const res = this.record()
      if (!res || res.status === 'loading') return this.model() ? { kind: 'ready' } : { kind: 'loading' }
      if (res.status === 'error' || !this.model()) {
        const n = noData()
        return { kind: 'empty', title: n.title, hint: 'hint' in n ? n.hint : undefined }
      }
      return { kind: 'ready' }
    },
    loading(): boolean {
      return this.record()?.status === 'loading'
    },
    heightStyle(): string {
      const n = this.model()?.ts.panels.length ?? 1
      const px = latestTimeseriesHeight(n, this.compact)
      return `--chart-height: ${px}px; --chart-height-compact: ${px}px`
    },
    /** Live-region text once a new view has data; '' while loading. */
    get announceKey(): string {
      const m = this.model()
      if (!m || this.loading()) return ''
      const w = this.window()
      const name = stations().current?.name ?? stations().id ?? ''
      return viewAnnouncement(name, m.period, w.start, w.end, m.ts.panels.length)
    },

    range(): [number, number] | null {
      const w = this.window()
      return w.valid ? windowRange(w.start, w.end) : null
    },
    onZoom(fromMs: number, toMs: number): void {
      const d = zoomDates(fromMs, toMs, todayIso(), installDate(stations().current))
      url().set(datesPatch(d.start, d.end))
    },
  })
}
