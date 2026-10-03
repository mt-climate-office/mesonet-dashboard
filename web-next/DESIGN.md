# web-next design

How the dashboard is laid out and why: the information architecture, the
layout ladder, the shared components, motion and type. Read it with
ARCHITECTURE.md (code layers, data flow, "How to …"). It describes the P0
prototype of the UX refactor (plan "offer-this-as-a-unified-quill") and the
P1 sections (Charts, Ag, Download, About).

## Information architecture

```
Station view (?s=<id>; remembered in localStorage mco-dashboard-station)
├─ Now       #now (default)  current-conditions overview
├─ Charts    #charts         variable list → variable page (v=…, view=recent|history|table)
│                            | Compare (cmp=1)
├─ Ag        #ag             tool cards → a tool (var=…): Options disclosure + chart
├─ Download  #download       Elements → Dates & period → Run, preview (a stepper on phones)
└─ About     #about          metadata, all current readings, locator map
Station picker: drawer (desktop/tablet) or bottom sheet (phones):
                search · Near me · recents · network chips · map
```

- **Entry:** `?s=` opens that station; otherwise the last one; otherwise the picker (first visit).
- **Picking** a station closes the picker at every size (the desktop drawer saves "closed") and moves focus
  to `<main>`, the new station's content.
- **History:** a section change or a drill-down (a Charts variable or sub-view, an Ag tool) is `pushState`,
  so Back returns; other changes inside a section (dates, toggles) replace the entry. Section links are real `<a href>`s: they open in a new tab
  and work before the JS runs.
- **Old links** keep working (DIVERGENCES "UX refactor"): `#latest` → Charts → Compare, `#downloader` →
  Download, `#ag` unchanged.

## Layout ladder

One ladder, aligned with the kit (HOUSE-STYLE §3). Layout lives in `@media` rules; behaviour (sheet vs
drawer) reads `MCO.viewport` and the desktop query in JS.

| Name | Query | Sections | Station picker | Now grid |
|---|---|---|---|---|
| compact | `(max-width: 640px), (max-height: 560px)` (`MCO.viewport.COMPACT_MQ`) | bottom tab bar | bottom sheet (peek / full) | one column, tiles 2-up |
| tablet | 641–1059 px | segmented row under the station header | overlay drawer + scrim | hero beside photo, tiles 3-up |
| desktop | ≥ 1060 px | segmented row | in-flow drawer, remembered (`mco-dashboard-drawer`) | hero 3/5 beside photo, tiles 4-up |

The kit's own steps still apply inside the navbar: labels shed ≤ 1400 px, chrome tightens ≤ 1060 px, the
brand hides ≤ 750 px.

**Page frame** (`partials/shell.html`, `ui/layout/shell.css`): the sticky one-row navbar; below it one flex
row, `.dash-shell` = picker drawer + content column (notices, station header, section row, the section,
footer); the phone tab bar is fixed at the bottom. `--chrome-h` (navbar) and `--tabbar-h` (tab bar) are
published on `<html>` and used for the drawer/sheet offsets, the body's bottom padding (the tab bar never
covers content) and the toast.

**Navbar:** logo · brand · **station switcher** (pin icon + "Bozeman ▾", truncates, opens the picker) · Share ·
theme · Help. One row at every width. Feedback lives in Help and the footer.

**Station header:** the station name (`--fs-xl` heading) over "network · county · elevation". On compact the
switcher already shows the name, so the heading is `.sr-only` there and only the meta line shows.

## Now

| Slot | Content | Data (tier) |
|---|---|---|
| Freshness | "Updated 7 min ago", an ⓘ toggletip when the data are provisional (QC level 2, not yet through the daily QC pass), **No report for over 2 hours** warning | `/latest` (1) |
| Hero | Air temperature; NWS feels-like with "Wind chill"/"Heat index"; today's high/low; gridMET normal high/low; 48 h sparkline | `/latest` (1); hourly + `tmmx`/`tmmn` (2) |
| Tiles | Wind (speed, gust, compass glyph pointing where it blows), Precipitation (today, 24 h, 7 d, YTD vs normal), Humidity, Solar, Pressure, Soil (depth profile: temp + VWC bar), Snow depth (only with snow: ≥ 0.5 in now or in any hour of the last 72 h), VPD (AgriMet); each a link to its variable, with a 48 h sparkline | `/latest`, `/derived/ppt/` (1); hourly + `pr` (2) |
| Media | Latest camera frame (opens the photo dialog), or the wind rose without a camera | photo schedule (1) |
| Forecast | NWS periods in a horizontal strip with scroll snap | NWS (1) |
| All readings | link to About's readings table (`navigate('about', { target: 'about-readings' })`) | — |

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
  variables from `/elements/{s}`, one card per group, one row per variable: name · current value (from
  `/latest`, shallowest depth for soil; the last 24 h total for precipitation and ETr) · 48 h sparkline (one
  72 h hourly request for every listed variable). The last card opens Compare.
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
## Ag

