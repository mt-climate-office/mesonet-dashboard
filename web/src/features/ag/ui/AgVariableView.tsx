/**
 * One view per Ag Tools variable. Each view pulls raw observations through
 * the data hooks (QC level 2), computes client-side with the compute library
 * and draws with the figure builders. The only `/derived` request is soil
 * water potential (see ./swpSource.ts).
 *
 * This module is the Ag feature's lazy chunk: AgToolsTab imports it with
 * `lazy()`, so compute/data/figures and Plotly load only on the Ag tab.
 */
import { type ReactNode, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { Station } from '../../../lib/api/types'
import type { GddCrop } from '../contract'
import {
  cciDaily,
  cciHourly,
  etoDaily,
  etoHourly,
  feelsLikeDaily,
  feelsLikeHourly,
  fToC,
  gdd,
  GDD_CUTOFFS_F,
  percentSaturation,
  projectGdd,
} from '../compute'
import {
  type AnnualDaily,
  DEFAULT_AG_LEVEL,
  getAnnualDaily,
  useDailyMet,
  useForecastDaily,
  useGddStages,
  useHourlyMet,
  useNormals,
  useSoilParams,
  useSoilSeries,
  useStationMeta,
} from '../data'
import { denverToday } from '../data/parse'
import {
  annualFigure,
  cciFigure,
  etoFigure,
  feelsLikeFigure,
  gddFigure,
  percentSaturationFigure,
  type SoilProfileVar,
  soilProfileFigure,
  swpFigure,
} from '../figures'
import type { GddProjHorizon } from '../../../lib/url-state'
import { AgChart } from './AgChart'
import { annualTraces, coverage, partialNote, profileValues, unavailableMessage } from './derive'
import { projectionThrough } from './projection'
import { SWP_SOURCE, useSwpSeries } from './swpSource'

export type AgVariable =
  | 'etr'
  | 'feels_like'
  | 'cci'
  | 'gdd'
  | 'soil_temp,soil_ec_blk'
  | 'swp'
  | 'percent_saturation'
  | 'annual'

export interface AgViewProps {
  variable: AgVariable
  station: string
  stationInfo: Station | undefined
  start: string
  end: string
  period: 'daily' | 'hourly'
  livestock: 'adult' | 'newborn'
  crop: GddCrop
  cropLabel: string
  /** Custom cutoffs (°F); both null → the crop's. */
  gddLoF: number | null
  gddHiF: number | null
  gddProj: GddProjHorizon
  soilVar: SoilProfileVar
  annualVar: string | null
}

/* ------------------------------------------------- ETr / feels / CCI */

function MetView(props: AgViewProps & { variable: 'etr' | 'feels_like' | 'cci' }) {
  const { variable, station, start, end, period, livestock } = props
  const q = useMemo(() => ({ station, start, end }), [station, start, end])
  const daily = useDailyMet(period === 'daily' ? q : null)
  const hourly = useHourlyMet(period === 'hourly' ? q : null)
  const meta = useStationMeta(variable === 'etr' ? station : null)
  const met = period === 'daily' ? daily : hourly

  const result = useMemo(() => {
    const data = met.data
    if (!data) return null
    if (variable === 'etr' && !meta.data) return null
    const needs =
      variable === 'feels_like'
        ? (['temperature'] as const)
        : (['temperature', 'humidity', 'solar', 'wind'] as const)
    const cov = coverage(data, [...needs])
    const empty = unavailableMessage(cov)
    const what = variable === 'etr' ? 'ETr' : variable === 'cci' ? 'the risk index' : 'feels-like'
    const notes: ReactNode[] = []
    const partial = partialNote(cov, period, what)
    if (partial) notes.push(partial)
    if (empty) return { empty, notes }
    if (variable === 'etr') {
      const s = 'date' in data ? etoDaily(data, meta.data!) : etoHourly(data, meta.data!)
      if (meta.data!.windHeightM !== 10)
        notes.push(`Wind measured at ${meta.data!.windHeightM === 2.44 ? '8 ft' : `${meta.data!.windHeightM} m`}; adjusted to 2 m for ETr.`)
      return { figure: etoFigure(s, period), notes }
    }
    if (variable === 'feels_like') {
      const s = 'date' in data ? feelsLikeDaily(data) : feelsLikeHourly(data)
      return { figure: feelsLikeFigure(s, period), notes }
    }
    const s = 'date' in data ? cciDaily(data, livestock) : cciHourly(data, livestock)
    return { figure: cciFigure(s, period), notes }
  }, [met.data, meta.data, variable, period, livestock])

  return (
    <AgChart
      loading={met.isLoading || (variable === 'etr' && meta.isLoading)}
      error={met.error ?? (variable === 'etr' ? meta.error : null)}
      empty={result?.empty}
      figure={result?.figure}
      notes={result?.notes}
    />
  )
}

/* ------------------------------------------------------------------ GDD */

function GddView(props: AgViewProps) {
  const { station, stationInfo, start, end, crop, cropLabel, gddLoF, gddHiF, gddProj } = props
  const q = useMemo(() => ({ station, start, end }), [station, start, end])
  const met = useDailyMet(q)
  const stages = useGddStages(crop)
  const custom = gddLoF != null || gddHiF != null
  const today = denverToday()
  const lastObserved = met.data?.date.at(-1)
  const through = projectionThrough(lastObserved, gddProj, today)
  const normals = useNormals(through ? station : null)
  const lat = through ? Number(stationInfo?.latitude) : null
  const lon = through ? Number(stationInfo?.longitude) : null
  const forecast = useForecastDaily(Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null)

  const result = useMemo(() => {
    if (!met.data || !stages.data) return null
    const cov = coverage(met.data, ['temperature'])
    const empty = unavailableMessage(cov)
    if (empty) return { empty, notes: [] as ReactNode[] }
    const table = stages.data.table
    const hasTable = !!table && table.stages.length > 0
    const series = custom
      ? gdd(met.data, {
          crop,
          lowC: gddLoF != null ? fToC(gddLoF) : undefined,
          highC: gddHiF != null ? fToC(gddHiF) : undefined,
        })
      : gdd(met.data, { crop, stages: table })
    const crops = GDD_CUTOFFS_F[crop]
    const cutoffsF: [number, number] = custom
      ? [gddLoF ?? crops[0], gddHiF ?? crops[1]]
      : [crops[0], crops[1]]
    const notes: ReactNode[] = []
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
      if (normals.data) {
        const fc = forecast.data?.status === 'ok' ? forecast.data.forecast : undefined
        projection = projectGdd(series, normals.data, fc, through, custom ? undefined : table)
        if (forecast.data?.status === 'degraded') {
          notes.push('NWS forecast unavailable right now; the projection uses 1991–2020 normals only.')
        } else if (fc) {
          notes.push(`Projection through ${through}: NWS forecast for the next ${fc.date.length} days, then the 1991–2020 gridMET normals median (band: 25th–75th percentile).`)
        }
      } else if (normals.data === null) {
        notes.push('No climate normals for this station, so no projection is shown.')
      }
    } else if (gddProj !== 'off' && lastObserved) {
      notes.push('The projection is shown when the date range ends today.')
    }
    return {
      figure: gddFigure(series, {
        cutoffsF,
        stageMode: custom ? 'custom' : hasTable ? 'table' : 'no-table',
        cropLabel,
        projection,
      }),
      notes,
    }
  }, [met.data, stages.data, custom, crop, cropLabel, gddLoF, gddHiF, through, normals.data, forecast.data, gddProj, lastObserved])

  return (
    <AgChart
      loading={met.isLoading || stages.isLoading}
      error={met.error ?? stages.error}
      empty={result?.empty}
      figure={result?.figure}
      notes={result?.notes}
    />
  )
}

