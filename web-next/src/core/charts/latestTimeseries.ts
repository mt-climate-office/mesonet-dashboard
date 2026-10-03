/**
 * Latest Data station plot: one grid per selected variable, stacked, on one
 * shared time axis with one dataZoom. Lines per column (soil depths colored
 * by depth), bars for precipitation and reference ET, gridMET normals (band
 * or percentile markers), hatched sensor-change spans and per-panel
 * "not available" notes. Input is core/models/timeseries (display units).
 */
import type { EChartsOption, GraphicComponentOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { TimeseriesModel, TimeseriesPanel, TimeseriesSeries } from '../models/timeseries'
import { panelNoDataText } from '../models/timeseries'
import { ETR, NORMALS, PRECIP, SENSOR_EVENT, depthColor, previewColor, variableStyle } from '../palette'
import { ELEM_MAP } from '../params/latest'
import type { LatestAgg } from '../url-schema'
import { formatValue, plainName, plainUnit } from '../variables/labels'
import { niceCeil, timeAxis, timeZoom, valueAxis } from './axes'
import { MISSING, escapeHtml, fmtWall, isoWall, plainLabel } from './format'
import { bandSeries, sensorEventSeries } from './overlays'
import { AUX, barSeries, lineSeries, markerSeries, points } from './series'
import { paint } from './theme'
import { tipText, tooltipBase, type TipParam } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

export interface LatestTimeseriesModel {
  ts: TimeseriesModel
  period: LatestAgg
  /** Visible window (the URL dates), wall-clock ms. */
  view: [number, number]
}

/** Layout in CSS px. Each panel has a key row (depths, columns) in the gap above it. */
export const LAYOUT = { panel: 190, single: 340, compactPanel: 160, gap: 34, top: 30, bottom: 64, compactBottom: 30 } as const

const panelPx = (n: number, compact: boolean) => (n === 1 ? LAYOUT.single : compact ? LAYOUT.compactPanel : LAYOUT.panel)

/** Canvas height for `n` panels; the component sets it as `--chart-height`. */
export function latestTimeseriesHeight(n: number, compact: boolean): number {
  const k = Math.max(1, n)
  return LAYOUT.top + k * panelPx(k, compact) + (k - 1) * LAYOUT.gap + (compact ? LAYOUT.compactBottom : LAYOUT.bottom)
}

const DASHES = [undefined, 'dashed', 'dotted'] as const
const isBar = (p: TimeseriesPanel) => p.variable === 'Precipitation' || p.variable === 'Reference ET'

/** Line/bar color of one column (palette roles only). */
export function seriesColor(ctx: ChartContext, p: TimeseriesPanel, s: TimeseriesSeries, panelIndex: number): string {
  const theme = ctx.theme.name
  if (p.variable === 'Precipitation') return PRECIP[theme].bar
  if (p.variable === 'Reference ET') return ETR[theme].bar
  if (s.depth) return depthColor(Number.parseInt(s.depth, 10), theme)
  return variableStyle(p.variable, theme)?.color ?? previewColor(panelIndex, theme)
}

/** "Air Temperature @ 8 ft [°F]" → "8 ft": what tells a panel's columns apart. */
const columnKey = (variable: string, col: string) =>
  col.replace(variable, '').replace(/\[[^\]]*\]/g, '').replace('@', '').trim() || col

/** Units of a column ("[°F]" → "°F"), or ''. */
const unitOf = (col: string) => /\[([^\]]+)\]\s*$/.exec(col)?.[1] ?? ''

/**
 * A series' plain label and unit for tooltips and tables (never the API column): one-sensor panels
 * use the variable's plain name ("Wind"); depths and sensor heights their key ("2 in"), and `full`
 * adds the plain name for a table header ("Soil moisture at 2 in"). Series names stay the API's.
 */
function plainSeries(p: TimeseriesPanel, s: TimeseriesSeries): { label: string; full: string; unit: string } {
  const name = plainName(ELEM_MAP[p.variable]?.[0] ?? '', p.variable)
  const key = s.depth ?? (p.legend ? columnKey(p.variable, s.name) : null)
  return { label: key ?? name, full: key ? `${name} at ${key}` : name, unit: plainUnit(unitOf(s.name)) }
}

/** Tooltip/table number: 3 decimals under 0.1 (precip, ETr), else 2; trailing zeros dropped. */
export function fmtValue(v: number): string {
  return String(Number(v.toFixed(v !== 0 && Math.abs(v) < 0.1 ? 3 : 2)))
}

interface KeyEntry {
  label: string
  color: string
  dash?: 'dashed' | 'dotted'
  /** Text glyph instead of a line swatch (normals markers). */
  glyph?: string
  /** Filled block (sensor change, normals band). */
  block?: boolean
}

