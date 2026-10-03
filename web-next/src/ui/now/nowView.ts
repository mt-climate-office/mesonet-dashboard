/**
 * `x-data="nowView"` on the Now section (partials/now/index.html). Tier 1
 * (`/latest`, the ppt summary, the NWS periods, the photo schedule) starts in
 * parallel on mount and renders the hero and tiles; tier 2 (the 72 h hourly
 * rows, normals, the NWS hourly forecast, SWP, 7 daily rain totals) fills the strip, sparklines,
 * high/low and the soil chip. The model is core/overview `buildNowPage`,
 * computed once per change in an effect (the partial reads `page` many times).
 */
import Alpine from 'alpinejs'
import type { Station } from '../../core/api'
import { forecastDetailUrl } from '../../core/cards'
import { heroStripChart, heroStripTable, type HeroStripModel } from '../../core/charts'
import { buildNowPage, latestSwpBar, type NowPage } from '../../core/overview'
import { hasCamera } from '../../core/photos'
import { stationHasSwp } from '../../core/stations'
import { loadErrorText } from '../../core/loadError'
import { denverToday } from '../../core/today'
import type { ChartBindings } from '../charts/chart'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'
import { follow } from '../shell/navigate'
import { latestObs, nwsForecast, photoSchedule, pptSummary } from '../station/resources'
import { normals, nwsHourly, rainDaily, sparkRows, swpRows } from './resources'

type State = 'none' | 'loading' | 'error' | 'empty' | 'ready'
interface View {
  page: NowPage | null
  state: State
  /** The error state's text: tier 1 failed (state 'error'), or the 72 h rows behind the strip did; '' when none failed. */
  error: string
  /** Tier 2 still loading: the strip, sparklines and high/low show skeletons. */
  tier2: boolean
  forecastUrl: string
}

const raw = <T>(x: T): T => (x ? Alpine.raw(x) : x)
const loading = (r: { status: string; data?: unknown } | null) => !!r && r.status === 'loading' && !r.data

/** Everything the partial binds, from the stores and the cache (reactive reads). */
function compute(nowMs: number): View {
  const st = Alpine.store('station')
  const s: Station | undefined = st.current
  const none = { page: null, tier2: false, forecastUrl: '', error: '' }
  if (!s) {
    if (st.catalog?.status === 'error') return { ...none, state: 'error', error: loadErrorText('The station list', st.catalog.error) }
    const waiting = !!Alpine.store('url').state.s && st.catalog?.status !== 'success'
    return { ...none, state: waiting ? 'loading' : 'none' }
  }
  const today = denverToday()
  // Tier 1, in parallel: reading a resource starts its request (the cache dedupes).
  const latestRes = latestObs(s.station)
  const ppt = s.sub_network === 'HydroMet' ? pptSummary(s.station).data?.[0] : undefined
  const fc = nwsForecast(s.latitude, s.longitude)
  photoSchedule()
  const latest = latestRes.data?.[0] as Record<string, unknown> | undefined
  if (!latest) {
    if (latestRes.status === 'error') return { ...none, state: 'error', error: loadErrorText('Current conditions', latestRes.error) }
    return { ...none, state: latestRes.status === 'loading' ? 'loading' : 'empty' }
  }
  // Tier 2 waits for /latest: it picks the elements and keeps tier 1 first on the wire.
  const spark = sparkRows(s.station, today, latest)
  const nm = { tmmx: normals(s.station, 'tmmx').data, tmmn: normals(s.station, 'tmmn').data, pr: normals(s.station, 'pr').data }
  const hourlyUrl = fc.data?.hourlyUrl
  const fcHourly = hourlyUrl ? nwsHourly(hourlyUrl) : null
  const swp = stationHasSwp(s) ? swpRows(s.station, today) : null
  const rain = rainDaily(s.station, today)
  const page = buildNowPage({
    latest: raw(latest),
    hourly: raw(spark.data),
    ppt: raw(ppt),
    normals: nm,
    today,
    nowMs,
    forecast: raw(fc.data),
    forecastHourly: raw(fcHourly?.data),
    swpBar: latestSwpBar(raw(swp?.data)),
    rainDaily: raw(rain.data),
    station: s,
  })
  const error = spark.status === 'error' ? loadErrorText('The last 72 hours', spark.error) : ''
  return { page, state: 'ready', error, tier2: loading(spark) || loading(fc) || loading(fcHourly) || loading(rain), forecastUrl: forecastDetailUrl(s.latitude, s.longitude) }
}

export function nowView() {
  let timer = 0
  let effect: ReturnType<typeof Alpine.effect> | null = null
  return component({
    /** Bumped every minute while visible so "Updated N min ago" stays current; the freshness tick (live reads) also recomputes. */
    nowMs: Date.now(),
    page: null as NowPage | null,
    state: 'loading' as State,
    tier2: true,
    forecastUrl: '',
    error: '',

    init() {
      effect = Alpine.effect(() => {
        void this.nowMs // re-run each minute
        // Date.now(), not nowMs: a freshness tick on return to the tab must not use the minute before it.
        Object.assign(this, compute(Date.now()))
      })
      timer = window.setInterval(() => document.hidden || (this.nowMs = Date.now()), 60_000)
    },
    destroy() {
      clearInterval(timer)
      if (effect) Alpine.release(effect)
    },

    /** The error state's text (partials/load-error.html). */
    loadError(): string {
      return this.error
    },

    /** Photo when the station has a camera, else the wind rose; 'pending' while the schedule loads. */
    get media(): 'photo' | 'wind' | 'pending' {
      const sched = photoSchedule()
      if (sched.status === 'loading') return 'pending'
      return hasCamera(sched.data, Alpine.store('station').id) ? 'photo' : 'wind'
    },

    /** Bindings for the strip's nested `x-data="chart(stripChart())"`. */
    stripChart(): ChartBindings<HeroStripModel> {
      return {
        builder: heroStripChart,
        table: heroStripTable,
        label: 'Air temperature, the last 24 hours observed and the next 24 hours forecast',
        model: () => this.page?.hero.strip,
      }
    },

    href(v: string): string {
      return Alpine.store('url').hrefFor('charts', { v, view: 'recent', cmp: false })
    },
    /** A tile: push its variable page; the tile morphs into the page heading, which takes focus. */
    open(e: MouseEvent, v: string): void {
      follow(e, 'charts', { patch: { v, view: 'recent', cmp: false }, morph: e.currentTarget as HTMLElement, target: 'var-title' })
    },
    /** A row to About, through the same pushState + transition as the section nav; `target` takes focus. */
    toAbout(e: MouseEvent, target?: string): void {
      follow(e, 'about', target ? { target } : {})
    },

    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
