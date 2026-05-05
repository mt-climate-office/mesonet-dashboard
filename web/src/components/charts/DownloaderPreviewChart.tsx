import { useMemo } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import type { Data, Layout } from 'plotly.js'
import { Plot } from '../../lib/plotly'
import { PLOT_CONFIG } from '../../lib/plotConfig'
import type { ObservationRow } from '../../lib/api'

interface Props {
  data: ObservationRow[] | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

const RM_COLS = new Set(['station', 'datetime', 'Contains Missing Data', 'has_na'])

const baseLayout: Partial<Layout> = {
  autosize: true,
  margin: { l: 80, r: 30, t: 20, b: 40 },
  hovermode: 'x unified',
  showlegend: false,
  plot_bgcolor: 'rgba(0,0,0,0)',
  paper_bgcolor: 'rgba(0,0,0,0)',
  font: { size: 11 },
}

/**
 * Multi-row stacked plot: one Plotly subplot per requested element column.
 * Mirrors the legacy `plot_downloaded_data` callback's behavior.
 */
export function DownloaderPreviewChart({ data, isLoading, isError, error }: Props) {
  const figure = useMemo(() => {
    if (!data || data.length === 0) return null
    const sample = data[0] as Record<string, unknown>
    const cols = Object.keys(sample).filter((k) => !RM_COLS.has(k))
    if (cols.length === 0) return null

    const datetimes = data.map((r) => r.datetime as string)

    const N = cols.length
    const VSPACE = 0.04
    const totalSpace = 1 - VSPACE * (N - 1)
    const subHeight = totalSpace / N

    const traces: Data[] = []
    const layout: Partial<Layout> = { ...baseLayout }

    cols.forEach((col, idx) => {
      const subplotIx = idx + 1
      const xRef = idx === 0 ? 'x' : `x${subplotIx}`
      const yRef = idx === 0 ? 'y' : `y${subplotIx}`
      const xaxisKey = idx === 0 ? 'xaxis' : `xaxis${subplotIx}`
      const yaxisKey = idx === 0 ? 'yaxis' : `yaxis${subplotIx}`

      const top = 1 - idx * (subHeight + VSPACE)
      const bottom = top - subHeight

      const yvals = data.map((r) => {
        const v = (r as Record<string, unknown>)[col]
        return typeof v === 'number' ? v : null
      }) as Array<number | null>

      const isPpt = /Precipitation|GDDs/.test(col) || /Reference ET/.test(col)

      traces.push({
        type: isPpt ? 'bar' : 'scatter',
        mode: isPpt ? undefined : 'lines',
        x: datetimes,
        y: yvals,
        xaxis: xRef,
        yaxis: yRef,
        line: isPpt ? undefined : { width: 1.5 },
        connectgaps: false,
        name: col,
        hovertemplate: '%{x|%b %d, %Y %H:%M}<br>%{y:.2f}<extra></extra>',
      } as Data)

      ;(layout as Record<string, unknown>)[yaxisKey] = {
        title: { text: col, standoff: 4 },
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

    return { data: traces, layout, revision: cols.length * 1000 + (data.length % 1000) }
  }, [data])

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
          {(error as Error)?.message ?? 'Failed to fetch data.'}
        </Text>
      </Center>
    )
  }
  if (!data) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Configure the request and click Run to preview your data.
        </Text>
      </Center>
    )
  }
  if (!figure) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          No data for the current selection.
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
