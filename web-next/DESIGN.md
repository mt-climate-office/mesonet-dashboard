# web-next design

How the dashboard is laid out and why: the information architecture, the
layout ladder, the shared components, motion and type. Read it with
ARCHITECTURE.md (code layers, data flow, "How to …"). It describes the
redesign's three places (REDESIGN.md; phase A: the shell, routing and
primitives) over the P1 section content (Now, Charts, Ag tools, Download, About),
which phase B restyles.

## Information architecture

```
Station view (?s=<id>; remembered in localStorage mco-dashboard-station)
├─ Now       #now (default)  current-conditions overview
├─ Charts    #charts         the list: variable groups · Ag tools · Compare · Download data
│                            → a variable page (v=<family>, view=recent|history|table)
│                            → an Ag tool (v=<Ag tool id>): Options disclosure + chart
│                            → Compare (cmp=1)
│            &dl=1           the Download sheet over any of them
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
  `#charts&v=<tool>`; a bare `#ag` → the list at its Ag tools group; `var=annual` → that variable's
  All-years view; `#download` / `#downloader` → `#charts&dl=1`.

## Layout ladder

One ladder, aligned with the kit (HOUSE-STYLE §3). Layout lives in `@media` rules; behaviour (sheet vs
drawer) reads `MCO.viewport` and the desktop query in JS.

| Name | Query | Sections | Station picker | Now grid |
|---|---|---|---|---|
| compact | `(max-width: 640px), (max-height: 560px)` (`MCO.viewport.COMPACT_MQ`) | bottom tab bar (3 items, solid surface) | bottom sheet (peek / full) | one column, tiles 2-up |
| tablet | 641–1059 px | segmented control in the header | overlay drawer + scrim | hero beside photo, tiles 3-up |
| desktop | ≥ 1060 px | segmented control in the header (+ the brand) | in-flow drawer, remembered (`mco-dashboard-drawer`) | hero 3/5 beside photo, tiles 4-up |

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

| Slot | Content | Data (tier) |
|---|---|---|
| Freshness | "Updated 7 min ago", an ⓘ toggletip when the data are provisional (served at QC level 1 until the next daily QC run, about 8 AM), **No report for over 2 hours** warning | `/latest` (1) |
| Hero | Air temperature; NWS feels-like with "Wind chill"/"Heat index"; today's high/low; gridMET normal high/low; 48 h sparkline | `/latest` (1); hourly + `tmmx`/`tmmn` (2) |
| Tiles | Wind (speed, gust, compass glyph pointing where it blows), Precipitation (today, 24 h, 7 d, YTD vs normal), Humidity, Solar, Pressure, Soil (depth profile: temp + VWC bar), Snow depth (only with snow: ≥ 0.5 in now or in any hour of the last 72 h), VPD (AgriMet); each a link to its variable, with a 48 h sparkline | `/latest`, `/derived/ppt/` (1); hourly + `pr` (2) |
| Media | Latest camera frame of the default direction (opens the photo dialog), or the wind rose without a camera | photo schedule, latest listings (1) |
| Forecast | NWS periods in a horizontal strip with scroll snap | NWS (1) |
| All readings | opens About's readings sheet (`navigate('about', { target: 'about-readings' })`; the target is the row, `data-sheet` opens its sheet) | — |

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

Tier 1 requests start together when Now mounts; tier 2 (one 72 h hourly request for every sparkline, the
normals CSVs) once `/latest` is in. Every slot holds its size with a skeleton while it loads, so nothing
shifts. Values are Space Mono on the type scale; labels are small caps in `--text-muted`.

Screenshots (P0, in the session scratchpad `ux-p0/`): `390-dark-now-acebozem.png`,
`390-dark-sheet-peek.png`, `768-light-now-acebozem.png`, `1440-dark-now-acebozem.png`,
`1440-dark-drawer-open.png`, `390-light-now-arskeogh.png` (AgriMet, wind rose).

## Charts

```
#charts                      list: groups Weather · Precipitation & ET · Soil · Well · Other
#charts&v=air_temp           variable page, Recent (range presets, chart, stats)
#charts&v=air_temp&view=history   years overlaid (daily)
#charts&v=air_temp&view=table     the chart's rows, newest first, 50 per page
#charts&cmp=1                Compare: stacked panels + options (legacy #latest lands here)
```

