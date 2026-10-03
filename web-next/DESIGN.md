# web-next design

How the dashboard is laid out and why: the redesign's reasons and decisions,
the information architecture, the visual language, the layout ladder, each
page, the shared components, motion and type. Read it with ARCHITECTURE.md
(code layers, data flow, "How to …"); what changed from P1 and web/ is in
DIVERGENCES.md ("Redesign 2026-10").

## Redesign 2026-10

Three places, chart first. The user found P1 "too complicated, and not modern enough"; the usability audit
named the reasons: five places, three of them mini-apps of their own; controls before content; every reading
with equal weight, empty ones included (0 W/m² at night, a flat 0.00 of rain); labels in API words; outlines
everywhere; Space Mono at hero sizes. A static mockup came first (session scratchpad `mockup/mockup-v2.html`,
published as a private artifact); the build matches its hierarchy and feel with kit tokens only (where the
mockup and the kit disagree, the kit wins).

The decisions:
1. **Three places:** Now · Charts · About. Ag tools are ordinary entries in the Charts list (an "Ag tools"
   group). Download is not a place: it is a sheet opened from a chart's ⋯ menu, prefilled from that chart.
2. **Navigation:** on phones a 3-item bottom tab bar on a solid surface; from tablet up the same three as a
   segmented control in the header. No separate section row.
3. **Now hero:** a large temperature, high/low against normal, a one-line plain summary, then one **48 h
   strip**: the last 24 h observed (solid) into the next 24 h of NWS hourly forecast (dashed).
4. **Display numerals:** readings at ≥ 1.75 rem use Outfit with `tabular-nums` (`.num-display`;
   mco-web-style#36). Space Mono stays for tables, ids, timestamps and axes.
5. **Interval** on every variable page: Auto · 5-min · Hourly · Daily (Auto: hourly up to 30 d, daily beyond;
   5-min only up to 7 d; Daily draws the mean inside a low–high band, and the stats' Low/High are the true
   extremes).

Unchanged rules: logic in pure, tested `core/`; mesonet2 v2 at QC level 2, no `premade`, `end_time`
exclusive, Ag computed client-side (SWP and porosity from the API), photos from data2 `webp_large`; axe-clean
in three themes at 1440 and 390; every canvas has an sr-only table and a live region; toggles styled by
`aria-pressed`; focus managed on every drill-down, sheet and menu. `web/` and `mesonet.climate.umt.edu/dash`
are untouched.

## Information architecture

```
Station view (?s=<id>; remembered in localStorage mco-dashboard-station)
├─ Now       #now (default)  current-conditions overview
├─ Charts    #charts         the list: search · variable groups · Ag tools · More (Compare variables)
│                            → a variable page (v=<family>; view=history: All years; tbl=1: as a table)
│                            → an Ag tool (v=<Ag tool id>): option chips + chart, the same frame
│                            → Compare (cmp=1)
│            &dl=1           the Download sheet over any of them (a chart's ⋯ → Download data)
└─ About     #about          metadata, all current readings, locator map
Header ⋯ menu: Share this view · Theme · Help · Send feedback
Station picker: drawer (desktop/tablet) or bottom sheet (phones):
                search (Near me inside) · recents · Browse on the map (network chips + map)
```

- **Entry:** `?s=` opens that station; otherwise the last one; otherwise the picker (first visit).
- **Picking** a station closes the picker at every size (the desktop drawer saves "closed") and moves focus
  to `<main>`, the new station's content.
- **History:** a section change or a drill-down (a Charts variable, Ag tool or sub-view) is `pushState`,
  so Back returns; other changes inside a section (dates, toggles, opening the Download sheet) replace the
  entry. Section links are real `<a href>`s: they open in a new tab and work before the JS runs.
- **Old links** keep working (DIVERGENCES "Three places"): `#latest` → Compare; `#ag&var=<tool>` →
  `#charts&v=<tool>` with every Ag key; a bare `#ag` → the list at its Ag tools group; `var=annual` → that
  variable's All-years view; `#download` / `#downloader` + `dl_*` keys → `#charts&dl=1` (closing the sheet
  clears `dl`); a bare `?s=` → Now.
- **One namespace:** `v` holds an element family id (`air_temp`, …) or an Ag tool id (the
  `DERIVED_VAR_OPTIONS` values). The interval is the `agg` key: absent = Auto, `raw|hourly|daily` explicit.

## Visual language

- **Surfaces:** `.dash-card` is flat: `--bg-surface`, radius 16 px, a soft shadow lighter than `--shadow`, no
  border (high contrast keeps one for separation). `.mco-panel` (glass) stays for panels over maps.
- **Chips:** range and interval chips are pills; the active range is filled with high contrast
  (`--text-primary` fill, `--bg-deep` text), the interval row is quieter (an accent-hover fill). `aria-pressed`
  alone drives both.
