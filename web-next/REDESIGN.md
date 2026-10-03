# Redesign: three places, chart first (2026-10)

Working spec for the redesign build. When the build is done, it is folded into DESIGN.md, ARCHITECTURE.md
and DIVERGENCES.md, and this file is deleted.

**Reference mockup** (static, sample data; read its HTML/CSS for layout, spacing and hierarchy):
`/private/tmp/claude-502/-Users-kyle-bocinsky-git-mt-climate-office-mesonet-dashboard/555463de-5eec-40b0-b395-8671a17ecca8/scratchpad/mockup/mockup-v2.html`
(published at https://claude.ai/artifact/VkDB3ejFReh5nBbFANp5gH).
Match the mockup's hierarchy and feel. Use **kit tokens only**: copy no raw hex values from the mockup (HOUSE-STYLE). Where
the mockup and the kit disagree, the kit wins, unless this spec says otherwise.

## Why

The user found P1 "too complicated, and not modern enough". The usability audit gave these reasons:
- Five places, three of which are mini-apps of their own.
- Controls come before content.
- Every reading gets equal weight, including empty ones (0 W/m² at night, flat 0.00 precipitation).
- Labels use raw API language.
- Outlines are everywhere.
- Space Mono at hero sizes.

## User decisions

1. **Three places:** Now · Charts · About.
   - Ag tools are ordinary entries in the Charts list, in an "Ag tools" group.
   - Download is no longer a place. It is a sheet opened from a chart's ⋯ menu, prefilled from that chart.
2. **Phones:** a 3-item bottom tab bar with a solid background. **Desktop:** the same three as a segmented control in the
   header. There is no separate section row.
3. **Now hero:** a large temperature, high/low against normal, and a one-line plain-language summary. Then a single
   **48 h strip**: the last 24 h observed (solid line) running into the next 24 h of NWS hourly forecast (dashed), with
   period icons and the high/low labelled.
4. **Display numerals:** display-size readings (≥ 1.75 rem) use **Outfit with `tabular-nums`**. Space Mono stays for
   tables, IDs, timestamps and axes. This is filed as mco-web-style#36. Until the kit ships it, use one app utility class
   (`.num-display`) and note it in KIT-NOTES.
5. **Interval control** on every variable page: Auto · 5-min · Hourly · Daily.
   - Auto: hourly up to 30 d, daily for 1 y and All years.
   - 5-min (the existing `agg=raw`) only for 24 h and 7 d.
   - Daily draws the daily mean inside a low–high band. The stats' Low/High are the true extremes.
6. The mockup came first, then this build. The user reviews the preview in the morning.

## Information architecture and URLs

`SECTIONS = now | charts | about`. Every old link still lands somewhere sensible:

| Old | New |
|---|---|
| `#ag` (bare) | `#charts`, list scrolled to the Ag tools group |
| `#ag&var=<tool>` + Ag keys | `#charts&v=<tool>` with every Ag key kept (`crop`, `ag_time`, `gdd_proj`, `lt`, …). Ag tool ids are the `DERIVED_VAR_OPTIONS` values. `var=annual` maps to the variable page of `annv` with the All-years view. |
| `#download` / `#downloader` + `dl_*`/`els`/… | `#charts&dl=1`, which opens the Download sheet with those keys applied. Closing it clears `dl`. |
| `#latest` | `#charts&cmp=1`, unchanged |
| `?s=` bare | `#now` |

- `v` holds observed element-family ids (`air_temp`, …) **or** Ag tool ids, in one namespace.
- Interval maps onto the existing `agg` key: Auto means the key is absent, and `raw|hourly|daily` are explicit.
- Section and variable changes push history; everything else replaces.

## Shell

- **Header (one row):**
  - logo;
  - brand text, desktop only;
  - **station button** ("Bozeman ▾", opens the picker);
  - spacer;
  - desktop segmented nav (Now | Charts | About);
  - one **⋯ menu**: Share this view, Theme (the 3-state cycle stays, with an accessible state label), Help, Send
    feedback.

  The separate Share/theme/Help buttons go away. Use the kit menu/flyout conventions and z-index tokens.
  Esc closes the menu, focus moves into it, and arrow keys move through it.
- **Tab bar (phones):** 3 items with a solid `--bg-surface` background and a top border. It keeps the safe-area padding
  and `--tabbar-h`.
- **Station strip:** the network, county and elevation meta line moves to About and the Now hero. There is no meta line above
  every section.
- **Station picker:**
  - search first, with a "Near me" chip inside the search field;
  - recents;
  - "Browse on the map", which reveals the existing map;
  - network filter chips appear only with the map.

  It keeps the current sheet on phones and drawer on desktop, with the same focus, inert and Esc rules.

## Visual language

- **Surfaces:** `.dash-card` becomes a flat surface: `--bg-surface`, radius 16 px, a soft shadow (derive it from
  `--shadow`, lighter), and **no border**, except in high-contrast, which keeps a border for separation.
- **Chips:** range and interval chips are pills. The active range is filled with high contrast (`--text-primary`
  background, `--bg-deep` text, set by `aria-pressed`). The interval row uses a quieter style (accent-hover fill).
- **Labels:** sentence case and plain names, never API labels. One shared map, `core/variables/labels.ts` or the
  existing variable metadata, with tests. Examples:
  - "Air temperature", "Humidity", "Wind", "Pressure", "Sunlight" (solar radiation), "Rain", "Rain rate".
  - "Soil moisture", "Soil temperature", "Soil salinity (EC)", "Reference ET", "Snow depth".
  - Units: °F, %, mph, mb, W/m², in.
  - Wind direction as a compass word ("SSE").
- **Precision:** one rule per variable, e.g. temperature as integer °F on Now and one decimal in tables.
- **Hide empty or meaningless readings on Now**, with a pure, tested rule:
  - solar radiation at night;
  - precipitation tiles with nothing in 7 d. Fold these into the "Rain" tile text.
  - snow per the existing rule;
  - pressure is a text trend chip ("steady", "rising", "falling" over 3 h), not a tile.
- **Motion:** keep the View Transitions and the reduced-motion rules.

## Pages

### Now
Phones show one column; desktop shows two (hero + photo | tiles + rows), as in the mockup.

1. **Hero:**
   - temperature (`.num-display`, about 5–7 rem);
   - high/low and normal on the right;
   - **summary sentence** from `core/overview/summary.ts`: pure, tested, deterministic phrases built from sky (NWS
     current period), wind (calm/light/breezy/windy plus direction) and rain (today, else days since the last rain);
   - "Updated N min ago · Provisional" as a text link that opens the existing toggletip, with the corrected QC wording;
   - the **48 h strip** (`core/charts/heroStrip.ts` builder, ECharts or SVG): observed hourly temperature from the
     72 h request already made, plus NWS **hourly** forecast (`forecastHourly`), with icons from the period forecast.
     A sr-only table twin is required.
2. The **photo** (the existing tile and dialog). The wind rose stays the fallback for camera-less stations.
3. **Tiles**, only the relevant ones, each linking to its variable page:
   - Wind: speed, direction word, gusts.
   - Humidity, with the dew point if available.
   - Rain: 7 d total and YTD % of normal.
   - Soil moisture: the shallowest depth plus a "Dry"/"Wet" chip from the existing SWP or VWC thresholds, if one exists. Otherwise no chip.
   - Snow depth: only when the existing rule says so.
4. **Rows:**
   - "All readings": its meta shows pressure trend and snow, and it links to About's readings.
   - "Station details": network and elevation, linking to About.
5. The forecast card goes away, because the strip replaces it. "Full forecast" moves to a link under the strip.

### Charts
- **List:**
  - a search field that filters rows;
  - groups: Weather · Rain and evaporation · Soil · **Ag tools** (all `DERIVED_VAR_OPTIONS` except `annual`) · More (Compare variables);
  - each row: plain name, a sub-label, the current value and a sparkline. Ag rows show a short summary value where cheap; otherwise only the sub-label.
- **Variable page:**
  - header: back chevron, title, and a ⋯ menu with Download data, Show as table, Custom dates…, Share this chart;
  - "value now · range label";
  - the **chart** at full width;
  - range chips: 24 h · 7 d · 14 d · 30 d · 1 y · All years. All years is the existing History view;
  - the **interval** row;
  - a stats card;
  - **horizontal swipe** to the previous or next variable on touch. Prev/next stays keyboard-reachable through the ⋯
    menu or visually hidden buttons.

  Table view replaces the chart in place, and Back or ⋯ returns. The normals band turns on automatically for daily
  temperature views; there is no checkbox.
- **Ag tool pages** use the same frame:
  - Their controls become **option chips** above the chart (e.g. `Wheat ▾` · `32–70 °F` · `Since Oct 2, 2025` ·
    `Projected to Oct 31`). Each chip opens a small sheet or popover holding the existing control component (chips,
    rangeSlider, dateRange, select).
  - The chip summary text reuses `core/ag/view/summary.ts`.
  - The Ag station combobox goes away: the station comes from the header. Where a tool doesn't apply to a station
    (e.g. no SWP sensors), show an empty state that names the reason and links to the picker.
  - Every Ag number and the fidelity harness's Ag selectors must stay identical. Keep the `.ag-chart-card` data-testids
    or update the drivers.
- **Compare:** reached from the list. It keeps its controls in a disclosure.

### Download sheet
- Opened from any chart's ⋯ menu, or by `dl=1`.
- Prefilled fields: variables (the current variable; "+ Add" opens the existing multiselect), dates (the chart's
  range), interval (the chart's effective interval), and quality ("Quality-controlled · Provisional (basic checks) ·
  Unchecked", mapping onto the existing QC levels).
- One primary **"Download CSV · N rows"** button, plus a small preview (existing).
- Request code, CSV bytes, `dl_*` keys and testids are unchanged. The phone stepper goes away; the sheet is one short
  form.

### About
Flat surfaces with three entries:
- details plus one-pager;
- the locator map;
- rows for "All current readings" and "Sensor changes", each expanding in place or opening a sheet;
- "About the data" prose, using the corrected provisional wording.

## Rules (unchanged)

- Simple and modular: logic in pure, tested `core/`; one way to do each thing; concise, complete comments.
- Data:
  - mesonet2 v2 at level 2;
  - no `premade=true`;
  - `end_time` is exclusive;
  - Ag computed client-side, with SWP and porosity from the API;
  - photos are data2 `webp_large`.
- Accessibility:
  - axe-clean in 3 themes at 1440 and 390;
  - every canvas has an sr-only table and a live region;
  - toggles styled by `aria-pressed`;
  - focus management on every drill-down, sheet and menu.
- Don't re-point `mesonet.climate.umt.edu/dash`. The live app (`web/`) is untouched.
