/**
 * Per-station fetches shared by the sections (Now, About, the Compare cards),
 * each one `$store.data.cached` call with its key
 * and TTL (ARCHITECTURE "Data flow"). Keys encode every fetcher input.
 * Components call these from getters; the cache dedupes repeated reads.
 */
import Alpine from 'alpinejs'
import { fetchNwsForecast, getPptSummary, getStationConfig, getStationLatest, getStationRecord, type ObservationRow } from '../../core/api'
import type { Resource } from '../../core/cache'
import { fetchOnePagers, ONE_PAGERS_STALE_MS, type WindRoseRequest } from '../../core/cards'
import { configKey, TTL } from '../../core/latest'
import { denverToday } from '../../core/today'
import {
  confirmDerived,
  fetchLatestFrames,
  fetchMonthFrames,
  fetchSchedule,
  type PhotoFrame,
  type PhotoSchedule,
  type StationCamera,
} from '../../core/photos'

const MIN = 60_000
/** `live`: time-sensitive, re-read on the freshness tick (stores/data.ts). */
const cached = <T>(key: string, fn: () => Promise<T>, ttl: number, live = false): Resource<T> =>
  Alpine.store('data').cached(key, fn, { ttl, live })

/** data2 camera registry. */
export const photoSchedule = () => cached('photo:schedule', () => fetchSchedule(), 60 * MIN)

/** Today + yesterday (local) frames from the live bucket listings. */
export const latestFrames = (s: PhotoSchedule, cam: StationCamera) =>
  cached(`photo:latest:${cam.station}`, () => fetchLatestFrames(s, cam), 5 * MIN, true)

/** One local month's manifest (`YYYY-MM`); the current month refreshes, past months never change. */
export const monthFrames = (s: PhotoSchedule, cam: StationCamera, ym: string) =>
  cached(`photo:month:${cam.station}:${ym}`, () => fetchMonthFrames(s, cam, ym), ym === denverToday().slice(0, 7) ? 5 * MIN : Infinity)

/**
 * A past day's frames with derived WebPs confirmed; `derived` is core/cards/photo `derivedKey(frames)`.
 * Strict: a failed listing errors (retried, then kept until refresh) instead of caching a partial day
 * forever; only a fully confirmed day is cached with no expiry.
 */
export const confirmedDay = (s: PhotoSchedule, cam: StationCamera, day: string, derived: string, frames: PhotoFrame[]) =>
  cached(`photo:confirm:${cam.station}:${day}:${derived}`, () => confirmDerived(s, cam, frames, { strict: true }), Infinity)

/** Newest observation row(s) for Current Conditions. */
export const latestObs = (station: string) => cached(`latest:${station}`, () => getStationLatest(station), 5 * MIN, true)

/** HydroMet precipitation summary (`/derived/ppt/`). */
export const pptSummary = (station: string) => cached(`ppt:${station}`, () => getPptSummary(station), 30 * MIN, true)

/** NWS text forecast for a point. */
export const nwsForecast = (lat: number, lon: number) => cached(`nws:${lat},${lon}`, () => fetchNwsForecast(lat, lon), 30 * MIN, true)

/** Station one-pager links (expiring URLs: short TTL, memory only). */
export const onePagers = () => cached('one-pagers', fetchOnePagers, ONE_PAGERS_STALE_MS)

/** `/config/{station}/` (instruments): About's sensor history; same key and TTL as Compare's sensor overlays. */
export const stationConfig = (station: string) => cached(configKey(station), () => getStationConfig(station), TTL.config)

/** Now's wind rose rows (core/cards `nowWindRoseRequest`): live, slotted, so the midnight key change keeps the rose. */
export const windObs = (station: string, r: WindRoseRequest): Resource<ObservationRow[]> =>
  Alpine.store('data').cached(r.key, () => getStationRecord(r.query), { ttl: 5 * MIN, live: true, slot: `wind:${station}` })
