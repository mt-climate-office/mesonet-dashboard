/**
 * `$store.station`: the station catalog (via `$store.data`) and the selected
 * station. Each row's `has_swp` comes from the mesonet-soils parameters
 * (core/stations `withSwpFlags`; false until they load or if they fail).
 * Rewrites an NWSLI or mis-cased `?s=` to the catalog id once the
 * catalog loads (legacy `/dash/<NWSLI>` links), and remembers every confirmed
 * station as the last/recent one (core/stations/recent.ts).
 */
import Alpine from 'alpinejs'
import { loadSoilParams, type SoilParamsBundle } from '../core/ag/data'
import { AG_TTL, agKeys } from '../core/ag/view/keys'
import { getStations, type Station } from '../core/api'
import type { Resource } from '../core/cache'
import { confirmedStation, resolveStationId, swpStationIds, withSwpFlags } from '../core/stations'
import { showsLanding } from '../core/stations/landing'
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
  /** mesonet-soils parameters (shared with the Ag tab's cache entry): decide `has_swp`. */
  soil: Resource<SoilParamsBundle> | null
  /** The soil parameters have loaded or failed, so `has_swp` is final. */
  readonly swpReady: boolean
  /** Catalog rows with `has_swp` set ([] until loaded). */
  readonly list: Station[]
  /** Confirmed station id for requests, or null (see core/stations `confirmedStation`). */
  readonly id: string | null
  /** Catalog row of `id`, or undefined. */
  readonly current: Station | undefined
  /** No station to show: the landing replaces the sections (core/stations/landing `showsLanding`). */
  readonly landing: boolean
  byId(id: string | null): Station | undefined
  /** User picked a station: set `s` (core/url-schema `selectStationPatch`). */
  select(id: string | null): void
  /** Recently opened station ids, newest first (max 5; updated as stations are confirmed). */
  recent: string[]
  init(): void
}

export function createStationStore(): StationStore {
  // `list` is read constantly; rebuild the flagged rows only when an input changes.
  let memo: { rows: Station[]; soil: SoilParamsBundle | undefined; out: Station[] } | null = null
  return {
    catalog: null,
    soil: null,
    recent: readRecent(browserStorage()),

    init() {
      const data = Alpine.store('data')
      this.catalog = data.cached('stations', getStations, { ttl: HOUR })
      this.soil = data.cached(agKeys.soilParams(), () => loadSoilParams(), { ttl: AG_TTL.static })
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
        // After this flush: Alpine drops a re-trigger of a job that already ran in the current
        // flush, so a write from inside it would leave the picker's Recent list stale.
        queueMicrotask(() => (this.recent = readRecent(storage)))
      })
    },

    get swpReady() {
      return this.soil?.status !== 'loading'
    },

    get list() {
      const rows = this.catalog?.data
      if (!rows) return []
      const soil = this.soil?.data
      if (memo?.rows !== rows || memo.soil !== soil) {
        memo = { rows, soil, out: withSwpFlags(rows, swpStationIds(soil?.rows ?? [])) }
      }
      return memo.out
    },

    get id() {
      const c = this.catalog
      return confirmedStation(Alpine.store('url').state.s, c?.data, c?.status === 'error')
    },

    get current() {
      return this.byId(this.id)
    },

    get landing() {
      return showsLanding(Alpine.store('url').state.s, this.catalog?.status, this.id)
    },

    byId(id) {
      return id ? this.list.find((s) => s.station === id) : undefined
    },

    select(id) {
      Alpine.store('url').set(selectStationPatch(id))
    },
  }
}
