# core/charts — ECharts option builders

Pure builders of type `ChartBuilder<M>` (`types.ts`), one file per figure
family, each with a sibling `*.test.ts`. The one host that renders them is
`ui/charts/chart.ts`. Import from `index.ts`.

| File | Exports |
|---|---|
| `agMet.ts` | `etrChart`/`etrTable` (`EtrModel`), `feelsLikeChart`/`feelsLikeTable`, `cciChart`/`cciTable` (CCI markers: one series per class, named by side, `CCI_GROUPS`: one ramp legend entry per side) |
| `agGdd.ts` | `gddChart`/`gddTable` (`GddModel`), `stageLines` (thinned; the stage reached and the highest stay), `stageGutter`, `fittedStageLabels` (full names, else stage codes), `gddAxisMax`, `GDD_NAMES` |
| `agLegend.ts` | `agLegend` (the Ag charts' plain wrapping legend: short names and no title on compact screens; an item may fill its icon with a color or a ramp), `liftForLegend`, `legendRows`, `sentenceCase` |
| `agSoil.ts` | `soilProfileChart`/`soilProfileTable` (`SoilProfileModel`; month ticks past 60 days, `monthStarts`), `swpChart`/`swpTable`, `percentSaturationChart`/`percentSaturationTable` |
| `agAnnual.ts` | `annualChart`/`annualTable` (`AnnualModel`; its years' key is `keys.ts`, current year first and strong) |
| `latestTimeseries.ts` | `latestTimeseriesChart`/`latestTimeseriesTable` (`LatestTimeseriesModel`; `fill: { rows }` + `fillRows`, the dashboard's equal, aligned rows; core/models/timeseries + the view, also the axis extent, + `partial`, today's daily row in progress), `latestTimeseriesHeight(n, compact)` |
| `variable.ts` | `variableChart`/`variableTable`/`variableTableAll` (`VariableModel`: a one-panel `LatestTimeseriesModel`; the plot fills the host height), `dashboardStackChart` (the dashboard's stacks: compact, `fill` rows aligned across stacks) |
| `windRose.ts` | the one wind rose: `windRoseChart` (Now's card) and `windRoseLargeChart` (the Wind direction page's Rose view; key beside it from `ROSE_SIDE_KEY_MIN_WIDTH`), `windRoseFitChart` (the dashboard: key beside or under, by the box's shape) over one option (radius: percent of every reading, calm included), `windRoseTable` (fixed order, bin shares, a Share column, calm readings in the caption) (`WindRoseModel` from `core/models/windRose`, calm counted apart), `windRoseTitle` (`last24h`: "Wind, last 24 hours"), `binName` |
| `downloaderPreview.ts` | `downloaderPreviewChart`/`downloaderPreviewTable` (`PreviewModel` from `core/models/downloaderPreview`), `previewHeight(m, compact)` |
| `heroStrip.ts` | `heroStripChart`/`heroStripTable` (`HeroStripModel` from `core/overview/hero.ts`): the Now 48 h strip, observed → NWS hourly forecast, no zoom |
| `theme.ts` | `readChartTheme(name, getVar)` (kit tokens → `ChartTheme`), `echartsTheme(t)`, `paint(t, role)` (palette role → color) |

## Shared helpers (internal to this folder)

- `keys.ts`: the one key style (`keyRow`, `wrapKeys`, `rowWidth`, `KeyEntry`): swatches with muted labels at the top left of the plot, drawn as graphics; used by `latestTimeseries`/`variable` and `agAnnual`.
- `format.ts`: `wallMs` (contract local time → Denver wall-clock ms, daily at noon), `fmtWall`/`isoWall`, `fmtNum`, `plainLabel` (Plotly `<br>`/`<sup>` → text), `escapeHtml`.
- `style.ts`: **the one chart style** (DESIGN.md "Chart style"); every builder uses it. `LINE_WIDTH`/`REF_WIDTH`; `stepMs(interval, xs)` and `points(xs, ys, step, notes?)` (a null midway across every step over 1.5 × the interval: gaps are breaks); `isAccumulation` (bars at every interval) and `runningTotal`; `axisFamily`/`yBounds`/`yAxisRange` (the y-axis rule per variable family); `plotExtent` (the x extent; half a step more for bars); `showsSlider`, `bottomLayout`, `timeZoom` (inside + slider; no drag-pan on compact; on touch the inside zoom is `disabled`, so swipes scroll the page), `zoomTrace` (the slider's background trace: a hidden first series on a hidden y axis), `timeFrame` (all of these for a one-grid time chart); `animates` (first draw only).
- `axes.ts`: `timeAxis` (wall-clock level ticks), `valueAxis(name)`, `logAxis(name, min, max, {inverse, prefix})`, `dualAxis(left, right)` (y2 aligned, from 0), `grid`, `niceCeil`, `logExtent`, `fitAxisNames`.
- `series.ts`: `lineSeries` (style width, straight, no symbols, LTTB over `LTTB_THRESHOLD`), `barSeries`, `markerSeries`; ids starting `AUX` (`aux:`) are drawing aids, skipped by tooltips, legends and the fidelity harness.
- `tooltip.ts`: `tooltipBase(ctx, pinTop?)` (kit `.mco-tooltip`; on touch tap-triggered, on compact touch full width and pinned under the chart or at `pinTop`), `axisTooltip(ctx, header, row)`, `tipText`, `legend(ctx, {data, title})` (bottom scroll legend; optional title text).
- `overlays.ts`: `bandSeries` (the one band style: stacked base + fill, under its line), `hBandSeries` (horizontal bands + boxed labels + dashed lines, e.g. SWP FC/WP, each labelled at its line), `sensorEventSeries` (hatched spans), `labelledLines` (markLines, e.g. GDD stages), `hatchDecal`.
- `heatmap.ts`: `colorBar(ctx, scale, extent, {midpoint, ticks})` (hidden visualMap + bar drawn as graphics with min/max and the palette `midpointLabel`; vertical at the right with `gridTop` keeping its title off the plot, horizontal under the plot when `ctx.compact`), `frozenSeries` (hatched mask cells).
- `zoom.ts` (used by the host): wall-clock ms ↔ category index (`categoryMs`, `toAxisRange`, `fromAxisRange`), `sameRange`, `carryState` (zoom + legend toggles across redraws).
- `testing.ts`: `testCtx(theme)` for tests (kit 0.11.3 token values).

## Contract

- `(model, ctx) => EChartsOption`. Pure: no DOM, no Alpine, no fetch, no `new Date(string)`.
- Input is a model from `core/models/` or an Ag contract series (SI). **Units convert at the edge**, inside the builder.
- Colors come only from `core/palette` roles (`paint()` for TokenRefs) and `ctx.theme`. No hex literals in builders. Chrome (text, axes, fonts) comes from the ECharts theme, so builders rarely touch it.
- Time axes: x is Denver wall-clock ms; set `useUTC: true`. A category x axis (heatmaps) puts each category's wall-clock ms in `xAxis.data` (format labels in `axisLabel.formatter`), so the host's zoom API stays in ms.
- Don't set `animation`; the host animates a chart's first draw only (style `animates`), never under reduced motion.
- Draw through `style.ts`: gaps with `points(…, stepMs(interval))`, accumulations as bars, the y axis with `yAxisRange`, the zoom with `timeFrame` (or `showsSlider` + `timeZoom` + `zoomTrace` for stacked grids).
- Every builder that draws data exports a `…Table(model): ChartTable` twin.
- Register any new ECharts part in `ui/charts/echarts.ts`; builders import types only from `echarts`.

## How to add a chart

1. Shape the data in `core/models/<name>.ts` (+ test) if the builder would otherwise need logic beyond layout.
2. Add `core/charts/<name>.ts` exporting `xChart: ChartBuilder<XModel>` and `xTable(model): ChartTable`, built from the helpers above; colors from `core/palette`.
3. Add `<name>.test.ts`: series types/count, axes, palette colors per theme (loop `THEMES` with `testCtx`), table columns/rows. No snapshots.
4. Re-export it from `index.ts`; if it needs a new ECharts part, add it to `ui/charts/echarts.ts`.
5. In the card's component, expose the bindings and render with the host:
   `<div class="chart" x-data="chart({ builder: xChart, table: xTable, label: 'X', model: () => xModel() })"></div>`.
   Optional: `onZoom(fromMs, toMs)` (debounced 250 ms, user zooms only) and `range: () => [fromMs, toMs]` to apply a zoom (e.g. from the URL). `range` runs in its own effect (it never re-renders) and is re-applied after model renders; a range equal to the visible window (±1 min) is ignored, so writing `onZoom` into the URL and reading it back as `range` does not loop. The host element carries `data-zoom="fromMs,toMs"` for tests.
6. Check it in `ui/charts/demo.html` (`npm run dev`, then `/mesonet-dashboard/next/src/ui/charts/demo.html?theme=light`).

## Behaviour kept from the Plotly builders (web/src/features/ag/figures)

Re-expressed in `agMet.test.ts`, `agGdd.test.ts`, `agSoil.test.ts`, `agAnnual.test.ts`:
ETr totals and axis titles; feels-like/CCI marker series per class in order,
°F, adult ≠ newborn, legend titles; GDD bar name, stage tooltip text, the
projection series order and anchors, y2 ≥ q75; SWP inverse log axis with "-"
ticks, FC/WP bands, lines and their labels, depth names; heatmap depth
dropping, frozen layer, 32 °F and 15 bar midpoints, log10 SWP; annual sort,
current-year style, cumulative label. Intentional changes are under "Charts"
in `web-next/DIVERGENCES.md`.
