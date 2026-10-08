# Kit conflict matrix (mco-web-style @0.7.1)

Per the kit's MIGRATING.md step 1. web-next is a rewrite, so "app value" is
what `web/` (React + Mantine) does today and "decision" is what web-next does.
Classes: **IDENTICAL** (nothing to do), **DRIFT** (decision needed),
**KIT-NEW** (adoption decision), **APP-SPECIFIC** (keep, untouched).
Settled precedents (MIGRATING.md) and pure-WCAG fixes are applied without asking.

| Area | Item | web/ today | Kit | Class | web-next decision |
|---|---|---|---|---|---|
| Head | Kit CSS/JS | none | pinned @0.7.1 + SRI | KIT-NEW | adopted (settled) |
| Head | Anti-flash script | none (light only) | `snippets/anti-flash.html` inline | KIT-NEW | adopted verbatim; CSP hash guarded by `vite/indexHtml.test.ts` |
| Head | `viewport-fit=cover` | absent | required | KIT-NEW | adopted (WCAG/settled) |
| Head | Meta CSP | none | meta CSP pattern | KIT-NEW | adopted; adds `'unsafe-eval'` for Alpine (documented) |
| Head | Favicons / OG card | app `favicon.svg`, no OG | kit-hosted favicon set; own og-card (`public/og-card.png`, `npm run og-card`) | KIT-NEW | adopted kit favicons; the kit's og-card is a Station Status screenshot |
| Head | Page title | "Montana Mesonet Dashboard" | `<Short> · <Family>` | DRIFT | `Dashboard · MT Mesonet` (§1 rule, plan); `<Station> · Dashboard · MT Mesonet` once a station is selected (DIVERGENCES "Page title") |
| Tokens | Colors | Mantine blue + 144 hard-coded hexes | tokens, 3 themes | DRIFT | tokens only; data colors → `core/palette` (W1) |
| Tokens | Themes | light only | dark / light / high-contrast | KIT-NEW | all three (user decision) |
| Tokens | `--text-dim`, `--accent-line` semantics | n/a | kit values | IDENTICAL | adopted (settled) |
| Typography | Fonts | system stack | Outfit + Space Mono, preloaded | DRIFT | adopted |
| Shell | Navbar | Mantine AppShell header | `.mco-navbar` lockup | KIT-NEW | adopted; brand "Mesonet Dashboard" as `<h1 class="brand-title">` |
| Shell | Navbar position | fixed header | `position: relative` | DRIFT | `sticky` override (page scrolls) — see Q4 |
| Shell | Logo | `MCO_logo.svg` in public | vendored `mco-logo.png` 40 px | DRIFT | kit logo vendored to `public/` |
| Shell | ≤750 px brand collapse | n/a | collapse to badge | KIT-NEW | kit default kept |
| Shell | Tabs | Mantine Tabs (`role=tab`) | none (toggles use `aria-pressed`) | DRIFT | `<a class="nav-btn" href="#…">` + `aria-current` override — Q1 |
| Buttons | Share / Feedback / Help | Mantine buttons | `.nav-btn` + `.btn-label`, `.mco-btn-info` | KIT-NEW | adopted, permanent `aria-label`s |
| Buttons | Theme toggle | none | `MCO.initThemeToggle` (2-state) | DRIFT | own 3-state cycle on `MCO.setTheme` — Q2 |
| Buttons | Segmented / chips | Mantine SegmentedControl / Chip | `.seg-btns`, `[aria-pressed]` | KIT-NEW | W1 controls build on these |
| Panels | Cards | Mantine Paper | `.mco-panel` (absolute, over maps) | APP-SPECIFIC | tab cards get small app CSS on tokens; `.mco-panel` only over maps |
| Modal | Help / outage | Mantine Modal | `<dialog class="mco-modal">` + `initInfoModal` | KIT-NEW | adopted (Esc, backdrop, focus return verified) |
| Toast | Notices | Mantine notifications | `MCO.showToast` 2800 ms | KIT-NEW | adopted (settled duration) |
| Tooltip | Chart hover | Plotly hover | `.mco-tooltip` | APP-SPECIFIC | ECharts tooltip styled from tokens (W1 chart host) |
| Map | Library | MapLibre 5.24 via npm (react-map-gl) | MapLibre 5.18.0 CDN + SRI | DRIFT | kit pin adopted — Q3 (security advisory) |
| Map | Basemap | Positron only | `cartoStyleUrl()` themed | KIT-NEW | adopted (W1 map host) |
| Map | Controls / framing | custom | `addNavigation` (no compass), `addFitControl`, `installZoomFloor`, `MT_FIT_BOUNDS` | KIT-NEW | adopted (settled) |
| Map | Hillshade, counties, tribal, hide `boundary_county` | counties only | `addHillshade`, `overlayPaints`, `TRIBAL_LABEL_LAYOUT` | KIT-NEW | adopted (settled precedent) |
| Map | Boundary GeoJSON | `public/mt_counties.geojson` | `map/data/*_simple.geojson` | DRIFT | W1 vendors the kit files |
| Charts | Library | Plotly (4.6 MB) | none (kit-deferred palettes module) | APP-SPECIFIC | ECharts, builders in `core/charts`, palette in `core/palette` |
| Charts | Palette | Viridis / Tol / legacy hexes | §6 CVD policy, no Spectral | DRIFT | full house palette (user decision); DIVERGENCES "House style" |
| A11y | Skip link + `<main id="main" tabindex="-1">` | absent | required | KIT-NEW | adopted (pre-authorized) |
| A11y | Live region | absent | `MCO.createLiveRegion` | KIT-NEW | adopted (`ui/shell/live.ts`; tab switches announced) |
| A11y | sr-only table twin | absent | required for canvas | KIT-NEW | chart host renders one per chart (W1) |
| A11y | Focus ring | Mantine | universal `:focus-visible` | KIT-NEW | adopted; no per-selector rules |
| A11y | Reduced motion | none | CSS blanket + `MCO.reducedMotion()` | KIT-NEW | adopted; ECharts/MapLibre animations gate on it |
| A11y | Touch targets | Mantine sizes | ≥ 40 px under `(hover: none)` | KIT-NEW | kit components; app controls match |
| State | URL | nuqs, hash tabs | URL > localStorage > default; `MCO.replaceUrlState` | DRIFT | own `$store.url` (kit helper drops the hash, which is our tab) |
| State | localStorage | none | `mco-theme` shared, `mco-<app>-*` | KIT-NEW | `mco-theme` + `mco-dashboard-*` |
| Time | Stamps | dayjs local | MT helpers | IDENTICAL | MT everywhere (settled) |
| Fetch | Cache / retry | TanStack Query | `MCO.promiseCache`, `fetchJSON` | APP-SPECIFIC | `core/cache.ts` (reactive, TTL, retry policy the kit lacks) |
| Footer | Credit | none | "Montana Climate Office · climate.umt.edu" | KIT-NEW | adopted; Downloader keeps BLM footer |