- **List** (`partials/charts/list.html`, `ui/charts/variableList.ts`, model `core/variables`): the station's
  variables from `/elements/{s}`, one card per group (Weather · Rain and evaporation · Soil · Well · Other),
  one row per variable: plain name (`core/variables/labels.ts`) · current value (from `/latest`, shallowest
  depth for soil; the last 24 h total for precipitation and ETr) · 48 h sparkline (one 72 h hourly request
  for every listed variable). Then **Ag tools** (`#charts-ag-tools`; `LIST_AG_TOOLS`: every Ag tool but
  Annual comparison, each a plain name over a one-line description), then Compare and **Download data**
  (opens the Download sheet; phase B moves it to each chart's ⋯ menu).
- **Variable page** (`partials/charts/variable.html`, `ui/charts/variablePage.ts`): "‹ All variables", the
  heading (`[data-vt-target]`: a tapped Now tile or list row morphs into it), prev/next chips in list order,
  a Recent · History · Table switch, then
  - **Recent:** presets **24 h · 7 d · 14 d · 30 d · 1 y · Custom** stored in `from`/`to`/`agg` (14 d hourly =
    no keys; 1 y daily; 24 h shows the 24 hours before the newest reading); Custom opens dates + Hourly /
    Daily / Raw; a gridMET normals switch for variables with normals, enabled on daily views; the chart
    (`core/charts/variable.ts`, the Compare panel drawing for one variable) and a stats row: min / max /
    mean per sensor over the visible range, or the total for precipitation and ETr.
  - **History:** one line per year on a day-of-year axis (`annualChart`), running totals for summed
    variables. Daily data, **one calendar year per request**, newest first; the next older year is requested
    once the newer ones settle, so the chart fills in progressively (skeleton until the first year). At most
    10 years; never a long hourly window.
  - **Table:** the chart's table twin made visible, newest first, paged 50 rows (Newer / Older).
- **Compare** (`partials/charts/compare.html`, `ui/charts/compare.ts` + `compareControls.ts`): the stacked
  chart from the old Latest tab with its options (dates, period of record, aggregation, normals, variable
  chips) in an "Options" disclosure, beside the plot on desktop and closed above it on phones. The station
  comes from the picker; the photo, forecast and map cards live on Now and About.
- **History:** every list → variable, variable → variable and sub-view change is a `pushState`
  (`navigate(…, { drillDown: true })`), so Back walks back through them to the list or to Now; presets,
  dates and switches replace the entry. The Charts tab inside Charts returns to the list (pushed);
  leaving Charts drops `v`, so the next visit opens the list (`core/router.ts#sectionNavPatch`).
- **Focus:** a drill-down moves focus to the new view's heading (`#charts-list-title`, `#var-title`,
  `#charts-compare-title`; prev/next chips too), so it never falls to `<body>`; a Recent · History · Table
  link keeps focus.

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
`chartsMode` → `'ag'`). Until phase B gives it the variable-page frame, it renders the P1 tool view
(`partials/ag/index.html`, `ui/ag/agTab.ts`): "‹ All charts" · heading "<tool>: <station>" · **Options**
disclosure · chart card (notes, then the chart or its state).

