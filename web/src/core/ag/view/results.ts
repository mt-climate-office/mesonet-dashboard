/**
 * What each Ag Tools chart card shows: loaded data (contract shapes) →
 * `AgView` = status + message + notes + the chart model. The ui/ag
 * components fetch, call these, and hand `model` to the chart host.
 * Ported from web/src/features/ag/ui/AgVariableView.tsx (same texts).
 */
import type { AnnualModel, CciModel, EtrModel, FeelsLikeModel, GddModel, PercentSaturationModel, SoilProfileModel, SwpModel } from '../../charts'
import type { DailyMet, DailyNormals, GddStageTable, HourlyMet, LocalDate, SoilParams, SoilSeries, StationMeta } from '../contract'
import { cciDailyRange, cciHourly, etoDaily, etoHourly, feelsLikeDailyRange, feelsLikeHourly, fToC, gdd, GDD_CUTOFFS_F, percentSaturation, projectGdd, swp as swpFromParams } from '../compute'
import type { AnnualDaily, ForecastResult } from '../data'
import { annualTraces, coverage, partialNote, profileValues, unavailableMessage } from './derive'
import { type Period, type SoilProfileVar, SWP_CAP_BAR, dropCappedDepths, swpBar } from './labels'
import type { AgTab, AgVariable } from './tab'
import { NOT_PROJECTABLE } from './projection'
import { loadErrorText } from '../../loadError'
import { latestVariableForColumn } from '../../params'

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

/** The error view's text (partials/load-error.html): what failed and why (core/loadError). */
export const errorText = (err: unknown): string => loadErrorText('This chart', err)

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

/** Why daily feels-like and livestock risk are not daily means (the ⓘ note). */
export const DAILY_RANGE_NOTE = 'Daily values are each day’s highest and lowest hourly reading, so afternoon heat and pre-dawn cold are not averaged away.'

/**
 * ETr from daily or hourly rows as `period`; feels-like and livestock risk always from hourly rows
 * (`met` must be HourlyMet): hourly as is, daily as each day's high and low hour.
 */
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
  const daily = 'date' in met
  const partial = partialNote(cov, daily ? 'daily' : 'hourly', what)
  if (partial) notes.push(partial)
  const empty = unavailableMessage(cov)
  if (empty) return emptyView(empty, notes)
  if (variable === 'etr') {
    if (!meta) return view('loading', null)
    const series = daily ? etoDaily(met, meta) : etoHourly(met as HourlyMet, meta)
    if (meta.windHeightM !== 10) {
      notes.push(`Wind measured at ${meta.windHeightM === 2.44 ? '8 ft' : `${meta.windHeightM} m`}; adjusted to 2 m for ETr.`)
    }
    return ready({ kind: 'etr', model: { series, period } }, notes)
  }
  const hourly = met as HourlyMet
  if (period === 'daily') notes.push(DAILY_RANGE_NOTE)
  if (variable === 'feels_like') {
    const model: FeelsLikeModel =
      period === 'daily' ? { range: feelsLikeDailyRange(hourly), period: 'daily' } : { series: feelsLikeHourly(hourly), period }
    return ready({ kind: 'feels_like', model }, notes)
  }
  const model: CciModel =
    period === 'daily' ? { range: cciDailyRange(hourly, livestock), period: 'daily' } : { series: cciHourly(hourly, livestock), period }
  return ready({ kind: 'cci', model }, notes)
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
    notes.push(NOT_PROJECTABLE)
  }
  return ready(
    {
      series,
      cutoffsF: custom ? [cut.loF ?? crops[0], cut.hiF ?? crops[1]] : [crops[0], crops[1]],
      ...(series.ndawnSwitch ? { switchHighF: GDD_CUTOFFS_F[`${crop as 'wheat' | 'barley'}2`][1] } : {}),
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
  /** Station soil parameters (mesonet-soils), for SWP and percent saturation. */
  params?: SoilParams[]
}

export function soilView(i: SoilInputs): AgView<SoilChart> {
  const { soil, period } = i
  const sub = soilSub(i.variable, i.soilVar)
  if (soil.time.length === 0 || soil.depthsCm.length === 0) return emptyView('No soil data for the current selection.')
  const swpAll = sub === 'swp' && i.params ? swpFromParams(soil, i.params) : undefined
  // The line chart leaves out a depth on the cap for (nearly) the whole window; the profile keeps it.
  const capped = swpAll && i.variable === 'swp' ? dropCappedDepths(swpAll) : undefined
  const swp = capped?.series ?? swpAll
  const pct = sub === 'percent_saturation' && i.params ? percentSaturation(soil, i.params) : undefined
  if (sub === 'swp' && !swp) return view('loading', null)
  if (sub === 'percent_saturation' && !pct) return view('loading', null)
  if (pct && pct.depthsCm.length === 0) {
    return emptyView('No soil porosity parameters for this station, so percent saturation is unavailable.')
  }
  if (swpAll && (swpAll.depthsCm.length === 0 || !swpAll.kPa.some((c) => c.some((v) => v != null && v > 0)))) {
    return emptyView('No soil water potential for this station and period.')
  }
  if (swp && swp.depthsCm.length === 0) {
    return emptyView(`Every depth is drier than -${SWP_CAP_BAR.toLocaleString('en-US')} bar for this period.`, capped?.notes)
  }
  const notes: string[] = [...(capped?.notes ?? [])]
  if (pct) notes.push('Soil saturation uses published mesonet-soils porosity for each depth.')
  if (swp) notes.push('Soil water potential is computed in the browser from published mesonet-soils parameters.')
  if (swp && swpBar(swp).dry.some((col) => col.some(Boolean))) {
    notes.push(
      `Dotted lines: the soil is drier than the driest lab sample, so the true suction is at least the value shown (drawn no deeper than -${SWP_CAP_BAR.toLocaleString('en-US')} bar).`,
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

/** Annual card while the station's element list is loading or failed; null once loaded. */
export function elementsGate<M>(res: Loaded<unknown>): AgView<M> | null {
  if (res.data !== undefined) return null
  return res.status === 'error' ? view('error', loadErrorText("This station's variables", res.error)) : view('loading', null)
}

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
  if (a && a.traces.length > 0) {
    // The y-axis rule's family (charts/style): a running total starts at zero, as precipitation.
    const variable = a.cumulative ? 'Precipitation' : (latestVariableForColumn(a.header ?? '') ?? undefined)
    return ready({ traces: a.traces, yLabel: a.yLabel, currentYear, variable }, notes)
  }
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
