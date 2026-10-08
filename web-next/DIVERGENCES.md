# Intentional divergences

What web-next deliberately does differently, in three parts:

1. **House style**: visual changes that come from adopting mco-web-style (palette, fonts, themes).
2. **vs web/**: behaviour that differs from the React app this replaces.
3. **Carried over from web/**: divergences from the legacy Dash app (`app/mdb`) that web/ already documented and that still apply. IDs refer to `web/scripts/fidelity/CHECKLIST.md`.

Each entry gives the old behaviour, the new one, and why. Add an entry in the same PR as the change.

## Redesign 2026-10: three places, chart first

### Redesign 2026-10 (summary)
- **P1:** five sections (Now · Charts · Ag · Download · About), controls before content, every reading with
  equal weight, API labels, outlined cards, Space Mono at hero sizes.
- **New:** three places, Now · Charts · About (DESIGN.md "Redesign 2026-10" and "Information architecture").
  The detailed entries, each with its old behaviour, new behaviour and reason:
  - [Three places: Now, Charts, About](#three-places-now-charts-about): Ag tools are Charts entries, Download
    is a sheet, every old link still lands;
  - [Header: one row and one ⋯ menu](#header-one-row-and-one--menu-no-station-meta-line) and
    [Station picker: search first](#station-picker-search-first-the-map-on-demand);
  - [Flat surfaces](#flat-surfaces) and [plain names in charts](#charts-plain-names-in-tooltips-and-tables);
  - Now: [the 48 h strip](#now-the-forecast-card-becomes-the-heros-48-h-strip),
    [desktop columns](#now-desktop-columns),
    [tiles only where they mean something](#now-tiles-only-where-they-mean-something),
    [pressure as a trend](#now-pressure-as-a-trend-in-the-all-readings-row),
    [wind with the 24 h peak gust](#now-wind-with-the-24-h-peak-gust);
  - [About: details, map, two rows that open sheets](#about-details-map-two-rows-that-open-sheets);
  - [Download: one short form](#download-one-short-form-preview-then-download-csv--n-rows);
  - Charts: [one chart frame](#charts-one-chart-frame-range-chips-an-interval-row-a--menu),
    [Interval and the Daily band](#interval-auto-and-the-daily-lowhigh-band),
    [Reference ET is one page](#reference-et-is-one-page),
    [Ag tools: option chips](#ag-tools-option-chips-the-station-comes-from-the-header).
- **Unchanged:** data requests (v2 API, QC level 2, no `premade`, exclusive `end_time`), Ag numbers, request
  code, CSV bytes and the `dl_*` keys.
- **Why:** the user's review of P1, "too complicated, and not modern enough" (DESIGN.md "Redesign 2026-10").

These entries supersede the section, navbar, picker, Ag-cards and Download-layout parts of the P0/P1 entries
below, which stay for the record and name what replaced them.

### Three places: Now, Charts, About
- **P1:** five sections, Now · Charts · Ag · Download · About, in a segmented row under the station header
  (tablet up) or a five-item tab bar (phones).
- **New:** **Now** (`#now`) · **Charts** (`#charts`) · **About** (`#about`) (core/router.ts). Ag tools are
  entries in the Charts list's "Ag tools" group, opened at `#charts&v=<tool>`: `v` is one namespace, an Ag
  tool id (core/params/ag `AG_TOOL_IDS`) or an element family. Download is a modal sheet, open while
  `dl=1` (from each chart's ⋯ menu, prefilled from the chart). The Ag tool
  cards page and the Ag and Download sections are gone. The sections sit in the header from tablet up; phones
  keep a three-item tab bar. Section and variable changes push history; the rest replaces.
- **`etr` is one id:** it was both the observed Reference ET variable page and the Ag Reference ET tool; it is
  now the Ag tool (it keeps every Ag number and the hourly/daily toggle). The list's Reference ET row opens it
  (see "Reference ET is one page").
- **Annual comparison:** no longer in the list; an old `var=annual` link opens the `annv` variable's
  All-years view (`view=history`; air temperature without `annv`). `v=annual` still renders the old tool.
- **Old links:** `#ag&var=<tool>` → `#charts&v=<tool>` with every Ag key; `#ag` with Ag keys but no `var`
  (or an unknown one) → GDD, as before; a bare `#ag` → the Charts list scrolled to its Ag tools group;
  `#download` / `#downloader` → `#charts&dl=1` with every `dl_*` / `els` / `period` / `qc` / `pub` key
  (`#downloader`'s `from`/`to` renamed first; closing the sheet then clears `dl`, `els`, `dl_from`, `dl_to`
  and `period`, where web/ kept them while the Downloader tab stayed open); `#latest` → Compare, unchanged. `var` left the schema; the
  boot redirect removes it, and any other unknown key round-trips.
- **Why:** user decision (DESIGN.md "Redesign 2026-10", decisions 1–2): P1 had three mini-apps of its own.

### Header: one row and one ⋯ menu; no station meta line
- **P1:** logo · brand · station switcher · Share · theme · Help, a station header (name and "network · county
  · elevation") above every section, then the section row.
- **New:** logo · brand (desktop only, ≥ 1060 px) · the station button ("Bozeman ▾") · the sections (tablet
  up) · one ⋯ menu with Share this view, Theme (the 3-state cycle, its state shown: "Dark"), Help and Send
  feedback. The menu is a WAI-ARIA menu button (focus moves in, arrows, Esc returns focus). The meta line is
  gone from the shell (About has the details; the Now hero gets them in phase B). The tab bar is a solid
  surface, no longer glass.
- **Why:** DESIGN.md "Redesign 2026-10": controls before content, outlines everywhere.

### Station picker: search first, the map on demand
- **P1:** search, a "Near me" section with its own button, recents, then the network chips and the map, always shown.
- **New:** the search field holds a "Near me" chip (the same one-time geolocation); its results show under the
  field once pressed. Recents follow, then "Browse on the map", which reveals the network chips and the map
  (MapLibre starts on the first reveal). Drawer / sheet, focus, `inert` and Esc rules are unchanged.
  The field starts empty (P1 showed the station name in it) and ranks matches across networks while typing
  (P1 grouped them by network); Esc clears the text, then closes the list, then the picker. On a phone,
  the map opens the sheet full and fills it (two fingers move it).
- **Why:** DESIGN.md "Redesign 2026-10": most visits search or pick a recent station. The prefilled name
  had to be deleted before every search, and grouping put a prefix match under a network of weaker ones.

### Flat surfaces
- **P1:** `.dash-card` had a 1 px border and a 12 px radius.
- **New:** a flat surface with a 16 px radius and a soft two-layer shadow tinted by the kit `--scrim`; no border,
  except in high contrast, which keeps the border (a shadow does not show on black). Phase A changes the
  primitive only; sections adopt the new chips and numerals in phase B.
- **Why:** DESIGN.md "Visual language".

### About: details, map, two rows that open sheets
- **P1:** About was five cards: details (nine rows: name, id, network, NWS ID, county, coordinates, elevation,
  installed, period of record), the map, the readings table with API labels ("Soil VWC @ 4 in [%]", values as
  the API sends them), the sensor-change list, and the notes. Now's "All readings" link scrolled to the table.
- **New:** a details card with five rows (Station with its id in mono, Network, Location "Gallatin County ·
  45.66° N, 111.07° W", Elevation, Record "Oct 30, 2020 – today") and a one-pager row; the map in a flat,
  rounded frame; rows "All current readings · 26" and "Sensor changes · Aug 22, 2025", each opening a modal
  sheet; the notes. The readings use plain labels ("Soil moisture at 4 in", core/about `readingRows`) with the
  unit on the value at table precision ("13.4%", "57.0 °F"); the rain totals read "Last 7 days", "Year to
  date". The NWS ID row is gone (the station picker still accepts an NWSLI in `?s=`). Now's "All readings"
  opens the readings sheet over About; closing it leaves focus on the row.
- **Why:** DESIGN.md "About": flat surfaces, plain labels, and a sheet is easier than a long in-place table
  on phones.

### Now: the forecast card becomes the hero's 48 h strip
- **P1:** an NWS forecast card: the next 8 text periods (name, icon, temperature, short forecast, chance of
  precipitation) in a horizontal scroll-snap strip, with a "{place} · NWS forecast" heading and a Retry button.
- **New:** no forecast card. The hero's 48 h strip draws the last 24 h observed into the next 24 h of the NWS
  **hourly** forecast (`forecastHourly`, one more request, `nwsh:<url>`, 30 min), with the observed high
  above its point and the low below it, inside the plot, and plain hour ticks ("Now", "6 AM", "Noon"; every 6 h
  on phones, 3 h wider). The periods it spans ("Tonight 45°") are an icon row under it (api.weather.gov only,
  alt text = the short forecast; not labels inside the plot, which crowded it at 390 px) beside a "Full
  forecast" link to the NWS page. The current period's sky feeds the summary sentence. Beyond 24 h, and
  the chance of precipitation, are on the NWS page. Without NWS coverage the strip shows the observed day only.
- **Why:** DESIGN.md "Now": one picture of yesterday into tomorrow instead of a second card of text.

### Now: the hero's high and low are the last 24 hours
- **P1 (and the Overview plan):** "High 63° · Low 40°" since local midnight (today's hourly means plus the current reading).
- **New:** "24 h high 74° · low 41°" over the strip's observed half: the hourly readings in (now − 24 h, now] plus the current one. The normal ("Normal 65° / 37°") stays today's calendar day in Denver.
- **Why:** just after midnight a since-midnight high/low covered one hour ("High 49° · Low 48°") beside a strip showing 74° and 41°; the two now always agree.

### Now: desktop columns
- **P1 / phase B:** hero + photo | tiles + rows, the photo 16:8 across the wide column (about 400 px tall at
  1440 px), leaving the right column half empty.
- **New:** from 1060 px, hero + tiles (4-up) | photo + rows, the photo at most 360 px tall: the pairing that
  keeps the two columns closest in height. Phones and tablets keep one column in DOM order (hero, photo, tiles,
  rows), which is also the reading and Tab order at every width.
- **Why:** the user's review of the phase B preview.

### Now: tiles only where they mean something
- **P1:** a tile for every reading the station reports: Wind (with a compass glyph), Precipitation today (24 h,
  7 d and YTD lines), Humidity, Solar radiation (0 W/m² all night), Pressure, Soil (a depth profile table), Snow
  depth (with snow), VPD; labels in API words ("Solar radiation", "mbar").
- **New:** `nowTiles` (core/overview/relevance.ts) hides Sunlight at night (< 5 W/m²) and Pressure always;
  precipitation is one **Rain** tile (the 7 d total, or 24 h without the ppt summary, with "% of normal this
  year"), shown whenever there is a source, even after a dry week; its graphic is seven daily bars (one small
  daily `ppt` request, `rainBars`), and nothing at all after a dry week (a flat line said nothing); humidity carries the dew point; soil
  moisture shows the shallowest depth only, with a **Dry/Wet** badge from soil water potential (≥ 15 bar / ≤ 0.33
  bar, the Ag SWP thresholds) for stations with SWP parameters (one hourly `soil_vwc` request, SWP computed in the browser; VWC alone gets no
  badge, its thresholds depend on soil texture). Names, units and precision come from `core/variables/labels`
  ("Sunlight", "mb", soil moisture as an integer). The full profile and every reading stay on About. The badge
  is a neutral `.dash-badge` (the kit has no warm status token).
- **Why:** DESIGN.md "Visual language": every reading had equal weight, including empty ones.

### Now: pressure as a trend in the "All readings" row
- **P1:** a Pressure tile (847.2 mbar and a sparkline).
- **New:** no tile. The "All readings" row's meta says "Pressure 847 mb, steady" (rising / falling when the
  last 3 h changed by more than 1 mb, NWS practice; the word appears once the hourly rows are in) and the snow
  depth ("Snow none" when the station measures it and there is none). A "Station details" row (network and
  elevation) links to About.
- **Why:** a station pressure of ~850 mb means little on its own; its 3 h change is what forecasts use.

### Now: wind with the 24 h peak gust
- **P1:** the latest 5-minute wind speed and gust ("1 mph", "SE · gusts 2").
- **New:** the Wind tile reads "1 mph now · SE" ("Calm" under 1 mph) over "Gusts to 43 mph · 24 h":
  the max of the hourly gusts (`windgust` joins the 72 h hourly request; the API's hourly gust is already the
  hour's maximum) and `/latest`'s gust (`peakGust`, core/overview/series.ts). Without gust rows the old
  "SE · gusts 2" line stays. The hero summary says "calm after gusts to 43 mph earlier" when that peak is
  ≥ 25 mph. The summary and the tile share one calm threshold, under 1 mph (Beaufort 0; `CALM_MPH`). The sparkline is unchanged.
- **Why:** at Dog Gun Lake E (acedoggu) the wind died off near 7:45 AM after a night of 40+ mph gusts, and
  the tile said only "1 mph".

### Download: one short form, Preview then "Download CSV · N rows"
- **P1:** three step cards (a phone stepper with Back/Next; two columns elsewhere) with a station combobox
  and a station map, a recap, then Run Request and a separate Download CSV button.
- **New:** one column of summary rows (Variables · Dates · Interval · Quality; label left, value right) that
  expand in place one at a time to the existing controls, and a fixed "Station: Bozeman (acebozem)" line: the
  header's picker changes the station, so the sheet has no station combobox or map (the `downloaderMap`
  preset is gone). One primary button reads **Preview** until the current inputs have a result, then
  **Download CSV · N rows**; any input change turns it back into Preview. It is `aria-disabled` (never
  natively disabled, so focus stays on it) with one line saying why ("Pick at least one variable.", the date
  error, …), which replaces web/'s "Please select a station and at least one variable first!" and "Please
  'Run Request' before attempting to download." (DL-015, DL-016). Plain labels: Interval Hourly / Daily /
  Monthly (finest first); Quality "Quality-controlled", "Provisional (basic checks)", "Unchecked" for
  levels 2 / 1 / 0 (was "Quality-controlled", "Provisional", "Raw"). The funding line (DL-020) is a quiet
  caption under the form, not an accent bar. After Preview, focus stays on the button (no scroll to the
  preview); the row-count announcement is unchanged. A station change from the header no longer resets the
  start date (`dl_from`); the date window still clamps to the new station's install date.
- **Why two steps, not one "Download CSV" that fetches and saves:** the save is a click on a blob link,
  which browsers tie to a user gesture. A fetch can outlast the gesture (about 5 s in Chrome), and Safari and
  Chrome's repeated-download guard block or prompt for downloads started without one. Saving on the second
  click keeps every download inside a click, and shows the row count before it.
- **Not offered:** a 5-min (raw) interval. Legacy had none (DL-008), the `period` key has no such value, and
  the request code is unchanged.
- **Unchanged:** the request code, the CSV bytes (fidelity: byte-identical to web/), every `dl_*` / `els` /
  `period` / `qc` / `pub` key, the `dl-run` / `dl-download` test ids the fidelity driver clicks.
- **Why:** DESIGN.md "Download (a sheet)": a short form opened from a chart, prefilled from its keys.

### Charts: one chart frame; range chips, an Interval row, a ⋯ menu
- **P1:** a variable page with "‹ All variables", prev/next chips, a Recent · History · Table switch, range presets
  plus Custom (dates + Hourly / Daily / Raw), a gridMET normals switch, and a min / max / mean stats row; the list
  ended with Compare and "Download data" cards.
- **New:** back · title · ⋯ (Download data, Show as table / chart, Custom dates…, Share this chart, Previous /
  Next), "57 °F now · Last 14 days", the chart, range chips **24 h · 7 d · 14 d · 30 d · 1 y · All years** (All
  years is the old History, `view=history`), the **Interval** row (see below) and a Low · High · Average card
  (Total for totals) in plain units and table precision ("81.0 °F", "4.0 mph"; was "81 °F", "4.04 mi/hr"). The
  Table view is "Show as table" (`tbl=1`, pushed; an old `view=table` link still opens it), and All years can be
  tabled too. Prev/next chips became ⋯ → Previous / Next plus a sideways swipe on touch. The list gained a
  search field, values in the variable's plain unit and precision ("6 mph", wind direction as "S") and sub-labels
  under the names; Compare is "Compare variables" under More; "Download data" left the list (each chart's ⋯
  has it, prefilled). Presets no longer set `agg` (P1's 1 y meant daily; it now means Auto, which is daily
  there), so an old `from`/`to`/`agg=daily` 1 y link opens 1 y with Daily pressed.
- **Normals:** no switch; gridMET normals draw on daily air temperature by themselves (DESIGN.md "Charts"). The other
  variables with normals (precipitation, humidity) show theirs on Compare's switch.
- **Why:** DESIGN.md "Charts": chart first, controls under it, one menu for the rest.

### Charts: plain names in tooltips and tables
- **web/ / P1:** chart tooltips and table headers used the API column ("Wind Speed: 4.1 mi/hr", "Air
  Temperature [°F]"); About's sensor changes listed "Soil VWC @ 2 in".
- **New:** the plain name and unit from `core/variables/labels` ("Wind: 4.1 mph", "Air temperature (°F)",
  "Soil moisture at 2 in (%)"; `plainUnit`), on the variable page and Compare, and in the sensor changes.
  Since Redesign C the **y-axis titles** are plain too (`axisTitle`: "Air temperature (°F)", "Rain (in)",
  "Wind direction", "Daily GDD (°F)", "Soil saturation (%)"; LDP-005's legacy "Air Temp. (°F)" and the
  per-period "(inches/day)" are gone, and AXIS_MAPPER with them), as are the All-years and Annual axes
  ("Cumulative rain (in)"), the Ag table headers, the Ag notes and live region ("Soil saturation", one name
  map), the wind-rose title ("Wind, Sep 19 – Oct 2", UI font; was "Wind Data from 2026-09-19 to
  2026-10-02") and the Download sheet's Variables row and checklist ("Air temperature at 6.6 ft"; was "Air
  Temperature @ 6.6 ft"; the element codes stay the values, and CSV headers and filenames are unchanged).
  The ECharts series names stay the API ones: the fidelity harness pairs traces by them, and pairs panels by
  their first series instead of their titles (title wording is reported, not scored; the wind-rose title
  and the Soil saturation note are DOCUMENTED). The Download preview table keeps the CSV's API headers.
- **Why:** DESIGN.md "Visual language": no API label in visible UI.

### Interval: Auto, and the Daily low–high band
- **P1:** `agg` absent meant hourly; Daily drew the API's daily mean only, and the stats' Min / Max were the
  extremes of the daily means.
- **New:** on the variable page, `agg` absent is **Auto**: hourly up to 30 days, daily beyond and for All years
  (`core/variables/interval`). 5-min (`raw`) is offered for windows of 7 days or less; on a longer window the page
  draws Auto. **Daily** adds one request, `/observations/daily` with `agg_func=min,max` over the same elements
  (`core/api/record` `aggFunc`), and draws each day's true low–high as a band behind the mean line (a one-column
  variable; not totals or wind direction); the stats' Low / High are those true extremes (one 5-minute reading,
  where the old Min was a daily average). The table gains Low / High columns. Compare is unchanged: there `agg`
  absent is still hourly (`latestAgg`), so every old `#latest` link draws what it did.
- **Why:** DESIGN.md "Redesign 2026-10", decision 5: daily means alone hide the day's range, and "Min 34.9" next to a daily
  mean line read as a measured low.

### Reference ET is one page
- **P1 / phase A:** `etr` was the observed Reference ET variable (with History and Table) and the Ag Reference ET
  tool; phase A made `v=etr` the tool, which lost the variable's History and Table.
- **New:** one Reference ET page, the Ag tool (client-side ETr, every number unchanged) in the chart frame, with
  an **All years** chip (`view=history`: the variable page's years-overlaid history of the API's daily ETr, one
  year per request), **Show as table** (the tool's table twin), and ⋯ → Previous / Next (and the swipe) in the
  variable list, where Reference ET stays under Rain and evaporation with its 24 h total and sparkline. It is not
  repeated in the Ag tools group (`LIST_AG_TOOLS` drops `etr`).
- **Why:** one id must be one page, and neither the tool's numbers nor the variable's history and table may be lost.

### Ag tools: option chips; the station comes from the header
- **P1:** an "Options" disclosure (station combobox, variable select, Learn More, dates, time aggregation,
  livestock, crop, cutoffs, projection, soil variable, annual element) above the chart card, headed
  "<tool>: <station>". Opening an SWP tool at a station without SWP sensors cleared the station with a toast
  (SWP-001).
- **New:** the chart frame (back · the tool's plain name · ⋯ with Download data, Show as table, Share this chart,
  About this tool) and **option chips** naming each option's value (`Wheat` · `32–70 °F` · `Since Oct 2, 2025` ·
  `Projected to Oct 31`), each opening a popover with the same control as before. The station is the header's;
  the tool select is gone (the list is the tool picker). An SWP tool at a station without SWP sensors keeps the
  station and says so ("… has no soil water potential sensors, so this tool does not apply there.") with a
  button that opens the picker. A stats card shows Reference ET's total, feels-like and livestock-risk low and
  high, and GDD so far with the stage reached. Every Ag number, `.ag-chart-card` and its test ids are unchanged.
- **Notes (Redesign C):** web/ showed each note (the NDAWN cutoff switch, the projection's sources, …) as an
  alert above the chart; they are one ⓘ toggletip under the chips now, with the same text. On phones the GDD
  legend uses short names and the stage labels sit at the right end of their lines.
- **Why:** DESIGN.md "Ag tools (inside Charts)": controls before content, and a second station control beside the header's.

## UX refactor (P0 prototype, 2026-10)

The user-approved refactor (overview first, mobile first; DESIGN.md) changes the
information architecture and layout on purpose. These entries supersede the
layout parts of older entries below; data behaviour is unchanged.

### One station view with sections, instead of three tabs (P0; superseded by "Three places")
- **Legacy / web/:** top-level tabs Latest Data · Ag Tools · Data Downloader (`#latest` default).
- **New:** a station view with sections **Now** (`#now`, default) · **Charts** · **Ag** · **Download** · **About**
  (core/router.ts). Section changes are `pushState`, so Back returns to the previous section; in-section
  state still uses the batched `replaceState`. On phones the sections are a bottom tab bar; on tablet and
  desktop a segmented row under the station header.
- **Old links keep working:** `#latest` → `#charts` + `cmp=1` (Compare, keeping `from/to/agg/vars/gridmet`);
  a hash-less link with one of those keys does the same; `#downloader` → `#download` (keys renamed by
  `migrateLegacySearch` first); `#ag` unchanged; `#satellite` → Now with the existing notice. `card`/`info`
  are no longer schema keys; like any unknown key they stay in the URL, so old links round-trip.
- **Sections (P1):** each section's own entries follow: About ("About replaces …"), Ag ("Ag: tool cards"),
  Download ("Download: a stepper …") and Charts ("UX refactor: Charts").
- **Why:** users land on current conditions; history, tools and tables stay one tap away (plan Context).

### A bare `?s=` opens Now; no `?s=` reopens the last station
- **Legacy / web/:** `?s=` opened Latest Data; no `?s=` showed an empty Latest tab.
- **New:** `?s=` opens Now. Without it the last confirmed station (`mco-dashboard-station`) opens; with none
  the station picker opens (first visit). The five most recent stations are `mco-dashboard-recent`.
- **Why:** user decision (2026-10-02): reopen the last station.

### Station picker: drawer / bottom sheet with Near me (P0; its contents now follow "Station picker: search first")
- **web/:** a combobox and network chips in the Latest sidebar, plus the locator map card.
- **New:** one picker (search, **Near me**, recents, network chips, map), a drawer on desktop (in-flow,
  remembered in `mco-dashboard-drawer`), an overlay drawer on tablets and a bottom sheet on phones. Near me
  asks for the location only when tapped. The Compare view keeps its own combobox until P1.
- **Why:** station choice is the first decision on every visit and must work one-handed on a phone.

### Navbar: one row; Feedback moved (P0; superseded by "Header: one row and one ⋯ menu")
- **Before (MOB-003):** the bar wrapped to two rows at 390 px and carried the tab links and Feedback.
- **New:** one row at every width: logo, brand (hidden ≤ 750 px by the kit), the station switcher
  ("Bozeman ▾"), Share, theme, Help. Feedback is in Help and the footer.
- **Why:** the old bar took 100 px of a phone screen and hid the app name.

### Feels like uses the NWS method
- **Legacy / web/:** Current Conditions showed "Real Feel", the NWS wind-chill formula at every temperature
  (a legacy bug kept for parity; LDB-007).
- **New:** **Feels like** from `core/ag/compute/feelsLike.ts` everywhere, the same NWS rules the Ag
  tool uses: heat index at ≥ 80 °F, wind chill at ≤ 50 °F with wind > 3 mph, otherwise the air
  temperature. The Now hero labels it "Wind chill" / "Heat index" when one applies. The About
  current-readings table (`core/cards/currentConditions.ts`) replaces the "Real Feel [°F]" row with
  "Feels like [°F]" (2 decimals, "(wind chill)" / "(heat index)" when one applies), shown whenever there
  is an air temperature, calm wind included. The wind chill is MetPy's metric formula, so it can differ
  from the °F formula by a few hundredths. The fidelity harness reports the Real Feel / Feels like pair
  as `documented` (`scripts/fidelity/lib/compare.mjs`, LDB-007).
- **Why:** user decision (2026-10-02): the NWS method everywhere.

### Ag tools: color by meaning, a season-long GDD window (issues #78–#80)
- **Before:** Feels like drew every day as a marker on the feels-like line, grey where no index applied.
  Livestock risk colored its classes with one YlOrRd ramp, so mild cold stress and mild heat stress looked
  the same. GDD drew its bars and line in one color and opened on the last 365 days, which starts mid-season
  and so lands on the wrong stage. The GDD cutoffs were two separate sliders.
- **New:**
  - **Feels like** (`core/charts/agMet.ts` `feelsLikeChart`): the feels-like line, the air temperature
    dashed, and a marker only where an index applies: wind chill blue ◆, heat index red ▲ (in dry air the
    heat index can sit below the air temperature, so the markers do not say "hotter"). The tooltip and
    table give both.
  - **Livestock risk** (`cciChart`, palette `cciStyle`): cold stress in blues ◆, heat stress in reds ▲
    (RdBu halves, light → dark from Mild to Extreme Danger), No stress grey ●; the legend runs cold → hot,
    and the table names the side ("Mild (cold)"). Dashed lines mark where heat stress starts (77 °F) and
    where cold stress starts for the chosen animal (33 °F adult, 42 °F newborn), so the Adult/Newborn chip
    visibly moves the cold threshold.
  - **GDD** (`gddChart`, palette `gddStageColors`): with a stage table, the bars and the stage lines are
    colored by the growth stage reached that day (batlow, first stage → last; a hidden piecewise visualMap
    on x); the running total and its projection are drawn in the text color (`CUMULATIVE_LINE`), so they
    stay visible over the bars (UX audit, below). Corn and custom cutoffs keep the GDD colors. With no
    `ag_from` / `ag_to`, the window is the crop's season (`core/ag/view/gddSeason.ts`): planting → today
    in season, planting → season end after it, last year's season before this year's planting date.
  - **Cutoffs** (`ui/controls/rangeSlider.ts`): one track with two thumbs (two native range inputs laid
    over each other, each with its own label, keys and value text).
  - Long marker series (a year of hourly rows) use ECharts' `large` mode, drawn in one pass.
  - **Daily feels like and livestock risk are each day's high and low** (`core/ag/compute/dailyRange.ts`,
    user decision 2026-10-07): the index is computed every hour, and a day shows its highest and lowest
    hourly value (≥ 18 hours, or the day so far for today). Legacy, web/ and the API's daily `/derived`
    compute from the daily *mean* temperature, humidity, wind and solar, which averages away afternoon heat
    and pre-dawn cold (in Bozeman, July daily means never reached a heat index, and the 24-hour solar mean
    understates the midday sun). The daily chart draws the day's range as a band (air temperature for
    feels like, the index for livestock risk) with markers at a stressed end: heat index ▲ at the high,
    wind chill ◆ at the low; livestock-risk stress classes at either end, No stress unmarked. The daily
    view therefore fetches hourly rows (as Hourly does). Download data from these two charts prefills
    the hourly values behind them (`agDownloadInterval`); picking Daily or Monthly for them in the Download
    sheet shows a note that the API's values there are daily means (`dailyMeansNote`).
- **Why:** user issues #78, #79, #80 (2026-10-06/07). The fidelity harness maps the renamed series back to
  web/'s names and leaves out web/'s grey "Average Temperature" markers and web-next's air temperature line
  (`scripts/fidelity/lib/compare.mjs`).

### Help: current copy and contacts
- **Legacy / web/:** Help described the five old sections, a `/dash/<station>` address, a James Seielstad
  contact, the Mesonet Manager (Kevin Hyde) for station questions, and a 94-station network with 205
  Army Corps stations still to be installed.
- **New:** Help (`partials/help.html`) describes Now · Charts · About, the chart ⋯ menu and this app's own
  `?s=` address; the dashboard contact is kyle.bocinsky@umontana.edu; the Mesonet Manager sentence is
  gone; the background is history (no siting plans), with the live station count from the catalog.
- **Why:** user request (2026-10-07): the copy was out of date, and the MCO is no longer siting stations.

### Now: a photo carousel; Back from a chart returns to Now
- **Before:** Now's photo card showed only the default direction's newest frame; opening a chart from a
  Now tile and pressing the chart's back arrow went to the Charts list.
- **New:** the photo card is a carousel of each direction's newest frame (default first; swipe, ‹ ›,
  dots; `core/cards` `photoSlides`, `ui/layout/carousel`), and a slide opens the photo dialog on that
  direction. A chart opened from a Now tile says "Back to Now", and its back arrow returns there through
  history (Now at its scroll position), also after a table view or Previous / Next (`$store.url.backTo`,
  core/router `nextBackTo`). Opened any other way, it still goes to the list.
- **Why:** user requests (2026-10-07).

### UX audit fixes (2026-10-07)
A sweep of every view in Chrome and WebKit (desktop, phone, tablet, landscape; three themes) and a review of each
screenshot produced 40 findings (issue drafts, `issue-drafts/ux-audit-2026-10-07`; the style-kit item is
mco-web-style#37). The behaviour changes:
- **GDD:** a window that ends in the past shows "No projection (past dates)" with an "End the dates today"
  button (`projectable`), not a projection chip with nothing drawn. Thinning keeps the stage reached and the
  highest stage; narrow screens label stage lines with their codes ("3", "V1"). Wheat and barley read
  "32–70/95 °F" (the NDAWN switch) on the chip, legend and table caption.
- **Feels like (hourly):** the feels-like line is named and in the legend (`FEELS_LIKE_LINE`); air temperature
  is the lighter dashed line. **Livestock risk:** one legend entry per side ("Cold stress (mild → extreme)",
  "Heat stress (mild → extreme danger)") with the classes in the tooltip and table; onset labels sit in a
  right gutter (short "77 °F heat" / "33 °F cold" on phones). GDD stage lines are one neutral stroke over a surface
  strip, and the GDD lines carry a surface halo, so both stay visible over the stage-colored bars. Bands read "Air temperature (daily low–high)" / "Livestock risk (daily low–high)".
- **Y axes** allow up to 8 steps (−24…113 °F → −40…120). Reference ET's running total uses the text color and its
  own axis steps.
- **Soil water potential:** every value drier than 1,000 bar is drawn capped and dashed, flagged clipped or not
  (dry-end values are lower bounds); the axis stops at 10⁴ bar; band labels sit at their lines with values
  ("Wilting point (-15 bar)") in a right gutter beside the plot; a depth on the cap for ≥ 90% of the window is left
  out with a note; log ticks have thousands separators. The Now soil chip uses the same cap. **Soil profile:** month
  ticks over 60 days (every 2nd/3rd month on phones), a hatched frozen swatch.
- **Palette:** light soil depths spread out (`DEPTH_GAMMA`), past years start at batlow 0.2, wider dark/high-contrast
  stress spans (all ≥ 3:1).
- **Wind direction:** the stats card shows a prevailing direction from a vector mean ("Prevailing SSE (156°)",
  "Variable" when bearings cancel) instead of low/high/average; it is drawn as small dots (no 360→0 strokes) on the
  variable page, Compare and All years; ticks read N/E/S/W/N; the axis title keeps "(°)".
- **Charts:** sparklines use their chart's y-axis rule (snow depth no longer autoscales noise) and dry rain draws
  a baseline; rain bars are at least 2 px; phone time axes over 3–60 days tick whole days; station-chart keys sit
  top-left (daily air temperature keys "Daily mean" and "Daily low–high"); All years ticks month starts at the
  bottom with a wrapping legend, current year first (also Ag Annual); the chart ⋯ trigger is a vertical ⋮ (the
  header's stays ⋯); the table view is full width; on phones the station's own keys come before chart-wide ones. All years and Annual fetch the install year
  together with the next (no 404 for an empty first year).
- **Now:** desktop tiles are one per row with the sparkline on the right; a dry week draws a bare baseline; copy
  "High 73° · Low 38° (24 h)", "Normal 63° · 35°", "Peak gust 14 mph (24 h)", Rain "Last 7 days" + "This year:
  81% of normal"; strip ticks every 6 h (12 h on phones, never dropping "Now"); forecast icons outlined.
- **Picker:** the drawer placeholder is "Station, town or ZIP"; search results show the station's network (IDs
  stay searchable).
- **Controls:** one control height token (`--ctl-h`: 34 px, 40 px on touch, 44 in the photo dialog); every select
  draws its own chevron and every date field its own calendar icon (so Safari matches Chrome); the page
  `color-scheme` follows the theme.
- **Photo dialog:** titled with the station name and aligned with the photo; on landscape phones the photo sits beside
  the controls; Time options show the time only; Safari no longer inserts " at "
  in photo times (`formatToParts`).
- **Dialogs and sheets** focus their heading on open and fade their bottom edge while there is more to scroll
  (`ui/layout/scrollFade`).
- **Download:** the Variables row opens straight to the checklist (`multiselect` `inline`): the uncommon-variables
  switch, the filter, a height-capped scrolling checklist, then the chosen chips (so ticking never moves the list);
  in high contrast a disabled Preview is dashed and muted; the daily-means note is
  a visible notice naming the selected charts; the variable list names a sensor height only when a station has
  several of that variable.
- **About:** units in their own column in the readings table (unit-less values in the UI font); sensor changes in
  depth order; "26 readings"; Location breaks before the "·". **Maps:** the selected station pushes town labels
  aside; the attribution button matches the zoom buttons; the locator map fits the station and its nearest neighbour
  clear of the legend and controls (`core/about/locator`) instead of a fixed zoom.
- **Short wide screens** (landscape phones) keep the header sections, attached popovers and the overlay picker drawer
  instead of the tab bar and bottom sheets; menus scroll when taller than the room below.
- **Why:** user review of the audit (2026-10-07): fix every finding in this repo.

### About replaces the metadata and current-conditions cards
- **Legacy / web/:** Station Metadata and Current Conditions were bottom-card tabs beside the locator map.
- **New:** the About section (DESIGN.md "About"): station details with readable labels and formats (Network,
  Coordinates "45.66° N, 111.07° W", Elevation "4,905 ft (1,495 m)", Installed "Oct 30, 2020") plus a
  **period of record** (install date to the newest report); the one-pager as a link; a locator map that
  needs two fingers or Ctrl/⌘ to move; the current-readings table with a header row and the
  precipitation summary; a **sensor-change history** from `/config/{station}/` (new); data notes and API
  links. The Compare cards keep the legacy rows until P1 retires them.
- **Why:** plan "About": details stay reachable without crowding the overview.

### Ag: tool cards, an Options disclosure, phone-sized charts (P1; superseded by "Ag tools: option chips")
- **Legacy / web/:** Ag Tools opened on Growing Degree Days with a three-column controls card above the
  chart; the variable select was the only way to change tools; `var` stayed in the URL once set.
- **New:** `#ag` without `var` shows one card per tool (Reference ET, Growing degree days, Feels like,
  Livestock risk, Soil profile, Soil water potential, Percent saturation, Annual comparison), each with a
  one-line description. A card opens that tool (`var=…`, the same reset as changing the variable select) with
  `pushState`, so Back returns to the cards; "All Ag tools" (and the Ag tab inside Ag) does the same and
  resets the tool's options (crop, cutoffs, dates, …), so the cards URL holds no Ag key. The controls sit in an "Options"
  disclosure above the chart, open on desktop and collapsed on phones (open there too while no station is
  chosen), whose summary line names the options (`core/ag/view/summary.ts`, e.g. "Wheat · 32–70 °F · to
  Oct 31"). Tool names are sentence case and shorter ("Feels like", "Soil profile", "Livestock risk";
  legacy "Feels Like Temperature", "Soil Profile Plot", "Livestock Risk Index"), so the chart heading reads
  "Feels like: Bozeman". On phones a chart is `min(60dvh, 420px)` tall, and on touch screens the `inside`
  dataZoom is off so a swipe over a chart scrolls the page (zoom with the dates, or the slider on wider
  screens).
- **Old links:** every Ag key is unchanged. `#ag` with an Ag key but no `var` (e.g. `?crop=corn#ag`, which
  web/ wrote when only the crop changed) gets `var=gdd`, its old default, at boot (core/router.ts
  `legacyRedirect`); only a bare `#ag` opens the cards. `var=gdd` is now written like any other tool.
- **Why:** plan "Ag": tools first, controls out of the way on phones, no scroll trap.

### Now overview data
- **New (no legacy equivalent):** the hero's high/low (since the redesign, the last 24 h: "Now: the hero's high and low") is set
  against the gridMET 1991–2020 **median** `tmmx`/`tmmn` for the date; year-to-date
  precipitation is compared with the sum of the daily **mean** `pr` normals from Jan 1 (a sum of medians
  would not be a normal total). Stations without `/derived/ppt/` (AgriMet) show since-midnight and 24 h
  from the hourly request. The sparkline request adds `bp` (pressure), and `snow_depth` / `vpd_atmo` when
  the station reports them, to the plan's six elements so every tile has a sparkline. Data older than 2 h
  shows a stale warning; the provisional ⓘ note follows `/latest`'s `provisional` flag.

### Download: a stepper on phones, step cards elsewhere (P1; superseded by "Download: one short form")
- **Legacy / web/:** one form column (station, variables, QC, aggregation, dates, Run / Download CSV) with
  the map under it, beside the preview; ≤ 900 px it all stacked, so on a phone the result landed
  off-screen after Run.
- **New:** three cards, **1 Elements** (station, variables, uncommon switch, map) · **2 Dates & period**
  (aggregation, dates, then QC) · **3 Run** (a one-line recap, Run, Download CSV), with the preview below.
  Desktop and tablet show Elements beside Dates & period over Run, the preview full width. Phones leave out
  the station map (user decision 2026-10-02: the navbar's station picker has one) and show one
  step at a time with "Step 2 of 3", Back and Next; Next refuses to leave a step that would block Run and
  says why, and Enter in a field means Next until the Run step. Each step change moves focus to the step
  heading and is announced. After Run (any width) the preview scrolls into view and its heading takes
  focus; the row-count announcement is unchanged. Variable rows are 44 px on phones and touch screens, and
  on phones the list no longer scrolls inside its panel.
- **Unchanged:** the request, the `dl_*` / `els` / `period` / `qc` / `pub` keys and the CSV (fidelity:
  byte-identical); the step is view state, not in the URL.
- **Why:** the plan's "Download" item; Run's result was a dead end on phones.
## UX refactor: Charts (P1, 2026-10)

Data requests are unchanged
(v2 API, QC level 2, no `premade`, inclusive end dates sent as an exclusive `end_time`).

### Charts is a variable list with a page per variable; the stacked plot is "Compare"
- **Legacy / web/:** one Latest Data plot with variable chips; no per-variable view, no history view.
- **New:** `#charts` lists the station's variables by group (Weather, Precipitation & ET, Soil, Well, Other)
  with a current value and a 48 h sparkline. A variable page (`v=<element family>`, e.g. `air_temp`) has
  range presets 24 h · 7 d · 14 d · 30 d · 1 y · Custom (stored in `from`/`to`/`agg`), a min / max / mean
  (or total) row, gridMET normals on daily views, prev/next chips, and History (years overlaid, daily, one
  request per year, at most 10 years) and Table (the chart's rows, paged) views (`view=`). Every drill-down
  is a history entry, so Back returns through them. The Charts tab inside Charts returns to the list;
  leaving Charts drops `v`, so the next visit opens the list.
- **Why:** plan "Variable page" / "Charts list": a reading leads to its history, not to a form.

### Compare loses the Latest sidebar's station picker, network filter, collapse and the card column
- **web/ (P0):** the Latest grid: sidebar (station combobox, network chips, dates, aggregation, normals,
  variables; collapsible at ≥ 1200 px, `mco-dashboard-sidebar`, LDC-002), plot, and two card switchers
  (photo / forecast / wind rose; map / metadata / current conditions; `card`/`info`).
- **New:** Compare (`cmp=1`; `#latest` and hash-less Latest links still land here with
  `from/to/agg/vars/gridmet`) keeps the dates, period of record, aggregation, normals and variable chips in
  an "Options" disclosure (open beside the plot on desktop, closed above it on phones). The station comes
  from the station picker; the photo, forecast and wind rose are on Now, the map, metadata and current
  readings on About. `card`/`info` are no longer read (dropped from the schema; kept as unknown keys so old links round-trip). The
  `mco-dashboard-sidebar` key is no longer written.
- **Why:** one station picker for the whole view; the cards moved to the sections that own them.

### Now's wind rose has its own window
- **Legacy / web/:** the Latest wind rose followed the plot's dates and aggregation (`from`/`to`/`agg`).
- **New:** Now's wind rose always shows the 14 days to today, hourly (legacy's default Latest window),
  whatever range the variable page or Compare last wrote (`core/cards/windRose.ts`).
- **Why:** Now is an overview; its rose should not change because a Charts preset was picked.

### Now tiles open the variable page
- **P0:** a tile opened Compare with its variables.
- **New:** a tile opens its first variable's page (wind → Wind Speed, soil → Soil VWC) with the usual
  section slide. A shared-element morph (the tile or list row growing into the page heading) was tried and
  removed: it added little over the slide and stretched the text in WebKit.

### Charts on touch screens
- **web/ and P0:** the inside dataZoom took drags and pinches, so a swipe over a chart panned it instead of
  scrolling the page; tooltips followed the finger and covered up to ~45 % of a phone screen.
- **New:** on touch devices (`(hover: none) and (pointer: coarse)`) every chart ignores swipes and pinches
  (the page scrolls; presets, dates and the tablet slider zoom), tooltips open on a tap and close on a tap
  outside the chart, and on phones they sit under the chart (Compare: under the tapped panel) at full width.
  The variable chart is `min(60dvh, 420px)` tall on phones; Compare stacks ~3 panels per screen and scrolls.
  A single-variable tooltip drops the repeated variable sub-header.

## House style

### Data colors
Every legacy data color is replaced by a role in `core/palette/roles.ts` (house palette, HOUSE-STYLE §6). "web/" is the React port; "legacy" is the Dash app. Every role is per theme; the light-theme value is listed unless noted. Every line, marker and bar clears 3:1 on `--bg-surface`. This table supersedes the older color notes further down (Viridis soil depths, sand/indigo GDD, Viridis heatmaps and annual years); CHECKLIST statuses that say "palette <ID>" cite its rows.

| ID | Legacy (and web/) | New role → color |
|---|---|---|
| LDP-007 | `COLOR_MAPPER`: Air Temp / Well Temp `#c42217`, Solar `#c15366`, RH `#a16a5c`, Snow Depth / Pressure `#A020F0`, Wind Speed `#ec6607`, Gust `#FEC20C`, Well Level `#0000FF`, Well EC `#AEF359`, Max Precip Rate `#000080`, VPD `#32612D`, Wind Dir `#607D3B` | `variableStyle()` by family. Temperature `#CC6677`; moisture (RH, VPD, well level, well EC) `#3388BB`; radiation `#998833`; wind (speed, gust, direction) `#117733`, gust dashed; pressure/snow `#AA4499`; precip rate `#332288`. Light = Tol muted, dark = Tol bright, HC = Tol high-contrast, darkened or lightened where needed for 3:1 |
| LDP-009 | Precip bars Plotly default `#636efa` | `PRECIP`: Blues bars `#2171b5` + cumulative `#08306b` |
| LDP-010 | ETr bars `#FF0000` | `ETR`: YlOrRd bars `#e31a1c` + cumulative `#800026` |
| LDP-011 | Depth colors: Plotly qualitative (legacy); Viridis sample (web/) | `depthColor(in, theme)`: batlow at fixed depth positions (2, 4, 8, 20, 40 in evenly spaced; 28 and 36 between 20 and 40). Light uses 0–0.55, dark 0.42–1, HC 0.35–1 |
| LDP-013 | Depth legend chips filled with the depth color, white text | A key row above the panel: a `depthColor()` line swatch plus "2 in" in kit text (white on the light depth colors failed 4.5:1) |
| LDP-018 | Normals band `rgba(107,107,107,0.4)` between dashed black q25/q75 lines | `NORMALS`: band `--text-dim` at 18% + dashed `--text-dim` median line |
| LDP-019 | Precip/ETr normals markers black | `NORMALS.line` (`--text-dim`); marker shapes unchanged |
| SC-008 | Sensor-event rect `rgba(200,200,200,1)` at 0.75 opacity | `SENSOR_EVENT`: `--text-dim` at 25% + hatch + label "Sensor change" |
| LDT-005 | Wind rose `Plasma_r` | `binColors(n, theme)`: batlow, slow → fast |
| LDT-006 | Wind rose title black | Kit `--text-primary` (chrome, not a palette role) |
| LDB-005 | Table odd rows `rgb(220,220,220)`, black on white | Kit table tokens (chrome, not a palette role) |
| AG-FL-001 | Feels-like markers blue / red / green over a black line | `FEELS_LIKE`: wind chill `#2166ac` diamond, heat index `#b2182b` triangle, only where the index differs from the air temperature; feels-like line `INDEX_LINE` (`--text-dim`), air temperature dashed in the same token. Dark/HC step along RdBu toward the light end |
| AG-CCI-003 | Extreme Danger `#843094`, Extreme `#CC0606`, Severe `#FF4400`, Moderate `#FFAD00`, Mild `#FFFF00`, No Stress `#A5A5A5`; black line (legacy). YlOrRd + `#BBBBBB` (web/) | `cciStyle()`: No Stress grey ●; cold stress 5 samples of RdBu's blue half ◆, heat stress 5 of its red half ▲, using the part that clears 3:1 on each surface (light 0.6–1); line `INDEX_LINE` |
| AG-GDD-005 | Orange bars + orange line, markers in a 24-color stage palette (legacy); Tol sand/indigo + Tol stage colors (web/) | `GDD`: YlOrRd bars `#fc4e2a` + cumulative `#bd0026`; projection band = cumulative at 15%; with a stage table, bars and stage lines take `gddStageColors` (batlow) by the stage reached, the running total and projection `CUMULATIVE_LINE` (`--text-primary`); stage labels stay `--text-muted` |
| AG-SOIL-004 | soil_temp `RdBu_r` mid 32; swp `BrBG_r`; others `BrBG` (legacy). Viridis / custom diverging (web/) | `HEATMAP`: soil_temp RdBu reversed, midpoint 32 °F; VWC YlGnBu; EC batlow; SWP BrBG reversed (wet teal → dry brown); percent saturation Blues. Frozen cells `FROZEN` grey (`#d9d9d9` light) + hatch |
| AG-SWP-001 | Depth colors as LDP-011 | `depthColor()` (cm ÷ 2.54) |
| AG-SWP-002 | FC/WP bands `rgba(128,128,128,0.2)` (legacy), `rgba(150,150,150,0.18)` + `#444` dashed lines (web/) | `SWP_BANDS`: `--text-dim` at 12% + dashed `--text-dim` lines, labelled "Field Capacity" / "Wilting Point" |
| AG-SWP-003 | Annotation boxes: black border 2, white 0.8 background | Boxed labels from kit tokens: `--text-primary` 2 px border and text, `--bg-surface` at 0.8 fill, 14 px (`core/charts/overlays.ts#hBandSeries`); not a palette role |
| AG-PS-001 | Depth colors as LDP-011 | `depthColor()` |
| AG-ANN-003 | Past years YlGnBu 0.15–0.75 (legacy), Viridis (web/); current year black, width 3 | `yearColors(n, theme)`: batlow old → new; current year `ANNUAL_CURRENT` = `--text-primary`, width 3 |
| DL-017 | Preview lines black | `previewColor(i, theme)`: Tol bright cycle (light keeps blue, green, red, purple) |
| DL-018 | AgriMet `#00cc96`, HydroMet `#7A7AFB`, co-located `#FB7A7A`, selected `#FFD700` | `NETWORK_COLOR`: HydroMet `#4477AA` circle, AgriMet `#CC6622` (light; `#EE7733` dark/HC) hollow circle, Cooperator `#009988` ring; selected `SELECTION_RING` = `--selection-ring`. A co-located site is one marker, inner dot the first network and outer ring the second ("Maps") |
| (Latest map, `web/src/lib/networks.ts`) | HydroMet `#7A7AFB`, AgriMet `#00cc96`, Cooperator `#FB7A7A`, selected `#FFD700` | Same as DL-018 |

### Fonts, chrome and themes
- **web/:** system font stack, stock Mantine blue, light theme only.
- **New:** kit tokens and fonts (Outfit for UI, Space Mono for numbers and ids), the kit navbar, and three themes (dark, light, high contrast). The theme follows `?theme=`, then the org-wide `mco-theme` choice, then the OS setting.
- **Why:** HOUSE-STYLE §1–§2; the user chose the full house style.

### Page title
- **web/:** "Montana Mesonet Dashboard".
- **New:** `Dashboard · MT Mesonet` in the tab and `Dashboard · Montana Mesonet` on link cards; the navbar reads "Mesonet Dashboard / A service of the Montana Climate Office."
- **Station in the tab title (GS-007).** Legacy's banner read "The Montana Mesonet Dashboard: {station name}" on Latest Data. web-next puts the station first in the document title instead ("Bozeman · Dashboard · MT Mesonet", `core/pageTitle.ts`) on every tab, since `?s=` is shared by all tabs. The navbar brand stays the app name (kit navbar), and the Ag card heading already names the station. Link-card titles stay static.
- **Why:** HOUSE-STYLE §1 Naming. The distinctive part comes first so it survives tab-bar truncation; the station is a prefix on the §1 title, which itself is unchanged.

### Viewport zoom (GS-002)
- **Legacy:** `maximum-scale=1.2, minimum-scale=0.5`.
- **New:** `width=device-width, initial-scale=1.0, viewport-fit=cover` with no scale limits.
- **Why:** WCAG 1.4.4: pinch zoom must not be capped. `viewport-fit=cover` is the kit's safe-area requirement.

### Navbar on narrow screens (MOB-003)
- **Legacy:** at ≤ 600 px the header's toggle and download buttons were hidden.
- **New:** the kit's ≤ 750 px rule visually hides the brand text (screen readers still read it) and drops the divider. Every tab link and button stays, and the buttons shrink to icons with permanent `aria-label`s. The bar wraps to two rows at 390 px (MIGRATION-MATRIX decision 4).
- **Why:** kit default; no feature is lost on phones.

## vs web/

### Tabs are links
- **web/:** Mantine tabs (`role=tab`) driven by the hash.
- **New:** `<a href="#ag">` links styled as kit buttons, with `aria-current="page"` on the active one. Routing works before JS runs, and back/forward move between tabs. Tab switches are announced in the live region.
- **Why:** the hash is navigation, so links are the native control; it keeps the shell to one tiny component.

### URL writing
- **Same as web/:** key names, defaults, legacy-key migration, `/<station>` path links, commas kept literal and spaces as `+`.
- **Changed (UX refactor P1):** Ag `var` has no default: absent means the Ag tool cards, and any tool (GDD included) is written. web/ kept `var` at its default once set (nuqs `clearOnDefault: false`); see "Ag: tool cards" above.
- **New:** every write is one batched `replaceState` per tick that keeps the hash. A value outside a key's allowed set (for example `agg=weekly`) is dropped from the URL on the first write instead of lingering.
- **Why:** one URL owner (`stores/url.ts`), HOUSE-STYLE §4.

### Theme in the URL
- **New:** when the URL carries `?theme=`, the toggle updates it, so a reload or a shared link shows the theme on screen.
- **Why:** the anti-flash script gives `?theme=` precedence over the saved choice; a stale value would undo the toggle on reload.

### Fetch cache
- **Same as web/:** in-flight requests are shared; network errors and 5xx retry twice, 4xx never (TanStack `retry` in `web/src/lib/queryClient.ts`).
- **New:** a failed request is retried only after its TTL (or on `refresh()`, for example a Retry button); TanStack refetched on remount. A failed refetch keeps the last data on screen.
- **Why:** Alpine re-evaluates templates freely; an automatic refetch on every read could loop on a failing request.

### Auto-refresh
- **Legacy Dash (`app/`):** no auto-refresh; data changed only on a callback (its one `dcc.Interval` saves the share link).
- **web/:** `/latest` and the photo listings refetched every 5 min while the tab was visible (TanStack `refetchInterval`); everything else refetched only when remounted past its 5 min `staleTime`, and `refetchOnWindowFocus` was off.
- **New:** one freshness tick (ARCHITECTURE "Data freshness"): every 5 min while visible, on return to the tab and on a bfcache restore, `/latest`, Now's recent requests (72 h hourly, 7-day rain, ppt summary, NWS forecasts, SWP), the Charts list's 48 h rows and chart windows reaching today refetch once past their TTL, keeping the old data on screen; dates roll over at Denver midnight. Photos, normals and history are not refreshed by it.
- **Why:** a tab left open overnight, or restored by a phone browser, kept showing the evening's last reading the next morning.

### Outage notice color
- **web/:** mapped `outage.json`'s Bootstrap color to a Mantine color.
- **New:** maps it to a tone (`warning`, `danger`, `info`, `success`, `neutral`; unknown → `warning`) that the notice styles with kit tokens (`core/outage.ts#outageTone`).
- **Why:** no Mantine.

### Chart time axes
- **New:** chart x values are Denver wall-clock milliseconds rendered with `useUTC: true`, so labels and hovers read in Mountain Time for every viewer, as the Plotly charts did by ignoring offsets.
- **Why:** HOUSE-STYLE settled precedent (Mountain Time stamps), no time-zone library.

### Chart style: one way to draw every chart
- **web/ (and web-next before this):** each chart drew its own way. Gaps were found from the data's median step
  (`insertGaps` on the rows, then again in the chart), so a mostly-gappy hourly series could be drawn as if
  connected, and the Download preview had two nulls per gap. The Download preview drew precipitation as a line
  (legacy `make_single_plot`) and its monthly panels with markers; the other charts drew it as bars. Line widths
  were 1.4, 1.5 or 2 px by chart. The y axis was each library's auto-scale (relative humidity and wind direction
  rescaled with the data; a precipitation preview panel was not zero-based; temperature over 35–81 °F was drawn
  20–100). web-next's slider showed at every range (24 h included), and drew its background from whichever series
  came first: precipitation bars on Compare (a near-flat strip), ETr and GDD daily bars, a flat line from the SWP
  bands' helper, nothing for the soil profile; its track was the data's extent while the axis was the window's,
  and the part inside the window was ECharts' default blue. A range or interval change replayed the entrance
  animation.
- **New:** DESIGN.md "Chart style" (`core/charts/style.ts`): one line width; gaps are breaks from the known
  interval (one null midway across a step over 1.5 intervals, inserted by the chart only); precipitation and ETr
  are bars at every interval, in the preview too, and no chart draws symbols on its lines; the y axis follows the
  variable's family (zero-based, fixed 0–100 % / 0–360°, or free ± 2 %, stopping at 0 for never-negative variables) rounded to nice steps (4–7 intervals, least padding); the slider shows on
  wide screens for windows over 2 days with ≥ 30 points, sits in one place, starts at the whole extent, spans
  exactly the plotted extent and traces one sensible series in token colors; charts animate their first draw only.
- **Same:** every value drawn, in every table and download, and every Ag number. Fidelity: one-sided nulls are not
  differences (`scripts/fidelity` already ignored a gap point present on one side only), so the gap nulls change
  point counts but no comparison.
- **Why:** the user saw different ranges and intervals draw differently; one rule per thing makes them the same.

### "Today" is the Denver date
- **web/:** default windows and "today" came from `dayjs()`, the browser's own zone (the Ag tab, Latest window, Download dates); the Now page of P1 already used Mountain Time.
- **New:** one helper, `core/today.ts` (`denverToday`, `denverDay`), gives the America/Denver date for every default window, preset, date bound, the Download defaults, the GDD default start, Now's high/low, rain today and normals day, and the photo day. A viewer in another zone, or a test browser in UTC, sees Montana's day; in Mountain Time nothing changes (the fidelity harness runs in America/Denver, so its dates match).
- **Why:** one day boundary everywhere; a browser in UTC turned the day over at 6 PM MDT.

### Help dialog
- See "Global UI › Help dialog content".
## Carried over from web/: shell, Latest Data and shared data

> From `web/DIVERGENCES.md`. These describe behaviour versus the legacy Dash app and still apply. Renderer details written for Plotly (`connectgaps`, `matches: 'x'`, x-unified hover, `hoveron`) state the behaviour to keep; W2 re-verifies each against ECharts.


### Data

#### QC level 2 by default (LDC-016, DL-010)
- **Legacy:** every request sent `level=1` (provisional data).
- **New:** observations, derived, latest and downloader requests default to `level=2` (quality-controlled). The Downloader keeps a QC selector (`qc=0|1|2`).
- **Why:** level 1 passes through flatlined sensors and false precipitation spikes (mesonet-db-rds#189). Level 2 is what the Mesonet publishes as its quality-controlled product.

#### Precipitation is the API's merged `ppt`; `ppt_corrected` is ignored
- **Legacy:** built its element list by substring match against `{API}elements`. On mesonet2 this would also pull in `ppt_corrected`, and `plot_ppt` would then plot that column.
- **New:** Latest Data plots the default merged `ppt` element only. The mesonet2-only element `ppt_corrected` ("Precipitation (fill-corrected)") is never offered as a variable chip, never requested, and never mapped to a panel (`LATEST_EXCLUDED_ELEMENTS`, `latestVariableForColumn`).
- **Why:** at QC level 2 the merged `ppt` is already wind-corrected. `ppt_corrected` is NULL inside high-wind events and puts the event total at the end, so plotting it next to `ppt` would duplicate and confuse the series.

#### Request shape (LDC-016, LDC-017)
- **No `premade`:** with it, `/derived/*` returns 500 (an upstream duplicate-label bug).
- **`rm_na=false` on the Latest plot:** missing observations stay as nulls, so lines break at gaps (`connectgaps: false`) instead of being drawn straight across them.
- **Inclusive end dates:** the API's `end_time` is an exclusive cutoff, so we send `end + 1 day`. Legacy sent the current local time when the end date was today.

#### Variables offered at a station (LDC-013)
- **Same as legacy:** chips come from `/elements/{station}/`: `description_short` before "@", deduplicated, plus Reference ET, sorted.
- **New:**
  - A variable missing from `ELEM_MAP` is requested by the station's own element codes and plotted with its name as the axis title. A new API element therefore degrades gracefully instead of crashing.
  - A variable the station doesn't offer is ignored instead of erroring.

### Latest Data UI

#### Native NWS forecast cards (LDT-009; since the redesign, the Now strip and its "Full forecast" link)
- **Legacy:** embedded `forecast.weather.gov/MapClick.php` in an iframe.
- **New:** renders the NWS API forecast periods as cards, with a link to the full MapClick page.
- **Why:** the iframe is not mobile friendly, can't be themed, and shows NWS chrome inside our card.

#### MapLibre locator map (ST-004, ST-005, DL-018)
- **Legacy:** an `{API}map/stations` iframe (Latest) and a Scattermapbox figure (Downloader).
- **New:** an in-app MapLibre map on the Carto positron basemap. Clicking a marker selects the station. Legacy's click callback was dead, so its iframe map never selected anything.
- **Why:** one map component for both tabs, no external iframe, and working selection. The USGS relief tiles, county lines and the co-located colour are not ported.

#### Photos come from the data2 archive, not the API (LDT-010, LDT-011, LDT-012, LDT-013, LDT-014)
- **Legacy:** directions guessed from the camera model on `/deployments/{station}` (EC-ScoutIP gave N/S/E/W/Snow, other models N/S/North Sky/South Sky, no camera N/S/Ground). The time list was every 09:00/15:00 "Morning/Afternoon" slot back to the camera start date, and each image came from `{API}photos/{station}/{dir}?dt=…`.
- **New:** everything comes from the Mesonet photo archive at `https://data2.climate.umt.edu/mesonet/photos/` (CORS-open CDN). The app makes no `/photos` API requests.
  - **Cameras and directions:** from the camera registry `photos/schedule/schedule.json`. A station has a camera when it has a current schedule period (`until: null`) with views. The direction chips show the views that have frames on the chosen day. On a day with no frames they show the views the schedule had that day, so a past date can show views the camera has since dropped (for example acecrowa's North Sky and South Sky before 2026-09-07). Labels use legacy's words (North, South, East, West, North Sky, South Sky, Ground, Snow).
  - **Times:** a date picker (from the camera's `first_month` to today) and a Select of the frames that actually exist that day, newest first, labelled in Mountain Time (for example "Oct 1, 2026 3:00 PM"). The default is the newest frame. Schedules change over time (acebozem went from 09:00/15:00 to 09:00/12:00/15:00 on 2026-09-20), and the list follows whatever was really captured.
  - **Where frames come from:** today and yesterday (Mountain Time) use live S3 listings of `photos/webp/large/{station}/{station}_{TOKEN}_{YYYYMMDD}`, one UTC day per direction for UTC today and yesterday, refreshed every 5 minutes. Older days use the station's monthly manifest `photos/manifest/{station}/{station}_{YYYY-MM}.csv`. Some manifest rows leave `webp_large` blank. For those, the WebP path is worked out from `slot_utc` (or the capture time snapped to the hour) and checked against a listing before it is shown, because most of those WebPs don't exist.
  - **Image:** the display image is the `webp_large` WebP for the chosen slot.
- **No camera in the schedule:** the "Latest Photo" choice is disabled. If a shared link asks for the photo card anyway, it shows "No camera images are available for this station." Legacy showed three blind chips and a single "today" option. If `schedule.json` can't load, the card says "Camera schedule unavailable." There is no API fallback.
- **Why:** the archive is the source of truth. It is fast (the schedule file is about 5 KB), while the API `/photos/` catalog took 22–80 s and lagged reality: nine cameras that were live in September 2026 were missing from it. The old 09:00/15:00 assumption also missed the new midday slot.

#### Photo tab enabled when the station has a camera (LDT-002, LDT-003)
- **Legacy:** "Latest Photo" was enabled only for HydroMet stations, and it was the default top card for them.
- **New:** "Latest Photo" is enabled when the data2 camera schedule lists the station with a current period. It is the default top card for those stations, as legacy made it the default for camera stations. Every scheduled camera is at a HydroMet station today. While the schedule loads, the auto default is Wind Rose. An explicit `card=photo` waits for the schedule.

#### Photo modal (LDT-015)
- **Same as legacy:** clicking the photo opens a centered 92vw modal (kit dialog, at most 1600 px wide) with the image up to 86vh tall.
- **New:** the modal has a "Download original" button. It downloads the same large WebP the card shows (`photos/webp/large/…_{slot_utc}.webp`) and saves it under that file's own name, for example `acebozem_N_20261001T150000Z.webp`. If the fetch fails, the image opens in a new tab.
- **New (UX refactor, P3):** the direction, day and time pickers live in this dialog (DESIGN.md "Now"). The Now tile always shows the newest frame of the default direction (N); the dialog opens on that frame and drops its picks on close, so the tile is never an older frame under a "latest" caption. The image is up to 70dvh tall below the pickers.

#### Card defaults are "auto" (LDT-003, LDB-001, LDB-002)
- **Same as legacy:** with no `card`/`info` in the URL, the top card is Latest Photo for stations with a camera and Wind Rose otherwise. The bottom card is Current Conditions with a station and Locator Map without one. Choosing a station from the dropdown or the map resets both cards to auto.
- **New:** an explicit `card=`/`info=` in a shared link is honoured.

#### Current Conditions failure falls back to metadata (LDB-010)
- **Legacy:** switched to the metadata tab when the station *record* request failed.
- **New:** switches when the `/latest` request fails, and only while the bottom card is on auto. If the user explicitly picked Current Conditions, it shows "No data available for selected dates." instead.

#### Current Conditions rows (LDB-006, LDB-007, LDB-008)
- **Same as legacy:**
  - The row set and order: Timestamp, then the legacy `elem_labs` columns in API order, then Feels like (was Real Feel; "Feels like uses the NWS method").
  - Raw values, and wind direction as "N (357.3 deg)".
- **New:**
  - Snow Depth is shown. Legacy listed it as `Snow Depth [in.]` while the API sends `[in]`, so legacy silently dropped it (legacy bug not ported).
  - The timestamp is formatted ("Oct 1, 2026 2:30 PM").
  - Precipitation Summary values are rounded to 2 decimals and carry an " in" suffix ("0.10 in"; LDB-009).
  - Real Feel (the wind-chill formula at every temperature, a legacy bug) is replaced by the NWS feels-like (LDB-007; "Feels like uses the NWS method").

#### Wind rose (LDT-005, LDT-006, LDT-007)
- **Same as legacy:** the rose follows the plotted date range and aggregation, and is titled "Wind Data from {start} to {end}" (Courier New).
- **New:**
  - The title wraps onto two lines at 14 px, because the card is narrower than legacy's.
  - The rose uses its own `wind_spd,wind_dir` request (with `rm_na=true`) instead of riding on the main record.
  - The speed bins are identical to legacy's (numpy half-even rounding, `pd.qcut(q=8)` linear-quantile edges). The legend shows the whole-mph speeds in each bin ("4 – 6") instead of pandas interval text ("(3.75, 6.0]").

#### Plot layout (LDP-001, LDP-002, LDP-021, MOB-002)
- **Legacy:** fixed 500 px (one panel) or 250 px per panel, in an 88vh scroll column. The x axes were independent but forced to the same range.
- **New:** see "Latest Data › Layout" (panel heights, no inner scroll box, sidebar collapse) and "Latest Data › One time axis, zoom and the URL" (one shared zoom, URL window). Those sections replace web/'s Plotly notes (200 px panels, `matches: 'x'`).

#### Soil depth colours (LDP-011)
- **Legacy:** the Plotly default colours per depth (2 in `#636efa`, 4 in `#EF553B`, …).
- **New:** batlow depth colours (`core/palette` `depthColor`, "House style › Data colors"; web/ used Viridis). The hover covers every panel, not just soil ("Latest Data › Hover").

#### "Not available" panels (LDP-014, LDP-015)
- **Same as legacy:** a selected variable with no data in the window keeps an empty panel with "**{Variable} data are not available for this time period.**" (`add_nodata_lab`).
- **New:**
  - The text is 13 px (12 px on phones), not 18 px, so it fits a narrow panel.
  - Legacy's early return (no notes or soil legends at all once any soil panel was empty, LDP-015) is not ported.

#### Empty and error states (ES-001 to ES-005)
- **Same as legacy:** the titles ("Select Station", "No variables selected", "No data available for selected station and dates / Either change the date range or select a new station.").
- **New:**
  - The no-station hint reads "To get started, select a station from the dropdown or the map." Legacy said "the dropdown above or the map to the right", but here the picker is in the sidebar and the map moves under the plot on narrow screens (ES-001).
  - An unknown `?s=` or `/<station>` path shows "Station not found." once the catalog has loaded, instead of silently showing no station (URL-003), so a mistyped link explains itself.
  - They render as centred text, not as a 500 px blank Plotly figure (ES-004).
  - Raw HTTP errors are logged to the console, never shown.
  - Malformed `?from`/`?to` show the no-data message without sending a request.

#### Variable selection (ES-002, LDC-014)
- **Same as legacy:** deselecting every chip shows "No variables selected" instead of re-applying the defaults.
- **New:** in the URL, an absent `vars` means the five defaults and `vars=` (empty) means none.

#### Period of record (LDC-005)
- **Same as legacy:** "Display Period of Record" switches to Daily from the install date to today, and the label becomes "Display Latest 2 Weeks", which restores Hourly for the last 14 days.
- **New:** the label is derived from the URL (Daily + install date + today), so a shared POR link shows the right label. The button is disabled with no station (legacy bug LDC-006 not ported).

### Sensor-change overlays (SC-001 to SC-010)
- **Same as legacy:** a port of legacy `_build_sensor_events` / `_filter_outage_events_to_metric_na` / `_add_sensor_event_overlays`, including 5afb746f (an outage ends at sensor replacement).
- **New:**
  - The config comes from `/config/{station}/`, which has no `public` parameter in v2.
  - The element→column map adds the 28 in (−70 cm) soil depth, which legacy lacked.
  - Times are computed as America/Denver wall-clock milliseconds, with no timezone library.
  - Drawing and hover are under "Latest Data › Sensor-change overlays (SC-008)": a hatched span, with the hover text in the axis tooltip (no hover polygon).

### Shell, routing and links

#### Base path (GS-003)
- **Legacy:** served at `/dash/` when `ON_SERVER` was set.
- **New:** the base comes from `VITE_BASE` (default `/mesonet-dashboard/next/`, the GitHub Pages preview; it becomes `/mesonet-dashboard/` when web-next replaces web/). `/dash` is pointed at it at cutover. `vite.config.ts` has the details.

#### NWSLI and station ids are case-insensitive (URL-002)
- **Legacy:** matched `/dash/<segment>` exactly against station id, then NWSLI id.
- **New:** `?s=` and `/<segment>` resolve case-insensitively (`?s=KEEM8`, `?s=keem8` and `?s=ACEABSAR` all work). The URL is then rewritten to the canonical id (`core/stations.ts#resolveStationId`).

#### `?state=` legacy share links (URL-006 to URL-010)
- **Legacy:** share links pointed at layouts saved on the old server (`./share/{hash}.json`).
- **New:** this client can't read those files. The `?state=` param is dropped (other params are kept), and a notice links to the same layout on the legacy dashboard. "Share" copies the live URL, which holds the full state in query params, instead of creating a server-side hash.

#### Outage notice freshness (OUT-001, OUT-006)
- **Legacy:** fetched `outage.json` server-side, cached for 60 s, and rendered the modal open on first paint.
- **New:** fetches the same file client-side on page load (5 s timeout, 60 s staleTime, failure means inactive), so the modal opens when the fetch resolves. raw.githubusercontent.com's own CDN cache (about 5 min) still applies to both.

#### Satellite Indicators hidden (GS-008, HELP-003)
- **New:** the tab is not routed. `#satellite` falls back to Latest Data with a link to the legacy dashboard's satellite view. The help modal says satellite indicators are available on the legacy dashboard.

#### Help modal (HELP-001 to HELP-006)
- **Same as legacy:** the content (welcome text with the crowagen example link, contacts, feedback form, GitHub issues, Background, Source Code).
- **New:**
  - The API docs link points to `mesonet2.climate.umt.edu/api/v2/docs` (the legacy AWS execute-api URL is gone).
  - The satellite paragraph is replaced by a short note on the Ag Tools and Downloader tabs.
  - The feedback form is the current Airtable form (GS-006, user-confirmed).

#### Tabs keep their state (GS-009)
- **Legacy:** rebuilt each tab from scratch.
- **Same as legacy:** each tab's content is mounted only while that tab is open (`<template x-if>` in `partials/<tab>/index.html`), so a tab makes no requests until it is opened and its components start fresh on each visit.
- **New:** each tab's controls live in its own URL keys (`core/url-schema.ts`), so switching tabs and coming back restores them, and fetched data stays in `$store.data`, so a revisit draws from the cache. Two things reset on leaving a tab: a chart zoom inside the loaded window, and a Downloader result (Run again; the request is still in the URL). The Latest sidebar's collapsed state is kept in localStorage.

## Carried over from web/: Ag Tools

> From `web/src/features/ag/DIVERGENCES.md` (paths now under `core/ag/`).

The client-side compute library (`compute/`) ports the Mesonet API's derived
variables (`mesonet-db-rds/api/app/app/{etr,derived}.py`). The policy is
**"correct + documented"**: port each formula faithfully, fix the API's known
bugs, and record every intentional difference here. Golden tests in
`compute/*.test.ts` check parity against the Wave 0 fixtures
(`__fixtures__/`, level 2, US units, 3-decimal rounding) everywhere else.

To print the per-variable parity table, run `VITE_PARITY=1 npx vitest run src/core/ag --silent=false`.

API line numbers refer to `mesonet-db-rds` as of 2026-10-01.

### Parity achieved (no divergence)

Every computed value matches the fixture to its 3-decimal rounding, with a
maximum absolute difference of 0.0005 in the fixture's units:

| Variable | Tolerance (brief) | Observed max abs diff | Fixtures |
|---|---|---|---|
| ETo daily | 0.005 in/day | 0.0005 in | 3 stations × 2 windows (arskeogh winter: API 404) |
| ETo hourly | 0.001 in/h | 0.0005 in | 3 × 2 (arskeogh Jan: API 404) |
| Wind chill, heat index, feels-like (daily and hourly) | 0.1 °F | 0.0005 °F | 3 × 4 |
| CCI (daily and hourly) | 0.1 °F | 0.0005 °F | 3 × 4 (2 API 404s) |
| GDD daily and cumulative (default + 7 crops) | exact to 3 dp | 0.0005 °F·day | 3 × 2 × 8 |
| GDD stage labels | exact | exact (except D-GDD-1/2/4) | 3 × 2 × 6 crops |
| Percent saturation (2026-09-25 test porosity, acebozem/arskeogh) | — | 0.0005 % | 2 × 4 |

When the API returns 404 because `sol_rad` is missing for the whole window
(arskeogh winter, daily and hourly, for ETo and CCI), compute returns an
all-null series and does not throw.

### Divergences

#### D-ETO-1: a missing input gives null hourly ETo, not 0

- **API:** `etr.py:726` runs `eto = np.where(eto > 0, eto, 0)`. `NaN > 0` is
  false, so any missing input (e.g. wind) becomes **0 mm**.
- **Here:** `null`. A missing input is not zero evapotranspiration, and a 0
  would also bias daily and annual sums.
- **Observed:** arskeogh `hourly.jul2025` has 33 hours with no wind. The API
  reports 0.000 in for them, and we report null.
- **Test:** `compute/eto.test.ts`, "etoHourly golden parity", arskeogh jul2025
  (null count equals the missing-wind count), and "missing hourly input → null,
  not 0 (D-ETO-1)".

#### D-CCI-1: negative night-time solar radiation is clamped to 0

- **API:** `derived.py:669` takes `np.sqrt(avg_sol_rad)`. Pyranometers often
  report small negative values at night, which make the CCI NaN.
- **Here:** R is set to `max(0, R)` before the radiation correction
  (`compute/cci.ts` `cciRadCorrection`).
- **Observed:** none of the fixtures have negative solar values (night hours
  read 0.0), so golden parity is unaffected.
- **Test:** `compute/cci.test.ts`, "negative night-time solar is clamped to 0,
  not NaN (D-CCI-1)".

#### D-SWP-1: each station's VWC is clipped to its own lab range

- **API:** `derived.py:255` selects `clip_range = vwc_range[vwc_range["depth"] == depth]`
  with no station filter. `derived.py:262-263` then uses `.values[0]`, so a
  multi-station request clips every station with the **first** station's lab
  range for that depth.
- **Here:** `swp()` uses only the `SoilParams` rows whose `station` matches
  the series, including `labVwcMin`/`labVwcMax`.
- **Observed:** none. Each fixture is a single-station request.
- **Test:** `compute/soil.test.ts`, "clips each station to its own lab range
  (D-SWP-1)".

#### D-SWP-2: the soil parameters come from mesonet-soils, not the API DB (data divergence)

mesonet2's `/derived` has no `swp` or `percent_saturation` (HTTP 422; #75),
and its `/stations` has no `has_swp`. SWP is therefore computed in the
browser from mesonet-soils' published parameters,
`data2 …/mesonet/soils/soil_params.json` (vendored fallback
`public/data/soil_params.json`, `vendor-static.mjs`). A station has SWP when
the bundle has at least one FX row for it (`core/stations` `withSwpFlags`).

The SWP formula is a verbatim port: `derived.py:1099-1123`, with clipping at
`188-299`. The parameters differ from the legacy API's private database
(older fits). The golden-parity tests use the mesonet-soils release
`2026-09-25` (copied to `__fixtures__/soil_params.test.csv`) against frozen
legacy `/derived` fixtures (captured 2026-09). They pin the arithmetic:

- The **clip ranges and clipped flags match the API exactly** on every row:
  `flagMismatch = 0` for all 8 cores × 4 windows.
- `fxInverse` exactly inverts the FX forward model.
- The parameters reproduce the lab retention data
  (`<station>.soil-raw.csv`) with θ RMSE < 0.01 (test "vendored params
  reproduce the lab retention data").

The value gap comes from the parameters, not the code. The cores below are
listed in `EXPECTED_SWP_DIVERGENCES` in `compute/soil.test.ts` and asserted
to still differ, so a fixture refresh that changes them fails loudly.

| Station @ depth | Max abs diff (bar) | Median relative diff (per window) | Notes |
|---|---|---|---|
| acebozem @ 5 cm | 3765.9 | 0.24 – 9.6 | Dry-end clip (θ = 7.75 %): API 391.0 bar, mesonet-soils 4156.9 bar. The lab point there is about 309 bar. |
| acebozem @ 10 cm | 5.2 | 0.04 – 0.20 | |
| acebozem @ 20 cm | 2.2 | 0.01 – 0.13 | |
| acebozem @ 50 cm | 0.96 | 0.05 – 0.16 | |
| acebozem @ 100 cm | 11065.8 | 0.18 – 14.2 | Dry-end clip (θ = 5.65 %), mesonet-soils about 14× the API. The lab point there is about 417 bar. |
| arskeogh @ 10 cm | 0.31 | 0.03 – 0.06 | |
| arskeogh @ 20 cm | 1.57 | 0.03 – 0.23 | |
| arskeogh @ 50 cm | 0.83 | 0.03 – 0.12 | |

With the shipped `2026-10-04T17:21:00Z` bundle, mid-range values sit close to
what the legacy API showed (acebozem 2026-09-01: 107 vs 98 bar at 10 cm, 61
vs 58 at 20 cm, 4.0 vs 4.9 at 50 cm; `data/static.test.ts`).

**Dry end.** When VWC is below a core's driest lab sample, `swp()` clips it
to the lab range, and the FX tail there gives very large suctions (acebozem
2026-09-01: about 3,900 bar at 5 cm, 12,800 at 100 cm; the legacy API showed
391 and 778). mesonet-soils does not cap these; the dashboard decides how to
show them (`ag/view/labels` `swpBar`):

- Ag SWP chart: those points are **lower bounds**, drawn on a dashed, faded
  line in the depth's color, capped at `SWP_CAP_BAR` (1,000 bar). The tooltip
  and table read "≤ -1000.00 bar (drier than the lab range)", and a note
  explains the dashes. The Soil Profile heatmap uses the same cap.
- Now soil chip: the capped value, which is past the wilting point ("Dry").
  Frozen hours are skipped, as on the Ag tab.
- Data Downloader: the uncapped value, plus a
  `Soil Water Potential @ -X cm Clipped?` column (data, not display).

#### D-PS-1: percent saturation uses mesonet-soils porosity, not the API DB (data divergence)

The formula is a verbatim port (`derived.py:302-359`,
`clip(VWC / porosity · 100, 0, 100)`), and the VWC is the same level-2
observation the API used. The porosity is mesonet-soils' `porosityPct` (the
HYPROP initial water content, Vol%). A core with no porosity (acechest at
100 cm) has no percent saturation.

Until mesonet2 dropped `/derived` percent saturation, the porosity came from
the API (`keep=true` `Porosity @ …` columns), because the API DB and
mesonet-soils disagreed at 60 of 91 has_swp stations
(`scripts/fixtures/porosity-survey.mjs`, 2026-09: API/mesonet-soils ratio
median 0.900, with some implausibly low DB values of 14–20 % that pinned
saturation at 100 %). That reference no longer exists, so mesonet-soils is
the only source. At acebozem and arskeogh, whose porosities matched, the
golden-parity test still holds to 0.0005 % (`compute/soil.test.ts`).

#### D-GDD-1: wheat and barley stage labels are recomputed after the NDAWN switch

- **API:** `derived.py:1040-1048` derives `stage`/`name` from the first-pass
  (32/70 °F) cumulative. `derived.py:1051-1059` then switches rows at Haun ≥ 2
  to 32/95 °F and recomputes `gdd` and `cumulative_gdd`, but **not** the stage
  labels. Labels after the switch are therefore stale: they belong to a smaller
  cumulative than the one reported next to them.
- **Here:** the switch logic is identical (the same rows switch, and daily and
  cumulative values match the API), and the labels come from the final
  cumulative.
- **Observed:** in season2025 the fix changes 26 labels for acebozem wheat and
  27 for acebozem barley. The golden test also confirms that every API label
  after the switch equals the first-pass label.
- **Tests:** `compute/gdd.test.ts`, "gdd golden parity" (wheat/barley branch of
  `checkStages`), and "wheat switches to 32/95 at Haun 2 and relabels on the
  final cumulative (D-GDD-1)".

#### D-GDD-2: a crop with no stage table gets null labels, not "Planted"/0

- **API:** if no stage matches, `derived.py:1041-1048` fills `stage` with 0
  and `name` with "Planted". The API's DB also has a **corn** stage table
  (labels VE, V2, V3, V6, V9, V10, VT, R2, R4, and the name "Emergence") that
  is in neither vendored source (`derived/combined_stages.tsv`,
  `write_hemp_table.sql`).
- **Here:** an empty or missing `GddStageTable` gives `stage = null` and
  `stageName = null` on every row, never a fake "stage 0". When a table
  exists, the API behaviour is kept exactly: rows before the first threshold
  are stage 0, and they are named "Planted" only if some row in the series
  reached a *named* stage. Otherwise every name is null, which matches the API
  dropping the `Stage Name` column (`derived.py:1045-1048`; this always
  happens for canola, sugarbeet and sunflower, whose tables have no names).
  `projectGdd` continues the observed series' naming.
- **Tests:** `compute/gdd.test.ts`, corn branch of `checkStages`, and "crop
  without a stage table → null labels, not stage 0 (D-GDD-2)".

#### D-GDD-3: the cumulative carries forward over missing days

- **API:** `derived.py:1029` uses `groupby().cumsum()`, which leaves NaN on a
  missing day (and `merge_asof` at line 1040 rejects null keys).
- **Here:** the contract's semantics apply: a running sum that skips nulls and
  carries the previous total forward, and stays null until the first valid day.
  Daily GDD stays null on missing days.
- **Observed:** the fixtures have no missing temperature days.
- **Test:** `compute/gdd.test.ts`, "cumulative skips nulls and carries forward
  (D-GDD-3)".

#### D-GDD-4: the API's hemp stage ids differ from `write_hemp_table.sql` (data, informational)

The API's first hemp stage is "BBCH Stage 11". `write_hemp_table.sql` (and so
the vendored table) has "BBCH Stages 0-11". Names and thresholds match.
`checkStages` compares hemp by name. Workstream B should decide which spelling
to ship.

#### D-GDD-5: explicit cutoffs override the crop's

- **API:** when `crop` is given, `derived.py:58-62` ignores `low`/`high`.
- **Here:** if `lowC`/`highC` are passed, they win, which supports the UI
  threshold slider. The series is then not a crop series (`crop = null`,
  `ndawnSwitch = null`), and any bound left out falls back to the named crop's.
  Without custom cutoffs, the crop's cutoffs from `derived.py:80-90` apply.
  `GddSeries.ndawnSwitch` records whether the wheat/barley rule was applied,
  and `projectGdd` follows that record rather than re-deriving it.
- **Test:** `compute/gdd.test.ts`, "custom cutoffs in °C override the crop
  (D-GDD-5)".

### Conventions that are not divergences

- **GDD units exception:** GDD values and stage thresholds are °F·day, as in
  the contract and the published stage tables. GDD is computed in °F
  internally because clip-then-average is not unit-invariant once the cutoffs
  bind. `GddSeries.cutoffs` is reported in °C.
- **Wind height:** ETo converts wind to 2 m with the FAO-56 log profile.
  Wind chill and CCI use the raw sensor-height wind, as the API does.
- **Solar time:** hourly ETo uses the hour on a fixed UTC−7 clock plus 0.5,
  and the day of year of the local date (`derived.py:927-934`).
- **feels_like with missing wind or RH:** falls back to air temperature, as
  the API's NaN handling does.
- **Daily `epochMs`:** the UTC instant of local (America/Denver) midnight.
- **Annual:** `groupByYear` accepts daily rows only. It throws on hourly
  timestamps or duplicate dates. `hourlyToDaily(…, 'sum')` returns null for
  any day with fewer valid hours than the local day has (23, 24 or 25 across
  DST), unless `minHours` is passed, so a partial day never looks like a low
  total. A mean needs one valid hour.

### UI divergences vs the legacy dashboard (Wave 3)

Ag Tools is now computed in the browser from raw `/observations` (QC level
2) with the library above; the figures live in `figures/`, the views in
`ui/`. Differences a user can see, compared with the legacy Dash app
(`app/mdb/app.py`, `utils/plot_derived.py`):

- **Data source and QC.** Every variable is computed client-side from
  level-2 observations (legacy: `/derived` at the
  API's default level). Live check, last 30 days (2026-09-02..10-01) vs
  `/derived/daily` (level 2, no `premade`): max |Δ| ETo 0.0005 in, GDD (corn)
  0 (≤ 1e-13), feels-like 0.0004 °F, CCI 0.0005 °F at acebozem, arskeogh and
  acecrowa (`ui/crosscheck.live.test.ts`).
- **SWP and percent saturation** are computed client-side from level-2 VWC
  and mesonet-soils parameters (`compute` `swp()` / `percentSaturation()`;
  D-SWP-2, D-PS-1). mesonet2 has neither in `/derived`. A station offers them
  when mesonet-soils has a fit for it (`has_swp` is derived from the bundle).
  Dry-end values beyond the lab range are drawn dashed and capped (D-SWP-2).
- **`var` is always in the URL.** The rebuild briefly defaulted to `etr`
  and dropped `var=etr` from links as the default; those links now open
  the legacy default (Growing Degree Days). `var` is now written even when
  it equals the default, so links name their variable explicitly.
- **Variable default and reset** match legacy: the default variable is
  Growing Degree Days, and changing the variable resets crop (wheat), custom
  GDD cutoffs, time aggregation (daily) and soil variable (VWC), as in
  `app.py` ~567-599. Explicit URL params in a deep link are kept on the
  initial load; only a user's change of variable resets them.
- **SWP annotations** match legacy: boxed "Field Capacity" (top-left) and
  "Wilting Point" (bottom-left) labels (2 px text-colour border on the
  surface at 0.8, 14 px). The grey bands also have dashed
  0.33 / 15 bar reference lines, which legacy did not draw.
- **Plot size and x range.** The chart fills its card (at least 540 px) and
  the x axis fits the data (Plotly autorange), instead of legacy's fixed
  500 px height and [first − 1 day, last + 1 day] range. A fixed pad would
  fight the GDD projection, which extends the axis past the last observation.
  Derived data are cached in memory (`$store.data`), not in session storage.
- **No-station state** uses the legacy text: "Select Station" / "To get
  started, select a station from the dropdown."
- **Static data sources.** `data/staticSource.ts`: the soil parameters
  load from data2 `soils/soil_params.json` and the vendored copy in parallel,
  and the newer `release` wins (`DATA2_SOILS_ENABLED`). The GDD stage tables
  load straight from `public/data/` (`DATA2_GDD_ENABLED = false`, no console
  404s) until data2 publishes `derived/gdd_stages.json`; that path stays
  tested (`deps.data2Enabled`).
- **GDD cutoffs.** The slider shows the crop's cutoffs from `GDD_CUTOFFS_F`
  (what the API computes, incl. wheat/barley 32–70 °F switching to 32–95 °F at
  Haun stage 2), not the legacy slider table (wheat/barley 32–95, hemp 34–100,
  sunflower 44–100), which never matched the API's numbers. Open-ended caps
  (sunflower, hemp) sit at the slider's right end and read "no upper cutoff".
  Moving the slider switches to **custom cutoffs** (URL `gdd_lo`/`gdd_hi`),
  which drop growth-stage labels (the stage tables assume the crop's cutoffs);
  the UI says so and offers "Reset to <crop> cutoffs".
- **GDD stages** come from the vendored stage tables; hover shows
  "<stage> – <name>". Corn has no public stage table (D-GDD-2), so corn shows
  "No stage table for corn" (legacy showed the API DB's corn stages).
- **GDD projection (new).** When the window ends today, a projection runs
  through the chosen horizon (URL `gdd_proj`): default **end of season
  (Oct 31)**, falling back to +60 days when fewer than 14 days remain; also
  +30 / +60 days / off. NWS forecast days (dotted) then the 1991–2020 gridMET
  normals median (dashed) with a 25th–75th percentile band. A failed NWS
  forecast degrades to normals only, with a note.
- **Soil profile frozen mask.** Same rule as legacy (soil temperature ≤ 32 °F
  hides VWC, EC, SWP and saturation), but masked cells are drawn light grey
  with a legend note instead of blank. The profile is always daily (legacy hid
  the time toggle and reset it to daily). Only has_swp stations offer the SWP
  and saturation chips (legacy `update_swp_chips`); EC comes from
  `soil_ec_blk` observations.
- **SWP / saturation station filter.** Only has_swp stations are listed (as
  legacy `filter_to_only_swp_stations`); an ineligible station is cleared
  **with a notification** (legacy cleared it silently).
- **Missing sensors.** A window where a required input is entirely missing
  shows e.g. "Solar radiation unavailable for this period." (ETr, CCI; e.g.
  arskeogh with its dead pyranometer) instead of an empty plot; partial gaps
  get a note and stay gaps (hourly ETo is null, not 0: D-ETO-1).
- **Annual comparison.** Option labels show depths and heights in US units,
  like legacy `dist_swap` ("Soil VWC @ 4 in", "Air Temperature @ 6.6 ft"),
  and are naturally sorted. One `/observations/daily` request per year (level 2,
  daily mean; daily total for precipitation), drawn as each year arrives
  (legacy: one full-record request). The current year is `--text-primary`,
  width 3; prior years are batlow samples ("House style › Data colors";
  legacy used YlGnBu). Precipitation is cumulative and stops at the last
  observed day rather than running flat to Dec 31. The y label keeps the
  sensor height ("Air Temperature @ 2 m [°F]"). The x axis has month ticks and
  no "Day of Year" title (the tooltip header gives the day), and the legend sits
  under the plot as on every other chart, not at the right (AG-ANN-003; the
  right-hand legend would take a quarter of a phone-width chart). A year before
  the station's level-2 data begins answers 404 "No data"; it is drawn as an
  empty year, and the browser still logs the 404 (as web/).
- **Empty Annual** reads "Select a comparison variable to continue." (web/
  wording; legacy "Select a variable for comparison...", AG-ANN-005).
- **Learn More.** Same slugs as legacy (gdd → `gdds/#<crop>-growing-degree-days`,
  soil profile → `soil_profile/`, cci → `risk/`, others pass through), except
  Annual, which links the base Ag Tools page instead of legacy's `ag_tools//`.
- **Date picker** ends at today (legacy allowed tomorrow).
- **Colors** are the house palette ("House style › Data colors"): CCI YlOrRd,
  GDD YlOrRd bars and line, per-variable heatmap scales. This replaces web/'s
  sand/indigo GDD and Viridis heatmaps.
- **Unit text.** Axis, legend and colour-bar labels use the API's unit
  symbols ("[°F]", "[bar]") instead of legacy's "[degF]", "[negative bar]" and
  "[Bar]" (AG-SOIL-003, AG-CCI-003; same as web/). SWP is negative by
  definition, and the axis ticks carry the "-".
- **GDD bar name** includes the cutoffs in use: "Daily GDDs (32–70 °F)"
  (legacy "Daily GDDs"; AG-GDD-005), so custom cutoffs are visible in the
  legend and the table.
- **Percent saturation axis** is fixed at 0–100 % (legacy autorange,
  AG-PS-001), so saturation reads against the same scale at every station.
- **Satellite tab** is hidden; `#satellite` links open Latest with a notice
  linking the legacy satellite view.

## Carried over from web/: Data Downloader

> From `web/src/tabs/downloader/DIVERGENCES.md`.

The Downloader tab (`tabs/DownloaderTab.tsx`, `tabs/downloader/`) ports the
legacy Dash downloader (`app/mdb/layout.py` `build_downloader_content`,
`app/mdb/app.py` ~2146-2369). This file records every deliberate
difference. The IDs refer to `web/scripts/fidelity/CHECKLIST.md` sections 12
and 13.

### Downloader

#### Request and QC

- **A QC level control replaces "Remove Flagged Data" (DL-007).** Legacy
  sent `rm_na = not checked`, so the switch did the opposite of its label
  (legacy bug). The rewrite offers a Raw / Provisional / Quality-controlled
  control (`level` 0 / 1 / 2) instead. Old links that carry `?rmna=true` map to
  level 2 (`core/url-schema.ts`).
- **The default is QC level 2, not legacy level 1 (DL-010).** Provisional
  data keeps gauge artefacts. For example, arskeogh precipitation for August
  2026 is 13.8 in at level 1 but 0.86 in at level 2 (mesonet-db-rds#189).
  Rows the daily QC pipeline has not reached yet are served provisionally and
  marked in the `provisional` column (`request.ts` `DEFAULT_QC_LEVEL`).
- **No `premade` data and an outer join (DL-010).** Observations and derived
  variables are fetched separately and joined with a full outer join on
  (station, datetime). Flags are OR-combined, as legacy did for
  `has_na_x`/`has_na_y`.
- **Raw API headers.** Columns keep the API's
  `{description} [{unit}]` names. Latest Data's sensor-height label swaps
  (LAB_SWAP) are not applied, so heights such as "@ 2 m" or "@ 8 ft" stay in
  the CSV exactly as the API reports them.
- **Only-derived selections are not padded with every element (DL-011,
  legacy bug not ported).** In legacy, `elements=""` fell back to every
  element.

#### Monthly aggregation (DL-012)

Monthly data is computed from the daily endpoints in `core/aggregate.ts`.
The audit noted that this choice was documented only in code comments; it is
recorded here as well.

- **Strict monthly sums.** Precipitation and Reference ET are summed only
  when every calendar day of the month has a value. Otherwise the total is
  blank. Legacy summed whatever days existed, so a total built from 1 of 31
  days looked like a real monthly total. A month that falls only partly
  inside the requested range is therefore blank. All other columns are means
  of the days available.
- **Stricter "Contains Missing Data".** On monthly rows this flag is also
  true when any value column is null on any day, or when a calendar day has
  no row at all.
- **A "Days With Data" column** counts the daily rows in each month, so
  partial months (range edges, outages) are visible. `obs_count` is dropped
  in favour of it.
- Every numeric column is aggregated. Legacy dropped any column missing from
  its hard-coded label list. Boolean flags (`provisional`) use any().
  Values are rounded to 3 decimals.

#### Variables

- **Soil Water Potential and Percent Saturation are derived options at
  `has_swp` stations (SWP-004 / DL-003).** Legacy commented them out of the
  picker but still treated them as derived codes, so old `els=swp,…` links
  depended on them. The rewrite offers them only at stations with SWP
  parameters (`request.ts` `DERIVED_OPTIONS`, `requiresSwp`). At a non-SWP
  station they are dropped from the request with a visible notice. The audit
  noted that this choice was documented only in code comments; it is recorded
  here as well. Monthly values are means. mesonet2's `/derived` has neither,
  so they are computed in the browser from a separate `soil_vwc` request and
  the mesonet-soils parameters (`soilDerived.ts`), with the legacy column
  names plus a `… Clipped?` flag per SWP depth (D-SWP-2).
- Option groups ("Standard elements" / "Derived variables") replace legacy's
  disabled header rows (DL-003).

#### Dates

- **Hourly defaults to the last 30 days (DL-009).** Daily and monthly start
  at the install date, as in legacy. Hourly starts 30 days back instead
  (`HOURLY_DEFAULT_DAYS`), because years of hourly rows are rarely what the
  user wants.
- **Large hourly requests need confirmation.** Hourly ranges longer than 366
  days (`HOURLY_CONFIRM_DAYS`) show a warning, and Run Request must be clicked
  a second time ("Confirm large request").
- **A start before the install date is clamped.** As with legacy's DatePicker
  `minDate`, a start date before `date_installed` (from an old link or typed
  in) is moved to the install date, and a small note explains the change. The
  request still runs. A start after the end is still an inline error.

#### Station selection

- **No implicit default station (DL-002).** Legacy preselected the first
  station in the sorted list. The Downloader shares the `?s=` URL key with the
  other tabs, so writing a default would change the station on every tab. The
  tab uses `?s=` when it is set and otherwise starts empty.
- **The map (DL-018)** is a Downloader-specific MapLibre map
  (`tabs/downloader/DownloaderMap.tsx`). It draws USGS shaded-relief tiles
  with Montana county outlines and merges co-located stations into one
  marker. Marker colours are AgriMet `#00cc96`, HydroMet `#7A7AFB`,
  co-located `#FB7A7A` and selected `#FFD700`. Hovering a marker shows
  "**Station(s)**: …". Clicking selects the group's first station code.
  Differences from legacy:
  - the map fits Montana's bounds at any width, where legacy used a fixed
    zoom of 5 and a height of 300;
  - markers have a thin white outline;
  - a small colour legend is shown;
  - selecting a station does not re-center the map, which matches legacy.

#### Funding footer (DL-020)

The footer "Supported by Bureau of Land Management (RM-CESU Award
L16AC00359)" is in bold, on `#129dff`, with a minimum height of 40px. It
is part of the tab's normal flow, at the bottom of the tab. It is not
`position: fixed` as in legacy, because a fixed bar would cover the controls
and the preview on small screens. It wraps to two lines at 375px.

### Downloads (CSV)

- **No leading index column (DLF-002, legacy bug not ported).** Legacy's
  pandas `to_csv` wrote an unnamed integer index column by accident.
- **Lowercase `true` / `false` booleans (DLF-003).** Flag columns are
  written as `true`/`false`. Legacy wrote Python's `True`/`False`. Either form
  parses in R, pandas and spreadsheets.
- **Extra columns (DLF-003).** `provisional` (QC state per row) is always
  included. Daily and hourly CSVs also carry the API's `obs_count`
  (observations behind each row); monthly CSVs drop it and add
  `Days With Data`. "Contains Missing Data" keeps its legacy name (DL-013).
- **Datetimes (DLF-003)** are the API's local stamps with their offset
  (`2026-09-01 00:00:00-06:00`), as received, not legacy's JSON round-trip.
  The offset makes each row unambiguous across DST changes.
- The filename is unchanged: `{station}_{period}_{YYYYMMDD}_to_{YYYYMMDD}.csv`
  (DLF-001). When the start date was clamped, the filename uses the clamped
  start.

## Global UI

> W1 global UI (outage notice, notices, Help, Share, theme toggle, footer). Compared with web/ unless noted.

### Outage notice
- **Same as web/:** `outage.json` from the repo's main branch, shown once per browser tab per notice `id`; any failure means inactive.
- **New:** a kit `<dialog class="mco-modal">` fed by `$store.data.cached('outage', …)` (60 s TTL, no retry), rechecked every 60 s while the tab is visible, so a notice posted while the page is open still appears. The sessionStorage key is `mco-dashboard-outage-<id>` (was `outageModalShown:<id>`). sessionStorage is per tab, so the rename makes no one see a notice twice. The tone (`color`) shows as an icon plus a word (Warning, Alert, Information, Resolved, Notice), never as color alone. The MCO logo header is gone; the notice title is the dialog heading.
- **Markdown:** a small built-in subset (`core/markdown.ts`): paragraphs, bold, italic, `[links](…)` and `<https://…>` autolinks. Raw HTML in the message shows as text. Only `http(s):` and `mailto:` targets become links (new tab, `rel="noopener noreferrer"`). react-markdown also rendered lists, headings and code, but outage messages have never used them.
- **Why:** no Mantine or react-markdown. The message is remote content rendered with `x-html`, so it has to be escaped.

### Page counts (GoatCounter)
- **Legacy / web/:** no analytics in web/.
- **New:** one GoatCounter beacon (`navigator.sendBeacon` to `mt-climate-office.goatcounter.com/count`) per view: the path plus the section, and on Charts the open chart or Ag tool (`/mesonet-dashboard/next/#charts/air_temp`, `#charts/compare`). Every count carries the screen size (`width,height,dpr`); the landing view also carries the referring site's host only (`google.com`, never the full URL; none for the app itself) and any `utm_*` tags as the campaign. Events (`e=true`) count actions: `station/<id>` per station viewed, `share`, `download/csv/<period>`, `download/photo`, `photos/open` and `interval/<id>`. Other query keys (the station, dates) and the full referrer are never sent, and there are no cookies or third-party script. It is skipped under Do Not Track or Global Privacy Control and on local hosts (dev, verify). The CSP `connect-src` allows that one host. The code is `core/analytics.ts` and `ui/shell/analytics.ts`.
- **Why:** user decision (2026-10-02): privacy-friendly counts instead of no analytics or GA4. Screen size, referrer host, campaign, per-chart paths and events added 2026-10-08 (user) to fill GoatCounter's "unknown" panels without cookies.

### Legacy `?state=` links and `#satellite`
- **web/:** a Mantine notification, open until closed, with a link to the previous dashboard.
- **New:** a dismissible banner at the top of `<main>` carries the sentence and the link, and a plain-text kit toast (2800 ms) points to it. `state` is removed and the other params stay byte-for-byte (`core/legacyLinks.ts#withoutLegacyState`). `#satellite` becomes `#latest`, both on load and on later hash changes.
- **Why:** the kit toast is text-only with `pointer-events: none`, so it can't hold a link. The banner keeps the link reachable by keyboard and screen reader.

### Station id resolution announced
- **New:** when an NWSLI or mis-cased `?s=` is rewritten to the catalog id, the live region says so ("Station ACEBOZEM opened as Bozeman (acebozem).").
- **Why:** HOUSE-STYLE §5.1. Otherwise the URL change is silent.

### Help dialog content
- **Same as web/:** the content (welcome with the crowagen example, the tabs, API docs on mesonet2, contacts, Background, Source Code, satellite on the previous dashboard). It opens only from the "?" button.
- **New:** kit `.info-section` blocks with headings (Welcome, Using the tabs, Data source, Contact, Montana Mesonet background, Source code). Data source adds "Times are Mountain Time." There is no first-visit auto-open: HOUSE-STYLE §4 suggests one, gated by `mco-dashboard-help-seen`, but neither web/ nor the legacy app opened Help on load.

### Share
- **New:** copies `$store.url.href`, the view's URL built from the store state (`core/url-schema.ts#viewHref`), so the link matches the view even before the store's batched write reaches the address bar. The result appears as a toast and is also sent to the page live region.

### Theme toggle
- **New:** one button cycles dark → light → high contrast. Its icon and `aria-label` ("Switch to light theme") name the theme a click switches to, a matching tooltip shows on hover, and the new theme is announced in the live region. `MCO.setTheme` saves the choice in the shared `mco-theme` key.

### Footer
- **New:** every tab ends with "Data from the Montana Mesonet, quality-controlled and served by the Mesonet API." and "Montana Climate Office · climate.umt.edu" (HOUSE-STYLE §1 voice), with underlined links. The Downloader's BLM funding footer stays on that tab only.

## Maps

The station maps (`ui/map/`) replace both web/ maps (`components/StationMap.tsx`
and `tabs/downloader/DownloaderMap.tsx`) with one host and two presets.
This section supersedes the colour and basemap notes in "MapLibre locator map"
and DL-018 above.

- **Basemap and relief (ST-004, DL-018).** Legacy and web/ used USGS
  shaded-relief tiles (Downloader) or Positron only (Latest). web-next uses the
  kit's CARTO Dark Matter or Positron basemap for the current theme (high
  contrast uses Dark Matter), with the kit hillshade (AWS terrain DEM, `igor`).
  **Why:** house style §7; USGS relief is light-only and US-only.
- **Boundaries.** County lines, tribal lands (labelled from z6) and the state
  line come from the kit's GeoJSON, vendored in `public/geo/` (kit v0.7.1). They
  replace `public/mt_counties.geojson`. CARTO's own `boundary_county` layer is
  hidden. The Downloader draws counties heavier, as legacy emphasised them; the
  Latest map uses the kit default.
- **Marker colours and shapes (DL-018).** The legacy colours (AgriMet
  `#00cc96`, HydroMet `#7A7AFB`, co-located `#FB7A7A`, selected `#FFD700`) are
  replaced by `core/palette` `NETWORK_COLOR` and `NETWORK_SHAPE`. HydroMet is a
  filled dot, AgriMet a hollow dot and Cooperator a thin ring, so the network
  still reads in grayscale. A co-located site is one marker: the inner dot is
  the first network and the outer ring is the second network's colour (the
  palette has no co-located colour). The selected station gets a
  `--selection-ring` ring. The legend is a kit `.mco-panel` with text labels;
  it collapses on phones.
- **Clicking a co-located marker** selects its first station (alphabetical, as
  in legacy). Clicking it again selects the next one, so a pointer can reach
  every station at the site. Legacy always took the first.
- **Popup.** Hovering a marker lists every station at that point with its name,
  network and elevation (m). This replaces the Downloader's "Station(s): …"
  text and Latest's name/elevation popup. web/ also pinned a popup on the
  selected station; web-next does not, and the ring marks the selection.
  Popups are built with DOM `textContent`, never HTML.
- **Only Latest moves the camera on selection.** Selecting a station there flies
  to it, at zoom 8 or closer. The move is instant under reduced motion and on
  first load. The Downloader never re-centres, as in legacy.
- **Framing.** Both maps fit `MCO.map.MT_FIT_BOUNDS` at any size. A zoom floor
  stops zooming out past Montana, a fit button resets the view, and rotation is
  off.
- **Accessibility (new).** The map container has `role="application"` and a
  label. A polite live region announces selection changes. A hidden table lists
  the visible stations (name, network, county), each with a select button. The
  table takes one Tab stop; the arrow keys and Home/End move within it.
  Focusing a station's button shows its popup and a focus-coloured halo on the
  map.

## Charts

ECharts host (`ui/charts/chart.ts`) and the Ag builders (`core/charts/ag*.ts`) vs the Plotly figures in `web/src/features/ag/figures`. Color changes are under House style.

### GDD growth stages
- **web/:** markers on the cumulative line, one color per growth stage.
- **New:** dashed, labelled horizontal lines at each stage's GDD threshold on the cumulative axis. Stages closer together than 1/16 of the axis are skipped so labels never stack. Every day's stage is still in the tooltip and the table twin.
- **Why:** the palette has no per-stage color set, and a label reads without color (HOUSE-STYLE §6).

### Legend titles
- **web/:** Plotly legend titles ("Index Used", "Livestock Risk (adult)").
- **New:** the same text drawn to the left of the legend. Drawing aids (the grey index line, the band's lower edge, the SWP bands) never appear in the legend or the tooltip.
- **Why:** ECharts legends have no title.

### Hover and zoom
- **web/:** Plotly `x` hover and drag-to-zoom.
- **New:** one axis tooltip per x listing every series (the kit `.mco-tooltip`). Zoom with shift+wheel or pinch, or the slider under wide charts. Drag pans on desktop only; on phones the page scrolls. The date controls are the keyboard alternative.
- **Why:** a drag gesture inside the plot would trap scrolling on touch screens.

### Daily points at local noon
- **New:** daily values sit at noon Mountain Time on the time axis, so a daily bar covers its own day between the midnight ticks. Tooltips and tables show the date only.

### Soil Profile heatmap
- **web/:** Viridis for most variables, a cool–warm diverging scale for temperature, and an auto range for SWP.
- **New:** palette scales (`HEATMAP`). Soil temperature diverges around 32 °F and SWP (log10 bar, BrBG) diverges around the wilting point (15 bar); each midpoint is labelled on the color bar ("Freezing (32 °F)", "Wilting point (15 bar)"), and SWP also marks FC (0.33 bar). SWP colors cover 0.01–1000 bar; cells beyond that take the end colors, because the inversion gives values in the tens of thousands of bar near residual water content. Frozen cells are grey with a diagonal hatch, so the mask reads without color. The time axis is a category axis (one cell per day or hour), which ECharts heatmaps require. On phones the color bar runs horizontally under the plot.

### Annual comparison
- **web/:** x axis numbered by day of year; hover "Day of year: 60 (2024-02-29)".
- **New:** month ticks (Jan–Dec at the 1st, non-leap day of year). The tooltip header is the day of year only ("Day 60"), and each year's row shows that year's own date, so leap years read correctly (2024 "Feb 29", 2025 "Mar 1").
- **Why:** months are what people scan for; one DOY is a different date in leap years.

### Accessible twin
- **New:** each chart has an `.sr-only` table twin (date/time column plus the plotted values, "—" for missing, "frozen" for masked soil cells) and an `aria-label` on the canvas. Animations run only on first draw, and not at all under reduced motion.
- **Why:** HOUSE-STYLE §5.

## Latest Data

Layout, sidebar and station plot (`partials/latest/index.html`, `ui/latest/{sidebar,timeseries}.ts`,
`core/latest`, `core/charts/latestTimeseries.ts`). IDs refer to `web/scripts/fidelity/CHECKLIST.md`.
Plotted values were checked against web/ point for point: acebozem hourly, mdamalta daily and arskeogh raw, all at level 2, with no differences.

### Layout (LDC-001, LDC-002, LDP-002, LDP-021, MOB-002)
- **Same as web/:** sidebar about 1/4, plot about 1/2 and cards about 1/4 on wide screens. On wide screens the card column is viewport-tall, and the bottom card fills the rest of it.
- **New:**
  - 768–1199 px: the sidebar and plot sit side by side, with the two cards in a row under them. Below 768 px everything stacks.
  - The plot is as tall as its panels need (190 px per panel, 340 px for a single panel, 160 px on phones), and the page scrolls. The plot has no inner scroll box.
  - The sidebar has a "Controls" heading (LDC-001).
  - **Collapse (LDC-002).** At 1200 px and wider, an icon button beside "Controls" ("Hide controls", `aria-expanded`) hides the sidebar, and the plot widens into its column (legacy: 6 → 9 of 12). A menu button ("Show controls") at the top of a slim rail where the sidebar was brings it back. This replaces legacy's floating blue button. Focus moves to the other button. The choice is saved per browser in localStorage `mco-dashboard-sidebar`, not in the URL, so a shared link always shows the controls. Below 1200 px both buttons are hidden and the sidebar always shows, whatever was saved (`ui/latest/layout.ts`, `core/latest/layout.ts`).
  - Loading is text, not legacy's Bars spinner: "Loading station data…" over an empty plot, and a small "Updating…" in the corner while a new window for the same station loads over the old plot (LDP-021).
- **Why:** one scroll container is easier to use on touch screens. Text says what is loading and needs no motion (reduced-motion safe).

### Station picker (ST-001)
- **web/:** a searchable Select whose labels read "{name} ({sub_network})".
- **New:**
  - The kit-style combobox lists stations under network headings, with the plain name as the label and the id beside it.
  - Typing also matches the NWSLI id. The county became a place (below).
  - The selected station stays in the list when the network filter hides its network, as it stays on the map.
- **Why:** with the headings, the network suffix only repeated itself. The NWSLI search covers the old `/dash/<NWSLI>` users.

### Station picker: place search and typo matches (new)
- **Legacy / P1:** stations only, by name, id, NWSLI id or county substring.
- **New:** typing also lists Montana places from the Census Gazetteer (`public/data/places.json`,
  `core/places/vendor-places.mjs`: 56 counties, 7 reservations with the nations' names as keywords, the
  Little Shell Tribe (no Census reservation; listed at Great Falls, its 5 nearest stations),
  incorporated places and CDPs, ZIP codes), at most 8 under the stations. Picking one lists stations where
  Near me does: every station in a county (the catalog's `county`) or on a reservation (its boundary in
  `public/geo/`), nearest the centre first, else the 5 nearest. A typo of 1 letter (5+ letters typed) or 2
  (8+) still matches, ranked last; numbers never match by typo. Accents and apostrophes are ignored.
- **Why:** people know their town, county, reservation or ZIP code, not a station's name. The list is bundled
  (15 KB gzipped, loaded when the search list first opens), so nothing typed leaves the browser and the CSP
  needs no geocoder. Counties left the station keywords: the county place lists the same stations, nearest first.

### Network filter (ST-002, ST-003)
- **Same as web/:** chips come from the catalog's networks, all are on by default, and turning every chip off shows every station.
- **New:** turning every catalog network back on clears `nets` from the URL. A network that has no chip (Cooperator, while the catalog has none) is dropped from the stored value. The filter applies to the picker and the locator map through `core/latest/stations.ts`.

### Date range (LDC-003, LDC-004)
- **web/:** one Mantine range picker with a maxDate of today. It had no minimum, which replicated the legacy bug LDC-004.
- **New:**
  - Start and End are two native date inputs, bounded from the station's install date to today, with an inline error for an invalid range.
  - Choosing the default window (the last 14 days ending today) clears `from`/`to`, so the view keeps rolling forward.
  - A malformed `?from`/`?to` shows empty inputs and the no-data message.
- **Why:** native inputs are accessible and mobile friendly. The bound fixes LDC-004 (legacy bug not ported).

### Variable chips (LDC-011 to LDC-014)
- **Same as web/:** the chip set (station elements or the sorted defaults), `ppt_corrected` excluded, `vars=` means "No variables selected", and the list scrolls past about 200 px.
- **New:**
  - Panels follow the order of selection: a chip turned on adds its panel at the bottom. web/ reordered the panels to chip order once any chip changed.
  - Variables the current station lacks stay in `vars`, so they come back at the next station that has them.
  - The five defaults, in default order, store as an absent `vars`.

### gridMET switch (LDC-009)
- **New:** a native checkbox with `role="switch"`. The help text is always visible under it instead of in a hover tooltip.
- **Why:** hover-only text is unreachable on touch screens and by keyboard.

### One time axis, zoom and the URL (LDP-001, LDP-003)
- **web/:** Plotly subplots with `matches: 'x'`, x range forced to [first day − 1, last day + 1], and drag pan or zoom writing `from`/`to`. A double click reset the view to the defaults.
- **New:**
  - One ECharts grid per variable, with every x axis on one shared dataZoom: shift+wheel, pinch, the slider on wide screens, and drag pan on desktop. The hover line is linked across all panels.
  - On load, back/forward or a sidebar change, the visible window is exactly the URL dates, from 00:00 on the start date to the end of the end date. The axis is that window (no padding), so the slider's track is what is plotted and its window starts full (2026-10: a padded axis left the slider window on the right ~45% of an empty track).
  - `from`/`to` are the day-granular *fetch* window. Zooming or panning inside the loaded days changes neither the URL nor the data, and the view is never snapped to whole days, so raw data zooms below a day. A wider window comes from the date inputs or "Whole record" (`core/latest/view.ts#zoomWindow` still turns a view past the loaded days into new dates). A reload shows the whole URL window.
  - The previous plot stays on screen, marked "Updating…", while a new window for the same station loads.
  - There is no double-click reset. The date inputs and "Display Latest 2 Weeks" do that job.
- **Why:** with the ±1 day padding, every refetch would have widened the URL by two days.

### Panel styling (LDP-007, LDP-009, LDP-010, LDP-011, LDP-013, LDP-016)
- **New:**
  - Colors come from `core/palette` ("House style"): variable families, Blues precipitation bars, YlOrRd ETr bars and batlow soil depths.
  - The soil depth labels (LDP-013) are a key row above the panel (a line swatch plus "2 in") instead of white text on colored chips. White text failed contrast on the light depth colors.
  - A panel with several columns of one variable (for example Air Temperature at 2 m and 8 ft) gives each column its own dash and a key row. Legacy colored them identically.
  - Bars are at least 1 px wide, so raw 5–15 minute precipitation stays visible over a week.
  - The Snow Depth axis runs from 0 to a round number at or above max(1, data max) (LDP-016 range with a readable top tick).
  - Daily values sit at local noon, as in the Ag charts.

### Hover (LDP-008, LDP-009, LDP-010)
- **web/:** an x-unified hover per subplot showing the raw `%{y}`.
- **New:**
  - One tooltip for the hovered time across every panel, grouped under each variable's name.
  - Soil rows show the depth ("2 in: 13.11 %"). Precipitation and ETr keep the legacy "Precipitation Total" / "Reference ET Total".
  - Values are rounded to 2 decimals, or 3 below 0.1, and carry their unit.

### gridMET normals (LDP-018, LDP-019)
- **Same as web/:** the data and joins: the q25-of-min to q75-of-max band for Air Temperature and RH, and the 75th/median/25th markers for Precipitation and ETr.
- **New:**
  - The band and dashed edges use the palette `NORMALS` role (a `--text-dim` tint) instead of black lines over `rgba(107,107,107,0.4)`. The markers are `--text-dim`, not black, so they show in the dark themes.
  - A chart-wide key names them ("gridMET normal (1991–2020)", "▼ 75th ● median ▲ 25th pct. normal"). Hovering shows the normal range or percentile values.

### Sensor-change overlays (SC-008)
- **web/:** a grey `rgba(200,200,200,1)` rectangle plus an invisible hover polygon over the data range.
- **New:**
  - A hatched full-height span in the palette `SENSOR_EVENT` role, with a "Sensor change" key at the top of the chart.
  - The legacy hover text (SC-009, verbatim) appears in the axis tooltip whenever the hovered time falls inside a span on that panel.
- **Why:** the hatch keeps the overlay readable without color (HOUSE-STYLE §6). One axis tooltip replaces the polygon trick.

### Accessible table twin
- **New:** the plot's `.sr-only` table holds at most the first 500 time steps, then a row reading "Showing first 500 of N rows; use the Data Downloader for the full record."
- **Why:** a raw window spanning weeks would otherwise build tens of thousands of cells.

### Announcements
- **New:** when a new station, window or aggregation finishes loading, the live region says "Chart updated: {station}, {hourly|daily|raw} data, {start} to {end}, {n} variables." Plotly had no announcement.
- **Why:** HOUSE-STYLE §5.1 (canvas changes are invisible to screen readers).

## Latest cards (pre-redesign; their content now lives on Now and About, see "Redesign 2026-10")

Top card (Wind Rose / Weather Forecast / Latest Photo) and bottom card (Locator Map / Station Metadata / Current Conditions). Card defaults, the camera-schedule rule for Latest Photo, data2-only photos and the NWS forecast cards are carried over from web/ (LDT-002, LDT-003, LDT-009 to LDT-015, LDB-002, LDB-010 above); this section lists what changes versus web/.

### Card switchers
- **web/:** Mantine `SegmentedControl`s.
- **New:** the kit segmented control (a radio fieldset in `.seg-btns`): arrow keys move between cards, a disabled Latest Photo is skipped, and each pick writes `?card=` / `?info=`. Labels and order are unchanged (LDT-001, LDB-001).
- **Why:** kit first; native radio keyboard behaviour.

### No Wind Rose flash before the photo
- **web/:** with no `?card=`, the top card drew the Wind Rose (and requested its data) while the camera schedule loaded, then switched to Latest Photo for camera stations.
- **New:** the auto choice shows "Loading…" until the schedule answers, then the Photo or the Wind Rose. An explicit `?card=` renders at once.
- **Why:** one less request and no content swap for camera stations; the final card was the same. (Superseded: the card switchers are gone; Now shows the photo, or the wind rose without a camera.)

### Wind rose
- **web/:** Plotly barpolar, Plasma_r bins, title in Courier New over the polar plot, hover "{bin} mph / {dir}: {count}", legend names without units.
- **New:** ECharts stacked polar bars with batlow bin colors (palette "wind-rose bins"); the title "Wind Data from {start} to {end}" is a heading above the chart (Space Mono); the legend names carry the unit ("4 – 6 mph") and wrap to two rows instead of paging; an `.sr-only` table twin lists the counts per direction and bin. Counts, bins, labels and the window/aggregation rule are unchanged (LDT-005 to LDT-007).
- **Why:** house palette and fonts; all bins visible in a narrow card; HOUSE-STYLE §5.

### Weather Forecast
- **web/:** Mantine period cards with a hover tooltip for the detailed forecast and a drop icon for the precipitation chance; the raw request error as the failure text.
- **New:** kit-token period cards in a keyboard-scrollable strip; the detailed forecast is the card's `title` and is in the accessible name; precipitation chance as "30%". On failure: "The NWS forecast is unavailable right now.", a Retry button and the NWS page link. Icons are shown only from `https://api.weather.gov/` (the page CSP's only image host for NWS).
- **Why:** text-only rendering of API strings, a recoverable failure state.

### Latest Photo
- **web/:** Mantine chips, date picker popover, Select and Modal.
- **New:** `aria-pressed` direction chips, a native date input bounded by the camera's first month and today, a native select of the frames that exist that day, and a kit `<dialog class="mco-modal">` (Esc and backdrop close, focus returns to the image button). "Download original" is in the dialog and saves the shown `webp_large` WebP under its archive basename, as web/ did. It is a link (`download` = basename); the WebP is prefetched as a blob when the dialog opens and saved without awaiting in the click, so the user gesture holds (Safari); if the blob is not ready the link opens the WebP in a new tab instead of web/'s late `window.open`. A past day whose derived WebPs cannot be confirmed shows the frames the manifest names and is retried later instead of being cached as final. The image is a `<button>`, so Enter/Space open the dialog.
- **Why:** kit components; native controls are keyboard and screen-reader complete.

### Current Conditions timestamp
- **web/:** `dayjs(ts)` formatted the API stamp in the browser's time zone ("MMM D, YYYY h:mm A"), and Safari could not parse the space-separated stamp with an offset.
- **New:** the stamp is read as Mountain wall clock by hand (`formatLatestStamp`), same format, so every viewer sees Mountain Time.
- **Why:** ARCHITECTURE "Time" (all stamps MT, no `new Date(string)`).

### Tables
- **web/:** Mantine tables, odd rows `rgb(220,220,220)` (legacy TABLE_STYLING).
- **New:** odd rows `--bg-raised`; row labels are `<th scope="row">`; values in Space Mono. Rows, order and values are unchanged from web/ (LDB-003 to LDB-009); the Precipitation Summary is still HydroMet only.
- **Station Metadata vs legacy (LDB-003):** the legacy rows in legacy order, then two web/ extras, County and NWSLI ID. (Superseded by About's station details, `core/about/details.ts`.) A blank catalog value shows "—" instead of an empty cell.
- **Why:** house tokens in all three themes; the extra rows are the ids people search by.

### Station one-pager link (OP-001)
- **Legacy:** fetched `one-pagers.json` from the repo's main branch on every Metadata render.
- **New:** the same file, fetched once through `$store.data` and kept for 30 minutes (`ONE_PAGERS_STALE_MS`). Only well-formed `{station, url}` entries with http(s) URLs are used (`core/cards/onePagers.ts`).
- **Why:** the file changes a few times a day at most; one fetch per visit is enough, and the URL filter keeps a bad entry from becoming a link.

## Downloader (web-next)

Supersedes the web/ notes above only where stated. CSV output is byte-identical
to web/ for the same request (checked for acebozem and lololowr × daily /
hourly / monthly, derived-only, `qc=0/1`, `rmna=true`, default hourly dates,
a confirmed > 366-day hourly range, a clamped start and `pub=true`); request,
join, monthly and CSV code is the same `core/downloader/request.ts`,
`core/aggregate.ts` and `core/csv.ts`.

- **Variables picker.** A grouped checkbox panel (`multiselect`: filter box,
  "Measured variables" (the API's standard elements) / "Derived variables", per-group Select all, removable
  chips) replaces the Mantine dropdown. Ticking options writes `els` in option
  order; a URL's own order is kept until the user edits it.
- **"Show uncommon variables"** is a native checkbox with `role="switch"`.
- **Dates** are two native date inputs bounded by the install date and today.
  The control shows its own bound/order error; when an old link's start was
  clamped past the end, the install-specific message is shown under it too.
  Browser form validation is off so Run always reports the problem inline.
- **Preview waits for the station catalog.** Preview is disabled while a `?s=` station
  is still being confirmed, so an early click no longer says "Please select a
  station…" for a station that is set.
- **Messages** are kit-styled inline notes (⚠ + text, accent edge), not
  coloured Mantine alerts; Run/Download hints keep their web/ wording.
- **Download is disabled until a run returns rows (DL-016),** as in web/,
  instead of legacy's enabled button that answered "Please 'Run Request'
  before attempting to download." The state is visible on the button, so
  the message is never needed.
- **Station (DL-001, DL-018, DL-019)** is a fixed line, "Station: Bozeman
  (acebozem)"; the header's station picker (search, Near me, its map)
  changes it. The sheet has no station combobox or map (redesign entry
  "Download: one short form").
- **Preview chart (DL-017).** ECharts small multiples, one grid per column,
  linked x zoom and axis pointer, the column name as each panel's title above
  the plot (not a rotated y title). Lines use the palette's preview cycle
  (`previewColor`, Tol bright) instead of black, in the house chart style
  (precipitation and ETr as bars, no markers, gaps broken: "Chart style: one way to draw every chart"). The canvas grows 200 px per column. A
  `.sr-only` table twin lists every timestamp with data.
- **Live region (new).** Run announces "Requesting … data for {station}…" and
  then "Request finished: N rows, M columns. Download CSV is ready." (or no
  data / failed).
- **Funding footer (DL-020)** keeps its text and in-flow placement, as a
  quiet centred caption under the form (`--text-secondary`) instead of a bold
  `#129dff` bar.
- **Run always refetches.** Download requests bypass `$store.data` (the one
  exception to the shared cache): the component keeps only the latest result,
  drops it when the station changes, and ignores a response from an older Run.
- **Run is disabled while the date inputs hold an invalid draft**, and the
  message under Run (no station/variable, bad dates, "Run Request" first)
  clears as soon as the inputs fix it, not only on the next click. When the
  clamped-start install message applies, the date control's own error is
  hidden (`dateRange` `showError`) so only that message shows.
- **Variables that fail to load** show "Variables could not be loaded." with a
  Retry button (web/ showed an empty list).
- **Monthly preview** ticks once per month ("Jan 2025", "Feb 2025", …) when
  the range is 36 months or less, as legacy's `dtick M1`; labels that would
  overlap are skipped.

## Ag Tools (web-next)

The Ag tab UI (`partials/ag/*`, `ui/ag/*`, logic in `core/ag/view/tab.ts`, `results.ts`, `keys.ts`) vs `web/src/tabs/AgToolsTab.tsx` + `features/ag/ui/AgVariableView.tsx`. Data, compute, texts and URL behaviour are unchanged (computed client-side from level-2 observations and the mesonet-soils parameters; no `/derived` requests).

### Controls
- **web/:** Mantine selects, a range date picker, chips for crop / soil variable / livestock, one dual-thumb slider with marks.
- **New:** the shared controls (`ui/controls`): station combobox (NWSLI searchable), native selects for variable / projection / comparison variable, two native date inputs (max today), segmented radios for time aggregation and livestock, `aria-pressed` chips (single choice) for crop and soil variable, and two native range inputs ("Base", "Upper cutoff", with the extra "No upper limit" stop) instead of one dual-thumb slider. The cutoff text and "Reset to <crop> cutoffs" are as before.
- **Labels vs legacy (AG-001, AG-002, AG-GDD-001, AG-ANN-001):** short labels shared by all tabs: "Station" with the placeholder "Pick a station" (legacy "Select Station" / "Select a Mesonet Station Dropdown..."), "Variable", "GDD crop" (legacy "GDD Generic Crop Type"), "Comparison variable". The station picker is clearable, which returns the card to "Select Station" (legacy was not clearable).
- **Why:** kit-first controls with a keyboard and screen-reader twin for every gesture; one label vocabulary across the three tabs.

### Chart card
- **New:** the heading names the tool and the station ("Growing degree days: Bozeman"). Notes are a list above the chart; the chart host is mounted only once a view is ready, so loading shows a spinner, and empty / error states show their text in place of the chart (same texts as web/). Each settled view is announced in the page's polite live region ("Growing Degree Days chart updated for Bozeman.", or the empty / error text).
- **Why:** HOUSE-STYLE §5 (canvas changes need a live region).

### Fetching
- **New:** the tab's components mount only while `#ag` is open, so nothing fetches from another tab (the cache keeps the data for the next visit). Cache keys encode station, window, period and QC level (`core/ag/view/keys.ts`). A degraded NWS forecast is retried on the next read after 5 minutes (web/: a 5-minute `staleTime`).

### Annual comparison controls
- **web/:** the date range stays visible (and is ignored); a failed element list shows an empty select.
- **New:** the date range is hidden for Annual. A failed element list says "Variables could not be loaded." in the control and the card, each with Retry. The card waits for the station's element list and never fetches years for a comparison variable the station does not offer (a stale `annv` after a station change); it draws the first option meanwhile, which is what the URL is corrected to.