- **Navigation:** a list row is a real link; a plain click opens the tool with `pushState`
  (`navigate('charts', { drillDown: true })`, `variablePatch`: the tool's options reset) and focuses the
  heading. "‹ All charts", and the Charts tab, return to the list (pushed). Changing the tool in the
  Options variable select pushes too.
- **Options** (`<details class="dash-card ag-options">`): open on desktop, collapsed on phones (open there too
  while no station is chosen, since the station combobox is inside). The summary is one line, ellipsized:
  `core/ag/view/summary.ts#optionsSummary`, e.g. "Wheat · 32–70 °F · to Oct 31" (GDD: crop · cutoffs ·
  projection), "Hourly · Jan 1 – Jan 7, 2026" (ETr, Feels like, SWP, % saturation; Livestock adds the
  animal), "Temperature · …" (soil profile), the comparison variable (annual). Inside: the three-column
  controls grid (one column ≤ 900 px); inputs are 16 px on touch (`ui/controls/controls.css`).
- **Charts:** 540 px tall; on phones `min(60dvh, 420px)`. On touch they follow "Charts on touch" above
  (`timeZoom(ctx)` with `ctx.touch`: a swipe scrolls the page; the dates, and the slider on wider screens, zoom).

Screenshots (P1, in the session scratchpad `ag/`): `390-<theme>-landing.png`, `390-<theme>-gdd.png`,
`390-<theme>-gdd-options.png`, `1440-<theme>-landing.png`, `1440-<theme>-gdd.png` for light, dark and
high-contrast.

## Download (a sheet)

The Download sheet (`partials/sheets/download.html`) is open while `dl=1`: from the Charts list's "Download
data" entry (`openSheet('download', opener)`), from an old `#download` / `#downloader` link, or any URL with
`dl=1`. Closing (×, Esc, the scrim, a drag down on phones) clears `dl` and returns focus to the opener (to
`<main>` when the URL opened it). It is a bottom sheet on phones and a centred panel (68 rem) from 641 px.
Inside, unchanged: three step cards (`.dash-card`, `partials/downloader/index.html`) and the preview below them:

| Step | Contents |
|---|---|
| 1 Elements | station combobox, variables multiselect, "Show uncommon variables", the station map (not on compact) |
| 2 Dates & period | time aggregation, dates (install date … today), quality control |
| 3 Run | recap ("Bozeman · 2 variables · Daily · 2026-09-01 to 2026-09-30"), Run, Download CSV, warnings |

- **Desktop and tablet:** a two-column grid, Elements beside Dates & period over Run; the preview spans
  both columns. No stepper.
- **Compact:** no station map in Elements (the header's station picker has one; MapLibre is not started),
  and a stepper. Only `.dl-step.is-current` shows (the Run step and the preview share step 3),
  under "Step 2 of 3" and a three-segment bar, with Back / Next below. Next stays enabled; when the step
  would block Run (no station or element; invalid dates, from the date control's `onValidity`) it stays put
  and shows why. A step change scrolls the progress line into view, focuses the step heading and announces
  "Step 2 of 3: Dates & period". Enter in a field is Next until step 3, then Run. The step is view state
  (not in the URL); the logic is `core/downloader/stepper.ts`.
- **After Run** (every width): the preview scrolls to the top of the view (instantly under reduced
  motion), its heading takes focus, and the live region gives the row count.
- **Touch:** inputs 16 px (controls.css), variable rows 44 px; on phones the variable list grows with the
  page instead of scrolling inside its panel.

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
- **Sensor changes** (`ui/about/history.ts`): installs and removals by day, newest first
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
- **Bottom sheet** (`sheet.ts`/`.css`) — peek/full, drag on the handle (up = full, down = peek, then
  close), Enter/Space on the handle toggles, Esc closes, focus moves in and returns to the opener, the
  rest of the page is `inert`, the body scrolls with `overscroll-behavior: contain`. Sits on the tab bar.
- **Drawer** (`drawer.ts`/`.css`) — inline (in the flex row, margin slide, content reflows, not modal)
  or overlay (fixed, scrim, modal). Closed = `visibility: hidden` + `inert`. Esc, focus in/out as the sheet.
- **Focus scope** (`focusScope.ts`) — the shared focus-in / inert / Esc / focus-return logic.
- **Section nav** (`sectionNav.ts`/`.css`) — the tab bar (three items on a solid `--bg-surface`, icon + label,
  ≥ 56 px, safe-area padding; the current one has a pill behind its icon and a bold label) and the header's
  segmented control (a `--bg-raised` track; the current one a raised `--bg-surface` pill, bold), `aria-current`.
- **Skeletons** (`skeleton.css`) — `.dash-skel` + `--line`, `--value`, `--spark`, `--media`, `--period`,
  `--chart`, `--table`; token shimmer, static under reduced motion, `aria-hidden`.
- **Badge** (`card.css`) — `.dash-badge`, `.dash-badge--warn` (heavier border + icon; never colour alone).
- **Toggletip** (`toggletip.ts`/`.css`) — an ⓘ button (`.mco-btn-info`, 24 px; the kit's 40 px on touch) that
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
  `about-readings`, `about-history` (each sheet open), `picker`, `picker-open` (both with the map revealed), `charts-list`, `variable` + `-history` + `-table`, `compare`,
  `legacy-ag`, four Ag tools, `download-step1` (390), `downloader`, `help-dialog`) × 3 themes × 1440/390.
  `keyboard.mjs` walks the header and its ⋯ menu (Help, Theme), the picker, the Download sheet, tab bar,
  photo dialog, About's two sheets (and Now's "All readings" opening the readings sheet), variable page, Ag
  Options and the legacy links; `layout.mjs` checks touch swipes over charts,
  sideways scroll at 390, the fold, the one-row header, the solid tab bar, the sheet's fit and reduced motion.
- Charts: the Table view is a real `<table>` (caption, scoped headers) in a focusable, labelled scroll region;
  presets and view switches are radios / links with `aria-current`; stats are a `<dl>`.
- Touch targets ≥ 40 px under `(hover: none)`; the tab bar is 56 px.
- Status is text: "No report for over 2 hours", "Feels like 41° · Wind chill"; the ⓘ button is named "Provisional data".
- The picker is `role="dialog" aria-modal="true"` only when it is modal (sheet, overlay drawer); the inline
  drawer is a plain landmark beside the content.
