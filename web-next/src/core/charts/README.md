# core/charts — ECharts option builders

Pure builders of type `ChartBuilder<M>` (`types.ts`), one file per figure
family, each with a sibling `*.test.ts`. The one host that renders them is
`ui/charts/chart.ts`. Import from `index.ts`.

| File | Exports |
|---|---|
| `agMet.ts` | `etrChart`/`etrTable` (`EtrModel`), `feelsLikeChart`/`feelsLikeTable`, `cciChart`/`cciTable` |
| `agGdd.ts` | `gddChart`/`gddTable` (`GddModel`), `stageLines`, `gddAxisMax`, `GDD_NAMES` |
| `agSoil.ts` | `soilProfileChart`/`soilProfileTable` (`SoilProfileModel`), `swpChart`/`swpTable`, `percentSaturationChart`/`percentSaturationTable` |
| `agAnnual.ts` | `annualChart`/`annualTable` (`AnnualModel`) |
| `latestTimeseries.ts` | `latestTimeseriesChart`/`latestTimeseriesTable` (`LatestTimeseriesModel`: core/models/timeseries + view/extent), `latestTimeseriesHeight(n, compact)` |
| `windRose.ts` | `windRoseChart`/`windRoseTable` (`WindRoseModel` from `core/models/windRose`), `windRoseTitle`, `binName` |
| `theme.ts` | `readChartTheme(name, getVar)` (kit tokens → `ChartTheme`), `echartsTheme(t)`, `paint(t, role)` (palette role → color) |

W2 adds `timeseries.ts` and `downloaderPreview.ts` the same way.

## Shared helpers (internal to this folder)

- `format.ts`: `wallMs` (contract local time → Denver wall-clock ms, daily at noon), `fmtWall`/`isoWall`, `fmtNum`, `plainLabel` (Plotly `<br>`/`<sup>` → text), `escapeHtml`.
- `axes.ts`: `timeAxis` (wall-clock level ticks), `valueAxis(name)`, `logAxis(name, min, max, {inverse, prefix})`, `dualAxis(left, right)` (y2 aligned, from 0), `grid`, `timeZoom` (inside + slider; no drag-pan on compact), `niceCeil`, `logExtent`.
- `series.ts`: `points(xs, ys, notes?)` (breaks lines at gaps > 1.5× cadence), `lineSeries` (LTTB over `LTTB_THRESHOLD`), `barSeries`, `markerSeries`; ids starting `AUX` (`aux:`) are drawing aids, skipped by tooltips and legends.
- `tooltip.ts`: `tooltipBase` (kit `.mco-tooltip`), `axisTooltip(ctx, header, row)`, `tipText`, `legend(ctx, {data, title})` (bottom scroll legend; optional title text).
- `overlays.ts`: `bandSeries` (stacked q25–q75 style band), `normalsSeries`, `hBandSeries` (horizontal bands + corner labels + dashed lines, e.g. SWP FC/WP), `sensorEventSeries` (hatched spans), `labelledLines` (markLines, e.g. GDD stages), `hatchDecal`.
- `heatmap.ts`: `colorBar(ctx, scale, extent, {midpoint, ticks})` (hidden visualMap + bar drawn as graphics with min/max and the palette `midpointLabel`; vertical at the right, horizontal under the plot when `ctx.compact`), `frozenSeries` (hatched mask cells).
- `zoom.ts` (used by the host): wall-clock ms ↔ category index (`categoryMs`, `toAxisRange`, `fromAxisRange`), `sameRange`, `carryState` (zoom + legend toggles across redraws).
- `testing.ts`: `testCtx(theme)` for tests (kit 0.7.1 token values).

## Contract

- `(model, ctx) => EChartsOption`. Pure: no DOM, no Alpine, no fetch, no `new Date(string)`.
- Input is a model from `core/models/` or an Ag contract series (SI). **Units convert at the edge**, inside the builder.
- Colors come only from `core/palette` roles (`paint()` for TokenRefs) and `ctx.theme`. No hex literals in builders. Chrome (text, axes, fonts) comes from the ECharts theme, so builders rarely touch it.
- Time axes: x is Denver wall-clock ms; set `useUTC: true`. A category x axis (heatmaps) puts each category's wall-clock ms in `xAxis.data` (format labels in `axisLabel.formatter`), so the host's zoom API stays in ms.
- Don't set `animation`; the host turns it on for first draws unless the user prefers reduced motion.
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
ticks, FC/WP bands, lines and corner labels, depth names; heatmap depth
dropping, frozen layer, 32 °F and 15 bar midpoints, log10 SWP; annual sort,
current-year style, cumulative label. Intentional changes are under "Charts"
in `web-next/DIVERGENCES.md`.
