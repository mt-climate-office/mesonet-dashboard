/**
 * The Latest cards' fetches, each one `$store.data.cached` call with its key
 * and TTL (ARCHITECTURE "Data flow"). Keys encode every fetcher input.
 * Components call these from getters; the cache dedupes repeated reads.
 */
import Alpine from 'alpinejs'
import { fetchNwsForecast, getPptSummary, getStationLatest, getStationRecord, type ObservationRow } from '../../../core/api'
import type { Resource } from '../../../core/cache'
import { fetchOnePagers, ONE_PAGERS_STALE_MS, type WindRoseRequest } from '../../../core/cards'
import {
  confirmDerived,
  fetchLatestFrames,
  fetchMonthFrames,
  fetchSchedule,
  localToday,
  type PhotoFrame,
  type PhotoSchedule,
  type StationCamera,
} from '../../../core/photos'

const MIN = 60_000
const cached = <T>(key: string, fn: () => Promise<T>, ttl: number): Resource<T> =>
  Alpine.store('data').cached(key, fn, { ttl })

/** data2 camera registry. */
export const photoSchedule = () => cached('photo:schedule', () => fetchSchedule(), 60 * MIN)

/** Today + yesterday (local) frames from the live bucket listings. */
export const latestFrames = (s: PhotoSchedule, cam: StationCamera) =>
  cached(`photo:latest:${cam.station}`, () => fetchLatestFrames(s, cam), 5 * MIN)

/** One local month's manifest (`YYYY-MM`); the current month refreshes, past months never change. */
export const monthFrames = (s: PhotoSchedule, cam: StationCamera, ym: string) =>
  cached(`photo:month:${cam.station}:${ym}`, () => fetchMonthFrames(s, cam, ym), ym === localToday().slice(0, 7) ? 5 * MIN : Infinity)

/** A past day's frames with derived WebPs confirmed; `derived` is core/cards/photo `derivedKey(frames)`. */
export const confirmedDay = (s: PhotoSchedule, cam: StationCamera, day: string, derived: string, frames: PhotoFrame[]) =>
  cached(`photo:confirm:${cam.station}:${day}:${derived}`, () => confirmDerived(s, cam, frames), Infinity)

/** Newest observation row(s) for Current Conditions. */
export const latestObs = (station: string) => cached(`latest:${station}`, () => getStationLatest(station), 5 * MIN)

/** HydroMet precipitation summary (`/derived/ppt/`). */
export const pptSummary = (station: string) => cached(`ppt:${station}`, () => getPptSummary(station), 30 * MIN)

/** NWS text forecast for a point. */
export const nwsForecast = (lat: number, lon: number) => cached(`nws:${lat},${lon}`, () => fetchNwsForecast(lat, lon), 30 * MIN)

/** Station one-pager links (expiring URLs: short TTL, memory only). */
export const onePagers = () => cached('one-pagers', fetchOnePagers, ONE_PAGERS_STALE_MS)

/** Wind speed/direction over the plotted window. */
export const windObs = (r: WindRoseRequest): Resource<ObservationRow[]> => cached(r.key, () => getStationRecord(r.query), 5 * MIN)
