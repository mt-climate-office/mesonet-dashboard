import { useMemo } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import type { Data, Layout } from 'plotly.js'
import { Plot } from '../../lib/plotly'
import { PLOT_CONFIG } from '../../lib/plotConfig'
import { META_COLUMNS, MISSING_DATA_COLUMN } from '../../lib/csv'
import { DAYS_WITH_DATA_COLUMN } from '../../lib/aggregate'
import { withGaps } from '../../tabs/downloader/previewRows'

type Row = Record<string, unknown>

interface Props {
  data: ReadonlyArray<Row> | undefined
  period: 'monthly' | 'daily' | 'hourly'
  isLoading: boolean
  isError: boolean
  error: unknown
}

/** Bookkeeping columns that are exported but not plotted. */
const RM_COLS = new Set([...META_COLUMNS, MISSING_DATA_COLUMN, DAYS_WITH_DATA_COLUMN])

const SUBPLOT_PX = 200
const MARGIN = { l: 80, r: 30, t: 20, b: 40 }

const HOVER_FMT: Record<Props['period'], string> = {
  monthly: '%b %Y',
  daily: '%b %d, %Y',
  hourly: '%b %d, %Y %H:%M',
}

/**
 * One stacked subplot per exported column, legacy `make_single_plot` look:
 * black line, gaps not connected, y-axis titled with the column name.
 */
export function DownloaderPreviewChart({ data, period, isLoading, isError, error }: Props) {
  const figure = useMemo(() => {
    if (!data || data.length === 0) return null
    const colSet = new Set<string>()
    for (const r of data) for (const k of Object.keys(r)) if (!RM_COLS.has(k)) colSet.add(k)
    const cols = [...colSet].filter((c) => data.some((r) => typeof r[c] === 'number'))
    if (cols.length === 0) return null

    const rows = period === 'monthly' ? data.slice() : withGaps(data)
    const x = rows.map((r) => r.datetime as string)

    const N = cols.length
    const height = Math.max(400, N * SUBPLOT_PX + MARGIN.t + MARGIN.b)
    const gapPx = 40
    const plotPx = height - MARGIN.t - MARGIN.b
    const vspace = N > 1 ? Math.min(0.08, gapPx / plotPx) : 0
    const subHeight = (1 - vspace * (N - 1)) / N

    const traces: Data[] = []
    const layout: Partial<Layout> = {
      autosize: true,
      height,
      margin: MARGIN,
      hovermode: 'x unified',
      showlegend: false,
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { size: 11 },
    }

    cols.forEach((col, idx) => {
      const n = idx + 1
      const suffix = idx === 0 ? '' : String(n)
      const top = 1 - idx * (subHeight + vspace)
      const bottom = top - subHeight

      traces.push({
        type: 'scatter',
        mode: period === 'monthly' ? 'lines+markers' : 'lines',
        x,
        y: rows.map((r) => (typeof r[col] === 'number' ? (r[col] as number) : null)),
        xaxis: `x${suffix}`,
        yaxis: `y${suffix}`,
        line: { color: 'black', width: 1.5 },
        marker: { color: 'black', size: 5 },
        connectgaps: false,
        name: col,
        hovertemplate: `%{x|${HOVER_FMT[period]}}<br>%{y:.3~f}<extra></extra>`,
      } as Data)

      ;(layout as Record<string, unknown>)[`yaxis${suffix}`] = {
        title: { text: col, standoff: 4 },
        domain: [Math.max(0, bottom), Math.min(1, top)],
        automargin: true,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        anchor: `x${suffix}`,
      }
      ;(layout as Record<string, unknown>)[`xaxis${suffix}`] = {
        type: 'date',
        ...(period === 'monthly' && rows.length <= 36
          ? { dtick: 'M1', tickformat: '%b %Y' }
          : {}),
        showticklabels: true,
        showgrid: true,
        gridcolor: 'rgba(120,120,120,0.25)',
        matches: idx === 0 ? undefined : 'x',
        anchor: `y${suffix}`,
      }
    })

    const first = String(x[0] ?? '')
    const last = String(x[x.length - 1] ?? '')
    const revision = hash(`${period}|${cols.join('|')}|${rows.length}|${first}|${last}`)
    return { data: traces, layout, height, revision }
  }, [data, period])

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
      style={{ width: '100%', height: figure.height }}
    />
  )
}

/** Small string hash for the Plot `revision` (forces re-plot on new data). */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
