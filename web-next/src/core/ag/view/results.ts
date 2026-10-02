/**
 * What each Ag Tools chart card shows: loaded data (contract shapes) →
 * `AgView` = status + message + notes + the chart model. The ui/ag
 * components fetch, call these, and hand `model` to the chart host.
 * Ported from web/src/features/ag/ui/AgVariableView.tsx (same texts).
 */
import type { AnnualModel, CciModel, EtrModel, FeelsLikeModel, GddModel, PercentSaturationModel, SoilProfileModel, SwpModel } from '../../charts'
import type { DailyMet, DailyNormals, GddStageTable, HourlyMet, LocalDate, SoilParams, SoilSeries, StationMeta } from '../contract'
import { cciDaily, cciHourly, etoDaily, etoHourly, feelsLikeDaily, feelsLikeHourly, fToC, gdd, GDD_CUTOFFS_F, percentSaturation, projectGdd } from '../compute'
import type { AnnualDaily, ForecastResult } from '../data'
import type { RawRow } from '../data/parse'
import { annualTraces, coverage, partialNote, profileValues, unavailableMessage } from './derive'
import type { Period, SoilProfileVar } from './labels'
import { POROSITY_SOURCE, percentSaturationFromApiPorosity } from './porositySource'
import { SWP_SOURCE, swpFromApiRows, swpFromParams } from './swpSource'
import type { AgTab, AgVariable } from './tab'

export type ViewStatus = 'loading' | 'error' | 'empty' | 'ready'

export interface AgView<M> {
  status: ViewStatus
  /** Error or empty-state text. */
  message: string | null
  /** Short notes shown above the chart (missing sensors, projection basis, …). */
  notes: string[]
  model: M | null
}

/** The part of a `$store.data` Resource these functions read. */
export interface Loaded<T> {
  status: 'loading' | 'success' | 'error'
  data: T | undefined
  error: unknown
}

const view = <M>(status: ViewStatus, message: string | null, notes: string[] = [], model: M | null = null): AgView<M> => ({
  status,
  message,
  notes,
  model,
})
export const emptyView = <M>(message: string, notes: string[] = []) => view<M>('empty', message, notes)
const ready = <M>(model: M, notes: string[]) => view<M>('ready', null, notes, model)

export function errorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Failed to load data for this selection.'
}

/** Loading / error view while any needed resource has no data yet; null once all have loaded. */
export function gate<M>(resources: (Loaded<unknown> | null | undefined)[]): AgView<M> | null {
  const rs = resources.filter((r): r is Loaded<unknown> => !!r)
  const failed = rs.find((r) => r.status === 'error' && r.data === undefined)
  if (rs.some((r) => r.status === 'loading' && r.data === undefined)) return view('loading', null)
  if (failed) return view('error', errorText(failed.error))
  return null
}

/* ------------------------------------------------- ETr / feels / CCI */

export type MetChart =
  | { kind: 'etr'; model: EtrModel }
  | { kind: 'feels_like'; model: FeelsLikeModel }
  | { kind: 'cci'; model: CciModel }

export function metView(
  variable: 'etr' | 'feels_like' | 'cci',
  period: Period,
  livestock: 'adult' | 'newborn',
  met: DailyMet | HourlyMet,
  meta: StationMeta | undefined,
): AgView<MetChart> {
  const needs = variable === 'feels_like' ? (['temperature'] as const) : (['temperature', 'humidity', 'solar', 'wind'] as const)
  const cov = coverage(met, [...needs])
  const what = variable === 'etr' ? 'ETr' : variable === 'cci' ? 'the risk index' : 'feels-like'
  const notes: string[] = []
  const partial = partialNote(cov, period, what)
  if (partial) notes.push(partial)
  const empty = unavailableMessage(cov)
  if (empty) return emptyView(empty, notes)
  const daily = 'date' in met
  if (variable === 'etr') {
    if (!meta) return view('loading', null)
    const series = daily ? etoDaily(met, meta) : etoHourly(met as HourlyMet, meta)
    if (meta.windHeightM !== 10) {
      notes.push(`Wind measured at ${meta.windHeightM === 2.44 ? '8 ft' : `${meta.windHeightM} m`}; adjusted to 2 m for ETr.`)
    }
    return ready({ kind: 'etr', model: { series, period } }, notes)
  }
  if (variable === 'feels_like') {
    const series = daily ? feelsLikeDaily(met) : feelsLikeHourly(met as HourlyMet)
    return ready({ kind: 'feels_like', model: { series, period } }, notes)
  }
  const series = daily ? cciDaily(met, livestock) : cciHourly(met as HourlyMet, livestock)
  return ready({ kind: 'cci', model: { series, period } }, notes)
}

