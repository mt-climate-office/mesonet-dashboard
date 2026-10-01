import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Center, Loader, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { Data, Layout } from 'plotly.js'
import { Plot, type PlotRelayoutEvent } from '../../lib/plotly'
import { PLOT_CONFIG } from '../../lib/plotConfig'
import {
  COLOR_MAPPER,
  depthLabelFromColumn,
  latestAxisTitle,
  latestElementCodes,
  latestVariableForColumn,
  latestVarsFromElements,
  type AggPeriod,
} from '../../lib/params'
import { useStationRecord } from '../../hooks/useStationRecord'
import { useStationElements } from '../../hooks/useStationElements'
import { useStationConfig } from '../../hooks/useStationConfig'
import { useStations } from '../../hooks/useStations'
import { useResolvedStation } from '../useResolvedStation'
import { useLatestTabState } from '../../lib/url-state'
import { fetchNormals, mergeNormals } from '../../lib/normals'
import { insertGaps } from '../../lib/gaps'
import { SOIL_DEPTH_COLOR } from '../../lib/params'
import type { ObservationRow } from '../../lib/api'
import {
  explodeInstruments,
  formatWallClock,
  sensorEventText,
  sensorEventsForSubplot,
  type RawInstrument,
  type SubplotKind,
} from '../../lib/sensorEvents'

const TWO_WEEKS = 14

// Shared CVD-safe soil-depth palette (Viridis sample, lib/params.ts).
const SOIL_DEPTH_COLORS = SOIL_DEPTH_COLOR

const ETR_COLOR = '#FF0000'
// Plotly's default first colour, which legacy px.bar uses for precipitation.
const PPT_COLOR = '#636efa'

// Legacy plot_site sizes the figure 500 px for one panel, else 250 px per
// panel, inside a scrolling column. We fill the column instead, but never let
// a panel shrink below this, so long selections scroll rather than squash.
const MIN_PANEL_PX = 200

/** Legacy make_nodata_figure texts (app.py render_station_plot). */
export const NO_DATA_TITLE = 'No data available for selected station and dates'
export const NO_DATA_HINT = 'Either change the date range or select a new station.'

/** "YYYY-MM-DD" that dayjs can parse; malformed ?from/?to are treated as no data. */
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid()

// Legacy `_add_sensor_event_overlays` styling.
const SENSOR_EVENT_FILL = 'rgba(200,200,200,1)'
const SENSOR_EVENT_OPACITY = 0.75

