/**
 * TanStack Query hooks for the Ag Tools data layer. Each hook wraps a
 * fetcher from this folder and returns contract shapes; pass `null` to
 * disable. Query keys are namespaced under `['ag', …]`.
 */
import { useQuery } from '@tanstack/react-query'
import { useStations } from '../../../hooks/useStations'
import type { GddCrop } from '../contract'
import { type AnnualOptions, getAnnualDaily } from './annual'
import { fetchForecastDaily } from './forecast'
import { loadGddStages } from './gddStages'
import { fetchDailyNormals } from './normals'
import {
  DEFAULT_AG_LEVEL,
  type ObsQuery,
  fetchDailyMet,
  fetchHourlyMet,
  fetchSoilSeries,
  fetchStationMeta,
} from './observations'
import { loadSoilParams, soilParamsFor } from './soilParams'

const HOUR = 60 * 60 * 1000
const obsKey = (q: ObsQuery) => [q.station, q.start, q.end, q.level ?? DEFAULT_AG_LEVEL] as const

/** Daily min/max/avg met inputs (`/observations/daily`). */
export function useDailyMet(q: ObsQuery | null) {
  return useQuery({
    queryKey: q ? ['ag', 'dailyMet', ...obsKey(q)] : ['ag', 'dailyMet', 'disabled'],
    queryFn: () => fetchDailyMet(q!),
    enabled: !!q?.station,
    staleTime: 10 * 60 * 1000,
  })
}

/** Hourly met inputs (`/observations/hourly`). */
export function useHourlyMet(q: ObsQuery | null) {
  return useQuery({
    queryKey: q ? ['ag', 'hourlyMet', ...obsKey(q)] : ['ag', 'hourlyMet', 'disabled'],
    queryFn: () => fetchHourlyMet(q!),
    enabled: !!q?.station,
    staleTime: 10 * 60 * 1000,
  })
}

/** Soil VWC + temperature by depth, daily or hourly. */
export function useSoilSeries(q: (ObsQuery & { period: 'daily' | 'hourly' }) | null) {
  return useQuery({
    queryKey: q
      ? ['ag', 'soilSeries', q.period, ...obsKey(q)]
      : ['ag', 'soilSeries', 'disabled'],
    queryFn: () => fetchSoilSeries(q!),
    enabled: !!q?.station,
    staleTime: 10 * 60 * 1000,
  })
}

/** StationMeta (reuses the cached `/stations` catalog). */
export function useStationMeta(station: string | null) {
  const stations = useStations()
  return useQuery({
    queryKey: ['ag', 'stationMeta', station],
    queryFn: () => fetchStationMeta(station!, stations.data),
    enabled: !!station && !!stations.data,
    staleTime: HOUR,
  })
}

/**
 * Soil hydraulic params. With a station: that station's rows (shallow →
 * deep); without: every row. `data.source` says data2 vs vendored.
 */
export function useSoilParams(station?: string | null) {
  return useQuery({
    queryKey: ['ag', 'soilParams'],
    queryFn: () => loadSoilParams(),
    staleTime: Infinity,
    gcTime: Infinity,
    select: (b) => (station ? { ...b, rows: soilParamsFor(b, station) } : b),
  })
}

/** GDD stage tables; with a crop, `data.table` is that crop's table. */
export function useGddStages(crop?: GddCrop | null) {
  return useQuery({
    queryKey: ['ag', 'gddStages'],
    queryFn: () => loadGddStages(),
    staleTime: Infinity,
    gcTime: Infinity,
    select: (b) => ({ ...b, table: crop ? b.tables[crop] : undefined }),
  })
}

/** gridMET daily normals (SI); `null` data when the station has none. */
export function useNormals(station: string | null) {
  return useQuery({
    queryKey: ['ag', 'normals', station],
    queryFn: () => fetchDailyNormals(station!),
    enabled: !!station,
    // Successes (incl. a genuine "no normals" null) are stable; failures
    // throw, stay in the error state and are retried, never cached as data.
    staleTime: Infinity,
    retry: 2,
  })
}

/**
 * NWS ≤ 7-day daily min/max. Never errors: `data.status === 'degraded'`
 * when NWS fails, so callers can fall back to normals.
 */
export function useForecastDaily(lat: number | null | undefined, lon: number | null | undefined) {
  return useQuery({
    queryKey: ['ag', 'forecastDaily', lat, lon],
    queryFn: () => fetchForecastDaily(lat!, lon!),
    enabled: lat != null && lon != null,
    // Retry a degraded forecast after 5 minutes rather than an hour.
    staleTime: (query) => (query.state.data?.status === 'degraded' ? 5 * 60 * 1000 : HOUR),
    gcTime: 3 * HOUR,
    retry: false,
  })
}

export type AnnualQuery = { station: string; element: string; years: number[] } & Omit<
  AnnualOptions,
  'today'
>

/** One element's daily series for several calendar years (Annual tab). */
export function useAnnualDaily(q: AnnualQuery | null) {
  return useQuery({
    queryKey: q
      ? ['ag', 'annual', q.station, q.element, q.agg, q.level, [...q.years].sort().join(',')]
      : ['ag', 'annual', 'disabled'],
    queryFn: () => getAnnualDaily(q!.station, q!.element, q!.years, q!),
    enabled: !!q?.station && !!q?.element && q.years.length > 0,
    staleTime: 10 * 60 * 1000,
  })
}