/* ------------------------------------------------------------------ GDD */

export interface GddInputs {
  tab: Pick<AgTab, 'crop' | 'cropLabel' | 'cut' | 'gddProj'>
  met: DailyMet
  table: GddStageTable | undefined
  /** Projection end (projectionThrough), or null for none. */
  through: LocalDate | null
  /** undefined = still loading; null = the station has no normals. */
  normals: DailyNormals | null | undefined
  forecast: ForecastResult | undefined
}

export function gddView({ tab, met, table, through, normals, forecast }: GddInputs): AgView<GddModel> {
  const cov = coverage(met, ['temperature'])
  const empty = unavailableMessage(cov)
  if (empty) return emptyView(empty)
  const { crop, cropLabel, cut } = tab
  const custom = cut.custom
  const hasTable = !!table && table.stages.length > 0
  const series = custom
    ? gdd(met, { crop, lowC: cut.loF != null ? fToC(cut.loF) : undefined, highC: cut.hiF != null ? fToC(cut.hiF) : undefined })
    : gdd(met, { crop, stages: table })
  const crops = GDD_CUTOFFS_F[crop]
  const notes: string[] = []
  if (custom) {
    notes.push('Custom temperature cutoffs: growth-stage labels are not shown (stage tables assume the crop’s own cutoffs).')
  } else if (!hasTable) {
    notes.push(`No stage table for ${cropLabel.toLowerCase()}: daily and cumulative GDDs only.`)
  }
  if (series.ndawnSwitch) {
    const hi = GDD_CUTOFFS_F[`${crop as 'wheat' | 'barley'}2`][1]
    notes.push(`${cropLabel} follows NDAWN: ${crops[0]}–${crops[1]} °F until Haun stage 2, then ${crops[0]}–${hi} °F.`)
  }
  const partial = partialNote(cov, 'daily', 'GDD')
  if (partial) notes.push(partial)

  let projection
  if (through) {
    if (normals) {
      const fc = forecast?.status === 'ok' ? forecast.forecast : undefined
      projection = projectGdd(series, normals, fc, through, custom ? undefined : table)
      if (forecast?.status === 'degraded') {
        notes.push('NWS forecast unavailable right now; the projection uses 1991–2020 normals only.')
      } else if (fc) {
        notes.push(
          `Projection through ${through}: NWS forecast for the next ${fc.date.length} days, then the 1991–2020 gridMET normals median (band: 25th–75th percentile).`,
        )
      }
    } else if (normals === null) {
      notes.push('No climate normals for this station, so no projection is shown.')
    }
  } else if (tab.gddProj !== 'off' && met.date.length > 0) {
    notes.push('The projection is shown when the date range ends today.')
  }
  return ready(
    {
      series,
      cutoffsF: custom ? [cut.loF ?? crops[0], cut.hiF ?? crops[1]] : [crops[0], crops[1]],
      stageMode: custom ? 'custom' : hasTable ? 'table' : 'no-table',
      cropLabel,
      stages: custom || !hasTable ? undefined : table.stages,
      projection,
    },
    notes,
  )
}

/* ----------------------------------------------------------------- Soil */

export type SoilChart =
  | { kind: 'profile'; model: SoilProfileModel }
  | { kind: 'swp'; model: SwpModel }
  | { kind: 'percent_saturation'; model: PercentSaturationModel }

/** The sub-variable a soil card draws: the profile's chip, or the variable itself. */
export const soilSub = (variable: AgVariable, soilVar: SoilProfileVar): SoilProfileVar =>
  variable === 'swp' || variable === 'percent_saturation' ? variable : soilVar

export interface SoilInputs {
  variable: 'soil_temp,soil_ec_blk' | 'swp' | 'percent_saturation'
  soilVar: SoilProfileVar
  period: Period
  soil: SoilSeries
  /** `/derived?elements=swp` rows (SWP_SOURCE 'api'). */
  swpRows?: RawRow[]
  /** `/derived?elements=percent_saturation&keep=true` rows (POROSITY_SOURCE 'api'). */
  porosityRows?: RawRow[]
  /** Station soil parameters, for the client SWP / vendored porosity paths. */
  params?: SoilParams[]
}

