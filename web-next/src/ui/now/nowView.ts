/**
 * `x-data="nowView"` on the Now section (partials/now/index.html): the
 * current-conditions overview. Tier 1 (`/latest`, `/derived/ppt/`, NWS,
 * photo schedule) is requested in parallel on mount; tier 2 (the hourly
 * sparkline rows and normals) once `/latest` is in. The model is
 * core/overview `buildOverview`, computed once per change in an effect (the
 * partial reads `o` many times). Tiles link to Charts → Compare with their
 * variables until P1 adds the variable page.
 */
import Alpine from 'alpinejs'
import type { Station } from '../../core/api'
import { buildOverview, type Overview } from '../../core/overview'
import { hasCamera } from '../../core/photos'
import { latestObs, nwsForecast, photoSchedule, pptSummary } from '../latest/cards/resources'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'
import { navigate } from '../shell/navigate'
import { normals, sparkRows } from './resources'

const EMPTY: Overview = { freshness: null, hero: null, tiles: [] }
type State = 'none' | 'loading' | 'error' | 'ready'

/** Everything the partial binds, from the stores and the cache (reactive reads). */
function compute(nowMs: number): { o: Overview; state: State; sparkLoading: boolean } {
  const st = Alpine.store('station')
  const s: Station | undefined = st.current
  if (!s) {
    const waiting = !!Alpine.store('url').state.s && st.catalog?.status !== 'success'
    return { o: EMPTY, state: waiting ? 'loading' : 'none', sparkLoading: false }
  }
  const today = MCO.todayMT()
  // Tier 1, in parallel: reading a resource starts its request (the cache dedupes).
  const latestRes = latestObs(s.station)
  const ppt = s.sub_network === 'HydroMet' ? pptSummary(s.station).data?.[0] : undefined
  nwsForecast(s.latitude, s.longitude)
  photoSchedule()
  const latest = latestRes.data?.[0] as Record<string, unknown> | undefined
  if (!latest) return { o: EMPTY, state: latestRes.status === 'loading' ? 'loading' : 'error', sparkLoading: false }
  // Tier 2 waits for /latest: it picks the elements and keeps tier 1 first on the wire.
  const spark = sparkRows(s.station, today, latest)
  const nm = { tmmx: normals(s.station, 'tmmx').data, tmmn: normals(s.station, 'tmmn').data, pr: normals(s.station, 'pr').data }
  const hourly = spark.data ? Alpine.raw(spark.data) : undefined
  const o = buildOverview({ latest: Alpine.raw(latest), hourly, ppt: ppt ? Alpine.raw(ppt) : undefined, normals: nm, today, nowMs })
  return { o, state: 'ready', sparkLoading: spark.status === 'loading' && !spark.data }
}

export function nowView() {
  let timer = 0
  let effect: ReturnType<typeof Alpine.effect> | null = null
  return component({
    /** Re-read every minute so "Updated N min ago" (and the 5 min refetch) stay current. */
    nowMs: Date.now(),
    o: EMPTY,
    state: 'loading' as State,
    sparkLoading: true,

    init() {
      effect = Alpine.effect(() => Object.assign(this, compute(this.nowMs)))
      timer = window.setInterval(() => (this.nowMs = Date.now()), 60_000)
    },
    destroy() {
      clearInterval(timer)
      if (effect) Alpine.release(effect)
    },

    /** Photo when the station has a camera, else the wind rose; 'pending' while the schedule loads. */
    get media(): 'photo' | 'wind' | 'pending' {
      const sched = photoSchedule()
      if (sched.status === 'loading') return 'pending'
      return hasCamera(sched.data, Alpine.store('station').id) ? 'photo' : 'wind'
    },

    href(vars: string[]): string {
      return Alpine.store('url').hrefFor('charts', { vars, cmp: true })
    },
    /** Plain click on a tile: push Charts → Compare for its variables; the tile morphs into the section header. */
    open(e: MouseEvent, vars: string[]): void {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      void navigate('charts', { patch: { vars, cmp: true }, morph: e.currentTarget as HTMLElement })
    },
    /** "All readings" → About, through the same pushState + transition as the section nav. */
    toAbout(e: MouseEvent): void {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      void navigate('about')
    },

    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