/** A row of keys, right-aligned, ending at `right` px with its middle at `y`. */
function keyRow(ctx: ChartContext, entries: KeyEntry[], right: number, y: number): GraphicComponentOption[] {
  const font = `${ctx.compact ? 10 : 11}px ${ctx.theme.fontUi}`
  const charW = ctx.compact ? 5.6 : 6.2
  let x = right
  const out: GraphicComponentOption[] = []
  for (const e of [...entries].reverse()) {
    const textW = Math.ceil(e.label.length * charW)
    const swatchW = e.glyph ? 10 : 14
    x -= textW + swatchW + 4
    const swatch = e.glyph
      ? { type: 'text' as const, x: 0, y: 0, style: { text: e.glyph, fill: e.color, font, verticalAlign: 'middle' as const } }
      : e.block
        ? { type: 'rect' as const, shape: { x: 0, y: -5, width: 12, height: 10 }, style: { fill: e.color, stroke: ctx.theme.textMuted, lineWidth: 1 } }
        : { type: 'line' as const, shape: { x1: 0, y1: 0, x2: 14, y2: 0 }, style: { stroke: e.color, lineWidth: 2, lineDash: e.dash === 'dashed' ? [5, 3] : e.dash === 'dotted' ? [1.5, 2.5] : undefined } }
    out.push({
      type: 'group',
      x,
      y,
      silent: true,
      children: [swatch, { type: 'text', x: swatchW + 4, y: 0, style: { text: e.label, fill: ctx.theme.textMuted, font, verticalAlign: 'middle' } }],
    } as GraphicComponentOption)
    x -= 12
  }
  return out
}

