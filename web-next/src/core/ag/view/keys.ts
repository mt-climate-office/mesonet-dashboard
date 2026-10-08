/**
 * `$store.data.cached` keys and TTLs for Ag Tools. Each key encodes every
 * input of its fetcher (station, window, period, QC level, …), as
 * ARCHITECTURE.md requires; TTLs are the former TanStack staleTimes.
 */
import type { LocalDate } from '../contract'
import { DEFAULT_AG_LEVEL } from '../data/observations'

const MIN = 60 * 1000
const HOUR = 60 * MIN

export const AG_TTL = {
  /** Observations-derived series and `/derived` SWP / porosity. */
  series: 10 * MIN,
  stationMeta: HOUR,
  elements: HOUR,
  /** Vendored soil parameters, GDD stage tables and normals never change in a session. */
  static: Infinity,
  forecast: HOUR,
  /** A degraded NWS forecast is retried after this long. */
  forecastDegraded: 5 * MIN,
} as const

export interface WindowKey {
  station: string
  start: LocalDate
  end: LocalDate
}

const win = (q: WindowKey) => `${q.station}:${q.start}:${q.end}:L${DEFAULT_AG_LEVEL}`

export const agKeys = {
  dailyMet: (q: WindowKey) => `ag:dailyMet:${win(q)}`,
  hourlyMet: (q: WindowKey) => `ag:hourlyMet:${win(q)}`,
  soil: (q: WindowKey, period: string) => `ag:soil:${period}:${win(q)}`,
  stationMeta: (station: string) => `ag:stationMeta:${station}`,
  elements: (station: string) => `ag:elements:${station}`,
  soilParams: () => 'ag:soilParams',
  gddStages: () => 'ag:gddStages',
  normals: (station: string) => `ag:normals:${station}`,
  forecast: (lat: number, lon: number) => `ag:forecast:${lat.toFixed(4)}:${lon.toFixed(4)}`,
  /** One request group's years (core/variables `requestGroups`): "2025", or "2021+2020" for the install year with the next. */
  annual: (station: string, element: string, years: readonly number[]) => `ag:annual:${station}:${element}:L${DEFAULT_AG_LEVEL}:${years.join('+')}`,
}

/** True when a degraded forecast fetched at `fetchedAt` should be retried now. */
export const forecastNeedsRetry = (degraded: boolean, fetchedAt: number, now: number) =>
  degraded && now - fetchedAt >= AG_TTL.forecastDegraded