/* ----------------------------------------------------------------- Soil */

function SoilView(props: AgViewProps & { variable: 'soil_temp,soil_ec_blk' | 'swp' | 'percent_saturation' }) {
  const { variable, station, start, end } = props
  const isProfile = variable === 'soil_temp,soil_ec_blk'
  // The profile heatmap is daily (legacy hides the time toggle there).
  const period = isProfile ? 'daily' : props.period
  const sub: SoilProfileVar = isProfile ? props.soilVar : variable
  const q = useMemo(() => ({ station, start, end, period }), [station, start, end, period])
  const soil = useSoilSeries(q)
  const needsSwp = sub === 'swp'
  const needsPct = sub === 'percent_saturation'
  const swpQ = useSwpSeries(soil.data, needsSwp ? q : null)
  const params = useSoilParams(needsPct ? station : null)

  const result = useMemo(() => {
    const s = soil.data
    if (!s) return null
    if (s.time.length === 0 || s.depthsCm.length === 0) return { empty: 'No soil data for the current selection.' }
    const pct = needsPct && params.data ? percentSaturation(s, params.data.rows) : undefined
    if (needsPct && pct && pct.depthsCm.length === 0)
      return { empty: 'No soil porosity parameters for this station, so percent saturation is unavailable.' }
    if (needsSwp && swpQ.data && swpQ.data.depthsCm.length === 0)
      return { empty: 'No soil water potential for this station and period.' }
    const notes: ReactNode[] = []
    if (needsSwp)
      notes.push(
        SWP_SOURCE === 'api'
          ? 'Soil water potential is computed by the Mesonet API from its soil parameters.'
          : 'Soil water potential is computed in the browser from published mesonet-soils parameters.',
      )
    if (!isProfile) {
      if (needsSwp && swpQ.data) return { figure: swpFigure(swpQ.data, period), notes }
      if (needsPct && pct) return { figure: percentSaturationFigure(pct, period), notes }
      return null
    }
    const v = profileValues(sub, s, { swp: swpQ.data, pct })
    if (!v) return null
    if (v.anyFrozen)
      notes.push('Grey cells: frozen soil (soil temperature ≤ 32 °F). Water content, EC, saturation and water potential are hidden there because frozen-soil readings are not reliable.')
    const figure = soilProfileFigure({ variable: sub, time: s.time, depthsCm: v.depthsCm, values: v.values, frozen: v.frozen, period })
    if (figure.data.length === 0) return { empty: 'This station has no data for the selected soil variable in this period.' }
    return { figure, notes }
  }, [soil.data, needsPct, needsSwp, params.data, swpQ.data, isProfile, sub, period])

  return (
    <AgChart
      loading={soil.isLoading || (needsSwp && swpQ.isLoading) || (needsPct && params.isLoading)}
      error={soil.error ?? (needsSwp ? swpQ.error : null) ?? (needsPct ? params.error : null)}
      empty={result?.empty}
      figure={result?.figure}
      notes={result?.notes}
    />
  )
}