- **Labels:** sentence case, plain names, never an API label, tooltips and tables included. One map,
  `core/variables/labels.ts` (tested): "Air temperature", "Humidity", "Wind", "Pressure", "Sunlight",
  "Rain", "Rain rate", "Soil moisture", "Soil temperature", "Soil salinity (EC)", "Reference ET", "Snow depth";
  units °F, %, mph, mb, W/m², in (`plainUnit` maps API units: "mi/hr" → "mph", "mbar" → "mb", "deg" → "°");
  wind direction as a compass word ("SSE"). Known gaps: chart y-axis titles (see "Charts").
- **Precision:** one rule per variable (`LABELS[v].digits`): e.g. temperature as an integer on Now, one
  decimal in tables.
- **Hide what means nothing on Now** (pure, tested rules in `core/overview`): sunlight at night; rain draws
  no graphic after a dry week; snow per the snow rule; pressure is a text trend ("steady", "rising",
  "falling" over 3 h), not a tile.
- **Numerals:** `.num-display` only at display sizes (the hero, the tiles); smaller readings (list values,
  stats) use the UI font with `tabular-nums`.
- **Motion:** View Transitions and the reduced-motion rules (see "Motion").

## Layout ladder

One ladder, aligned with the kit (HOUSE-STYLE §3). Layout lives in `@media` rules; behaviour (sheet vs
drawer) reads `MCO.viewport` and the desktop query in JS.

| Name | Query | Sections | Station picker | Now grid |
|---|---|---|---|---|
| compact | `(max-width: 640px), (max-height: 560px)` (`MCO.viewport.COMPACT_MQ`) | bottom tab bar (3 items, solid surface) | bottom sheet (peek / full) | one column, tiles 2-up |
| tablet | 641–1059 px | segmented control in the header | overlay drawer + scrim | one column, tiles 2-up |
| desktop | ≥ 1060 px | segmented control in the header (+ the brand) | in-flow drawer, remembered (`mco-dashboard-drawer`) | hero + tiles (4-up) beside photo + rows |

The brand shows only on desktop (visually hidden below 1060 px; the kit's own step is 750 px).

**Page frame** (`partials/shell.html`, `ui/layout/shell.css`): the sticky one-row header; below it one flex
row, `.dash-shell` = picker drawer + content column (notices, the section, footer); the phone tab bar is
fixed at the bottom; modal sheets come last. `--chrome-h` (header) and `--tabbar-h` (tab bar) are
published on `<html>` and used for the drawer/sheet offsets, the body's bottom padding (the tab bar never
covers content) and the toast. There is no station meta line above the sections.

**Header:** logo · brand (desktop) · **station button** ("Bozeman ▾", large, borderless, truncates, opens the
picker) · the sections, Now | Charts | About, as a segmented control (tablet up; the current one a raised pill,
bold) · one **⋯ menu**: Share this view, Theme (cycles dark → light → high contrast and stays open; the
state, "Dark", shows on the right and is in the item's name), Help (the kit dialog; focus returns to ⋯),
then Send feedback (a link). One row at every width.

**Adding a menu item:** a `role="menuitem"` button (or link) inside `#header-menu` in partials/shell.html,
`class="dash-menu-item"`, an icon `<svg aria-hidden="true">` and its label; `@click` calls a method on
`navMeta` (ui/shell/navMeta.ts). The menu wiring needs no change.

## Now

One model, `core/overview` `buildNowPage` (hero.ts + relevance.ts + nowPage.ts), bound by `partials/now/index.html`
and `ui/now/nowView.ts`. **Phones and tablets:** one column, hero → photo → tiles (2-up) → rows. **Desktop
(≥ 1060 px):** two columns (1.35 : 1), hero + tiles (4-up) | photo (at most 360 px tall) + rows: the pairing
that keeps the columns closest in height. The column wrappers dissolve (`display: contents`) onto one grid
with named areas, so the DOM, reading and Tab order stays hero, photo, tiles, rows at every width.

| Slot | Content | Data (tier) |
|---|---|---|
| Hero | Air temperature (`.num-display`, 5 rem phones / 7 rem desktop); on the right the high and low of the strip's observed 24 h ("24 h high 74° · low 41°", so the two agree), today's gridMET normal and the NWS feels-like ("Wind chill"/"Heat index"); the one-line **summary** (`summarize`: sky, wind, rain) | `/latest`, NWS periods (1); hourly + `tmmx`/`tmmn` (2) |
| Freshness | "Updated 7 min ago · Provisional": **Provisional** is a text button (only when `/latest` says so) that opens the toggletip (served at QC level 1 until the next daily QC run, about 8 AM); **No report for over 2 hours** warning | `/latest` (1) |
| Strip | The **48 h strip** in the chart host (`core/charts/heroStrip`): the last 24 h observed (solid, area) into the next 24 h of NWS hourly forecast (dashed), the now rule, the observed high above its point and the low below it (the y range is padded so both stay inside the plot); x ticks "Now" plus plain hours ("6 AM", "Noon"; every 6 h on phones, 3 h wider; none crowding "Now"); its sr-only table; a "Loading the 48-hour strip…" status while tier 2 loads and a short note in its place when there is nothing to draw. Below it the forecast periods as an icon row (api.weather.gov only, alt = the short forecast; the periods are not labelled inside the plot), a solid/dashed legend and "Full forecast" (NWS, new tab) | hourly + NWS hourly (2) |
| Media | Latest camera frame of the default direction (16:9, at most 360 px tall on desktop; opens the photo dialog), or the wind rose without a camera | photo schedule, latest listings (1) |
| Tiles | Only the relevant ones (`nowTiles`): Wind (speed; compass word · gusts), Rain (7 d total, 24 h without the ppt summary; % of normal this year; seven daily bars, `rainBars`, or no graphic after a dry week), Humidity (dew point), Sunlight (by day only), Soil moisture (shallowest depth; a **Dry/Wet** badge from soil water potential where the station has SWP sensors), Snow depth (the snow rule), VPD (AgriMet). Plain name, value (`.num-display`, 1.9 rem) and unit from `core/variables/labels`, a sub-line and a 48 h sparkline; each a link to its variable page that morphs into the page heading, which takes focus | `/latest`, `/derived/ppt/` (1); hourly, `pr`, `/derived/hourly` SWP (2) |
| Rows | **All readings** (meta: "Pressure 847 mb, steady · Snow none", the 3 h trend once the hourly rows are in) → opens About's readings sheet (`target: 'about-readings'`, the row's `data-sheet`; see About); **Station details** (meta: "HydroMet · 4,905 ft") → About (`target: 'main'`) | `/stations`, `/latest` |

