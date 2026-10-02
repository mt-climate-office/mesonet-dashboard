# web-next architecture

The Montana Mesonet Dashboard, rebuilt on the MCO house style
([mco-web-style](https://github.com/mt-climate-office/mco-web-style) @0.7.1)
with Alpine.js, Apache ECharts and TypeScript. Preview at
`/mesonet-dashboard/next/`; it replaces `web/` at cutover.

Read this file first. It is short on purpose: if something here is unclear,
fix this file in the same PR.

## Commands

```sh
npm ci
npm run dev        # http://localhost:5174/mesonet-dashboard/next/ (API proxied at /_api)
npm test           # vitest, Node only
npm run typecheck && npm run lint
npm run build && npm run size   # size = bundle budget gate
npm run verify     # build + Playwright: kit-consumer checks, axe matrix, keyboard walks
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
  ui/       thin Alpine components (Alpine.data) + their CSS
  types/    globals from the CDN (window.MCO, maplibregl) and $store typing
  main.ts   URL fix-ups → register stores → register components → Alpine.start()
partials/   HTML, one file per tab/card, inlined into index.html at build
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
  omit defaults (Ag `var` stays once set) and keep unknown keys. `tab` comes
  from the hash; `setTab(t)` or a plain `<a href="#ag">` switches tabs.
  Back/forward re-read both.
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
  the Latest cards). It rewrites NWSLI / mis-cased `?s=` to the catalog id.

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

**Add a card.** Markup in `partials/<tab>/<card>.html`, included from the
tab's `index.html` with `<!-- @include partials/<tab>/<card>.html -->`.
Component `ui/<tab>/<card>.ts` exporting a factory that returns
`component({...})` (`ui/component.ts` types `this`). Register it in
`main.ts` with one `Alpine.data('<name>', factory)` line. Fetch through
`$store.data.cached`; put any logic in `core/`.

**Add a tab.** Add it to `core/tabs.ts`, a link in `partials/shell.html`
(`.controls`), a `<section class="tab-panel">` in `<main>` that includes
`partials/<tab>/index.html`, and its URL keys (prefixed `<tab>_`) to the schema.

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
`[aria-current]` for tab links — app CSS), `.seg-btns`, `.mco-btn-info`,
`<dialog class="mco-modal">` + `MCO.initInfoModal`, `MCO.showToast`,
`.mco-panel` (floating over maps only; it is absolutely positioned),
`MCO.createLiveRegion` (via `ui/shell/live.ts#announce`), `MCO.viewport`,
`MCO.reducedMotion()`, `MCO.map.*`. localStorage keys other than
`mco-theme` are `mco-dashboard-*` and re-validated on read.

## Accessibility (HOUSE-STYLE §5, all mandatory)

Skip link + `<main id="main" tabindex="-1">`; live region for canvas changes;
an `.sr-only` table twin per chart (rendered by the chart host); kit focus
ring only (no per-selector focus rules); ≥ 40 px touch targets under
`(hover: none)`; `aria-pressed` drives toggle styling; keyboard twin for every
pointer gesture; decorative icons `aria-hidden`; dialogs labelled, Esc closes,
focus returns. W3 runs axe on 3 tabs × 1440/390 px × 3 themes.

## Testing

- Everything in `core/` has a sibling `*.test.ts`; vitest runs in Node
  (`vitest.config.ts`). Ag fixtures in `core/ag/__fixtures__` are the golden
  parity data; live cross-checks run with `AG_LIVE=1`.
- Stores keep their logic in core (`cache.ts`, `url-schema.ts`, `theme.ts`,
  `stations.ts#confirmedStation`), so they need no DOM tests.
- UI is verified with Playwright against the dev server and the built Pages
  artifact (W3 adds the fidelity harness and axe matrix).

## Bundle budget

`scripts/check-size.mjs`: the entry chunk ≤ 200 KB gzip and all JS ≤ 450 KB
gzip. Measured at W1: entry (Alpine + core + shell, controls, map and chart hosts) 43 KB; tree-shaken
ECharts, a lazy chunk loaded on the first chart render (`ui/charts/echarts.ts`), 233 KB; 268 KB in all,
leaving ~180 KB for the tabs. The Plotly build this replaces shipped
~4.6 MB. Raising a budget needs a reason in the PR.

## Rules carried from web/

Data from mesonet2 v2 at QC level 2; Ag computed client-side except SWP and
porosity (`/derived`); photos only from data2 `webp_large`; soil and GDD
static data vendored in `public/data/` (`core/ag/data/vendor-static.mjs`);
Satellite hidden. `web/` is frozen: hotfixes only, each mirrored into
`core/` in the same PR. Intentional behaviour changes go in `DIVERGENCES.md`.
