/**
 * Review page script for ui/charts/demo.html: every Ag builder rendered
 * through the chart host with the golden fixtures (core/ag/__fixtures__).
 * Not part of the app build. The annual chart uses synthetic precipitation
 * (the fixtures hold no multi-year precipitation).
 */
import Alpine from 'alpinejs'
import type { DailyNormals, GddCrop } from '../../core/ag/contract'
import { cciDaily, etoDaily, etoHourly, feelsLikeDaily, feelsLikeHourly, gdd, groupByYear, percentSaturation, projectGdd, swp } from '../../core/ag/compute'
import { GDD_CUTOFFS_F } from '../../core/ag/compute/gdd'
import { profileValues } from '../../core/ag/view/derive'
import { annualAxisLabel, type SoilProfileVar } from '../../core/ag/view/labels'
import { dailyMet, hourlyMet, soilParams, soilSeries, stageTable, stationMeta } from '../../core/ag/__tests__/adapters'
import * as C from '../../core/charts'
import { isTheme } from '../../core/theme'
import { chart, type ChartBindings } from './chart'
import './chart.css'

const ST = 'acebozem'
const meta = stationMeta(ST)
const season = dailyMet(ST, 'season2025')
const winter = dailyMet(ST, 'winter2526')
const soilSeason = soilSeries(ST, 'daily', 'season2025')
const soilWinter = soilSeries(ST, 'daily', 'winter2526')
const soilJul = soilSeries(ST, 'hourly', 'jul2025')
const params = soilParams(ST)

/* GDD with a projection: observed through Aug 15, a 3-day forecast, then synthetic normals to Oct 31. */
function gddModel(crop: GddCrop, project: boolean): C.GddModel {
  const stages = stageTable(crop)
  const cut = project ? season.date.indexOf('2025-08-15') + 1 : season.date.length
  const met = { ...season, date: season.date.slice(0, cut), tminC: season.tminC.slice(0, cut), tmaxC: season.tmaxC.slice(0, cut) }
  const series = gdd(met as typeof season, { crop, stages })
  let projection
  if (project) {
    const q = (m: number) => ({ q25: m - 3, median: m, q75: m + 3 })
    const normals: DailyNormals = { station: ST, byMonthDay: {} }
    for (let d = 0; d < 366; d++) {
      const md = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000).toISOString().slice(5, 10)
      const doy = d / 365
      normals.byMonthDay[md] = { tminC: q(10 * Math.sin(Math.PI * doy) - 2), tmaxC: q(28 * Math.sin(Math.PI * doy) - 2), prMm: 0, petMm: 0 }
    }
    projection = projectGdd(series, normals, { date: ['2025-08-16', '2025-08-17', '2025-08-18'], tminC: [11, 12, 10], tmaxC: [29, 31, 27], source: 'nws' }, '2025-10-31', stages)
  }
  const [lo, hi] = GDD_CUTOFFS_F[crop]
  return {
    series,
    cutoffsF: [lo, hi],
    stageMode: stages.stages.length ? 'table' : 'no-table',
    cropLabel: crop,
    stages: stages.stages,
    projection,
  }
}

function profile(variable: SoilProfileVar, soil = soilWinter): C.SoilProfileModel {
  const pv = profileValues(variable, soil, { swp: swp(soil, params), pct: percentSaturation(soil, params) })!
  return { variable, time: soil.time, depthsCm: pv.depthsCm, values: pv.values, frozen: pv.frozen, period: soil.time[0].length > 10 ? 'hourly' : 'daily' }
}

/* Deterministic synthetic cumulative precipitation, 2019–2026. */
function annualModel(): C.AnnualModel {
  const traces = []
  for (let y = 2019; y <= 2026; y++) {
    const dates: string[] = []
    const vals: number[] = []
    const end = y === 2026 ? 273 : 365
    let seed = y * 7919
    for (let d = 0; d < end; d++) {
      dates.push(new Date(Date.UTC(y, 0, 1 + d)).toISOString().slice(0, 10))
      seed = (seed * 16807) % 2147483647
      vals.push(seed % 9 === 0 ? (seed % 100) / 180 : 0)
    }
    traces.push(...groupByYear(dates, vals, { cumulative: true }))
  }
  return { traces, yLabel: annualAxisLabel('Total Precipitation [in]', true), currentYear: 2026 }
}

interface DemoChart {
  id: string
  title: string
  bind: ChartBindings<never>
}

/*
 * URL round trip, as the Latest tab will do it: ?z=fromMs,toMs drives `range` for the ETr chart and
 * the season SWP heatmap (a category axis), and either chart's onZoom writes it back.
 */
