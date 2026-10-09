/**
 * Latest Data station plot: one grid per selected variable, stacked, on one
 * shared time axis with one dataZoom. Lines per column (soil depths colored
 * by depth), bars for precipitation and reference ET, gridMET normals (band
 * or percentile markers), hatched sensor-change spans and per-panel
 * "not available" notes, in the house chart style (style.ts: gaps, y-axis
 * rule, slider and its trace). Every key sits in one place: a row at the top
 * left of its panel. Wind direction is drawn as small dots with compass ticks
 * (windDirection.ts). Input is core/models/timeseries (display units).
 */
import type { EChartsOption, GraphicComponentOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { TimeseriesModel, TimeseriesPanel, TimeseriesSeries } from '../models/timeseries'
import { isDepthVariable, panelNoDataText } from '../models/timeseries'
import { DAILY_RANGE, ETR, NORMALS, PRECIP, SENSOR_EVENT, depthColor, previewColor, sensorColor, variableStyle, withAlpha } from '../palette'
import { ELEM_MAP } from '../params/latest'
import type { LatestAgg } from '../url-schema'
import { WIND_DIRECTION } from '../variables/direction'
import { formatValue, plainName, plainUnit } from '../variables/labels'
import { timeAxis, valueAxis } from './axes'
import { MISSING, escapeHtml, fmtWall, isoWall, plainLabel } from './format'
import { bandSeries, sensorEventSeries } from './overlays'
import { AUX, barSeries, lineSeries, markerSeries } from './series'
import { REF_WIDTH, extentOf, isAccumulation, points, runningTotal, showsSlider, stepMs, timeZoom, valued, yAxisRange, zoomTrace, type Point } from './style'
import { paint } from './theme'
import { tipText, tooltipBase, type TipParam } from './tooltip'
import { PARTIAL_DAY_LABEL } from '../latest/view'
import { keyRow, rowWidth, type KeyEntry } from './keys'
import type { ChartBuilder, ChartContext, ChartTable } from './types'
import { DIRECTION_SHAPES, compassTick, directionDots } from './windDirection'

export interface LatestTimeseriesModel {
  ts: TimeseriesModel
  period: LatestAgg
  /** Visible window (the URL dates, ending at the next hour when that is sooner: core/latest `untilNow`), wall-clock ms. */
  view: [number, number]
  /**
   * Daily only: today's row (x, wall-clock ms at 00:00) while the day is in progress (core/latest
   * `partialDay`), drawn as a hollow ring or a lighter bar and labelled "Today (so far)".
   */
  partial?: number | null
  /**
   * The dashboard's stacks: `rows` equal rows share the canvas height (`ctx.height`) instead of a fixed
   * panel height, every gap the same (room for a key row), so stacks given the same `rows` put their
   * panels at the same heights side by side; a shorter stack's last panel takes its empty rows, so both
   * time axes end level. Without a height it falls back to the fixed layout.
   */
  fill?: { rows: number }
}

/**
 * Layout in CSS px. Each panel has a key row (depths, columns) in the gap above it; the first
 * panel's also carries the chart-wide keys, on a row of their own under the station's keys when
 * one row is too long. A gap above a panel with keys is `keyPad` taller, so the row clears the
 * panel above. Under the last panel: the x labels and the slider (style `bottomLayout(true)`: 56),
 * or the labels alone on phones.
 */
export const LAYOUT = { panel: 190, single: 340, compactPanel: 160, gap: 34, keyPad: 10, top: 30, bottom: 56, compactBottom: 30 } as const

const panelPx = (n: number, compact: boolean) => (n === 1 ? LAYOUT.single : compact ? LAYOUT.compactPanel : LAYOUT.panel)

/** True when a panel draws a key row (soil depths, several sensors, the Daily band); bars never do. */
export const panelHasKeys = (p: TimeseriesPanel): boolean => !isBar(p) && p.series.some((s) => !!s.depth || p.legend || !!s.band)

/**
 * Gaps that get `keyPad` (panels after the first with keys): from the panels once loaded, else
 * predicted from the variable names (soil depths; core/models/timeseries `isDepthVariable`).
 */
export function keyedGaps(panels: readonly TimeseriesPanel[] | readonly string[]): number {
  return panels.slice(1).filter((p) => (typeof p === 'string' ? isDepthVariable(p) : panelHasKeys(p))).length
}

/** Canvas height for `n` panels, `keyed` of them past the first with keys; the component sets it as `--chart-height`. */
export function latestTimeseriesHeight(n: number, compact: boolean, keyed = 0): number {
  const k = Math.max(1, n)
  return LAYOUT.top + k * panelPx(k, compact) + (k - 1) * LAYOUT.gap + keyed * LAYOUT.keyPad + (compact ? LAYOUT.compactBottom : LAYOUT.bottom)
}

/**
 * The rows of a filling stack (`fill`): each row's top and the panel height, from the canvas `height`
 * shared evenly by `rows` rows after the top, uniform gaps (each with room for a key row) and the x
 * labels; panels at least 40 px. Depends only on `rows` and `height`, so two stacks align row for row.
 */
export function fillRows(rows: number, height: number, compact: boolean): { height: number; tops: number[] } {
  const n = Math.max(1, rows)
  const gap = LAYOUT.gap + LAYOUT.keyPad
  const h = Math.max(40, Math.floor((height - LAYOUT.top - (n - 1) * gap - (compact ? LAYOUT.compactBottom : LAYOUT.bottom)) / n))
  return { height: h, tops: Array.from({ length: n }, (_, i) => LAYOUT.top + i * (h + gap)) }
}

/** Bars: the totals per interval (rain, reference ET) and rain rate (the interval's peak rate, beside rain's bars). */
function isBar(p: TimeseriesPanel): boolean {
  return isAccumulation(p.variable) || p.variable === 'Max Precip Rate'
}

/** Line/bar color of one column (palette roles only). */
export function seriesColor(ctx: ChartContext, p: TimeseriesPanel, s: TimeseriesSeries, panelIndex: number): string {
  const theme = ctx.theme.name
  if (p.variable === 'Precipitation') return PRECIP[theme].bar
  if (p.variable === 'Reference ET') return ETR[theme].bar
  if (s.depth) return depthColor(Number.parseInt(s.depth, 10), theme)
  // Several sensors in one panel (heights, wells): told apart by color alone (every line is solid).
  if (p.legend && p.series.length > 1) return sensorColor(Math.max(0, p.series.indexOf(s)), theme)
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

/** Today's partial daily bar: its color at this alpha, outlined in the full color. */
const PARTIAL_BAR_ALPHA = 0.35
/** Today's partial daily point: a hollow ring this wide (px), over the line or dots. */
const PARTIAL_RING = 8

export const latestTimeseriesChart: ChartBuilder<LatestTimeseriesModel> = (m, ctx) => {
  const { panels } = m.ts
  const n = panels.length
  const filled = m.fill && ctx.height ? fillRows(m.fill.rows, ctx.height, ctx.compact) : null
  const h = filled ? filled.height : panelPx(n, ctx.compact)
  const left = ctx.compact ? 56 : 72
  const right = 16
  const plotW = Math.max(40, ctx.width - left - right)
  // Panel tops: each gap above a panel with keys is LAYOUT.keyPad taller.
  const tops = filled ? filled.tops : panels.reduce<number[]>((t, p, i) => [...t, i === 0 ? LAYOUT.top : t[i - 1] + h + LAYOUT.gap + (panelHasKeys(p) ? LAYOUT.keyPad : 0)], [])
  const topOf = (i: number) => tops[i] ?? LAYOUT.top
  const ok = m.ts.x.map(Number.isFinite)
  // Daily rows sit at local noon so a bar fills its own day (as the Ag charts, format.ts wallMs).
  const shift = m.period === 'daily' ? 12 * 3_600_000 : 0
  const xs = m.ts.x.filter((_, j) => ok[j]).map((x) => x + shift)
  const pick = <T>(arr: readonly T[]) => arr.filter((_, j) => ok[j])
  // Gaps are breaks: a step over 1.5 × the interval (5-min: the station's cadence) gets a null.
  const step = stepMs(m.period, xs)
  const pts = (ys: readonly (number | null)[]) => points(xs, pick(ys), step)
  const normalColor = paint(ctx.theme, NORMALS.line)
  // Today's daily row while the day is in progress, as drawn (at noon), and its index in `m.ts.x`.
  const partialX = m.partial != null ? m.partial + shift : null
  const partialAt = m.partial != null ? m.ts.x.indexOf(m.partial) : -1
  const hasPartial = (s: TimeseriesSeries) => partialAt >= 0 && s.values[partialAt] != null

  const series: SeriesOption[] = []
  /** Per series id: its panel and how the tooltip labels it (absent = skip). */
  const tipMeta = new Map<string, { panel: number; label: string; unit: string }>()
  const push = (s: SeriesOption, meta: { panel: number; label: string; unit: string } | null) => {
    series.push(s)
    if (meta) tipMeta.set(String(s.id), meta)
  }
  const graphic: GraphicComponentOption[] = []
  const global = { normals: false, markers: false, sensor: false, partialLine: false, partialBar: null as string | null }
  const panelKeys: KeyEntry[][] = []

  panels.forEach((p, i) => {
    const axes = { xAxisIndex: i, yAxisIndex: i }
    const keys: KeyEntry[] = []
    p.series.forEach((s, j) => {
      const color = seriesColor(ctx, p, s, i)
      const { label, unit } = plainSeries(p, s)
      if (isBar(p)) {
        // barMinWidth: hourly bars over two weeks on a phone (or raw ones over a week) are under a
        // pixel apart; 2 px keeps a shower visible, and neighbours merge into one wet spell.
        // Today's partial bar is lighter, outlined in the full color.
        const partialStyle = { color: withAlpha(color, PARTIAL_BAR_ALPHA), borderColor: color, borderWidth: 1 }
        const data = pts(s.values).map((pt) => (hasPartial(s) && pt[0] === partialX ? { value: pt, itemStyle: partialStyle } : pt))
        if (hasPartial(s)) global.partialBar = withAlpha(color, PARTIAL_BAR_ALPHA)
        push({ ...barSeries(s.name, data as Point[], color, i), ...axes, barMinWidth: 2, id: `p${i}:${s.name}` }, { panel: i, label, unit })
        return
      }
      const dots = p.variable === WIND_DIRECTION
      // Every line is solid: depths and sensors are told apart by color (core/palette roma), and in the key and tooltip by name.
      const shape = DIRECTION_SHAPES[p.legend ? j % DIRECTION_SHAPES.length : 0]
      const style = { color, yAxisIndex: i, id: `p${i}:${s.name}` }
      push({ ...(dots ? directionDots(s.name, pts(s.values), { ...style, symbol: shape.symbol }) : lineSeries(s.name, pts(s.values), style)), xAxisIndex: i }, {
        panel: i,
        label,
        unit,
      })
      // Today's partial point: a hollow ring over the line's (or the dots') last point.
      if (hasPartial(s) && partialX !== null) {
        global.partialLine = true
        const ring = markerSeries(`${AUX}partial`, [[partialX, s.values[partialAt]]], { color, size: PARTIAL_RING })
        push({ ...ring, ...axes, id: `${AUX}p${i}-partial-${j}`, itemStyle: { color: ctx.theme.surface, borderColor: color, borderWidth: 2 }, z: 4, silent: true, large: false }, null)
      }
      if (s.depth) keys.push({ label: s.depth, color })
      else if (p.legend) keys.push({ label: columnKey(p.variable, s.name), color, ...(dots ? { glyph: shape.glyph } : {}) })
      // The variable page's Daily band (core/variables/band; drawn by variable.ts) and the mean it surrounds.
      else if (s.band) keys.push({ label: 'Daily mean', color }, { label: DAILY_RANGE.label, color: withAlpha(color, DAILY_RANGE.alpha), block: true })
    })

    const nm = p.normals
    if (nm?.kind === 'band') {
      global.normals = true
      const band = bandSeries('gridMET normal', `${AUX}normal-base`, xs, pick(nm.min), pick(nm.max), {
        color: paint(ctx.theme, NORMALS.band),
        yAxisIndex: i,
        digits: 1,
        stack: `normals${i}`,
        step,
      })
      band.forEach((s, k) => push({ ...s, xAxisIndex: i, z: 1 }, k === 1 ? { panel: i, label: 'gridMET normal', unit: '' } : null))
      for (const [edge, ys] of [['min', nm.min], ['max', nm.max]] as const) {
        push({ ...lineSeries(`${AUX}normal-${edge}`, pts(ys), { color: normalColor, width: REF_WIDTH, dash: NORMALS.dash, yAxisIndex: i, id: `${AUX}p${i}-normal-${edge}` }), xAxisIndex: i, silent: true }, null)
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

    panelKeys.push(keys)
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

  // Chart-wide keys: overlays that recur across panels, after the first panel's own keys.
  const globalKeys: KeyEntry[] = []
  if (global.normals) globalKeys.push({ label: 'gridMET normal (1991–2020)', color: paint(ctx.theme, NORMALS.band), block: true })
  if (global.markers) {
    globalKeys.push({ label: '75th', color: normalColor, glyph: '▼' }, { label: 'median', color: normalColor, glyph: '●' }, { label: '25th pct. normal', color: normalColor, glyph: '▲' })
  }
  if (global.sensor) globalKeys.push({ label: SENSOR_EVENT.label, color: paint(ctx.theme, SENSOR_EVENT.fill), block: true })
  if (global.partialLine) globalKeys.push({ label: PARTIAL_DAY_LABEL, color: ctx.theme.textMuted, glyph: '○' })
  else if (global.partialBar) globalKeys.push({ label: PARTIAL_DAY_LABEL, color: global.partialBar, block: true })
  panelKeys.forEach((keys, i) => {
    const first = i === 0 ? [...keys, ...globalKeys] : keys
    if (i > 0 || !keys.length || rowWidth(ctx, first) <= plotW) {
      if (first.length) graphic.push(...keyRow(ctx, first, left, topOf(i) - 12))
      return
    }
    // Too long for one row: the station's own keys first, the chart-wide keys on a row under them.
    graphic.push(...keyRow(ctx, keys, left, topOf(0) - 23), ...keyRow(ctx, globalKeys, left, topOf(0) - 9))
  })

  const xIdx = panels.map((_, i) => i)
  const xAxis: XAXisComponentOption[] = panels.map((_, i) => {
    // The axis is the loaded window, so the slider's track is what is plotted and its window starts full.
    const base = timeAxis({ min: m.view[0], max: m.view[1], compact: ctx.compact })
    const last = i === n - 1
    // No snap: each panel's crosshair would jump to its own nearest point (bars, gaps and thinned lines
    // differ), so the linked lines would sit a few px apart; unsnapped they are all at the cursor's time.
    return { ...base, gridIndex: i, axisLabel: { ...(base.axisLabel as object), show: last }, axisTick: { show: last }, axisPointer: { snap: false } } as XAXisComponentOption
  })
  const yAxis: YAXisComponentOption[] = panels.map((p, i) => {
    // The variable's y-axis rule over everything the panel draws (its columns, the daily band, normals).
    const nm = p.normals
    const normals = nm?.kind === 'band' ? [nm.min, nm.max] : nm?.kind === 'markers' ? [nm.p25, nm.median, nm.p75] : []
    const range = p.noData ? { min: 0, max: 1 } : yAxisRange(p.variable, ...extentOf(...p.series.flatMap((s) => [s.values, s.band?.lo, s.band?.hi]), ...normals))
    return {
      ...valueAxis(plainLabel(p.axisTitle)),
      ...range,
      gridIndex: i,
      nameGap: ctx.compact ? 36 : 46,
      nameTextStyle: { fontSize: ctx.compact ? 10 : 11, lineHeight: ctx.compact ? 12 : 14 },
      axisLabel: { show: !p.noData, fontSize: ctx.compact ? 10 : 11, ...(p.variable === WIND_DIRECTION ? { formatter: compassTick } : {}) },
      splitLine: { show: !p.noData },
    } as YAXisComponentOption
  })

  const tipPeriod = m.period === 'daily' ? 'daily' : 'hourly'
  const formatter = (raw: TipParam | TipParam[]) => {
    const list = Array.isArray(raw) ? raw : [raw]
    if (list.length === 0) return ''
    const x = Number(list[0].axisValue ?? (Array.isArray(list[0].value) ? list[0].value[0] : NaN))
    const rows = new Map<number, string[]>()
    for (const p of list) {
      const meta = tipMeta.get(String(p.seriesId))
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
    const when = x === partialX ? `${PARTIAL_DAY_LABEL}, ${fmtWall(x, tipPeriod)}` : fmtWall(x, tipPeriod)
    return `<div class="tooltip-name">${escapeHtml(when)}</div>${parts.join('')}`
  }

  // Compact touch pins the tooltip under the tapped panel (the stack is taller than the screen).
  const underPanel = (y: number) => topOf(tops.filter((t, i) => i > 0 && t <= y).length) + h

  // The slider (style `showsSlider`) spans the window and traces the first panel (`panelTrace`).
  const trace = panels[0] ? panelTrace(panels[0], pts) : []
  const slider = showsSlider(ctx, m.view, valued(trace)) ? zoomTrace(trace, m.view, { yAxisIndex: n }) : null

  return {
    useUTC: true,
    // A filled stack with fewer panels than rows: its last panel takes the empty rows, so its time axis
    // ends level with the longer stack's beside it. outerBoundsMode 'none': ECharts 6 would otherwise move a
    // panel's plot in to fit wide y labels ("852.5"), so panels (and a moment on them) would sit px apart.
    grid: panels.map((_, i) => ({ left, right, top: topOf(i), height: filled && i === n - 1 ? filled.tops[filled.tops.length - 1] + h - topOf(i) : h, outerBoundsMode: 'none' as const })),
    xAxis,
    yAxis: slider ? [...yAxis, slider.yAxis] : yAxis,
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    dataZoom: timeZoom(ctx, { xAxisIndex: xIdx, extent: m.view, slider: !!slider }),
    tooltip: { ...tooltipBase(ctx, n > 1 ? underPanel : undefined), trigger: 'axis', axisPointer: { type: 'line' }, formatter: formatter as never },
    graphic,
    series: slider ? [slider.series, ...series] : series,
  } satisfies EChartsOption
}

/**
 * A panel's slider trace: its first column (the main line; on the Daily interval the mean, which
 * the band surrounds; the shallowest soil depth), or for an accumulation its running total, so the
 * track is never a flat row of bars.
 */
export function panelTrace(p: TimeseriesPanel, pts: (ys: readonly (number | null)[]) => Point[]): Point[] {
  const s = p.series[0]
  if (!s) return []
  return pts(isBar(p) ? runningTotal(s.values) : s.values)
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
    // Today's partial daily row keeps its date, so the column stays a date column.
    rows.push([x === m.partial ? `${isoWall(x, period)} (so far)` : isoWall(x, period), ...cols.map((c) => (c.values[j] == null ? MISSING : formatValue(c.id, c.values[j], 'table')))])
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