| State | Content |
|---|---|
| No `var` | "Ag tools": one `a.dash-card` per tool (`DERIVED_VAR_OPTIONS` in `core/params/ag.ts`: name + one-line description), as many columns as fit (min 16 rem) |
| `var=<tool>` | "‹ All Ag tools" link · heading "<tool>: <station>" · **Options** disclosure · chart card (notes, then the chart or its state) |

- **Navigation:** a card is a real link (`?…&var=<tool>#ag`); a plain click opens it with `pushState`
  (`navigate('ag', { drillDown: true })`) and focuses the heading. "All Ag tools", and the Ag tab inside Ag,
  return to the cards the same way (`core/ag/view/tab.ts#agCardsPatch`: `var` and every other Ag key back to
  its default, so the link is not read as an old GDD one); the link focuses the card just left. Back returns
  to the cards. Opening a tool applies `variablePatch` (the
  same reset as changing the variable select inside Options).
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

## Download

Three step cards (`.dash-card`, `partials/downloader/index.html`) and the preview below them:

| Step | Contents |
|---|---|
| 1 Elements | station combobox, variables multiselect, "Show uncommon variables", the station map |
| 2 Dates & period | time aggregation, dates (install date … today), quality control |
| 3 Run | recap ("Bozeman · 2 variables · Daily · 2026-09-01 to 2026-09-30"), Run, Download CSV, warnings |

- **Desktop and tablet:** a two-column grid, Elements beside Dates & period over Run; the preview spans
  both columns. No stepper.
- **Compact:** a stepper. Only `.dl-step.is-current` shows (the Run step and the preview share step 3),
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
`core/about`). One column on phones; from tablet up two (details | map, readings | sensor changes), notes
full width.

| Card | Content | Data |
|---|---|---|
| Station details | name, id, network, NWS ID, county, coordinates, elevation (ft and m), installed, period of record (install → newest report); one-pager link | `/stations`, `/latest`, one-pagers.json |
| Location | `locatorMap` (ui/map/presets): the station map flown to the station, legend collapsed, **cooperative gestures** (one finger and a plain wheel scroll the page; two fingers or Ctrl/⌘ move the map) | `/stations` |
| All current readings | the former Current Conditions table (`core/cards/currentConditions`, with **Feels like** by the NWS method) and, for HydroMet, the precipitation summary; `#about-readings` is the target of Now's link | `/latest`, `/derived/ppt/` |
| Sensor changes | installs and removals by day, newest first (`core/about/sensorHistory`) | `/config/{station}/` (the response Compare's overlays use) |
| About the data | QC level 2, provisional data, time and units; links to the API docs and this station's requests | — |

Long tables and lists scroll inside `.about-scroll`, a focusable `role="region"` with a label, so the page
never scrolls sideways at 390 px. Every fetch is in `ui/station/resources.ts`, shared with Now.

## Components (`src/ui/layout/`; kit candidates, see KIT-NOTES.md)

Each is framework-free CSS on kit tokens plus a small vanilla `init…({…})`; the Alpine wrappers
(`ui/picker/stationPicker.ts`, `ui/shell/sections.ts`, `ui/shell/navigate.ts`) only connect them to the stores.

- **`.dash-card`** — the one in-flow panel: `--bg-surface`, `--border`, `--radius-lg`, `--card-pad`
  (1 rem; 0.875 rem compact), `.dash-card-title` (sm, 600, `--text-secondary`). A card may be an `<a>`
  (tiles): hover border, kit focus ring. `.mco-panel` stays for glass over maps.
- **Bottom sheet** (`sheet.ts`/`.css`) — peek/full, drag on the handle (up = full, down = peek, then
  close), Enter/Space on the handle toggles, Esc closes, focus moves in and returns to the opener, the
  rest of the page is `inert`, the body scrolls with `overscroll-behavior: contain`. Sits on the tab bar.
- **Drawer** (`drawer.ts`/`.css`) — inline (in the flex row, margin slide, content reflows, not modal)
  or overlay (fixed, scrim, modal). Closed = `visibility: hidden` + `inert`. Esc, focus in/out as the sheet.
- **Focus scope** (`focusScope.ts`) — the shared focus-in / inert / Esc / focus-return logic.
- **Section nav** (`sectionNav.ts`/`.css`) — the tab bar (icon + label, ≥ 56 px, safe-area padding,
  indicator line + bold label for the current one) and the segmented row (filled pill), `aria-current`.
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
  kit easing; forward/back follows the section order. The navbar and tab bar stay still.
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

- Every new surface is in the axe matrix (`scripts/verify/axe.mjs`: `now`, `about`, `picker`, `charts-list`,
  `variable`, `compare`, `ag-tools`) × 3 themes × 1440/390.
- Charts: the Table view is a real `<table>` (caption, scoped headers) in a focusable, labelled scroll region;
  presets and view switches are radios / links with `aria-current`; stats are a `<dl>`.
- Touch targets ≥ 40 px under `(hover: none)`; the tab bar is 56 px.
- Status is text: "No report for over 2 hours", "Feels like 41° · Wind chill"; the ⓘ button is named "Provisional data".
- The picker is `role="dialog" aria-modal="true"` only when it is modal (sheet, overlay drawer); the inline
  drawer is a plain landmark beside the content.