/** Finite min/max over `cols`, with legacy's fallbacks (NaN → 0..1, flat → ±1). */
function valueBounds(
  rows: ReadonlyArray<Record<string, unknown>>,
  cols: readonly string[],
): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const r of rows) {
    for (const c of cols) {
      const v = r[c]
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (lo === hi) return [lo - 1, hi + 1]
  return [lo, hi]
}

interface SubplotInfo {
  v: string
  cols: string[]
}

export function StationTimeseriesChart() {
  const state = useLatestTabState()
  // Only query once `?s=` is a real station id (NWSLI links resolve first).
  const station = useResolvedStation()
  const stations = useStations()
  const stationElements = useStationElements(station)
  // Sensor deployment history → grey added/removed/outage overlays.
  const stationConfig = useStationConfig(station)
  const sensorConfig = useMemo(
    () =>
      explodeInstruments(
        stationConfig.data?.instruments as unknown as RawInstrument[] | undefined,
      ),
    [stationConfig.data],
  )

  const period: AggPeriod = state.agg

  // The selection (absent `vars` = the 5 defaults), filtered to what the
  // station offers, in selection order (legacy update_select_vars). An empty
  // selection is "No variables selected", not the defaults.
  const requestedVars = useMemo(() => {
    if (!stationElements.data) return state.vars
    const available = new Set(latestVarsFromElements(stationElements.data))
    return state.vars.filter((v) => available.has(v))
  }, [state.vars, stationElements.data])
  const requestedKey = requestedVars.join(',')

  const elementsQuery = useMemo(
    () => latestElementCodes(requestedVars, stationElements.data).join(','),
    [requestedVars, stationElements.data],
  )

  const wantsEtr = requestedVars.includes('Reference ET')

  const start =
    state.from ?? dayjs().subtract(TWO_WEEKS, 'day').format('YYYY-MM-DD')
  const end = state.to ?? dayjs().format('YYYY-MM-DD')
  const datesValid = isIsoDate(start) && isIsoDate(end) && start <= end

  // Wait for the element list (it decides which codes to send) unless it
  // failed, so one selection makes one request.
  const elementsReady = !!stationElements.data || stationElements.isError
  const canQuery =
    !!station && elementsReady && datesValid && requestedVars.length > 0

  const { data, isLoading, isError, error } = useStationRecord(
    canQuery && station
      ? {
          station,
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
  const normalsKey = `${station}|${state.gridmet}|${state.agg}|${requestedKey}`
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
    if (!state.gridmet || state.agg !== 'daily' || !station || !data) {
      return
    }
    const targets = requestedVars.filter((v) =>
      ['Precipitation', 'Reference ET', 'Air Temperature', 'Relative Humidity'].includes(
        v,
      ),
    )
    Promise.all(
      targets.map(async (v) => [v, await fetchNormals(station, v)] as const),
    ).then((entries) => {
      if (cancelled) return
      const next: NormalsMap = {}
      for (const [v, n] of entries) if (n) next[v] = n
      setNormalsByVar(next)
    })
    return () => {
      cancelled = true
    }
    // requestedKey stands in for requestedVars (stable across renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gridmet, state.agg, station, requestedKey, data])

  const figure = useMemo(() => {
    if (!data || data.length === 0) return null

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
    const hasValues = (col: string) =>
      dataWithGaps.some((r) => {
        const v = (r as Record<string, unknown>)[col]
        return typeof v === 'number' && Number.isFinite(v)
      })

    const columnsByVar = new Map<string, string[]>()
    for (const col of dataKeys) {
      const v = latestVariableForColumn(col)
      if (!v || !requestedVars.includes(v)) continue
      if (!hasValues(col)) continue
      const list = columnsByVar.get(v) ?? []
      // Avoid pushing the same canonical column name twice (LAB_SWAP can map
      // multiple sensor heights to one canonical label).
      if (!list.includes(col)) list.push(col)
      columnsByVar.set(v, list)
    }

    // One panel per selected variable, in selection order. A variable with no
    // data keeps an empty panel with legacy's "not available" note
    // (plot_site / add_nodata_lab) instead of being dropped.
    const orderedSubs: SubplotInfo[] = requestedVars.map((v) => ({
      v,
      cols: columnsByVar.get(v) ?? [],
    }))
    if (orderedSubs.length === 0) return null

    // Legacy forces every x axis to [min date − 1 day, max date + 1 day].
    const dayStrings = dataWithGaps
      .map((r) => String(r.datetime).slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
    const xRange =
      dayStrings.length > 0
        ? [
            dayjs(dayStrings[0]).subtract(1, 'day').format('YYYY-MM-DD'),
            dayjs(dayStrings[dayStrings.length - 1]).add(1, 'day').format('YYYY-MM-DD'),
          ]
        : undefined

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
    // Sensor-change vrects, one set per subplot.
    const shapes: NonNullable<Partial<Layout>['shapes']> = []
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
      const noData = sub.cols.length === 0
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
        let traceColor = baseColor ?? (isPpt ? PPT_COLOR : '#444')
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

        // Legacy hover labels: "Precipitation Total" / "Reference ET Total"
        // for bars, the variable for soil panels, the column for the rest.
        const hoverLabel = isPpt
          ? 'Precipitation Total'
          : isEtr
            ? 'Reference ET Total'
            : isSoilStack
              ? sub.v
              : col
        const hovertemplate = `<b>Date</b>: %{x}<br><b>${hoverLabel}</b>: %{y}<extra></extra>`
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
            hovertemplate,
          } as Data)
        } else {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            // Full column names, like legacy (soil depths read
            // "Soil VWC @ 2 in [%]"); soil depths are keyed by the chip
            // annotations below rather than a legend.
            name: col,
            legendgroup: sub.v,
            showlegend: !isSoilStack && sortedCols.length > 1,
            x: datetimes,
            y: yVals,
            xaxis: xRef,
            yaxis: yRef,
            line: { color: traceColor, width: 1.5 },
            connectgaps: false,
            hovertemplate,
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
      if (norms && !noData) {
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
              name: '75th Percentile',
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
              name: 'Median',
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
              name: '25th Percentile',
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
              name: `Average Max.<br>${sub.cols[0] ?? sub.v}`,
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
              name: `Average Min.<br>${sub.cols[0] ?? sub.v}`,
              showlegend: false,
              fill: 'tonexty',
              fillcolor: 'rgba(107,107,107,0.4)',
              xaxis: xRef,
              yaxis: yRef,
              hoverinfo: 'skip',
            } as Data)
          }
        }
      }

      // Sensor added/removed/outage overlays (legacy plot_met / plot_soil /
      // plot_ppt; plot_etr has none). Drawn below the traces, with an
      // invisible-ish polygon trace carrying the hover text.
      if (!isEtr && !noData && sensorConfig.length > 0) {
        const kind: SubplotKind = isSoilStack ? 'soil' : isPpt ? 'ppt' : 'met'
        const rawRows = data as ReadonlyArray<Record<string, unknown>>
        const events = sensorEventsForSubplot({
          kind,
          columns: sub.cols,
          config: sensorConfig,
          rows: rawRows,
        })
        if (events.length > 0) {
          const [yMin, yMax] = valueBounds(rawRows, sub.cols)
          for (const e of events) {
            const x0 = formatWallClock(e.x0)
            const x1 = formatWallClock(e.x1)
            shapes.push({
              type: 'rect',
              xref: xRef as never,
              yref: `${yRef} domain` as never,
              x0,
              x1,
              y0: 0,
              y1: 1,
              fillcolor: SENSOR_EVENT_FILL,
              opacity: SENSOR_EVENT_OPACITY,
              line: { width: 0 },
              layer: 'below',
            })
            const text = sensorEventText(e)
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: [x0, x0, x1, x1, x0],
              y: [yMin, yMax, yMax, yMin, yMin],
              fill: 'toself',
              // 'fills' (the toself default) never fires in unified hover.
              hoveron: 'points',
              fillcolor: 'rgba(200,200,200,0.5)',
              line: { color: 'rgba(200,200,200,0.5)', width: 0 },
              opacity: 0.5,
              showlegend: false,
              name: '',
              text: [text, text, text, text, text],
              hovertemplate: '%{text}<extra></extra>',
              xaxis: xRef,
              yaxis: yRef,
            } as Data)
          }
        }
      }

      if (noData) {
        // Plotly only draws a subplot that some trace references, so give the
        // empty panel an invisible placeholder (legacy: an empty px.line).
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: [datetimes[0], datetimes[datetimes.length - 1]],
          y: [null, null],
          xaxis: xRef,
          yaxis: yRef,
          name: sub.v,
          showlegend: false,
          hoverinfo: 'skip',
        } as Data)
        annotations.push({
          text: `<b>${sub.v} data are not available for this time period.</b>`,
          x: 0.5,
          y: 0.5,
          xref: `${xRef} domain` as never,
          yref: `${yRef} domain` as never,
          showarrow: false,
          xanchor: 'center',
          yanchor: 'middle',
          font: { color: 'black', size: 14 },
          bgcolor: 'white',
          bordercolor: '#c7c7c7',
        })
      }

      // Snow depth: y from 0 to at least 1 (legacy plot_site).
      let yRange: [number, number] | undefined
      if (sub.v === 'Snow Depth' && !noData) {
        let hi = -Infinity
        for (const r of dataWithGaps as ReadonlyArray<Record<string, unknown>>) {
          for (const c of sub.cols) {
            const v = r[c]
            if (typeof v === 'number' && Number.isFinite(v) && v > hi) hi = v
          }
        }
        yRange = [0, Math.max(1, hi)]
      }

      ;(layout as Record<string, unknown>)[yaxisKey] = {
        title: { text: latestAxisTitle(sub.v, period), standoff: 4 },
        domain: [Math.max(0, bottom), Math.min(1, top)],
        automargin: true,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        anchor: idx === 0 ? 'x' : `x${subplotIx}`,
        ...(noData ? { showticklabels: false, range: [0, 1] } : {}),
        ...(yRange ? { range: yRange } : {}),
      }

      ;(layout as Record<string, unknown>)[xaxisKey] = {
        type: 'date',
        showticklabels: idx === N - 1,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        matches: idx === 0 ? undefined : 'x',
        anchor: idx === 0 ? 'y' : `y${subplotIx}`,
        ...(idx === 0 && xRange ? { range: xRange } : {}),
      }
    })

    if (annotations.length > 0) {
      layout.annotations = annotations
    }
    if (shapes.length > 0) {
      layout.shapes = shapes
    }

    // Compute a stable revision so the wrapper purges + re-plots when the
    // subplot count changes.
    const revision = orderedSubs.length * 1000 + (dataWithGaps.length % 1000)

    return { data: traces, layout, revision, panels: N }
    // requestedKey stands in for requestedVars (stable across renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, requestedKey, normalsByVar, period, sensorConfig])

  // Empty states follow legacy render_station_plot: "No variables selected"
  // wins over the station check.
  if (state.vars.length === 0 || (station && stationElements.data && requestedVars.length === 0)) {
    return <EmptyState title="No variables selected" />
  }

  if (!state.station) {
    return (
      <EmptyState
        title="Select Station"
        hint="To get started, select a station from the dropdown or the map."
      />
    )
  }

  if (!station) {
    // `?s=` is set but not (yet) a catalog id: wait for the catalog and the
    // NWSLI resolver, then say so if it still doesn't match.
    return (
      <Center h="100%">
        {stations.data ? (
          <Text c="dimmed" size="sm">
            Station not found.
          </Text>
        ) : (
          <Loader />
        )}
      </Center>
    )
  }

  if (!datesValid) {
    return <EmptyState title={NO_DATA_TITLE} hint={NO_DATA_HINT} />
  }

  if (!elementsReady || isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    )
  }

  if (isError || !figure) {
    // Details go to the console; the user gets legacy's no-data message.
    if (isError) console.error('Latest Data request failed:', error)
    return <EmptyState title={NO_DATA_TITLE} hint={NO_DATA_HINT} />
  }

  return (
    <Box h="100%" style={{ overflowY: 'auto' }}>
      <Plot
        data={figure.data}
        layout={figure.layout}
        config={PLOT_CONFIG}
        revision={figure.revision}
        onRelayout={handleRelayout}
        style={{ width: '100%', height: '100%', minHeight: figure.panels * MIN_PANEL_PX }}
      />
    </Box>
  )
}

/** Legacy make_nodata_figure-style message (bold title, optional hint). */
function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Center h="100%" px="md">
      <Stack gap="xs" align="center" maw={420}>
        <Text fw={700} size="md" ta="center">
          {title}
        </Text>
        {hint && (
          <Text size="sm" ta="center">
            {hint}
          </Text>
        )}
      </Stack>
    </Center>
  )
}
