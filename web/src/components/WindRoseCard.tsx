import { useMemo } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { Data, Layout } from 'plotly.js'
import { Plot } from '../lib/plotly'
import { PLOT_CONFIG } from '../lib/plotConfig'
import { degToCompass, WIND_DIRECTIONS } from '../lib/params'
import { useStationRecord } from '../hooks/useStationRecord'
import { useResolvedStation } from './useResolvedStation'
import { useLatestTabState } from '../lib/url-state'
import { speedBins, windDateSpan } from './windRose'

const PLASMA_R = [
  '#0d0887',
  '#46039f',
  '#7201a8',
  '#9c179e',
  '#bd3786',
  '#d8576b',
  '#ed7953',
  '#fb9f3a',
  '#fdca26',
  '#f0f921',
].reverse() // matches px.colors.sequential.Plasma_r ordering, lo→hi speed

interface BinRow {
  dir: string
  bin: number // 0-7, increasing speed
  binLabel: string
  count: number
}

export function WindRoseCard() {
  const station = useResolvedStation()
  const state = useLatestTabState()
  // Same window and aggregation as the main plot (legacy builds the rose from
  // the cached station record, app.py update_ul_card).
  const start = state.from ?? dayjs().subtract(14, 'day').format('YYYY-MM-DD')
  const end = state.to ?? dayjs().format('YYYY-MM-DD')

  const { data, isLoading, isError, error } = useStationRecord(
    station
      ? {
          station,
          start,
          end,
          period: state.agg,
          elements: 'wind_spd,wind_dir',
          rmNa: true,
          publicOnly: true,
        }
      : null,
  )

  const figure = useMemo(() => {
    if (!data || data.length === 0) return null
    const span = windDateSpan(data.map((r) => String(r.datetime)))
    const rows: Array<{ dir: number; spd: number }> = []
    for (const r of data) {
      const dir = (r as Record<string, unknown>)['Wind Direction [deg]']
      const spd = (r as Record<string, unknown>)['Wind Speed [mi/hr]']
      if (typeof dir === 'number' && typeof spd === 'number' && Number.isFinite(dir) && Number.isFinite(spd)) {
        rows.push({ dir, spd })
      }
    }
    if (rows.length === 0) return null

    // Rounded whole-mph quantile bins (legacy qcut); see ./windRose.
    const { numBins, binFor, labels } = speedBins(rows.map((r) => r.spd))

    // Aggregate counts by (compass dir, bin)
    const counts = new Map<string, BinRow>()
    for (const r of rows) {
      const compass = degToCompass(r.dir)
      const b = binFor(r.spd)
      const key = `${compass}|${b}`
      const existing = counts.get(key)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(key, { dir: compass, bin: b, binLabel: labels[b], count: 1 })
      }
    }

    // Build one trace per bin so the legend reads as speed categories.
    const traces: Data[] = []
    for (let b = 0; b < numBins; b++) {
      // An empty top bin happens when the max speed is itself a cut point.
      if (![...counts.values()].some((c) => c.bin === b)) continue
      const r: number[] = []
      const theta: string[] = []
      for (const dir of WIND_DIRECTIONS) {
        const cell = counts.get(`${dir}|${b}`)
        r.push(cell?.count ?? 0)
        theta.push(dir)
      }
      const colorIx = Math.floor((b / Math.max(1, numBins - 1)) * (PLASMA_R.length - 1))
      const label = labels[b]
      traces.push({
        type: 'barpolar',
        r,
        theta,
        name: label,
        marker: { color: PLASMA_R[colorIx] },
        hovertemplate: `<b>${label} mph</b><br>%{theta}: %{r}<extra></extra>`,
      } as Data)
    }

    const layout: Partial<Layout> = {
      autosize: true,
      margin: { l: 20, r: 20, t: span ? 64 : 20, b: 20 },
      ...(span
        ? {
            title: {
              // Legacy is one line at 15 px; the card is narrower, so wrap.
              text: `<b>Wind Data from ${span[0]}<br>to ${span[1]}</b>`,
              x: 0.5,
              y: 0.96,
              xanchor: 'center',
              yanchor: 'top',
              font: { family: 'Courier New, monospace', size: 14, color: 'black' },
            },
          }
        : {}),
      polar: {
        radialaxis: { ticksuffix: '', angle: 45, nticks: 4, tickfont: { size: 9 } },
        angularaxis: {
          direction: 'clockwise',
          rotation: 90,
          tickmode: 'array',
          tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
          ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        },
      },
      showlegend: true,
      legend: { font: { size: 10 }, x: 1, y: 1 },
      paper_bgcolor: 'rgba(0,0,0,0)',
    }

    return { data: traces, layout, revision: data.length }
  }, [data])

  // Legacy shows an empty card until a station is picked.
  if (!station) return null
  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }
  if (isError || !figure) {
    if (isError) console.error('Wind rose request failed:', error)
    return (
      <Center h="100%" px="md">
        <Text fw={700} size="sm" ta="center">
          No data available for selected dates.
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
      style={{ width: '100%', height: '100%' }}
    />
  )
}
