/**
 * `$store.station`: the station catalog (via `$store.data`) and the selected
 * station. Rewrites an NWSLI or mis-cased `?s=` to the catalog id once the
 * catalog loads (legacy `/dash/<NWSLI>` links), and remembers every confirmed
 * station as the last/recent one (core/stations/recent.ts).
 */
import Alpine from 'alpinejs'
import { getStations, type Station } from '../core/api'
import type { Resource } from '../core/cache'
import { confirmedStation, resolveStationId } from '../core/stations'
import { readRecent, rememberStation, type StorageLike } from '../core/stations/recent'
import { selectStationPatch } from '../core/url-schema'

const HOUR = 60 * 60 * 1000

/** localStorage, or a no-op stand-in where even reading `window.localStorage` throws. */
export function browserStorage(): StorageLike {
  try {
    return window.localStorage
  } catch {
    return { getItem: () => null, setItem: () => undefined }
  }
}

export interface StationStore {
  catalog: Resource<Station[]> | null
  /** Catalog rows ([] until loaded). */
  readonly list: Station[]
  /** Confirmed station id for requests, or null (see core/stations `confirmedStation`). */
  readonly id: string | null
  /** Catalog row of `id`, or undefined. */
  readonly current: Station | undefined
  byId(id: string | null): Station | undefined
  /** User picked a station: set `s` (core/url-schema `selectStationPatch`). */
  select(id: string | null): void
  /** Recently opened station ids, newest first (max 5; updated as stations are confirmed). */
  recent: string[]
  init(): void
}

export function createStationStore(): StationStore {
  return {
    catalog: null,
    recent: readRecent(browserStorage()),

    init() {
      this.catalog = Alpine.store('data').cached('stations', getStations, { ttl: HOUR })
      Alpine.effect(() => {
        const s = Alpine.store('url').state.s
        const list = this.catalog?.data
        if (!s || !list) return
        const canonical = resolveStationId(s, list)
        if (canonical && canonical !== s) Alpine.store('url').set({ s: canonical })
      })
      // Only catalog-confirmed ids are remembered, so a bad link never becomes the default.
      Alpine.effect(() => {
        const id = this.id
        if (!id) return
        const storage = browserStorage()
        rememberStation(storage, id)
        this.recent = readRecent(storage)
      })
    },

    get list() {
      return this.catalog?.data ?? []
    },

    get id() {
      const c = this.catalog
      return confirmedStation(Alpine.store('url').state.s, c?.data, c?.status === 'error')
    },

    get current() {
      return this.byId(this.id)
    },

    byId(id) {
      return id ? this.list.find((s) => s.station === id) : undefined
    },

    select(id) {
      Alpine.store('url').set(selectStationPatch(id))
    },
  }
}