**Photo dialog** (`partials/now/photo-dialog.html`, `ui/now/photoCard.ts`, model `core/cards/photo`): a kit
`<dialog class="mco-modal">` with a **Direction** segmented control (the directions with frames that day, legacy
labels, N first), a **Day** date input (the camera's first archived month … today) and a **Time** select (the
frames that exist, newest first), over the `webp_large` frame and "Download original" (the same WebP). Today
and yesterday come from the data2 S3 listings, older days from the monthly manifest. The frame area keeps a
16:9 box while a day loads. **The tile always shows the latest frame**; the picks live only in the dialog and
are dropped on close, so it reopens on the tile's frame (the tile never shows an old frame under a "latest"
caption). The dialog's content mounts only while open. On phones the day and time stack, inputs are 16 px and
targets 44 px; nothing scrolls sideways at 390 px. Focus stays in the modal (the page is inert), Esc closes,
focus returns to the tile.

**Loading.** Tier 1 (`/latest`, the ppt summary, the NWS periods, the photo schedule) starts together when Now
mounts and renders the hero and tiles. Tier 2 (one 72 h hourly request for the strip, sparklines, the 24 h high/low and
pressure trend; the normals CSVs; the NWS hourly forecast from the periods' `forecastHourly` URL, `nwsh:<url>`,
30 min; SWP for stations with SWP sensors, `nowSwpQuery`) starts once `/latest` is in and fills the strip,
sparklines and chip. The Rain tile's bars come from one small daily request (`rainDailyQuery`: `ppt`, the 7 days
ending today, 30 min). Every slot holds its size with a skeleton (the strip a fixed 9.5 / 11 rem box), so
nothing shifts. Labels are sentence case in `--text-muted`; readings are `.num-display`.

Screenshots (phase B, in the session scratchpad `rd-now/`): `<390|1440>-<light|dark|high-contrast>-<acebozem|arskeogh>.png`
(arskeogh: AgriMet, wind rose, VPD).

## Charts

```
#charts                              list: search · Weather · Rain and evaporation · Soil · … · Ag tools · More
#charts&v=air_temp                   variable page, 14 d, Auto interval (no keys)
#charts&v=air_temp&from=…&to=…       another window (a range chip or Custom dates…)
#charts&v=air_temp&agg=daily         Interval: absent = Auto · raw (5-min) · hourly · daily
#charts&v=air_temp&view=history      All years: one line per year (daily)
#charts&v=air_temp&tbl=1             the chart as a table (newest first, 50 per page)
#charts&v=gdd&crop=corn              an Ag tool with its keys (core/ag/view/tab)
#charts&cmp=1                        Compare: stacked panels + options (legacy #latest lands here)
```