const zParam = new URLSearchParams(location.search).get('z')?.split(',').map(Number)
const sync = Alpine.reactive({ range: zParam?.length === 2 && zParam.every(Number.isFinite) ? (zParam as [number, number]) : null, calls: 0 })
const syncBindings = {
  range: () => sync.range,
  onZoom: (a: number, b: number) => {
    sync.calls++
    sync.range = [a, b]
    const u = new URL(location.href)
    u.searchParams.set('z', `${a},${b}`)
    history.replaceState(null, '', u)
    document.getElementById('zoom-readout')!.textContent = `${new Date(a).toISOString().slice(0, 16)} → ${new Date(b).toISOString().slice(0, 16)} (onZoom calls: ${sync.calls})`
  },
}

const bind = <M>(builder: C.ChartBuilder<M>, table: (m: M) => C.ChartTable, label: string, model: M, extra: Partial<ChartBindings<M>> = {}) =>
  ({ builder, table, label, model: () => model, ...extra }) as unknown as ChartBindings<never>

const CHARTS: DemoChart[] = [
  { id: 'etr', title: 'Reference ET — daily, season 2025 (zoom synced with the SWP heatmap via ?z=)', bind: bind(C.etrChart, C.etrTable, 'Reference ET', { series: etoDaily(season, meta), period: 'daily' }, syncBindings) },
  { id: 'etr-h', title: 'Reference ET — hourly, Jul 2025', bind: bind(C.etrChart, C.etrTable, 'Hourly reference ET', { series: etoHourly(hourlyMet(ST, 'jul2025'), meta), period: 'hourly' }) },
  { id: 'fl', title: 'Feels like — daily, winter 2025–26', bind: bind(C.feelsLikeChart, C.feelsLikeTable, 'Feels-like temperature', { series: feelsLikeDaily(winter), period: 'daily' }) },
  { id: 'fl-h', title: 'Feels like — hourly, Jul 2025', bind: bind(C.feelsLikeChart, C.feelsLikeTable, 'Hourly feels-like temperature', { series: feelsLikeHourly(hourlyMet(ST, 'jul2025')), period: 'hourly' }) },
  { id: 'cci-a', title: 'Livestock risk (adult) — winter 2025–26', bind: bind(C.cciChart, C.cciTable, 'Livestock risk, adult', { series: cciDaily(winter, 'adult'), period: 'daily' }) },
  { id: 'cci-n', title: 'Livestock risk (newborn) — winter 2025–26', bind: bind(C.cciChart, C.cciTable, 'Livestock risk, newborn', { series: cciDaily(winter, 'newborn'), period: 'daily' }) },
  { id: 'gdd', title: 'GDD — wheat, with projection (observed to Aug 15)', bind: bind(C.gddChart, C.gddTable, 'Growing degree days, wheat', gddModel('wheat', true)) },
  { id: 'gdd-c', title: 'GDD — corn (no stage table)', bind: bind(C.gddChart, C.gddTable, 'Growing degree days, corn', gddModel('corn', false)) },
  { id: 'sp-t', title: 'Soil profile — temperature, winter', bind: bind(C.soilProfileChart, C.soilProfileTable, 'Soil temperature profile', profile('soil_temp')) },
  { id: 'sp-v', title: 'Soil profile — VWC, winter (frozen mask)', bind: bind(C.soilProfileChart, C.soilProfileTable, 'Soil VWC profile', profile('soil_vwc')) },
  { id: 'sp-s', title: 'Soil profile — SWP, winter (frozen mask)', bind: bind(C.soilProfileChart, C.soilProfileTable, 'Soil water potential profile', profile('swp')) },
  { id: 'sp-ss', title: 'Soil profile — SWP, season 2025 (zoom synced with ETr)', bind: bind(C.soilProfileChart, C.soilProfileTable, 'Soil water potential profile, season', profile('swp', soilSeason), syncBindings) },
  { id: 'sp-p', title: 'Soil profile — percent saturation, hourly Jul 2025', bind: bind(C.soilProfileChart, C.soilProfileTable, 'Percent saturation profile', profile('percent_saturation', soilJul)) },
  { id: 'swp', title: 'Soil water potential — daily, season 2025', bind: bind(C.swpChart, C.swpTable, 'Soil water potential by depth', { series: swp(soilSeason, params), period: 'daily' }) },
  { id: 'swp-h', title: 'Soil water potential — hourly, Jul 2025', bind: bind(C.swpChart, C.swpTable, 'Hourly soil water potential', { series: swp(soilJul, params), period: 'hourly' }) },
  { id: 'ps', title: 'Percent saturation — daily, season 2025', bind: bind(C.percentSaturationChart, C.percentSaturationTable, 'Percent saturation by depth', { series: percentSaturation(soilSeason, params), period: 'daily' }) },
  { id: 'annual', title: 'Annual comparison — cumulative precipitation (synthetic)', bind: bind(C.annualChart, C.annualTable, 'Annual cumulative precipitation', annualModel()) },
]

Alpine.data('chart', chart)
Alpine.data('demoPage', () => ({
  list: () => CHARTS,
  setTheme(t: string) {
    if (!isTheme(t)) return
    MCO.setTheme(t, { persist: false })
    const u = new URL(location.href)
    u.searchParams.set('theme', t)
    history.replaceState(null, '', u)
  },
}))
Alpine.start()
