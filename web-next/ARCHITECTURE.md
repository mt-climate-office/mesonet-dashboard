# web-next architecture

The Montana Mesonet Dashboard, rebuilt on the MCO house style
([mco-web-style](https://github.com/mt-climate-office/mco-web-style) @0.7.1)
with Alpine.js, Apache ECharts and TypeScript. Preview at
`/mesonet-dashboard/next/`; it replaces `web/` at cutover.

Read this file first. It is short on purpose: if something here is unclear,
fix this file in the same PR. Layout, components, motion and type are in
DESIGN.md; what the kit lacks (and the proposals) is in KIT-NOTES.md.

## Commands

```sh
npm ci
npm run dev        # http://localhost:5174/mesonet-dashboard/next/ (API proxied at /_api)
npm test           # vitest, Node only
npm run typecheck && npm run lint
npm run build && npm run size   # size = bundle budget gate
npm run verify     # build + Playwright: kit-consumer checks, axe matrix, keyboard walks,
                   # phone layout + touch + motion (layout.mjs)
                   # (scripts/verify/, API data from its fixtures/; to re-record:
                   #  rm -r scripts/verify/fixtures && VERIFY_RECORD=1 npm run verify)
```

CI (`.github/workflows/web-next-check.yml`) runs all of these on every PR
touching `web-next/`. `deploy-web.yml` builds `web/` at `/mesonet-dashboard/`
and this app at `/mesonet-dashboard/next/` into one Pages artifact.

## Layers

```
src/
  core/     pure TypeScript: API clients, parsing, Ag compute, chart models,
            chart builders, palette, URL schema. No DOM, no Alpine.
  stores/   the four shared pieces of app state (Alpine.store)
  ui/       thin Alpine components (Alpine.data) + their CSS;
            ui/layout/ holds the framework-free primitives (drawer, sheet,
            section nav, transitions, card, skeleton, type scale)
  types/    globals from the CDN (window.MCO, maplibregl) and $store typing
  main.ts   URL fix-ups → register stores → register components → Alpine.start()
partials/   HTML, one file per section/card, inlined into index.html at build
index.html  <head> (kit CSS/JS + SRI, CSP, anti-flash, fonts) + @include shell
vite/       the @include plugin and index.html guard tests
```

**Imports go one way: `core` → `stores` → `ui`.** `core` imports nothing from
`stores`/`ui`/`alpinejs`; `stores` never imports `ui`. ESLint enforces both
(`eslint.config.js`), and bans runtime imports of `maplibre-gl` (MapLibre
comes from the kit-pinned CDN as the `maplibregl` global; `import type` is fine).

## Design principles (govern every PR)

1. **Three layers, imports one way:** `core/` → `stores/` → `ui/`.
2. **Business logic lives only in `core/` and is unit-tested.** A component
   reads stores, calls core functions and holds view state. Target < ~150 lines.
3. **One file, one job,** named for what it does. No barrels except one
   `index.ts` per core module.
4. **Explicit over clever:** no auto-registration or globs; `main.ts` lists
   every store and component; no decorators or metaprogramming; no state library.
5. **One way to do each thing:** one fetch cache (`$store.data.cached`), one
   chart host (`ui/charts/chart.ts`), one map host (`ui/map/map.ts`), one URL
   owner (`$store.url`), one place for colors (`core/palette`).
6. **Kit first.** Use kit classes and `window.MCO` before writing CSS or JS.
   App CSS is small and per feature; every override carries
   `/* kit-override: why */`.
7. **Comments.** Every file starts with a 1–3 line header: what it is and how
   it is used. Exported functions get a one-line contract (units, time zone,
   nulls). Explain *why* where it is not obvious. Never narrate code.
   (Test files are named after their subject and need no header.)
8. **Few dependencies:** Alpine, ECharts, papaparse, dayjs. Anything else needs
   orchestrator approval. Dev-only type packages (`@types/*`, `maplibre-gl`
   for types) don't ship.

## Data flow

```
URL ──► $store.url.state ──► component getters ──► core fetchers via
                                                   $store.data.cached(key, fn)
                                                          │
          ECharts option ◄── core/charts builder ◄── core/models / ag compute
                │
        ui/charts/chart.ts (theme, resize, sr-only table) ──► DOM
```

- **`$store.url`** (`stores/url.ts`): `state` holds every key in
  `core/url-schema.ts`, parsed, defaults filled in. Change it only with
  `set(patch)`; writes batch into one `replaceState` per tick, keep the hash,
  omit defaults and keep unknown keys. `section` comes from the hash
  (core/router.ts: now · charts · ag · download · about; legacy
  `#latest`/`#downloader` map). `go(section, patch?, drillDown?)` changes
  section with `pushState` (Back works); `drillDown` pushes inside a section
  too (an Ag tool opened from its card; a Charts variable or sub-view). The
  section nav applies `sectionNavPatch` (Charts inside Charts → the list;
  leaving Charts drops `v`). `hrefFor(section, patch?)` gives the
  real href for a link. In-page anchors (the skip link's `#main`) keep the section.
  Back/forward re-read both. Navigate from UI through `ui/shell/navigate.ts`
  (view transition + scroll + announcement).
- **`$store.data`** (`stores/data.ts` → `core/cache.ts`):
  `cached(key, fetcher, {ttl, retry})` returns one reactive
  `{status: 'loading'|'success'|'error', data, error, refresh()}` per key.
  In-flight requests are shared; stale entries refetch in the background on
  the next read; network/5xx retry twice, 4xx never; a response from an older
  fetch never overwrites a newer one; errors stay until `refresh()`. **The key
  must encode every input of the fetcher** (e.g. `obs:acebozem:hourly:2026-09-17:2026-10-01:air_temp`).
- **`$store.theme`** (`stores/theme.ts`): `current`, `label`, `cycle()`
  (dark → light → high-contrast), `set(t)`. Each change calls `MCO.setTheme`
  and fires one `window` event `mco-theme-change` (`detail.theme`).
- **`$store.station`** (`stores/station.ts`): `catalog` (a Resource), `list`,
  `id` (the `?s=` value once confirmed against the catalog; null while
  loading), `current` (its row), `byId(id)`, `select(id)` (sets `s` and resets
  the Latest cards), `recent` (last 5). It rewrites NWSLI / mis-cased `?s=` to
  the catalog id and remembers every confirmed station (core/stations/recent.ts).
  With no `?s=`, main.ts puts the remembered station in the URL before the
  stores start; with none, the station picker opens.

Per-station fetches shared by sections (latest obs, ppt summary, NWS, photos, one-pagers, station
config) are one function each in `ui/station/resources.ts`; a section's own fetches sit beside it
(e.g. `ui/now/resources.ts`).

Former TanStack hooks map to `cached()` keys with these TTLs (keep them):
stations / elements 1 h; station config, ppt summary, NWS forecast 30 min;
observations 5 min (default); latest obs 5 min; Ag series 10 min; soil
params, GDD stages, normals `Infinity`; photo schedule 60 min, latest frames
5 min, current-month manifest 5 min, past months `Infinity`; Ag gridpoint
forecast: 1 h (5 min when degraded, `retry: false`).

### Time

All user-facing stamps are Mountain Time (`MCO.formatStampMT` etc.). Chart
models carry **Denver wall-clock ms** (the API's local reading parsed as if
UTC; `core/sensorEvents.ts#parseWallClock`); chart builders set
`useUTC: true`. Never `new Date(string)` on a date-only string (Safari / UTC
day shift); parse by hand or with dayjs formats.

## Theming reaches charts and maps through one event

Kit tokens are CSS custom properties on `<html data-theme>`. Canvas renderers
cannot read them, so:

- **Charts:** `ui/charts/chart.ts` resolves the tokens it needs with
  `getComputedStyle(document.documentElement)` into a `ChartTheme`
  (`core/charts/types.ts`), passes it in the builder `ctx`, and on
  `mco-theme-change` rebuilds the option and calls `setOption`. Data colors
  come from `core/palette` for the current theme.
- **Maps:** `ui/map/map.ts` on `mco-theme-change` calls
  `map.setStyle(MCO.map.cartoStyleUrl())` and re-adds its sources/layers in
  `map.once('style.load', …)` (hillshade first, then boundaries, then data).

## How to …

**Add a chart.** (1) If the data needs shaping, add a model to
`core/models/<name>.ts` + test. (2) Add a pure builder
`core/charts/<name>.ts` of type `ChartBuilder<M>` + a `…Table(model)` twin +
test (see `core/charts/README.md`). (3) In the component, pass the model and
builder to the chart host. No colors outside `core/palette`.

**Add a card.** Markup in `partials/<section>/<card>.html` inside a
`.dash-card`, included from the section's `index.html` with
`<!-- @include partials/<section>/<card>.html -->`.
Component `ui/<section>/<card>.ts` exporting a factory that returns
`component({...})` (`ui/component.ts` types `this`). Register it in
`main.ts` with one `Alpine.data('<name>', factory)` line. Fetch through
`$store.data.cached`; put any logic in `core/`.

**Add a section.** (1) An entry in `SECTIONS` (`core/router.ts`) + its
router test. (2) A link in both navs in `partials/shell.html` (the
`.dash-sections` row and the `.dash-tabbar` with an icon; same
`data-section`). (3) A `<section id="section-<id>" class="tab-panel">` in
`.dash-section-host` that includes `partials/<id>/index.html`. (4) Wrap that
partial's root in `<template x-if="$store.url.section === '<id>'">` so it
mounts, and fetches, only while open; components undo in `destroy()` whatever
they add outside themselves (listeners, maps, charts). Its URL keys are
prefixed `<id>_` in the schema.

**Add a Now tile.** (1) In `core/overview/tiles.ts`, push a `Tile` in
`tiles()` when the station reports the value (read it in
`core/overview/conditions.ts` if it is a new `/latest` column), with its
`vars` (display variables; the tile opens the first one's Charts page) and a `SeriesKey` for the
sparkline; add the element code to `SPARK_ELEMENTS` (or
`OPTIONAL_SPARK_ELEMENTS`) and its column to `keyFor` in `series.ts`. (2) A
test in `core/overview/overview.test.ts`. The partial renders every tile
from the model, so no markup is needed unless the tile has a custom block
(like `windDeg` or `soil`); styling hooks are `.now-tile--<id>`.

**Add a variable (Charts).** A variable is a display name from the
station's `/elements` (`latestVarsFromElements`: `description_short` before
"@"), so a new API element already shows under Other with its element code
as id. To place it: (1) its element-code prefix in `ELEM_MAP` and axis title
in `AXIS_MAPPER` (`core/params/latest.ts`; the first `ELEM_MAP` code is its
`v=` id), and a column rule in `variableForColumn` (`core/params/columns.ts`)
if its column name is not "<name> [unit]"; (2) its group and position in
`GROUPED` (`core/variables/catalog.ts`), and `SUMMED` if it is a total
(bars, a total stat, a cumulative history); (3) a color in `core/palette`
(`variableStyle`) or it takes a preview color; (4) a line in
`core/variables/catalog.test.ts`. The list, variable page, history and
Compare need no other change.

**Add a layout primitive.** Framework-free first: CSS on kit tokens in
`ui/layout/<name>.css` and, if it has behaviour, a vanilla
`init<Name>({…})` in `ui/layout/<name>.ts` (no Alpine, no stores); then a
thin Alpine wrapper elsewhere. Log what the kit lacks in KIT-NOTES.md.

**Add a URL key.** One entry in `URL_SCHEMA` (`core/url-schema.ts`) with its
parser and default, a line in that file's key map, and a test. Read it as
`$store.url.state.<key>`, write it with `$store.url.set({ <key>: v })`.

**Add a color.** Only in `core/palette` (ramps + per-theme roles), with a
contrast comment naming the surface and WCAG criterion; the palette test
checks it against the kit tokens snapshot. Chrome colors are kit tokens
(`var(--…)`), never hexes.

**Add a store.** Rarely. A factory in `stores/`, one `Alpine.store` line in
`main.ts` (order matters: `init()` runs on registration and may read the
stores registered above it), and a line in `types/alpine.d.ts`.

## Kit usage

Version and SRI hashes live only in `index.html`; a bump follows the kit's
MIGRATING.md and the `vite/indexHtml.test.ts` guard (pinned, SRI'd, one
version, CSP hash matches the inline anti-flash script byte for byte).
`'unsafe-eval'` in `script-src` is for Alpine's standard build (it compiles
`x-*` expressions with `Function`); accepted for a static, read-only app.
Expressions in HTML stay limited to property/method calls on typed components.

Use: `.mco-navbar` family, `.nav-btn` (`[aria-pressed]` for toggles,
`[aria-current]` for section links — app CSS), `.seg-btns`, `.mco-btn-info`,
`<dialog class="mco-modal">` + `MCO.initInfoModal`, `MCO.showToast`,
`.mco-panel` (floating over maps only; it is absolutely positioned),
`MCO.createLiveRegion` (via `ui/shell/live.ts#announce`), `MCO.viewport`,
`MCO.reducedMotion()`, `MCO.map.*`, `.mco-scrim`. localStorage keys other
than `mco-theme` are `mco-dashboard-*` and re-validated on read:
`mco-dashboard-station`, `mco-dashboard-recent`, `mco-dashboard-drawer`
(station picker, `core/stations/recent.ts`); sessionStorage holds
`mco-dashboard-outage-<id>`. Where the kit has no piece (drawer, sheet, tab
bar, card, skeleton, type scale, transitions) the app's version lives in
`ui/layout/` under a `dash-` name with a proposed `mco-` name in KIT-NOTES.md.

## Accessibility (HOUSE-STYLE §5, all mandatory)

Skip link + `<main id="main" tabindex="-1">`; live region for canvas changes;
an `.sr-only` table twin per chart (rendered by the chart host); kit focus
ring only (no per-selector focus rules); ≥ 40 px touch targets under
`(hover: none)`; `aria-pressed` drives toggle styling; keyboard twin for every
pointer gesture; decorative icons `aria-hidden`; dialogs labelled, Esc closes,
focus returns; drawers and sheets move focus in, make the background `inert`
while modal, close on Esc and return focus (`ui/layout/focusScope.ts`).
`npm run verify` runs axe on its scenarios (Now, the picker on a first visit and opened with a station,
the Charts list, a variable page in each view, Compare, Ag tools + 4 Ag views, Download (step 1 and step 3
on phones), About, Help) × 1440/390 px × 3 themes (`scripts/verify/axe.mjs`). A known gap expected to
fail until a fix lands is a `known(…)` in the verify scripts: printed, not failing; make it a `check` then.

## Testing

- Everything in `core/` has a sibling `*.test.ts`; vitest runs in Node
  (`vitest.config.ts`). Ag fixtures in `core/ag/__fixtures__` are the golden
  parity data; live cross-checks run with `AG_LIVE=1`.
- Stores keep their logic in core (`cache.ts`, `url-schema.ts`, `theme.ts`,
  `stations.ts#confirmedStation`), so they need no DOM tests.
- UI is verified with Playwright: `scripts/verify/` (kit-consumer, axe,
  keyboard and phone layout/touch/motion checks on the built app, API from fixtures) and
  `scripts/fidelity/` (web-next vs web/ and `/derived` on the live API; its
  `CHECKLIST.md` is the legacy-parity audit).

## Bundle budget

`scripts/check-size.mjs`: the entry chunk ≤ 200 KB gzip and all JS ≤ 450 KB
gzip. Measured at W1: entry (Alpine + core + shell, controls, map and chart hosts) 43 KB; tree-shaken
ECharts, a lazy chunk loaded on the first chart render (`ui/charts/echarts.ts`), 233 KB; 268 KB in all,
leaving ~180 KB for the sections; at the UX P0 prototype the entry is 107 KB and all JS 328 KB
(the Now page does not need the ECharts chunk unless it shows the wind rose). The Plotly build this replaces shipped
~4.6 MB. Raising a budget needs a reason in the PR.

## Rules carried from web/

Data from mesonet2 v2 at QC level 2; Ag computed client-side except SWP and
porosity (`/derived`); photos only from data2 `webp_large`; soil and GDD
static data vendored in `public/data/` (`core/ag/data/vendor-static.mjs`);
Satellite hidden. `web/` is frozen: hotfixes only, each mirrored into
`core/` in the same PR. Intentional behaviour changes go in `DIVERGENCES.md`.