export const latestTimeseriesChart: ChartBuilder<LatestTimeseriesModel> = (m, ctx) => {
  const { panels } = m.ts
  const n = panels.length
  const h = panelPx(n, ctx.compact)
  const left = ctx.compact ? 56 : 72
  const right = 16
  const plotW = Math.max(40, ctx.width - left - right)
  const topOf = (i: number) => LAYOUT.top + i * (h + LAYOUT.gap)
  const ok = m.ts.x.map(Number.isFinite)
  // Daily rows sit at local noon so a bar fills its own day (as the Ag charts, format.ts wallMs).
  const shift = m.period === 'daily' ? 12 * 3_600_000 : 0
  const xs = m.ts.x.filter((_, j) => ok[j]).map((x) => x + shift)
  const pick = <T>(arr: readonly T[]) => arr.filter((_, j) => ok[j])
  const pts = (ys: readonly (number | null)[]) => points(xs, pick(ys))
  const normalColor = paint(ctx.theme, NORMALS.line)

  const series: SeriesOption[] = []
  /** Per series index: its panel and how the tooltip labels it (null = skip). */
  const tipMeta: ({ panel: number; label: string; unit: string } | null)[] = []
  const push = (s: SeriesOption, meta: (typeof tipMeta)[number]) => {
    series.push(s)
    tipMeta.push(meta)
  }
  const graphic: GraphicComponentOption[] = []
  const global = { normals: false, markers: false, sensor: false }

  panels.forEach((p, i) => {
    const axes = { xAxisIndex: i, yAxisIndex: i }
    const keys: KeyEntry[] = []
    p.series.forEach((s, j) => {
      const color = seriesColor(ctx, p, s, i)
      const { label, unit } = plainSeries(p, s)
      if (isBar(p)) {
        // barMinWidth: raw 5–15 min bars over a week are narrower than a pixel and would vanish.
        push({ ...barSeries(s.name, pts(s.values), color, i), ...axes, barMinWidth: 1, id: `p${i}:${s.name}` }, { panel: i, label, unit })
        return
      }
      const dash = p.legend ? DASHES[j % DASHES.length] : variableStyle(p.variable, ctx.theme.name)?.dash
      push({ ...lineSeries(s.name, pts(s.values), { color, dash, width: 1.5, yAxisIndex: i, id: `p${i}:${s.name}` }), xAxisIndex: i }, {
        panel: i,
        label,
        unit,
      })
      if (s.depth) keys.push({ label: s.depth, color })
      else if (p.legend) keys.push({ label: columnKey(p.variable, s.name), color, dash })
    })

    const nm = p.normals
    if (nm?.kind === 'band') {
      global.normals = true
      const band = bandSeries('gridMET normal', `${AUX}normal-base`, xs, pick(nm.min), pick(nm.max), {
        color: paint(ctx.theme, NORMALS.band),
        yAxisIndex: i,
        digits: 1,
        stack: `normals${i}`,
      })
      band.forEach((s, k) => push({ ...s, xAxisIndex: i, z: 1 }, k === 1 ? { panel: i, label: 'gridMET normal', unit: '' } : null))
      for (const [edge, ys] of [['min', nm.min], ['max', nm.max]] as const) {
        push({ ...lineSeries(`${AUX}normal-${edge}`, pts(ys), { color: normalColor, width: 1, dash: NORMALS.dash, yAxisIndex: i, id: `${AUX}p${i}-normal-${edge}` }), xAxisIndex: i, silent: true }, null)
      }
    } else if (nm?.kind === 'markers') {
      global.markers = true
      const marks = [
        ['75th Percentile', nm.p75, 'triangle', 180],
        ['Median', nm.median, 'circle', 0],
        ['25th Percentile', nm.p25, 'triangle', 0],
      ] as const
      for (const [name, ys, symbol, rotate] of marks) {
        push(
          { ...markerSeries(name, pts(ys), { color: normalColor, symbol, size: symbol === 'circle' ? 5 : 7 }), ...axes, symbolRotate: rotate, id: `p${i}:${name}` },
          { panel: i, label: `Normal ${name.replace(' Percentile', ' pct.').toLowerCase()}`, unit: '' },
        )
      }
    }

    if (p.sensorSpans.length) {
      global.sensor = true
      push({ ...sensorEventSeries(ctx, p.sensorSpans), ...axes, id: `${AUX}sensor-events-${i}` }, null)
    }

    if (keys.length) graphic.push(...keyRow(ctx, keys, ctx.width - right, topOf(i) - 10))
    if (p.noData) {
      graphic.push({
        type: 'text',
        x: left + plotW / 2,
        y: topOf(i) + h / 2,
        silent: true,
        style: {
          text: panelNoDataText(p.variable),
          width: plotW - 24,
          overflow: 'break',
          align: 'center',
          verticalAlign: 'middle',
          fill: ctx.theme.text,
          font: `600 ${ctx.compact ? 12 : 13}px ${ctx.theme.fontUi}`,
          backgroundColor: ctx.theme.surface,
          borderColor: ctx.theme.grid,
          borderWidth: 1,
          padding: [6, 10],
        },
      } as GraphicComponentOption)
    }
  })

  // Chart-wide keys (top row, left): overlays that recur across panels.
  const globalKeys: KeyEntry[] = []
  if (global.normals) globalKeys.push({ label: 'gridMET normal (1991–2020)', color: paint(ctx.theme, NORMALS.band), block: true })
  if (global.markers) {
    globalKeys.push({ label: '75th', color: normalColor, glyph: '▼' }, { label: 'median', color: normalColor, glyph: '●' }, { label: '25th pct. normal', color: normalColor, glyph: '▲' })
  }
  if (global.sensor) globalKeys.push({ label: SENSOR_EVENT.label, color: paint(ctx.theme, SENSOR_EVENT.fill), block: true })
  if (globalKeys.length) {
    // Laid out right-aligned from the end of the row, then shifted so the row starts at the plot's left edge.
    const row = keyRow(ctx, globalKeys, 10_000, 10)
    const first = Math.min(...row.map((g) => (g as { x: number }).x))
    row.forEach((g) => ((g as { x: number }).x += left - first))
    graphic.push(...row)
  }

  const xIdx = panels.map((_, i) => i)
  const xAxis: XAXisComponentOption[] = panels.map((_, i) => {
    // The axis is the loaded window, so the slider's track is what is plotted and its window starts full.
    const base = timeAxis({ min: m.view[0], max: m.view[1], compact: ctx.compact })
    const last = i === n - 1
    return { ...base, gridIndex: i, axisLabel: { ...(base.axisLabel as object), show: last }, axisTick: { show: last } } as XAXisComponentOption
  })
  const yAxis: YAXisComponentOption[] = panels.map((p, i) => {
    const base = valueAxis(plainLabel(p.axisTitle), p.noData ? { min: 0, max: 1 } : p.yRange ? { min: p.yRange[0], max: niceCeil(p.yRange[1]) } : isBar(p) ? { min: 0 } : {})
    return {
      ...base,
      gridIndex: i,
      nameGap: ctx.compact ? 36 : 46,
      nameTextStyle: { fontSize: ctx.compact ? 10 : 11, lineHeight: ctx.compact ? 12 : 14 },
      splitNumber: 3,
      axisLabel: { show: !p.noData, fontSize: ctx.compact ? 10 : 11 },
      splitLine: { show: !p.noData },
    } as YAXisComponentOption
  })

  const tipPeriod = m.period === 'daily' ? 'daily' : 'hourly'
  const formatter = (raw: TipParam | TipParam[]) => {
    const list = (Array.isArray(raw) ? raw : [raw]) as (TipParam & { seriesIndex?: number })[]
    if (list.length === 0) return ''
    const x = Number(list[0].axisValue ?? (Array.isArray(list[0].value) ? list[0].value[0] : NaN))
    const rows = new Map<number, string[]>()
    for (const p of list) {
      const meta = tipMeta[p.seriesIndex ?? -1]
      if (!meta || !Array.isArray(p.value)) continue
      const y = p.value[1]
      if (typeof y !== 'number' || !Number.isFinite(y)) continue
      const note = typeof p.value[2] === 'string' ? p.value[2] : undefined
      const text = note ? tipText(meta.label, note) : tipText(meta.label, `${fmtValue(y)}${meta.unit === '%' || meta.unit === '°' ? meta.unit : meta.unit ? ` ${meta.unit}` : ''}`)
      const panelRows = rows.get(meta.panel) ?? []
      panelRows.push(`<div>${typeof p.marker === 'string' ? p.marker : ''}${text}</div>`)
      rows.set(meta.panel, panelRows)
    }
    const parts = panels.map((pn, i) => {
      const spans = pn.sensorSpans.filter((s) => x >= s.x0 && x <= s.x1)
      const r = rows.get(i) ?? []
      if (!r.length && !spans.length) return ''
      const notes = spans.map((s) => `<div class="tooltip-sub">${escapeHtml(plainLabel(s.text)).replace(/\n/g, '<br>')}</div>`)
      // One panel (the variable page): the rows already name the variable.
      const head = n > 1 ? `<div class="tooltip-sub">${escapeHtml(pn.variable)}</div>` : ''
      return `${head}${r.join('')}${notes.join('')}`
    })
    return `<div class="tooltip-name">${escapeHtml(fmtWall(x, tipPeriod))}</div>${parts.join('')}`
  }

  // Compact touch pins the tooltip under the tapped panel (the stack is taller than the screen).
  const underPanel = (y: number) => topOf(Math.min(n - 1, Math.max(0, Math.floor((y - LAYOUT.top) / (h + LAYOUT.gap))))) + h

  const zoom = timeZoom(ctx).map((z) => ({
    ...z,
    xAxisIndex: xIdx,
    startValue: m.view[0],
    endValue: m.view[1],
    ...(z.type === 'slider' ? { bottom: 8 } : {}),
  }))

  return {
    useUTC: true,
    grid: panels.map((_, i) => ({ left, right, top: topOf(i), height: h })),
    xAxis,
    yAxis,
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    dataZoom: zoom,
    tooltip: { ...tooltipBase(ctx, n > 1 ? underPanel : undefined), trigger: 'axis', axisPointer: { type: 'line' }, formatter: formatter as never },
    graphic,
    series,
  } satisfies EChartsOption
}