- **List** (`partials/charts/list.html`, `ui/charts/variableList.ts`, model `core/variables`): a **search field**
  (`matchesQuery`: every word in the name, sub-label or group) over one card per group: the station's
  variables from `/elements/{s}` (Weather · Rain and evaporation · Soil · Well · Other), then **Ag tools**
  (`#charts-ag-tools`, `LIST_AG_TOOLS`: every tool but Annual comparison and Reference ET, which is listed once,
  under Rain and evaporation) and **More** (Compare variables). A row: plain name over a sub-label ("at 2 in",
  "last 24 h", what an Ag tool is) · the current value in plain units and precision (`formatReading`; the
  last 24 h total for totals; none for Ag tools) · a 48 h sparkline (one 72 h hourly request for every listed
  variable). Every row opens its page through `chartPatch(id)` (core/variables).
- **Chart page frame** (variable page and Ag tools, `.chart-page` in styles/charts.css): back chevron (to the
  list) · title (`[data-vt-target]`: a tapped Now tile or list row morphs into it) · **⋯ menu**; under it one
  line (the variable page: "57 °F now · Last 14 days", `currentReading` + `rangeLabel`; an Ag tool: the station);
  then the chart card, the chips and a stats card. Cards are flat `.dash-card`s.
- **Variable page** (`partials/charts/variable.html`, `ui/charts/variablePage.ts`):
  - **Chart:** full width, 420 px; on phones `min(60dvh, 420px)` (`core/charts/variable.ts`, the Compare panel
    drawing for one variable). Normals (gridMET 1991–2020) draw by themselves on daily air temperature
    (`showsNormals`; no switch).
  - **Range chips** (`RANGE_CHIPS`, `.dash-chip` pills, one scrolling row): 24 h · 7 d · 14 d · 30 d · 1 y over
    `from`/`to` (14 d = no keys; 24 h shows the 24 hours up to the newest reading) and **All years**
    (`view=history`, the progressive years-overlaid chart: one calendar year per request, newest first, at most
    10). A window from Custom dates… presses no chip. Chips replace the history entry.
  - **Interval row** (`intervalChips`, quiet chips over `agg`): **Auto** (key absent; hourly up to 30 days,
    daily beyond and for All years; its label says which, "Auto (hourly)") · **5-min** (`raw`; only for windows
    of 7 days or less, disabled with the reason otherwise) · Hourly · Daily. A range chip drops 5-min where the
    new window does not offer it. **Daily** draws the daily mean as a line inside a **low–high band**: one more
    daily request with `agg_func=min,max` (`recordRequest({ extremes })`, `core/variables/band.ts`), drawn for a
    one-column variable (the band, in the line's color, is in the tooltip and the table's Low/High columns).
  - **Stats card:** Low · High · Average per sensor over the visible range (Total for precipitation and ETr), in
    the variable's plain unit (`panelStats(…, id)`); on Daily, Low and High are the band's true extremes. One
    line per sensor at every width (equal columns up to 7 rem); values in the UI font with `tabular-nums`.
  - **⋯ menu:** Download data (the sheet prefilled: `core/downloader/fromChart`, the variable's element codes,
    the window (All years: install date … today) and the interval, 5-min as hourly) · Show as table / Show as
    chart (`tbl`, pushed, so Back returns; replaces the chart in place; All years tables its years) · Custom
    dates… (the `dates` modal sheet, `partials/sheets/dates.html`: `dateRange` over `from`/`to`, install date …
    today; a valid range applies at once) · Share this chart (`shareView`) · Previous / Next variable.
  - **Swipe:** on touch, a sideways swipe on the page (`ui/layout/swipe.ts`, `core/swipe.ts`: ≥ 60 px and
    twice as sideways as vertical) opens the previous or next variable in list order; the page is
    `touch-action: pan-y pinch-zoom`, so vertical scrolling is untouched. ⋯ → Previous / Next is its keyboard twin.
- **Compare** (`partials/charts/compare.html`, `ui/charts/compare.ts` + `compareControls.ts`): back · "Compare
  variables", then the stacked chart in a flat card with its options (dates, period of record, aggregation,
  normals, variable chips) in an "Options" disclosure, beside the plot on desktop and closed above it on phones.
  It reads `agg` absent as hourly (`latestAgg`), as the old Latest tab did.
- **Labels:** tooltips and table headers use the plain name and unit (`plainSeries` in
  `core/charts/latestTimeseries.ts`: "Wind: 4.1 mph", "Soil moisture at 2 in (%)"). The ECharts series names
  and the y-axis titles are still the legacy API ones ("Air Temp. (°F)", `AXIS_MAPPER`), because the fidelity
  harness matches traces and panels by them against web/; moving them to plain names needs the harness to
  match by element code first.
- **History:** every list → page and page → page change is a `pushState` (`navigate(…, { drillDown: true })`),
  and so are Show as table / chart; range and interval chips, dates and options replace the entry. The Charts
  tab inside Charts returns to the list (pushed); leaving Charts drops `v`, `tbl` and `cmp` (`sectionNavPatch`).
- **Focus:** a drill-down moves focus to the new page's heading (`#charts-list-title`, `#var-title`,
  `#ag-chart-title`, `#charts-compare-title`; ⋯ → Previous / Next too), so it never falls to `<body>`; chips
  keep focus.

