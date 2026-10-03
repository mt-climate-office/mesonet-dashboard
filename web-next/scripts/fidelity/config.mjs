// Fidelity harness configuration: targets, URL builder, scenarios, tolerances, timeouts.
// Both apps read the same URL keys (web/src/lib/url-state.ts = web-next/src/core/url-schema.ts),
// so one builder serves both; web-next also gets ?theme=light (the run is light-theme only).
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
export const WEB_NEXT_DIR = resolve(here, '../..')
export const WEB_DIR = resolve(here, '../../../web')

export const DEFAULT_OUT =
  process.env.FIDELITY_OUT ??
  '/private/tmp/claude-502/-Users-kyle-bocinsky-git-mt-climate-office-mesonet-dashboard/555463de-5eec-40b0-b395-8671a17ecca8/scratchpad/fidelity-next'

export const API_V2 = process.env.MESONET_V2 ?? 'https://mesonet2.climate.umt.edu/api/v2/'

/** Level for /derived (ag-api) and the Downloader `qc` (both apps default to 2). */
export const QC_LEVEL = Number(process.env.FIDELITY_LEVEL ?? 2)

/**
 * A = the current React app (web/, Plotly + Mantine), B = web-next (ECharts + Alpine).
 * `dir`/`port` let run.mjs start a Vite dev server when the URL is not answering.
 */
export const TARGETS = {
  web: {
    kind: 'web',
    label: 'web/ (React, Plotly)',
    base: process.env.WEB_URL ?? 'http://localhost:5188/mesonet-dashboard/',
    dir: WEB_DIR,
    port: 5188,
  },
  next: {
    kind: 'next',
    label: 'web-next (Alpine, ECharts)',
    base: process.env.NEXT_URL ?? 'http://localhost:5189/mesonet-dashboard/next/',
    dir: WEB_NEXT_DIR,
    port: 5189,
  },
}

/** Deep link for `target`: ?s=…&params… #tab ('latest' = no hash, web/'s default tab). Arrays join with commas (kept literal, as the apps write them). */
export function appUrl(target, station, { tab = 'latest', params = {} } = {}) {
  const q = new URLSearchParams()
  if (station) q.set('s', station)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    q.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  if (target.kind === 'next') q.set('theme', 'light')
  const qs = q.toString().replace(/%2C/g, ',')
  return `${target.base}${qs ? `?${qs}` : ''}${tab !== 'latest' ? `#${tab}` : ''}`
}

/** Station matrix (web/scripts/fidelity/select-stations.mjs output, copied). */
export function loadStations() {
  return JSON.parse(readFileSync(join(here, 'stations.json'), 'utf8')).stations
}

/**
 * Where web-next shows web/'s Latest Data since the P1 routes (DESIGN.md "Information architecture"):
 * the plot is Compare (`#charts`, cmp=1); the photo, forecast and wind rose are on Now; the map,
 * metadata and current readings on About. `figures` (roles) and `cards` (web/ card → web-next host)
 * are what that page shows; anything else web/ shows is listed as a `moved` note citing `see` (not scored).
 * `media`: Now shows the photo at camera stations and the wind rose elsewhere, so a card scenario
 * is compared only when Now shows its medium. `relabeled`: the card's rows were redesigned, so
 * label changes are documented too (values under a shared label still WARN).
 */
const SEE_COMPARE = 'DIVERGENCES "Compare loses the Latest sidebar\'s station picker, network filter, collapse and the card column"'
const SEE_ABOUT = 'DIVERGENCES "About replaces the metadata and current-conditions cards"'
const compare = (params) => ({ tab: 'charts', params: { ...params, cmp: 1 }, figures: ['timeseries'], cards: {}, see: SEE_COMPARE })
const now = (more) => ({ tab: 'now', params: {}, figures: [], see: SEE_COMPARE, ...more })
const about = (more) => ({ tab: 'about', params: {}, figures: [], see: SEE_ABOUT, ...more })

/** Latest Data scenarios (the old ui-latest set). `onlyRoles` limits a scenario to matrix roles. */
export const LATEST_SCENARIOS = [
  { id: 'default', label: 'Default (hourly, default variables)', params: {} },
  { id: 'daily-gridmet', label: 'Daily + gridMET normals', params: { agg: 'daily', gridmet: true } },
  { id: 'daily', label: 'Daily (no normals)', params: { agg: 'daily' } },
  {
    // acebento: pyranometer swap 2026-05-14, 50 cm TDR outage from 2026-05-19, 100 cm outage ending 2026-05-26
    id: 'sensor-overlay',
    onlyRoles: ['sensor-change'],
    label: 'Daily 2026-05-01..06-15 (sensor-change overlays)',
    params: { agg: 'daily', from: '2026-05-01', to: '2026-06-15' },
  },
  { id: 'raw', label: 'Raw', params: { agg: 'raw' } },
  { id: 'card-wind', label: 'Top card: Wind Rose', params: { card: 'wind' }, next: now({ media: 'wind', figures: ['windrose'], cards: { top: '[data-testid="now-media"]' } }) },
  { id: 'card-forecast', label: 'Top card: Weather Forecast', params: { card: 'forecast' }, next: now({ cards: { top: '[data-testid="now-icons"]' }, relabeled: true }) },
  { id: 'card-photo', label: 'Top card: Latest Photo', params: { card: 'photo' }, next: now({ media: 'photo', cards: { top: '[data-testid="now-media"]' } }) },
  { id: 'info-map', label: 'Bottom card: Locator Map', params: { info: 'map' }, next: about({ cards: { bottom: '[data-testid="about-map"]' }, map: '[data-testid="about-map"]' }) },
  { id: 'info-metadata', label: 'Bottom card: Station Metadata', params: { info: 'metadata' }, next: about({ cards: { bottom: '[data-testid="about-details"]' }, relabeled: true }) },
  { id: 'info-current', label: 'Bottom card: Current Conditions', params: { info: 'current' }, next: about({ cards: { bottom: '[data-testid="about-readings"]' } }) },
].map((sc) => ({ ...sc, next: sc.next ?? compare(sc.params) }))