/** Rows the sr-only twin keeps; a raw multi-week window would otherwise build a huge DOM. */
export const TABLE_ROW_LIMIT = 500

/**
 * The sr-only twin: one row per time step with any value (the first `limit`,
 * then a one-cell note row), one column per plotted column (plus its daily
 * low and high where the variable page attached a band).
 */
export function latestTimeseriesTable(m: LatestTimeseriesModel, limit = TABLE_ROW_LIMIT): ChartTable {
  const period = m.period === 'daily' ? 'daily' : 'hourly'
  const cols = m.ts.panels.flatMap((p) => {
    // Table precision per variable (core/variables/labels `digits.table`): "56.0" beside "70.4", never "56".
    const id = ELEM_MAP[p.variable]?.[0] ?? ''
    return p.series.flatMap((s) => {
      const { full, unit } = plainSeries(p, s)
      const name = unit ? `${full} (${unit})` : full
      return [
        { id, name, values: s.values },
        ...(s.band ? [{ id, name: `Low: ${name}`, values: s.band.lo }, { id, name: `High: ${name}`, values: s.band.hi }] : []),
      ]
    })
  })
  const rows: string[][] = []
  let total = 0
  m.ts.x.forEach((x, j) => {
    if (!Number.isFinite(x) || cols.every((c) => c.values[j] == null)) return
    if (++total > limit) return
    rows.push([isoWall(x, period), ...cols.map((c) => (c.values[j] == null ? MISSING : formatValue(c.id, c.values[j], 'table')))])
  })
  if (total > limit) {
    rows.push([`Showing first ${limit} of ${total} rows; use the Data Downloader for the full record.`])
  }
  return {
    caption: `Station observations (${m.period}): ${m.ts.panels.map((p) => p.variable).join(', ')}`,
    columns: [period === 'daily' ? 'Date' : 'Time (MT)', ...cols.map((c) => c.name)],
    rows,
  }
}
