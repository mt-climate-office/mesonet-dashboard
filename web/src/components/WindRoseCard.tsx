import { useMemo } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { Data, Layout } from 'plotly.js'
import { Plot } from '../lib/plotly'
import { PLOT_CONFIG } from '../lib/plotConfig'
import { degToCompass, WIND_DIRECTIONS } from '../lib/params'
import { useStationRecord } from '../hooks/useStationRecord'
import { useResolvedStation } from './useResolvedStation'
import { speedBins } from './windRose'

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
  const start = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  const end = dayjs().format('YYYY-MM-DD')

  // Fetch yesterday + today of hourly wind data, then keep the trailing 24h
  // below.
  const { data, isLoading, isError } = useStationRecord(
    station
      ? {
          station,
          start,
          end,
          period: 'hourly',
          elements: 'wind_spd,wind_dir',
          rmNa: true,
          publicOnly: true,
        }
      : null,
  )

  const figure = useMemo(() => {
    if (!data || data.length === 0) return null
    // "2026-10-01 10:00:00-06:00" → ISO so every browser parses it.
    const times = data.map((r) => Date.parse(String(r.datetime).replace(' ', 'T')))
    // Trailing 24h, anchored to the newest observation.
    const cutoff = Math.max(...times.filter(Number.isFinite)) - 24 * 60 * 60 * 1000
    const rows: Array<{ dir: number; spd: number }> = []
    for (const [i, r] of data.entries()) {
      if (Number.isFinite(times[i]) && times[i] <= cutoff) continue
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
      margin: { l: 20, r: 20, t: 20, b: 20 },
      polar: {
        radialaxis: { ticksuffix: '', angle: 45, dtick: 'auto' },
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

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to see its wind rose.
        </Text>
      </Center>
    )
  }
  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }
  if (isError || !figure) {
    return (
      <Center h="100%" px="md">
        <Text c="dimmed" size="xs" ta="center">
          No wind data available for the last 24 hours.
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