### Charts on touch

`ChartContext.touch` (`(hover: none) and (pointer: coarse)`, set by the chart host) changes every chart:
- the `inside` dataZoom is `disabled`: it still holds the window, but a swipe over a chart scrolls the
  page (no drag-pan, no pinch); range presets, date fields and the slider (tablet) zoom instead;
- tooltips open on a **tap** and close on a tap outside the chart (host), compact (12 px);
- on compact screens the tooltip is **pinned under the chart** at full width (Compare: under the tapped
  panel), so it never covers the data;
- chart height on phones: the variable chart `min(60dvh, 420px)`; Compare ~160 px per panel, about three
  per screen, and the page scrolls past the stack.
## Ag tools (inside Charts)

An Ag tool is a Charts entry: `#charts&v=<tool>` (`v` is an Ag tool id, `core/params/ag` `AG_TOOL_IDS`;
`chartsMode` → `'ag'`), in the chart page frame (`partials/ag/index.html`, `ui/ag/agTab.ts`): back · the tool's
plain name · ⋯ (Download data prefilled through `fromChart` + `agToolElements`, Show as table / chart, Share
this chart, About this tool) · the station · **option chips** · the chart card · a stats card where it means
something (`core/ag/view/stats.ts`: Reference ET's total, feels-like and livestock-risk low and high, GDD so far
and the stage reached).

- **Option chips** (`partials/ag/options.html`, `ui/ag/agOptions.ts`): one `.dash-chip` per option the tool has
  (`optionChips` in `core/ag/view/summary.ts`), naming its value: GDD `Wheat` · `32–70 °F` · `Since Oct 2, 2025`
  · `Projected to Oct 31`; ETr, Feels like, SWP, saturation `Daily` · dates; Livestock adds `Adult`; soil
  profile its variable; Annual its element. Each chip opens a **popover** (`x-data="popover"`) holding the
  existing control: crop chips, the cutoff `rangeSlider` (with its reset and note), `dateRange`, the
  projection and comparison selects, the interval and livestock radios, the soil chips. A chip choice (crop,
  soil) applies and closes; the rest apply as they change and stay open until Esc, a press outside or Tab
  away. Chips wrap; on phones the popover docks at the bottom like a small sheet.
