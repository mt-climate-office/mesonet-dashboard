import { useCallback, useEffect, useMemo, useState } from 'react'
import { Center, Loader, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { Data, Layout } from 'plotly.js'
import { Plot, type PlotRelayoutEvent } from '../../lib/plotly'
import { PLOT_CONFIG } from '../../lib/plotConfig'
import {
  AXIS_MAPPER,
  COLOR_MAPPER,
  ELEM_MAP,
  SELECTED_VARS,
  type AggPeriod,
} from '../../lib/params'
import { useStationRecord } from '../../hooks/useStationRecord'
import { useStationElements } from '../../hooks/useStationElements'
import { useLatestTabState } from '../../lib/url-state'
import { fetchNormals, mergeNormals } from '../../lib/normals'
import { insertGaps } from '../../lib/gaps'
import { SOIL_DEPTH_COLOR } from '../../lib/params'
import type { ObservationRow } from '../../lib/api'

const TWO_WEEKS = 14

// Shared CVD-safe soil-depth palette (Viridis sample, lib/params.ts).
const SOIL_DEPTH_COLORS = SOIL_DEPTH_COLOR

const ETR_COLOR = '#FF0000'

function isWindSpeed(label: string) {
  return /Wind Speed/.test(label)
}
function isPrecip(label: string) {
  return /Precipitation/.test(label)
}
function isReferenceEt(label: string) {
  return /Reference ET/.test(label)
}

// Map a column header to the user-facing display variable.
function variableForColumn(col: string): string | null {
  if (col === 'Air Temperature [°F]') return 'Air Temperature'
  if (col === 'Atmospheric Pressure [mbar]') return 'Atmospheric Pressure'
  if (col === 'Relative Humidity [%]') return 'Relative Humidity'
  if (col === 'Solar Radiation [W/m²]') return 'Solar Radiation'
  if (col === 'Snow Depth [in]' || col === 'Snow Depth [in.]')
    return 'Snow Depth'
  if (col.startsWith('Soil Temperature')) return 'Soil Temperature'
  if (col.startsWith('Soil VWC')) return 'Soil VWC'
  if (col.startsWith('Bulk EC')) return 'Bulk EC'
  if (col.startsWith('Gust Speed')) return 'Gust Speed'
  if (isWindSpeed(col)) return 'Wind Speed'
  if (col.startsWith('Wind Direction')) return 'Wind Direction'
  if (col === 'Max Precip Rate [in/h]' || col === 'Max Precip Rate [in/hr]')
    return 'Max Precip Rate'
  if (isPrecip(col)) return 'Precipitation'
  if (isReferenceEt(col)) return 'Reference ET'
  if (col === 'Well Water Level [in]') return 'Well Water Level'
  if (col === 'Well Water Temperature [°F]') return 'Well Water Temperature'
  return null
}

// "Soil Temperature @ 4 in [°F]" → "4 in"
function depthLabelFromColumn(col: string): string | null {
  const m = col.match(/@\s*([0-9]+\s*in)/)
  return m ? m[1].replace(/\s+/g, ' ') : null
}

interface SubplotInfo {
  v: string
  cols: string[]
}

export function StationTimeseriesChart() {
  const state = useLatestTabState()
  const stationElements = useStationElements(state.station)

  const period: AggPeriod = state.agg

  const elementsQuery = useMemo(() => {
    const vars =
      state.vars.length > 0 ? state.vars : ([...SELECTED_VARS] as string[])
    const codes = new Set<string>()
    for (const v of vars) {
      const prefixes = ELEM_MAP[v]
      if (!prefixes) continue
      if (v === 'Reference ET') continue // fetched via has_etr
      for (const p of prefixes) codes.add(p)
    }
    if (stationElements.data && codes.size > 0) {
      const have = new Set(stationElements.data.map((r) => r.element))
      const filtered = [...codes].filter((c) =>
        [...have].some((h) => h === c || h.startsWith(`${c}_`)),
      )
      return filtered.length > 0 ? filtered.join(',') : [...codes].join(',')
    }
    return [...codes].join(',')
  }, [state.vars, stationElements.data])

  const wantsEtr = useMemo(() => {
    const vars =
      state.vars.length > 0 ? state.vars : ([...SELECTED_VARS] as string[])
    return vars.includes('Reference ET')
  }, [state.vars])

  const start =
    state.from ?? dayjs().subtract(TWO_WEEKS, 'day').format('YYYY-MM-DD')
  const end = state.to ?? dayjs().format('YYYY-MM-DD')

  const { data, isLoading, isError, error } = useStationRecord(
    state.station
      ? {
          station: state.station,
          start,
          end,
          period,
          elements: elementsQuery,
          hasEtr: wantsEtr,
          // rm_na=false keeps the API from dropping rows where a measurement is
          // null. With nulls preserved, `connectgaps: false` on the scatter
          // traces actually breaks the line at missing observations instead of
          // drawing through them.
          rmNa: false,
          publicOnly: true,
        }
      : null,
  )

  // Pan/zoom → URL state. When the user drags the chart left or right (or
  // box-zooms), Plotly emits a relayout event with the new x-axis range. We
  // mirror that into the URL so the data hook refetches the wider window.
  const handleRelayout = useCallback(
    (event: PlotRelayoutEvent) => {
      // Reset to defaults when the user double-clicks "autoscale".
      if (event['xaxis.autorange'] === true) {
        state.setFrom(null)
        state.setTo(null)
        return
      }

      const range = event['xaxis.range']
      const r0 = event['xaxis.range[0]'] ?? (Array.isArray(range) ? range[0] : undefined)
      const r1 = event['xaxis.range[1]'] ?? (Array.isArray(range) ? range[1] : undefined)
      if (r0 === undefined || r1 === undefined) return

      const a = dayjs(r0 as string | number)
      const b = dayjs(r1 as string | number)
      if (!a.isValid() || !b.isValid()) return
      // Day-granular URL state matches the date picker's resolution. The
      // chart still keeps its finer-grained internal range until the next
      // refetch lands.
      const nextFrom = a.format('YYYY-MM-DD')
      const nextTo = b.format('YYYY-MM-DD')
      if (nextFrom !== state.from) state.setFrom(nextFrom)
      if (nextTo !== state.to) state.setTo(nextTo)
    },
    [state],
  )

  // Normals overlays — only on daily aggregation, only when toggled on.
  type NormalsMap = Record<string, Awaited<ReturnType<typeof fetchNormals>>>
  const [normalsByVar, setNormalsByVar] = useState<NormalsMap>({})
  // Track which (station,vars,gridmet,agg) tuple our normals correspond to
  // so we can reset state inline (avoids triggering setState inside an
  // effect just to clear). React preserves a top-level setState during
  // render as the "derive state from props" idiom.
  const normalsKey = `${state.station}|${state.gridmet}|${state.agg}|${state.vars.join(',')}`
  const [lastNormalsKey, setLastNormalsKey] = useState(normalsKey)
  if (lastNormalsKey !== normalsKey) {
    setLastNormalsKey(normalsKey)
    if (
      (!state.gridmet || state.agg !== 'daily') &&
      Object.keys(normalsByVar).length > 0
    ) {
      setNormalsByVar({})
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!state.gridmet || state.agg !== 'daily' || !state.station || !data) {
      return
    }
    const requested =
      state.vars.length > 0 ? state.vars : ([...SELECTED_VARS] as string[])
    const targets = requested.filter((v) =>
      ['Precipitation', 'Reference ET', 'Air Temperature', 'Relative Humidity'].includes(
        v,
      ),
    )
    Promise.all(
      targets.map(async (v) => [v, await fetchNormals(state.station!, v)] as const),
    ).then((entries) => {
      if (cancelled) return
      const next: NormalsMap = {}
      for (const [v, n] of entries) if (n) next[v] = n
      setNormalsByVar(next)
    })
    return () => {
      cancelled = true
    }
  }, [state.gridmet, state.agg, state.station, state.vars, data])

  const figure = useMemo(() => {
    if (!data || data.length === 0) return null

    const requestedVars =
      state.vars.length > 0 ? state.vars : ([...SELECTED_VARS] as string[])

    // Insert null rows wherever the API skipped a missing observation, so
    // `connectgaps: false` actually breaks the line at gaps. The cadence is
    // auto-detected, so 5-min and 15-min stations both work. We do this for
    // every aggregation period — hourly/daily aggregates also drop rows when
    // the underlying window has no data.
    const dataWithGaps = insertGaps(data)

    const sample = dataWithGaps[0] as Record<string, unknown>
    const dataKeys = Object.keys(sample).filter(
      (k) => k !== 'station' && k !== 'datetime',
    )

    const columnsByVar = new Map<string, string[]>()
    for (const col of dataKeys) {
      const v = variableForColumn(col)
      if (!v || !requestedVars.includes(v)) continue
      const list = columnsByVar.get(v) ?? []
      // Avoid pushing the same canonical column name twice (LAB_SWAP can map
      // multiple sensor heights to one canonical label).
      if (!list.includes(col)) list.push(col)
      columnsByVar.set(v, list)
    }

    // Honor the user's visible-var ordering from requestedVars, but only
    // include the ones we actually have columns for.
    const orderedSubs: SubplotInfo[] = requestedVars
      .filter((v) => columnsByVar.has(v))
      .map((v) => ({ v, cols: columnsByVar.get(v)! }))
    if (orderedSubs.length === 0) return null

    // Compute explicit yaxis domains. This mirrors make_subplots() better
    // than Plotly's automatic grid layout.
    const N = orderedSubs.length
    const VSPACE = 0.04
    const totalSpace = 1 - VSPACE * (N - 1)
    const subHeight = totalSpace / N
    const datetimes = dataWithGaps.map((r) => r.datetime as string)

    const traces: Data[] = []
    // Per-subplot annotations (e.g. soil-depth color chips). Collected as we
    // build subplots, then assigned to layout.annotations at the end.
    const annotations: NonNullable<Partial<Layout>['annotations']> = []
    const layout: Partial<Layout> = {
      autosize: true,
      margin: { l: 80, r: 20, t: 16, b: 40 },
      hovermode: 'x unified',
      showlegend: false,
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { size: 11 },
    }

    orderedSubs.forEach((sub, idx) => {
      const subplotIx = idx + 1
      const xRef = idx === 0 ? 'x' : `x${subplotIx}`
      const yRef = idx === 0 ? 'y' : `y${subplotIx}`
      const xaxisKey = idx === 0 ? 'xaxis' : `xaxis${subplotIx}`
      const yaxisKey = idx === 0 ? 'yaxis' : `yaxis${subplotIx}`

      // top of this subplot in figure coordinates
      const top = 1 - idx * (subHeight + VSPACE)
      const bottom = top - subHeight

      const baseColor = COLOR_MAPPER[sub.v]
      const isPpt = sub.v === 'Precipitation'
      const isEtr = sub.v === 'Reference ET'

      // Sort soil columns by depth (shallow → deep) so legend order is sensible.
      const sortedCols =
        sub.v === 'Soil Temperature' || sub.v === 'Soil VWC' || sub.v === 'Bulk EC'
          ? [...sub.cols].sort((a, b) => {
              const da = parseInt(depthLabelFromColumn(a) ?? '0', 10)
              const db = parseInt(depthLabelFromColumn(b) ?? '0', 10)
              return da - db
            })
          : sub.cols

      const isSoilStack =
        sub.v === 'Soil Temperature' || sub.v === 'Soil VWC' || sub.v === 'Bulk EC'

      // Track depth → color so we can build the chip legend after the
      // traces. Keyed by depth label (e.g. "4 in") so duplicate columns
      // (LAB_SWAP can collapse multiple sensors onto one canonical label)
      // collapse to a single chip.
      const soilChips: Array<{ depth: string; color: string }> = []

      sortedCols.forEach((col) => {
        let traceColor = baseColor ?? '#444'
        if (isSoilStack) {
          const d = depthLabelFromColumn(col)
          traceColor = (d && SOIL_DEPTH_COLORS[d]) || '#666'
          if (d && !soilChips.some((c) => c.depth === d)) {
            soilChips.push({ depth: d, color: traceColor })
          }
        } else if (isEtr) {
          traceColor = ETR_COLOR
        }

        const yVals = dataWithGaps.map((r) => {
          const v = (r as Record<string, unknown>)[col]
          return typeof v === 'number' ? v : null
        }) as Array<number | null>

        if (isPpt || isEtr) {
          traces.push({
            type: 'bar',
            name: col,
            legendgroup: sub.v,
            showlegend: false,
            x: datetimes,
            y: yVals,
            xaxis: xRef,
            yaxis: yRef,
            marker: { color: traceColor },
            hovertemplate: '%{x|%b %d, %Y %H:%M}<br>%{y:.2f}<extra></extra>',
          } as Data)
        } else {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            // Soil traces use chip annotations instead of a legend, so
            // suppress per-trace legend entries. Other multi-trace subplots
            // (none today, but the structure allows it) still legend per
            // depth.
            name: isSoilStack ? (depthLabelFromColumn(col) ?? col) : sub.v,
            legendgroup: sub.v,
            showlegend: !isSoilStack && sortedCols.length > 1,
            x: datetimes,
            y: yVals,
            xaxis: xRef,
            yaxis: yRef,
            line: { color: traceColor, width: 1.5 },
            connectgaps: false,
            hovertemplate: '%{x|%b %d, %Y %H:%M}<br>%{y:.2f}<extra></extra>',
          } as Data)
        }
      })

      // Soil-depth color chips — small floating labels in the upper-right
      // of the subplot, one per depth, filled with the trace color and
      // rendered in white text. Subtle but unmistakable, matching the
      // legacy dashboard's plot_soil annotation row.
      if (isSoilStack && soilChips.length > 0) {
        // Lay out 0.62..0.98 of the subplot's x domain (roughly the right
        // ~35%, matching legacy `delta = (dmax - dmin) * 0.35 / 5`).
        const xStart = 0.62
        const xEnd = 0.98
        const yPos = 0.92
        const step =
          soilChips.length === 1 ? 0 : (xEnd - xStart) / (soilChips.length - 1)
        soilChips.forEach((chip, ci) => {
          annotations.push({
            text: chip.depth,
            x: soilChips.length === 1 ? xEnd : xStart + step * ci,
            y: yPos,
            // `xref`/`yref` use the axis-reference form (`x`, `x2`, `y`, `y2`)
            // with a `domain` suffix for fractional positioning within the
            // subplot — NOT the layout-key form (`xaxis`, `yaxis`).
            xref: `${xRef} domain` as never,
            yref: `${yRef} domain` as never,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'middle',
            font: {
              size: 10,
              color: '#ffffff',
              family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            },
            bgcolor: chip.color,
            bordercolor: 'rgba(255,255,255,0.7)',
            borderwidth: 1,
            borderpad: 2,
            opacity: 0.92,
          })
        })
      }

      // Optional GridMET normals overlay
      const norms = normalsByVar[sub.v]
      if (norms) {
        const merged = mergeNormals(dataWithGaps as ObservationRow[], norms)
        // Skip if no overlap.
        const hasAny = merged.some(
          (r) => r.mn !== null || r.mx !== null || r.avg !== null,
        )
        if (hasAny) {
          const x = merged.map((r) => r.datetime)
          // For bar plots (precip / etr), use markers.
          if (isPpt || isEtr) {
            traces.push({
              type: 'scatter',
              mode: 'markers',
              x,
              y: merged.map((r) => r.mx),
              marker: { color: 'black', symbol: 'triangle-down', size: 6 },
              name: '75th pct (1991-2020)',
              showlegend: false,
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
            traces.push({
              type: 'scatter',
              mode: 'markers',
              x,
              y: merged.map((r) => r.avg),
              marker: { color: 'black', symbol: 'circle', size: 5 },
              name: 'Median (1991-2020)',
              showlegend: false,
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
            traces.push({
              type: 'scatter',
              mode: 'markers',
              x,
              y: merged.map((r) => r.mn),
              marker: { color: 'black', symbol: 'triangle-up', size: 6 },
              name: '25th pct (1991-2020)',
              showlegend: false,
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
          } else {
            // line vars: shade between mn and mx
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x,
              y: merged.map((r) => r.mx),
              line: { dash: 'dash', color: 'black', width: 1 },
              name: 'Avg max',
              showlegend: false,
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x,
              y: merged.map((r) => r.mn),
              line: { dash: 'dash', color: 'black', width: 1 },
              name: 'Avg min',
              showlegend: false,
              fill: 'tonexty',
              fillcolor: 'rgba(107,107,107,0.25)',
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
          }
        }
      }

      // Y-axis title (replaces <br> with HTML so Plotly renders it)
      let title = AXIS_MAPPER[sub.v] ?? sub.v
      if ((sub.v === 'Precipitation' || sub.v === 'Reference ET') && period === 'daily') {
        title = title.replace('(inches)', '(in/day)')
      } else if ((sub.v === 'Precipitation' || sub.v === 'Reference ET') && period === 'hourly') {
        title = title.replace('(inches)', '(in/hr)')
      }

      ;(layout as Record<string, unknown>)[yaxisKey] = {
        title: { text: title, standoff: 4 },
        domain: [Math.max(0, bottom), Math.min(1, top)],
        automargin: true,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        anchor: idx === 0 ? 'x' : `x${subplotIx}`,
      }

      ;(layout as Record<string, unknown>)[xaxisKey] = {
        type: 'date',
        showticklabels: idx === N - 1,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        matches: idx === 0 ? undefined : 'x',
        anchor: idx === 0 ? 'y' : `y${subplotIx}`,
      }
    })

    if (annotations.length > 0) {
      layout.annotations = annotations
    }

    // Compute a stable revision so the wrapper purges + re-plots when the
    // subplot count changes.
    const revision = orderedSubs.length * 1000 + (dataWithGaps.length % 1000)

    return { data: traces, layout, revision }
  }, [data, state.vars, normalsByVar, period])

  if (!state.station) {
    return (
      <Center h="100%">
        <Stack gap="xs" align="center">
          <Text c="dimmed" size="sm">
            Pick a station from the sidebar or map.
          </Text>
        </Stack>
      </Center>
    )
  }

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    )
  }

  if (isError) {
    return (
      <Center h="100%" px="md">
        <Text c="red" size="sm">
          {(error as Error)?.message ?? 'Failed to fetch observations.'}
        </Text>
      </Center>
    )
  }

  if (!figure) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          No observations in the selected range.
        </Text>
      </Center>
    )
  }

  return (
    <Plot
      data={figure.data}
      layout={figure.layout}
      config={PLOT_CONFIG}
      revision={figure.revision}
      onRelayout={handleRelayout}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