## Questions for Kyle (batch 1)

1. **Tab links.** web-next's tabs are `<a class="nav-btn" href="#ag">` with
   `aria-current="page"`, styled by a local rule that mirrors the kit's
   `[aria-pressed="true"]` look. The kit has no navigation-state style.
   Recommend (2) app override now, tagged; back-port when a second app needs
   it. **(1) adopt kit** (render tabs as `aria-pressed` toggles) **· (2) app
   override · (3) back-port `.nav-btn[aria-current="page"]` to the kit?**
2. **Theme toggle.** The plan wants dark → light → high-contrast in one
   button; `MCO.initThemeToggle` is 2-state (dark ↔ light, HC only by URL).
   web-next cycles itself on `MCO.setTheme` and sets the `aria-label` to the
   next theme. Recommend (2) app-local now; (3) as a `cycle: true` option if
   another app asks. **(1) adopt kit 2-state · (2) app override · (3)
   back-port a 3-state option?**
3. **MapLibre pin.** The kit pins `maplibre-gl@5.18.0`; npm audit flags it
   critical (GHSA-jrc7-96c5-q579, XSS bypass in `DOM.sanitize`, fixed after
   6.4.0). It matters only if popups render HTML built from untrusted data.
   Recommend (3): open a kit issue to bump the family pin; meanwhile
   web-next keeps 5.18.0 and builds popups with DOM APIs/`setText`, never
   `setHTML` on API strings. **(1) keep kit pin · (2) app pins a patched
   MapLibre · (3) bump the kit pin?**
4. **Navbar on phones.** The kit bar is `position: relative`; web-next makes
   it `sticky` (long scrolling tabs). At 390 px the three tab links plus four
   icon buttons wrap to two rows (~92 px). Recommend (2): keep sticky and the
   two-row wrap for the preview; W1 controls revisits a compact tab
   `<select>`/drawer if the wrap is judged too tall. **(1) adopt kit
   (static bar) · (2) app override as built · (3) back-port a sticky option?**

## Decisions (batch 1, 2026-10-01)

| # | Decision | Follow-up |
|---|---|---|
| 1 | Tab links with `aria-current="page"`: **app override** (tagged) | kit issue [mco-web-style#3](https://github.com/mt-climate-office/mco-web-style/issues/3) |
| 2 | 3-state theme toggle: **app override** | kit issue [#3](https://github.com/mt-climate-office/mco-web-style/issues/3) (`cycle: true`) |
| 3 | MapLibre: **keep kit pin 5.18.0**; popups via DOM/`setText`, never `setHTML` on API strings | kit issue [#1](https://github.com/mt-climate-office/mco-web-style/issues/1) (bump the pin) |
| 4 | Sticky navbar, two-row wrap at 390 px: **app override as built** | kit issue [#4](https://github.com/mt-climate-office/mco-web-style/issues/4) |
| — | Form errors: `--text-primary` + ⚠ + heavier edge until the kit has a token | kit issue [#2](https://github.com/mt-climate-office/mco-web-style/issues/2) |
| — | SWP heatmap (BrBG): labelled midpoint at the **wilting point, 15 bar** | `core/palette/roles.ts` `HEATMAP.swp` |

## Decisions (W4, 2026-10-02)

| # | Decision | Follow-up |
|---|---|---|
| — | **Kit touch targets: exemption, no kit issue.** Under `(hover: none)` the kit's MapLibre controls (29 px), the attribution button (24 px) and `.mco-panel-toggle` (36 px) are below HOUSE-STYLE §5.5's 40 px. The user declined a kit issue. The verify touch-target check exempts exactly these three selectors (`scripts/verify/lib.mjs#smallTargets`, run by `axe.mjs`). Reason: this is kit-owned chrome that the app must not patch locally (CLAUDE.md: change the kit, never a local copy), and every map control has a keyboard or sr-table twin. | Revisit if the kit changes its map chrome |
| — | Latest sidebar collapse (LDC-002): **added**, wide screens only, persisted in localStorage `mco-dashboard-sidebar` (not the URL) | DIVERGENCES "Latest Data › Layout" |
