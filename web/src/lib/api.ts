import { API_URL } from './config'
import { buildQuery, parseCsv } from './csv'
import type { AggPeriod } from './params'
import { DERIVED_ENDPOINTS, ENDPOINTS } from './params'

export interface Station {
  station: string
  name: string
  date_installed: string | null
  sub_network: string
  longitude: number
  latitude: number
  elevation: number
  county: string
  mesowest_id: string | null
  gwic_id: string | null
  nwsli_id: string | null
  has_swp: boolean
  funded: boolean
}

export interface ElementMeta {
  element: string
  description: string
  description_short: string
  base_units: string
  us_units: string
  sort_order: number
}

export interface StationElement extends ElementMeta {
  date_start?: string
  date_end?: string | null
}

export interface ObservationRow {
  station: string
  datetime: string
  [key: string]: string | number | boolean | null
}

export interface PptSummaryRow {
  station: string
  [key: string]: string | number | null
}

export interface InstrumentEntry {
  date_start: string
  date_end: string | null
  elements: string[]
  height: string
  manufacturer: string
  model: string
  serial_number: string
  type: string
}

export interface StationConfig {
  station: string
  name: string
  date_installed: string
  latitude: number
  longitude: number
  elevation: number
  sub_network: string
  status: string
  nwsli_id: string | null
  instruments?: InstrumentEntry[]
}

async function fetchText(path: string, query: Record<string, unknown> = {}): Promise<string> {
  const url = `${API_URL}${path.replace(/^\//, '')}${buildQuery(query as never)}`
  const r = await fetch(url, { headers: { Accept: 'text/csv,application/json' } })
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} on ${url}: ${await r.text().catch(() => '')}`)
  }
  return r.text()
}

async function fetchJson<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
  const url = `${API_URL}${path.replace(/^\//, '')}${buildQuery(query as never)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} on ${url}: ${await r.text().catch(() => '')}`)
  }
  return (await r.json()) as T
}

async function fetchCsv<T extends object>(
  path: string,
  query: Record<string, unknown> = {},
): Promise<T[]> {
  const text = await fetchText(path, { ...query, type: 'csv' })
  return parseCsv<T & Record<string, unknown>>(text) as T[]
}

export const getStations = () => fetchCsv<Station>('stations')

export const getElements = () => fetchCsv<ElementMeta>('elements')

export const getStationElements = (station: string) =>
  fetchCsv<StationElement>(`elements/${station}/`)

export const getStationLatest = (station: string) =>
  fetchCsv<ObservationRow>('latest', { stations: station })

export const getStationConfig = (station: string) =>
  fetchJson<StationConfig>(`config/${station}/`)

export const getPptSummary = (station: string) =>
  fetchCsv<PptSummaryRow>('derived/ppt/', { stations: station })

/**
 * Camera metadata for every station that has photos. The "Photo Directions"
 * column comes back as a Python-list-shaped string like
 * `['N (North)', 'SNOW (Snow Platform)']` so we parse it client-side.
 */
export interface PhotoStationRow {
  'Station ID': string
  'Camera Manufacturer': string
  'Camera Model': string
  'Photo Start Date': string
  'Photo Directions': string
}

export interface PhotoDirection {
  /** Code used in the URL path (e.g. `N`, `SNOW`, `NS`). */
  value: string
  /** Human label from the metadata (e.g. `North`, `Snow Platform`). */
  label: string
}

export interface PhotoMeta {
  station: string
  manufacturer: string
  model: string
  startDate: string
  directions: PhotoDirection[]
}

const DIRECTION_REGEX = /'([^']+)'/g

function parseDirections(raw: string): PhotoDirection[] {
  const out: PhotoDirection[] = []
  for (const match of raw.matchAll(DIRECTION_REGEX)) {
    const item = match[1]
    const m = item.match(/^([^\s(]+)\s*\(([^)]+)\)\s*$/)
    if (m) {
      out.push({ value: m[1], label: m[2] })
    } else {
      out.push({ value: item, label: item })
    }
  }
  return out
}

export async function getPhotoCatalog(): Promise<PhotoMeta[]> {
  const rows = await fetchCsv<PhotoStationRow>('photos/')
  return rows
    .map((r) => ({
      station: String(r['Station ID']),
      manufacturer: String(r['Camera Manufacturer'] ?? ''),
      model: String(r['Camera Model'] ?? ''),
      startDate: String(r['Photo Start Date'] ?? ''),
      directions: parseDirections(String(r['Photo Directions'] ?? '')),
    }))
    .filter((m) => m.station)
}

export interface RecordQuery {
  station: string
  start: Date | string
  end?: Date | string
  period: AggPeriod
  /** comma-separated element codes; defaults to a sensible station-default set */
  elements?: string
  hasEtr?: boolean
  derivedElems?: string[]
  rmNa?: boolean
  naInfo?: boolean
  publicOnly?: boolean
}

