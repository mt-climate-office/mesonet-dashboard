# core/charts — ECharts option builders

Empty at W0. W1 writes one file per figure family here (`timeseries.ts`,
`windRose.ts`, `downloaderPreview.ts`, `agMet.ts`, `agGdd.ts`, `agSoil.ts`,
`agAnnual.ts`), each exporting pure builders of type `ChartBuilder<M>`
(`types.ts`), plus one `*.test.ts` per file.

## Contract

- `(model, ctx) => EChartsOption`. Pure: no DOM, no Alpine, no fetch, no
  `Date` parsing of strings. Same input → deep-equal output.
- Input is a model from `core/models/` (Latest, wind rose, Downloader preview)
  or an Ag contract series from `core/ag/compute` (SI). **Units convert at the
  edge**, inside the builder, with `core/ag/compute/units.ts` /
  `core/ag/view/labels.ts` `fromSi`; nothing upstream converts.
- Colors come only from `core/palette` (W1) and `ctx.theme`. No hex literals
  in builders.
- Time axes: x is Denver wall-clock ms; set `useUTC: true`.
- Large series: `sampling: 'lttb'` on line series over ~2 000 points.
- Text from `core/params` (axis titles) can carry Plotly markup (`<br>`,
  `<sup>-1</sup>`): convert `<br>` to `\n` and `<sup>` to Unicode
  superscripts in one shared helper here, not per builder.
- Each builder that draws data exports a `…Table(model): ChartTable` twin for
  the host's `.sr-only` table.
- Register only the ECharts parts you use in `ui/charts/chart.ts`
  (tree-shaking); builders import types only from `echarts`.

## Behaviour to keep from the Plotly builders (web/src/features/ag/figures)

Ported tests live in `core/ag/view/labels.test.ts` (the renderer-free parts).
The renderer-specific assertions in `figures.test.ts` must be re-expressed
against ECharts options:

- **ETr**: bars in inches + cumulative line on a second y axis; totals match
  `Σ etoMm / 25.4`; y titles "Reference ET (a=0.23) [in]" / "Cumulative
  Reference ET (a=0.23) [in]"; hourly hover shows HH:mm.
- **Feels like**: one line (no hover) + one marker series per regime present,
  in °F, named by `FEELS_LIKE_LABELS`; marker count = non-null values.
- **CCI**: marker series in `CCI_CLASSES` severity order; adult vs newborn
  differ in winter; legend title "Livestock Risk (adult|newborn)".
- **GDD**: daily bars named "Daily GDDs (lo–hi °F)" (∞ for an open cap) +
  cumulative on y2 with per-stage marker colors when a stage table exists;
  hover "No stage table for <crop>" or "n/a (custom cutoffs)" otherwise.
  Projection order: q25 (hidden), "Projected range (normals 25th–75th
  pct.)", "Projected (NWS forecast)" (starts at the last observed day),
  "Projected (normals median)" (starts at the last forecast day); y2 max ≥
  the last q75.
- **SWP**: reversed log axis with a "-" tick prefix; FC/WP bands +
  dashed lines at `SWP_FIELD_CAPACITY` / `SWP_WILTING_POINT`; one line per
  depth named `depthLabel(cm)`; "Field Capacity" (top-left) and "Wilting
  Point" (bottom-left) corner labels.
- **Soil profile heatmap**: drops all-null depths (and depths with no data
  before masking, e.g. no EC probe → empty option); frozen cells as a
  separate grey hatched layer; soil temperature diverging around 32 °F;
  SWP drawn on log10(bar) with FC/WP ticks.
- **Annual**: one line per year sorted by year, current year in
  `--text-primary` at width 3, prior years from batlow; y title from
  `annualAxisLabel`.

Latest timeseries, wind rose and Downloader preview behaviour is in the
model files' docs and tests (`core/models/*.ts`).