export function soilView(i: SoilInputs): AgView<SoilChart> {
  const { soil, period } = i
  const sub = soilSub(i.variable, i.soilVar)
  if (soil.time.length === 0 || soil.depthsCm.length === 0) return emptyView('No soil data for the current selection.')
  const swp =
    sub !== 'swp' ? undefined : SWP_SOURCE === 'api' ? i.swpRows && swpFromApiRows(i.swpRows, soil, period) : i.params && swpFromParams(soil, i.params)
  const pct =
    sub !== 'percent_saturation'
      ? undefined
      : POROSITY_SOURCE === 'api'
        ? i.porosityRows && percentSaturationFromApiPorosity(i.porosityRows, soil, period)
        : i.params && percentSaturation(soil, i.params)
  if (sub === 'swp' && !swp) return view('loading', null)
  if (sub === 'percent_saturation' && !pct) return view('loading', null)
  if (pct && pct.depthsCm.length === 0) {
    return emptyView('No soil porosity parameters for this station, so percent saturation is unavailable.')
  }
  if (swp && (swp.depthsCm.length === 0 || !swp.kPa.some((c) => c.some((v) => v != null && v > 0)))) {
    return emptyView('No soil water potential for this station and period.')
  }
  const notes: string[] = []
  if (pct) {
    notes.push(
      POROSITY_SOURCE === 'api'
        ? 'Percent saturation uses the Mesonet API’s soil porosity for each depth.'
        : 'Percent saturation uses published mesonet-soils porosity for each depth.',
    )
  }
  if (swp) {
    notes.push(
      SWP_SOURCE === 'api'
        ? 'Soil water potential is computed by the Mesonet API from its soil parameters.'
        : 'Soil water potential is computed in the browser from published mesonet-soils parameters.',
    )
  }
  if (i.variable === 'swp' && swp) return ready({ kind: 'swp', model: { series: swp, period } }, notes)
  if (i.variable === 'percent_saturation' && pct) {
    return ready({ kind: 'percent_saturation', model: { series: pct, period } }, notes)
  }
  const v = profileValues(sub, soil, { swp, pct })
  if (!v || v.depthsCm.length === 0) return emptyView('This station has no data for the selected soil variable in this period.', notes)
  if (v.anyFrozen) {
    notes.push(
      'Grey cells: frozen soil (soil temperature ≤ 32 °F). Water content, EC, saturation and water potential are hidden there because frozen-soil readings are not reliable.',
    )
  }
  const model: SoilProfileModel = { variable: sub, time: soil.time, depthsCm: v.depthsCm, values: v.values, frozen: v.frozen, period }
  return ready({ kind: 'profile', model }, notes)
}

/* --------------------------------------------------------------- Annual */

/** Years to request, newest first: from the install year (or 5 years back) to `currentYear`. */
export function annualYears(dateInstalled: string | null | undefined, currentYear: number): number[] {
  const y = Number(String(dateInstalled ?? '').slice(0, 4))
  const first = Number.isFinite(y) && y > 2000 && y <= currentYear ? y : currentYear - 5
  return Array.from({ length: currentYear - first + 1 }, (_, i) => currentYear - i)
}

/** Per-year resources (in `years` order) → the progressive annual view. */
export function annualView(
  element: string | null,
  years: number[],
  results: Loaded<AnnualDaily>[],
  currentYear: number,
): AgView<AnnualModel> {
  if (!element) return emptyView('Select a comparison variable to continue.')
  const loaded = results.flatMap((r) => (r.data ? [r.data] : []))
  const pending = results.filter((r) => r.status === 'loading' && !r.data).length
  const failed = years.filter((_, i) => results[i]?.status === 'error' && !results[i]?.data)
  const notes: string[] = []
  if (pending > 0) notes.push(`Loading ${pending} of ${years.length} years…`)
  if (failed.length > 0) notes.push(`Could not load ${failed.join(', ')}.`)
  const a = loaded.length > 0 ? annualTraces(element, loaded) : null
  if (a && a.traces.length > 0) return ready({ traces: a.traces, yLabel: a.yLabel, currentYear }, notes)
  if (pending > 0) return view('loading', null, notes)
  if (failed.length === years.length && years.length > 0) return view('error', errorText(results[0]?.error), notes)
  return emptyView('No data for this variable at this station.', notes)
}

/* ------------------------------------------------------- announcements */

/** Live-region text for a settled view (null while loading). */
export function viewAnnouncement(label: string, v: Pick<AgView<unknown>, 'status' | 'message'>, where: string): string | null {
  if (v.status === 'loading') return null
  if (v.status === 'ready') return `${label} chart updated for ${where}.`
  return `${label}: ${v.message ?? ''}`.trim()
}