/* --------------------------------------------------------------- Annual */

function AnnualView({ station, stationInfo, annualVar }: AgViewProps) {
  const currentYear = Number(denverToday().slice(0, 4))
  const firstYear = useMemo(() => {
    const y = Number(String(stationInfo?.date_installed ?? '').slice(0, 4))
    return Number.isFinite(y) && y > 2000 && y <= currentYear ? y : currentYear - 5
  }, [stationInfo?.date_installed, currentYear])
  const years = useMemo(
    () => Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i),
    [firstYear, currentYear],
  )
  // One query per year (newest first) so years render as they arrive; the
  // key matches useAnnualDaily for a single year.
  const results = useQueries({
    queries: years.map((year) => ({
      queryKey: ['ag', 'annual', station, annualVar, undefined, DEFAULT_AG_LEVEL, String(year)],
      queryFn: () => getAnnualDaily(station, annualVar!, [year], { level: DEFAULT_AG_LEVEL }),
      enabled: !!annualVar,
      staleTime: 10 * 60 * 1000,
    })),
  })
  const loaded = results.flatMap((r) => (r.data ? [r.data as AnnualDaily] : []))
  const loadedKey = results.map((r) => r.dataUpdatedAt).join(',')
  const failed = years.filter((_, i) => results[i].isError)
  const pending = results.filter((r) => r.isLoading).length

  const result = useMemo(() => {
    if (!annualVar || loaded.length === 0) return null
    const a = annualTraces(annualVar, loaded)
    if (a.traces.length === 0) return null
    return { figure: annualFigure(a.traces, { yLabel: a.yLabel, currentYear }), a }
    // loadedKey tracks the per-year results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualVar, loadedKey, currentYear])

  if (!annualVar) return <AgChart empty="Select a comparison variable to continue." />
  const notes: ReactNode[] = []
  if (pending > 0) notes.push(`Loading ${pending} of ${years.length} years…`)
  if (failed.length > 0) notes.push(`Could not load ${failed.join(', ')}.`)
  return (
    <AgChart
      loading={!result && pending > 0}
      error={!result && pending === 0 && failed.length === years.length ? results[0].error : null}
      empty={!result && pending === 0 ? 'No data for this variable at this station.' : null}
      figure={result?.figure}
      notes={notes}
    />
  )
}

/* ------------------------------------------------------------- dispatch */

export default function AgVariableView(props: AgViewProps) {
  switch (props.variable) {
    case 'etr':
    case 'feels_like':
    case 'cci':
      return <MetView {...props} variable={props.variable} />
    case 'gdd':
      return <GddView {...props} />
    case 'soil_temp,soil_ec_blk':
    case 'swp':
    case 'percent_saturation':
      return <SoilView {...props} variable={props.variable} />
    case 'annual':
      return <AnnualView {...props} />
  }
}