- **Station:** from the header's picker; there is no station control on the page. With no station, or for an
  SWP tool at a station without SWP sensors (`chartState` `'not-here'`), the card names why ("Crow Agency has no
  soil water potential sensors, so this tool does not apply there.") with a button that opens the picker.
- **Reference ET** is also the observed `etr` variable (one id, one page): its page adds an **All years** chip
  (`view=history`, the variable page's history of the derived ETr) and ⋯ → Previous / Next in the variable
  list (plus the swipe). Annual comparison (`v=annual`) still renders for old links, but is not listed.
- **Navigation:** a list row is a real link; a plain click opens the tool with `pushState` (`chartPatch` →
  `variablePatch`: the tool's options reset, chart view) and focuses its heading.
- **Charts:** 540 px tall; on phones `min(60dvh, 420px)`. On touch they follow "Charts on touch" above.
  Every Ag number, the `.ag-chart-card` and its `data-testid`s are unchanged (fidelity `ag` / `ag-api`).

Screenshots (phase B, in the session scratchpad `rd-charts/`): `<390|1440>-<light|dark|high-contrast>-<list|var|var1y|vartable|varall|varmenu|vardates|gdd|gddcrop|etr|swpcrow|compare>.png`.

## Download (a sheet)

The Download sheet (`partials/sheets/download.html`) is open while `dl=1`: from a chart's ⋯ → Download data
(prefilled by `core/downloader/fromChart`, then `openSheet('download', opener)`), from an old `#download` / `#downloader` link, or any URL with
`dl=1`. Closing (×, Esc, the scrim, a drag down on phones) clears `dl` and returns focus to the opener (to
`<main>` when the URL opened it). It is a bottom sheet on phones and a centred panel (34 rem) from 641 px;
its body scrolls on its own. Every value comes from the URL's existing keys, so whatever opened it (a chart's
⋯ menu writing `els`, `dl_from`, `dl_to`, `period`), the form shows that.

Inside is one short form (`partials/downloader/index.html`, logic in `core/downloader/form.ts`), one column at
every width, flat on the sheet's surface:

| Row | Value (right) | Expands to (the existing control) | URL key |
|---|---|---|---|
| Variables | up to two names, then "+ N more"; "+ Add" | chips for the selection, "+ Add variables" (the grouped checklist with a filter), "Show uncommon variables" | `els`, `pub` |
| Dates | "Sep 1 – Sep 30, 2026" | start/end date inputs bounded by the install date and today, the install-date notes | `dl_from`, `dl_to` |
| Interval | Hourly · Daily · Monthly | a segmented control; Monthly adds its note | `period` |
| Quality | Quality-controlled · Provisional (basic checks) · Unchecked | one option per line, with the level's description | `qc` (2 · 1 · 0) |
| Station | "Bozeman (acebozem)" | not a button: the header's station picker changes it | `s` |

- **Rows:** a label on the left, the value on the right (ellipsized), a chevron. Each is a button in an `<h3>`
  (`aria-expanded`, `aria-controls` its `role="region"` panel). Tapping one expands it in place and closes
  any other (`openRow`, view state, not in the URL). All start closed.
- **One button** under the rows, full width (`.dl-btn-primary`), with one line under it saying why it cannot
  act (`aria-describedby`): "Pick a station in the header first.", "Pick at least one variable.", the date
  error, "Fix the dates.", or "No data for this selection. …". It reads **Preview** until the current inputs
  have a result, then **Download CSV · N rows**; changing any input makes it Preview again. A large hourly
  range (> 1 year) arms "Confirm large request" first. It is never natively `disabled` but `aria-disabled`
  (clicks do nothing), so it keeps focus as its label changes; `data-testid` follows its job (`dl-run`, then
  `dl-download`).
- **Why two clicks, not one:** the CSV is saved by clicking a blob link, which browsers tie to a user
  gesture. The fetch can take longer than the gesture lasts (about 5 s in Chrome), and Safari and Chrome's
  repeated-download guard block or prompt for downloads started without one. Saving on the second click keeps
  every download inside a click, and the row count is known before the user commits.
- **After Preview:** the preview chart (the existing one) appears under the button; the live region says
  "Request finished: N rows, M columns. Download CSV is ready."; focus stays on the button.
- **Notices** under the rows, always visible: SWP variables dropped at a non-SWP station, variables that
  failed to load (Retry), the large-hourly warning.
- **Below:** the BLM funding line (legacy DL-020), a quiet centred caption.
- **Touch:** rows and the button are ≥ 48 px; inputs 16 px (controls.css); checklist rows 44 px; the
  checklist grows with the sheet body instead of scrolling inside its panel. Fits 390 × 844 with no sideways
  scroll.

## About

Details that stay reachable but not front and center (`partials/about/*`, `ui/about/*`, models in
`core/about`; styles `src/styles/about.css`). One column on phones; from tablet up two: details + map |
rows + notes. Flat `.dash-card` surfaces; no visible card titles except "About the data" (each section has
an sr-only heading).

| Slot | Content | Data |
|---|---|---|
| Details | Station (name, id in mono), Network, Location (county · coordinates), Elevation (ft and m), Record (install date – "today", or the newest report's date; "Since …" until `/latest` answers): `core/about/details.ts`. Then a **Station one-pager (PDF)** row when one is listed. This is where the old "network · county · elevation" meta line lives now. | `/stations`, `/latest`, one-pagers.json |
| Map | `locatorMap` (ui/map/presets) in a flat frame with the card radius: the station map flown to the station, legend collapsed, **cooperative gestures** (one finger and a plain wheel scroll the page; two fingers or Ctrl/⌘ move the map) | `/stations` |
| Rows | **All current readings · N** (N readings now, Observed not counted) and **Sensor changes · latest date**: `<button class="about-row" aria-haspopup="dialog" data-sheet="…">`, each opening a modal sheet | as the sheets |
| About the data | QC level 2, provisional data (the corrected wording), time and units; links to the API docs and this station's requests (`core/about/apiLinks.ts`) | — |

**Sheets** (`partials/sheets/about-readings.html`, `about-history.html`; the modal sheet primitive, `--sheet-w`
34 rem): content mounts only while open, and scrolls inside `.about-scroll`, a focusable `role="region"`
with a label (the sheet body itself does not scroll, so the table head stays put).
- **All current readings** (`ui/about/readings.ts`): the readings table, plain labels from
  `core/variables/labels.ts` with depths ("Soil moisture at 4 in"), values with units at table precision
  ("57.0 °F"; wind direction as "ESE (111.6 deg)"; **Feels like** by the NWS method), `core/about/readings.ts`.
  For HydroMet, the rain totals ("Last 7 days", "Year to date"). Each row header carries its API column in
  `data-col` (the fidelity harness keys rows by it).
- **Sensor changes** (`ui/about/history.ts`): installs and removals by day, newest first, with what each sensor measures in plain words ("Soil moisture at 2 in")
  (`core/about/sensorHistory`), from `/config/{station}/` (the response Compare's overlays use).

**The readings target (contract with Now):** the readings row is `#about-readings` with
`data-sheet="about-readings"`. `navigate('about', { target: 'about-readings' })` (Now's "All readings")
focuses it and, because of `data-sheet`, opens that sheet with the row as opener (`ui/shell/navigate.ts`), so
closing the sheet leaves focus on the row. Any `target` with `data-sheet="<id>"` works the same way. Leaving
About closes its sheets. Every fetch is in `ui/station/resources.ts`, shared with Now.

## Components (`src/ui/layout/`; kit candidates, see KIT-NOTES.md)

Each is framework-free CSS on kit tokens plus a small vanilla `init…({…})`; the Alpine wrappers
(`ui/picker/stationPicker.ts`, `ui/shell/sections.ts`, `ui/shell/menu.ts`, `ui/shell/sheet.ts`,
`ui/shell/navigate.ts`) only connect them to the stores.

- **`.dash-card`** — the one in-flow surface, flat: `--bg-surface`, radius `--card-radius` (16 px),
  `--card-shadow` (two short layers tinted by the kit `--scrim`, lighter than `--shadow`), no border except in
  high contrast; `--card-pad` (1 rem; 0.875 rem compact), `.dash-card-title` (sm, 600, `--text-secondary`).
  A card may be an `<a>` (tiles): hover fill, kit focus ring. `.mco-panel` stays for glass over maps.
- **Menu** (`menu.ts`/`.css`; Alpine `x-data="menu"`) — the ⋯ menu button. Markup:
  `<div class="dash-menu" x-data="menu">` holding `<button class="dash-icon-btn" data-menu-button
  aria-label="…">` and `<div class="dash-menu-panel" id="…" role="menu" aria-label="…" hidden>` with
  `role="menuitem"` items (`.dash-menu-item`; `.dash-menu-state` for a value on the right; `<hr
  class="dash-menu-sep">`). Focus moves to the first item on open (ArrowUp on the button: the last); arrows,
  Home/End move; Esc closes and returns focus to the button; Tab, a press outside or focus leaving closes.
  Choosing an item closes the menu before its handler runs (focus on the button), unless the item has
  `data-keep-open`. Panel at `--z-flyout`, right-aligned under the button.
- **Modal sheet** (`.dash-sheet--modal` on the bottom sheet below; Alpine `x-data="sheet({ id, urlKey? })"`) —
  a task surface over everything: a bottom sheet on phones, a centred panel (`--sheet-w`) from 641 px; the
  page behind is `inert`, Esc / × / scrim close, focus moves in (`[data-autofocus]`, else the first control)
  and returns to the opener. Open or close from code with `openSheet(id, opener)` / `closeSheet(id)`
  (`ui/shell/sheet.ts`); with `urlKey` the URL key is the open state. Content inside `<template
  x-if="isOpen">` mounts only while open. Each sheet has a sibling scrim `#<id>-scrim`.
- **Pill chips** (`card.css`) — `<button class="dash-chip" aria-pressed>`: a raised pill; pressed is filled
  with high contrast (`--text-primary` fill, `--bg-deep` text) for the active range. `.dash-chip--quiet` for
  the interval row: pressed is the accent tint with `--accent-line` text. `aria-pressed` alone drives the style.
- **Display numerals** (`card.css`) — `.num-display`: Outfit, `tabular-nums`, −0.02 em tracking, for readings
  at ≥ 1.75 rem (hero, tiles). Space Mono stays for tables, ids, timestamps and axes (mco-web-style#36).
- **Plain labels** (`core/variables/labels.ts`, not a layout primitive but used by every surface) — `LABELS[v]`
  (name, unit, `digits.display` / `digits.table`, an optional `sub`), `plainName(v, fallback)`,
  `formatReading(v, value, 'display' | 'table')` ("54 °F", "8%", "0.05 in"), `compassWord(deg)` ("SSE").
- **Popover** (`popover.ts`/`.css`; Alpine `x-data="popover"`) — a chip or button (`[data-popover-button]`,
  `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`) toggles a non-modal `role="dialog"` panel with a
  label (`.dash-popover-panel`, `--z-flyout`, under the button; docked at the bottom on phones). Opening moves
  focus to its first control; Esc closes and returns focus to the button; a press outside, or focus leaving,
  closes. `closePopover()` closes it from a control inside (after a single choice). The Ag option chips use it.
- **Swipe** (`swipe.ts`) — `initSwipe({ el, onStep })`: a touch pointer's sideways travel past
  `core/swipe#swipeStep`'s threshold calls `onStep(−1 | 1)`; mouse and pen never swipe; gestures starting in a
  `[data-no-swipe]` element (chip rows, tables) are ignored. The chart pages use it for Previous / Next.
- **Bottom sheet** (`sheet.ts`/`.css`) — peek/full, drag on the handle (up = full, down = peek, then
  close), Enter/Space on the handle toggles, Esc closes, focus moves in and returns to the opener, the
  rest of the page is `inert`, the body scrolls with `overscroll-behavior: contain`. Sits on the tab bar.
- **Drawer** (`drawer.ts`/`.css`) — inline (in the flex row, margin slide, content reflows, not modal)
  or overlay (fixed, scrim, modal). Closed = `visibility: hidden` + `inert`. Esc, focus in/out as the sheet.
- **Focus scope** (`focusScope.ts`) — the shared focus-in / inert / Esc / focus-return logic.
- **Section nav** (`sectionNav.ts`/`.css`) — the tab bar (three items on a solid `--bg-surface`, icon + label,
  ≥ 56 px, safe-area padding; the current one has a pill behind its icon and a bold label) and the header's
  segmented control (a `--bg-raised` track; the current one a raised `--bg-surface` pill, bold), `aria-current`.
- **Skeletons** (`skeleton.css`) — `.dash-skel` + `--line`, `--value`, `--spark`, `--media`,
  `--chart`, `--table`; token shimmer, static under reduced motion, `aria-hidden`.
- **Badge** (`card.css`) — `.dash-badge`, `.dash-badge--warn` (heavier border + icon; never colour alone).
- **Toggletip** (`toggletip.ts`/`.css`) — an ⓘ button (`.mco-btn-info`, 24 px; the kit's 40 px on touch), or a text button (Now's "Provisional"), that
  shows a short note below it on click or tap: `aria-expanded` + `aria-controls`, the note right after the
  button in the DOM; Esc or a press outside closes it. The Alpine wrapper is `ui/shell/toggletip.ts`.
- **Sparkline** (`core/charts/sparkline.ts` → SVG, `.dash-spark`) — a line (or bars for precipitation) in
  `--accent-line`; decorative (`aria-hidden`) with an `.sr-only` sentence giving the 48 h range. SVG, not
  ECharts: eight per page, no library wait, and a swipe over one always scrolls the page.

## Motion

- **Section changes:** a same-document View Transition (`ui/layout/transition.ts`) where supported:
  only the section region (`view-transition-name: dash-section`) cross-fades with a 12 px slide, 180 ms,
  kit easing; forward/back follows the section order. The header and tab bar stay still.
- **Shared element:** a tapped tile morphs into the destination heading (`[data-vt-target]`, 240 ms).
- **Drawer and sheet:** 220 ms slides (`.enter`/`.leaving`, margin or transform). The state restored on
  page load does not animate.
- **Reduced motion:** no view transition (`MCO.reducedMotion()` checked at call time), static skeletons,
  instant drawer/sheet, plus the kit's blanket clamp. Charts animate only their first draw (chart host).

## Type scale (`ui/layout/type.css`)

| Token | rem | Use |
|---|---|---|
| `--fs-xs` | 0.75 | labels, captions, badges, tab-bar labels |
| `--fs-sm` | 0.875 | card text, secondary lines, section links |
| `--fs-md` | 1 | body, **inputs on touch** (≥ 16 px stops iOS zoom) |
| `--fs-lg` | 1.25 | section titles |
| `--fs-xl` | 1.75 | tile values, station name |
| `--fs-2xl` | 2.5 | the hero value |

New CSS uses only these; ag.css, downloader.css and charts.css are on them. `now-cards.css` (the wind rose
pane and photo dialog carried over from the Latest cards) still uses older sizes.

## Accessibility notes

- Every new surface is in the axe matrix (`scripts/verify/axe.mjs`: `now`, `header-menu`, `photo-dialog`, `about`,
  `about-readings`, `about-history` (each sheet open), `picker`, `picker-open` (both with the map revealed),
  `charts-list`, `variable` + `-menu` + `-history` + `-table` + `-daily` (the band), `dates-sheet`, `compare`,
  `legacy-ag`, four Ag tools, the GDD crop and cutoff popovers, the Reference ET ⋯ menu, `download-variables`,
  `download-dates`, `downloader` (after Preview), `help-dialog`) × 3 themes × 1440/390.
  `keyboard.mjs` walks the header and its ⋯ menu (Help, Theme), the picker, the Download sheet and its form, tab bar,
  photo dialog, About's two sheets (and Now's "All readings" opening the readings sheet), the variable page (⋯ Show
  as table / Previous / Next / Custom dates, range and interval chips), Download prefilled from ⋯, Ag option chips
  (Enter opens, a pick applies, Esc returns focus) and the legacy links; `layout.mjs` checks touch swipes over
  charts (vertical scrolls, sideways walks the list),
  sideways scroll at 390, the fold, the one-row header, the solid tab bar, the sheet's fit and reduced motion.
- Charts: a chart as a table is a real `<table>` (caption, scoped headers) in a focusable, labelled scroll
  region; range and interval chips are `aria-pressed` buttons in labelled groups; option chips name their option
  ("Crop: Wheat"); stats are a `<dl>`.
- Touch targets ≥ 40 px under `(hover: none)`; the tab bar is 56 px.
- Status is text: "No report for over 2 hours", "Feels like 41° · Wind chill"; the Provisional text button opens its note (`aria-expanded`).
- The picker is `role="dialog" aria-modal="true"` only when it is modal (sheet, overlay drawer); the inline
  drawer is a plain landmark beside the content.
