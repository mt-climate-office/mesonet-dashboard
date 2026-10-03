# Fidelity harness (web-next)

Compares web-next with the current React app (`web/`) on the same API and QC level (2), and
web-next's Ag numbers with the API's `/derived`. It is the W4 cutover evidence together with
`CHECKLIST.md`. It is a port of `web/scripts/fidelity/` (which compared legacy Dash with `web/`);
`web/` is frozen, so that copy stays as it was.

## Run

```sh
cd web-next
node scripts/fidelity/run.mjs            # everything, full station matrix (~2–3 h)
```

That one command starts both Vite dev servers if they are not already answering
(`web/` on :5188, web-next on :5189; override with `WEB_URL` / `NEXT_URL`) and stops the ones it
started. Options:

```sh
node scripts/fidelity/run.mjs --compare latest,ag,downloader,ag-api \
  --stations acebozem,lololowr --scenarios default,daily --out DIR --headed
node scripts/fidelity/run.mjs --recompare      # re-diff saved captures, no browser
node scripts/fidelity/run.mjs --report-only    # rebuild DIR/report.html and DIR/results.json
FIDELITY_DEBUG=1 node scripts/fidelity/run.mjs …   # print each wait step
```

- **Needs** `npm ci` in `web-next/` (its `playwright` dev dependency), `npm ci --ignore-scripts`
  in `web/` (to serve it), and an installed Chrome (`channel: 'chrome'`;
  `FIDELITY_CHROMIUM=/path` overrides).
- **Output** (default: the session scratchpad `…/fidelity-next`, env `FIDELITY_OUT`):
  `DIR/<compare>/results.json`, `captures/*.json` (every extracted figure, card and log),
  `shots/*.png`, `files/*.csv`; `DIR/results.json` (summary) and `DIR/report.html`
  (scenario × station matrix with details).
- **Exit code** 1 if any item is FAIL or ERROR.
- **Every page** is 1440 × 1000, light color scheme, `America/Denver`; web-next also gets
  `?theme=light`. Theme independence is the axe job's concern, not this one.
- **Gentle with the API:** items run one after another, web/ then web-next, with a pause between
  items. Waits are for render evidence (a drawn chart, an empty-state text, no "Loading…"), then a
  2 s quiet period with no xhr/fetch, never `networkidle`; timeouts are generous (`config.mjs`).

## Comparisons

| `--compare` | A | B | What it checks |
|---|---|---|---|
| `latest` | web/ Latest Data | web-next Compare / Now / About | Every station × the old scenario set (hourly default, daily, daily + gridMET, raw, the sensor-change window for `sensor-change` stations, and each top/bottom card). Since the P1 routes web-next shows the plot on Compare (`#charts`, `cmp=1`), the photo, forecast and wind rose on Now (the wind rose only at stations without a camera) and the map, details and readings on About (`config.mjs` `sc.next`). Timeseries and wind-rose traces (values by timestamp, panel titles), sensor-change spans, "not available" notes; card tables (Current Conditions, Metadata, Precipitation Summary) as label/value rows, card text, image sources, select options; the locator map's station list vs `/stations`; web-next palette roles; non-2xx requests and console errors |
| `ag` | web/ Ag Tools | web-next | Every station × every variable: ETr daily/hourly, GDD wheat/corn and the default window with the projection, feels-like, CCI adult/newborn, SWP and percent saturation (has_swp stations), soil profile VWC/temperature/EC, annual (first element and precipitation). Traces, panels, SWP reference lines, notes/messages, palette |
| `downloader` | web/ Downloader | web-next | daily / hourly / monthly / derived-only requests: the downloaded CSV (byte-identical, else filename, columns, row count, values by datetime), the preview chart traces, palette (web-next's Download sheet has no map) |
| `ag-api` | mesonet2 `/derived` (no `premade`, `keep=true`, `alpha=0.23`, level 2) | web-next Ag | ETr, GDD wheat/corn, feels-like, CCI, SWP, percent saturation: each derived output column is matched to the closest trace (raw or cumulative, depth-aware cm → in) |

Statuses: **PASS** everything web-next draws matches web/ within tolerance (`abs 0.0011`, `rel 2e-4`;
`FIDELITY_ABS_TOL`, `FIDELITY_REL_TOL`). **DOCUMENTED** compared content differs on purpose, citing
its `DIVERGENCES.md` entry: a renamed row (`DOCUMENTED_ROWS`, Real Feel ↔ Feels like), or a moved
card whose text or row labels changed while every value under a shared label matches. **WARN**
label wording, points that differ only at the trailing edge (the two captures are seconds apart),
advisory card text, off-palette colors, web-next console errors.
**FAIL** a trace, figure or card missing/extra/empty, interior value or null differences, sensor
spans, CSV columns/rows/values. **ERROR** a side failed to load.

**Moved** (latest only): a figure or card web/ shows that the scenario's web-next page does not
draw (it moved section, or Now shows the other medium) is not compared. It is listed in the item's
`comparison.moved` (`{ part, note, see }`, `see` = the DIVERGENCES entry), in the summary
`results.json` and in the report, and does not lower the status. A card that page should draw and
does not is still a FAIL.

Known FAIL: ag-api mdamalta feels-like at exactly 50 °F (`/derived` applies no wind chill there,
web-next and web/ do), filed upstream as mt-climate-office/mesonet-db-rds#201.

## How the extraction works

- **web/ (Plotly):** `gd.data` / `gd._fullLayout` of every `.js-plotly-plot`.
- **web-next (ECharts):** for every chart host (`.chart`, `ui/charts/chart.ts`) the harness imports
  the ECharts module the host lazy-loaded (the same Vite dev URL, so the same instance registry;
  its dev path when the resource-timing buffer is full)
  and reads `echarts.getInstanceByDom(canvas).getOption()`. Nothing is exposed globally. Without
  an instance (a production build) it falls back to the host's `.sr-only` table twin (and
  `data-zoom` carries the visible window).