const fmtDate = (d: Date | string): string =>
  typeof d === 'string' ? d : d.toISOString().slice(0, 10)

/**
 * Mirrors get_data.get_station_record. Returns the time series CSV joined with
 * derived elements (e.g. etr) when has_etr / derived_elems are set.
 */
export async function getStationRecord(q: RecordQuery): Promise<ObservationRow[]> {
  const start = fmtDate(q.start)
  const end = q.end ? fmtDate(q.end) : undefined

  const baseQuery = {
    stations: q.station,
    elements: q.elements ?? '',
    start_time: start,
    end_time: end,
    level: 1,
    rm_na: q.rmNa ?? true,
    premade: true,
    na_info: q.naInfo ?? false,
    public: q.publicOnly ?? true,
  }

  const observations =
    q.elements && q.elements !== ''
      ? await fetchCsv<ObservationRow>(ENDPOINTS[q.period], baseQuery)
      : []

  let merged = observations

  if (q.hasEtr) {
    const etr = await fetchCsv<ObservationRow>(DERIVED_ENDPOINTS[q.period], {
      ...baseQuery,
      elements: 'etr',
    })
    merged = mergeOn(merged, etr, ['station', 'datetime'])
  }

  if (q.derivedElems && q.derivedElems.length > 0) {
    const derived = await fetchCsv<ObservationRow>(DERIVED_ENDPOINTS[q.period], {
      ...baseQuery,
      elements: q.derivedElems.join(','),
    })
    merged = mergeOn(merged, derived, ['station', 'datetime'])
  }

  return merged
}

function mergeOn(
  left: ObservationRow[],
  right: ObservationRow[],
  keys: string[],
): ObservationRow[] {
  if (left.length === 0) return right
  if (right.length === 0) return left
  const index = new Map<string, ObservationRow>()
  for (const row of right) {
    index.set(keys.map((k) => row[k]).join('||'), row)
  }
  return left.map((row) => {
    const match = index.get(keys.map((k) => row[k]).join('||'))
    return match ? { ...row, ...match } : row
  })
}

/* -------------------------------------------------------------------------- */
/* Ag Tools — derived endpoints                                               */
/* -------------------------------------------------------------------------- */

export interface DerivedQuery {
  station: string
  variable: string
  /** YYYY-MM-DD */
  start: string
  /** YYYY-MM-DD */
  end: string
  /** 'daily' | 'hourly' */
  time: 'daily' | 'hourly'
  /** Crop name for GDD; ignored otherwise. */
  crop?: string
}

/**
 * Fetch derived/observation series for the Ag Tools tab.
 * Mirrors get_data.get_derived from the legacy app.
 *
 * - Soil variables (soil_temp, soil_ec_blk, soil_vwc) hit /observations/{time}.
 * - Everything else (etr, gdd, feels_like, cci, swp, percent_saturation) hits /derived/{time}.
 *
 * Note on GDD: the new RDS API ignores `low`/`high` query params (verified
 * empirically against /derived/daily). The slider in the UI therefore drives
 * client-side recomputation in DerivedChart from the Tmax/Tmin columns the
 * API returns when `keep=true` is set. We send `keep=true` only for `gdd`
 * since other endpoints don't honor it (and it makes the response wider).
 */
export async function getDerived(q: DerivedQuery): Promise<ObservationRow[]> {
  const isObservation =
    q.variable.includes('soil_temp') ||
    q.variable.includes('soil_ec_blk') ||
    q.variable.includes('soil_vwc')
  const path = isObservation
    ? `observations/${q.time}`
    : `derived/${q.time}`

  const baseQuery: Record<string, unknown> = {
    stations: q.station,
    start_time: q.start,
    end_time: q.end,
    elements: q.variable,
    alpha: 0.23,
    premade: true,
    rm_na: true,
  }
  if (q.crop) baseQuery.crop = q.crop
  // `keep=true` returns the underlying inputs alongside the derived value.
  // For GDD we use it to recompute against the slider thresholds; for
  // feels_like it surfaces Wind Chill / Heat Index so the chart can color
  // each marker by which regime the value came from.
  if (q.variable === 'gdd' || q.variable === 'feels_like') baseQuery.keep = true

  return fetchCsv<ObservationRow>(path, baseQuery)
}

/**
 * Convenience for the Soil Profile plot. Fetches the soil observation series
 * (temp/EC/VWC) and merges with the derived percent_saturation + swp series so
 * the heatmap can switch between any of the five soil sub-variables without
 * refetching.
 */
export async function getDerivedSoil(q: Omit<DerivedQuery, 'crop'>): Promise<ObservationRow[]> {
  const [obs, derived] = await Promise.all([
    getDerived({ ...q, variable: q.variable }),
    getDerived({ ...q, variable: 'percent_saturation,swp' }),
  ])
  return mergeOn(obs, derived, ['station', 'datetime'])
}