/**
 * Ag Tools scenarios (web/ vs web-next). `days`: window ending yesterday (null = the tab default,
 * which ends today and so includes the GDD projection). `needsSwp`: has_swp stations only.
 */
export const AG_SCENARIOS = [
  { id: 'etr', params: { var: 'etr' }, days: 30 },
  { id: 'etr-hourly', params: { var: 'etr', ag_time: 'hourly' }, days: 7 },
  { id: 'gdd-wheat', params: { var: 'gdd', crop: 'wheat' }, days: 30 },
  { id: 'gdd-corn', params: { var: 'gdd', crop: 'corn' }, days: 30 },
  { id: 'gdd-default', params: { var: 'gdd' }, days: null },
  { id: 'feels-like', params: { var: 'feels_like', ag_time: 'hourly' }, days: 7 },
  { id: 'cci', params: { var: 'cci', ag_time: 'hourly' }, days: 7 },
  { id: 'cci-newborn', params: { var: 'cci', ag_time: 'hourly', lt: 'newborn' }, days: 7 },
  { id: 'swp', params: { var: 'swp' }, days: 30, needsSwp: true },
  { id: 'percent-saturation', params: { var: 'percent_saturation' }, days: 30, needsSwp: true },
  { id: 'soil-vwc', params: { var: 'soil_temp,soil_ec_blk', soilv: 'soil_vwc' }, days: 30 },
  { id: 'soil-temp', params: { var: 'soil_temp,soil_ec_blk', soilv: 'soil_temp' }, days: 30 },
  { id: 'soil-ec', params: { var: 'soil_temp,soil_ec_blk', soilv: 'soil_blk_ec' }, days: 30 },
  { id: 'annual', params: { var: 'annual' }, days: null },
  { id: 'annual-ppt', params: { var: 'annual', annv: 'ppt' }, days: null },
]

/**
 * ag-api: web-next Ag vs mesonet2 /derived (no premade, keep=true, alpha=0.23, level QC_LEVEL).
 * `outputs` picks the derived columns to compare.
 */
export const AG_API_SCENARIOS = [
  { id: 'etr', outputs: 'Reference ET', derived: { period: 'daily', elements: 'etr' }, params: { var: 'etr' } },
  { id: 'gdd-wheat', outputs: 'GDD', derived: { period: 'daily', elements: 'gdd', crop: 'wheat' }, params: { var: 'gdd', crop: 'wheat' } },
  { id: 'gdd-corn', outputs: 'GDD', derived: { period: 'daily', elements: 'gdd', crop: 'corn' }, params: { var: 'gdd', crop: 'corn' } },
  { id: 'feels-like', outputs: 'Feels', derived: { period: 'hourly', elements: 'feels_like' }, params: { var: 'feels_like', ag_time: 'hourly' } },
  { id: 'cci', outputs: 'Comprehensive|CCI', derived: { period: 'hourly', elements: 'cci' }, params: { var: 'cci', ag_time: 'hourly' } },
  { id: 'swp', outputs: 'Water Potential', derived: { period: 'daily', elements: 'swp' }, params: { var: 'swp' }, needsSwp: true },
  {
    id: 'percent-saturation',
    outputs: 'Saturation',
    derived: { period: 'daily', elements: 'percent_saturation' },
    params: { var: 'percent_saturation' },
    needsSwp: true,
  },
]

/** Downloader scenarios: period × elements over `days` ending 2 days back (no partial day). */
export const DOWNLOADER_SCENARIOS = [
  { id: 'dl-daily', period: 'daily', elements: ['air_temp_0200', 'ppt', 'rh'], days: 30 },
  { id: 'dl-hourly', period: 'hourly', elements: ['air_temp_0200', 'wind_spd', 'sol_rad'], days: 7 },
  { id: 'dl-monthly', period: 'monthly', elements: ['air_temp_0200', 'ppt'], days: 365 },
  { id: 'dl-derived', period: 'daily', elements: ['etr', 'feels_like', 'cci'], days: 30 },
]

export const TOLERANCE = {
  abs: Number(process.env.FIDELITY_ABS_TOL ?? 0.0011),
  rel: Number(process.env.FIDELITY_REL_TOL ?? 2e-4),
  /** Trailing common points whose value diffs only WARN (the two captures are seconds apart). */
  edgePoints: Number(process.env.FIDELITY_EDGE_POINTS ?? 2),
}

/** ms. The API is slow on cold paths; waits are for render evidence, bounded by these. */
export const TIMEOUTS = {
  nav: 120_000,
  render: 180_000,
  settleQuiet: 2_000,
  settleMax: 60_000,
  /** Pause between items, to be gentle with the API. */
  between: 750,
}