- Both are normalised to `{ panel, name, x[], y[] }` traces: panel = the y-axis title (`polar` for
  the wind rose), x = wall-clock `YYYY-MM-DDTHH:MM` (midnight = the date; web-next's daily points
  at local noon are moved back to the date), numbers for day-of-year. Stacked ECharts series are
  reported at their drawn (absolute) values; heatmaps become one trace per depth row; frozen-soil
  cells become `frozen|<depth>` traces; sensor spans and markLine/markArea values are compared
  separately. Known renames are mapped (`Average Max./Min.` ↔ the normals edges, `Feels Like` /
  `Risk` ↔ the index line, wind-rose bins with/without "mph"); otherwise traces pair by panel +
  name, then by name, then by content within the panel (a WARN for the label change).
- **Cards:** visible text (sr-only twins and hidden panes skipped), tables as cell rows, images
  (and whether they loaded), select options. web/'s cards are found by their Mantine switcher
  label; web-next's by the `data-testid` of the card that replaced it (`now-media`, `now-forecast`,
  `about-details`, `about-readings`, `about-map`). Table header rows are skipped.
- **Maps:** web-next's map host (`about-map`) via its sr-only station table. Map tiles
  MapLibre cancels (`net::ERR_ABORTED` as the view changes) are not request failures.
- **Colors** are not compared between the apps (the house palette is intentional,
  `DIVERGENCES.md` "House style"). Instead every web-next data series color must be one of the
  colors `core/palette` produces for the light theme (imported from the dev server, sampled
  ramps included); anything else WARNs as "off palette".

## Files

- `config.mjs`: targets, URL builder (both apps share the URL keys), scenarios, tolerances, timeouts.
- `stations.json`: the station matrix (copied from `web/scripts/fidelity/`, made by its `select-stations.mjs`).
- `lib/browser.mjs`: Playwright launch, instrumented page, settle, screenshots.
- `lib/extract.mjs`: in-page extractors (Plotly, ECharts, cards, map) and the palette color set.
- `lib/drivers.mjs`: per-tab drivers for both apps (deep link → wait → extract; Downloader clicks Run and Download). web-next follows its routes (`#charts&cmp=1`, `#now`, `#about`; an Ag tool is `#charts&v=<tool>`, web/'s `var`; the Downloader is the Download sheet, `#charts&dl=1`).
- `lib/compare.mjs`: normalisation, trace matching and numeric diff, cards, CSV, palette check.
- `lib/derived.mjs`: `/derived` fetch and the ag-api comparison.
- `lib/report.mjs`: `report.html`. `lib/servers.mjs`: dev-server start/stop. `lib/util.mjs`: CSV, dates (Mountain Time), status ranking.
- `CHECKLIST.md`: the 212-item legacy inventory with a web-next status column.
