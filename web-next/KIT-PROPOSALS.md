# Kit proposals from the mesonet-dashboard redesign

**For:** the maintainer of `mt-climate-office/mco-web-style` (kit at v0.7.1, with 0.8.0 planned in `CHANGELOG.md § Unreleased`).
**From:** the mesonet-dashboard `web-next` rewrite (Alpine + TypeScript + ECharts + MapLibre, on kit 0.7.1). The rewrite is the seventh kit consumer and the first with charts, forms and long scrolling pages.
**Status:** proposals only. No kit issues or PRs have been opened from this document. The four existing issues (#1–#4) are referenced where they fit.

## How to read this

- **Evidence** cites `repo/path:line` at the commits checked on 2026-10-02. The short names are:
  - `explorer` = mesonet-explorer
  - `status` = mesonet-status
  - `photos` = mesonet-photo-explorer (`docs/`)
  - `maint` = mesonet-maintenance
  - `umrb` = mesonet-umrb-build
  - `snow` = mco-snowpack-explorer
  - `dash` = mesonet-dashboard `web-next/`
  - `kit` = mco-web-style
- **Priority:**
  - **P0** is a shipped a11y or correctness defect, or a blocker for the next migrations.
  - **P1** is duplication across two or more properties that is costing consistency today.
  - **P2** is a candidate. It is waiting for a second consumer under the admission rule (AGENTS.md rule 5).
- **Version** follows the kit's semver (README § Versioning):
  - **PATCH** = a fix with no change to any selector, token, signature or default.
  - **MINOR** = additive.
  - **MAJOR** = any rename, removal or change of default.

  Wherever a proposal would change a default, it ships **opt-in in a MINOR** and flips in **1.0.0**.
- **Conventions every proposal keeps:**
  - Tokens only, and `--accent` is fill-only.
  - `aria-pressed` (toggles) and `aria-current` (navigation) drive styling.
  - `[hidden]` takes collapsed content out of the tab order.
  - The z-index ladder: add to a tier, never invent a number.
  - The live `MCO.reducedMotion()` gate.
  - `MCO.viewport` for behavior; real `@media` for layout.
  - Classic scripts on `window.MCO`. No build, no dependencies.
  - New tokens go in all three theme blocks **and** `tokens/tokens.json`.
  - New components get exercised in `demo/`.

## 0. What the survey found

Six adopters are on 0.7.1, and all are vanilla JS. The dashboard is the seventh consumer. The table shows who builds each pattern locally (L) or doesn't have it (—).

| Pattern | explorer | status | photos | maint | umrb | snow | dash |
|---|---|---|---|---|---|---|---|
| Off-canvas drawer | L, no Esc/focus/inert | — (deferred) | — | — | — | — | L (P0 branch) |
| Bottom sheet, peek/full/drag | L | — (popup on phones) | — (dialogs) | — (popup on phones) | — (popup on phones) | — | L (P0 branch) |
| Search combobox | L | L | L | L | L | — | L (APG, tested) |
| Legend toggle rows | L (accessible dim) | L (`.off` 0.4, fails) | — | L (`.off` 0.4) | L (`.off` 0.4) | static | ECharts default |
| Chips | — | L | — | L | L | — | L |
| Stepper | L | — | L | — | — | L (no keyboard) | — |
| Segmented → narrow fallback | label swap | wraps at 1280 | `<select>` at 1060 | wraps at 1200 | wraps at 1200 | `nowrap` | radio fieldset |
| Hidden-table twin | L (best) | L | L | L | L | **none** | L (map + every chart) |
| Live region | hand `#sr-announce` | hand | `createLiveRegion` | hand | hand | hand (double-announces) | wrapper with clear-then-set |
| URL writes | raw `replaceState` | kit | kit | kit | kit | raw, never clean | own store (keeps hash) |
| Basemap failure | none | none | none | none | none | none | toast + one retry |
| Loading UI | bar + Retry card | stamp (hidden < 640) | none | stamp | stamp + `aria-busy` | none | spinner / "Updating…" |
| Popup content | `innerHTML` (escaped) | `setHTML` (escaped) | — | `setHTML` (**one raw URL**) | `setHTML` (escaped) | — | DOM + `textContent` |
| `kit-override` tags | 1 | 0 | 1 (+1 orphan) | 0 | 0 | 0 | 10 |

The headline: **every map app builds the same five or six components by hand, and the kit's own tag for overrides is almost never used.** Only 2 of the 6 adopters tag anything; most overrides are untagged. That makes the drift invisible to the "a second app wants the same override, so it's a kit change" rule (AGENTS.md "When consuming"). Section 8 proposes a mechanical fix.

---

## 1. Layout primitives

### L1. Off-canvas drawer — `.mco-drawer` + `MCO.initDrawer` · P0 · 0.9.0 (MINOR)

**Problem.**
- HOUSE-STYLE §3 sanctions "relocating `.controls` into an off-canvas drawer". It names mesonet-explorer as the reference and mesonet-status as the first kit consumer (deferred 2026-08-04). The kit still ships only `.mco-scrim` (`kit/theme/mco-theme.css:637-641`).
- The reference implementation is an a11y defect:
  - Esc doesn't close it. `explorer/app.js:3484-3488` only closes the spider and popup.
  - Focus neither moves in on open nor returns to `#btn-drawer` on close.
  - Nothing behind it is `inert`.
  - Closed, it is only `translateX(-100%)` (`explorer/index.html:552`), so its controls stay in the tab order and the accessibility tree.
  - On a phone, `/` focuses a search field inside the closed, off-screen drawer (`explorer/app.js:3498`).
- The dashboard's P0 prototype is building a second drawer (its compact Latest sidebar, LDC-002). mesonet-status needs one for its control-dense bar.

**Proposed API.**
```html
<button class="nav-btn icon-only" id="btn-drawer" aria-label="Filters"
        aria-expanded="false" aria-controls="drawer">…</button>
<aside class="mco-drawer" id="drawer" data-side="start" aria-labelledby="drawer-title" hidden>
  <div class="mco-drawer-head"><h2 id="drawer-title" class="mco-panel-title">Filters</h2>
    <button class="modal-close" data-close-drawer aria-label="Close filters">×</button></div>
  <div class="mco-drawer-body">…</div>
</aside>
<div class="mco-scrim" data-scope="container" hidden></div>
```
```js
const drawer = MCO.initDrawer({
  drawer, toggle, scrim,          // scrim optional
  inertRoots: [mapEl, mainEl],    // made inert while modal-open (default: the drawer's siblings)
  modal: 'compact',               // 'always' | 'compact' | 'never'; on desktop it can be a docked column
  initialFocus: null,             // element or selector; default is the first focusable element
  onChange(open) {},              // e.g. map.resize(), pushState
});
// → { open(), close({restoreFocus}), toggle(), isOpen(), destroy() }
```
- **CSS.**
  - It sits at `--z-drawer`. Width is `min(var(--drawer-w, 320px), 88vw)`.
  - `[data-side="start"|"end"]`.
  - Edge padding uses `max(1rem, env(safe-area-inset-*))`.
  - The slide transition goes through `--transition` (the reduced-motion blanket clamps it).
  - Once the close transition ends, the drawer gets `[hidden]`, the same mechanics as `initCollapsible` (`kit/core/mco-core.js:337-367`).
- **`modal: 'compact'`** means the drawer behaves as a modal surface only when `MCO.viewport.isCompact()`. When the viewport widens past compact, the drawer is torn down to a docked column, and that change fires `onChange`. This is the explorer's desktop-column / phone-drawer pattern.

**A11y contract.**
- Open moves focus to `initialFocus`. Close returns focus to the toggle, or to the opener if a shortcut opened it.
- Esc closes. Shared Esc precedence is described in I1.
- While the drawer is modal-open, `inertRoots` get `inert`. Tab cycling stays inside the drawer because everything else is inert, so no focus-trap loop is needed.
- The toggle carries `aria-expanded`. The drawer is a labelled `aside`/`region`, **not** `role=dialog`. It is a disclosure that also makes the rest inert. HOUSE-STYLE should say which pattern to use when; see I1.
- Close button: `.modal-close`, which is 44 px on touch.
- On close, the drawer gets `[hidden]`, so no control is reachable off-screen.

**Migration.**
- explorer: replace the `app.js:3361-3479` drawer logic and the `index.html:541-563` CSS. Keep `#sidebar-scrim` only until L5 ships.
- status: becomes the second consumer for the deferred controls drawer.
- dash: adopt in place of the P0 branch's local drawer.
- maint, umrb, photos, snow: nothing to do until they need one.

**Effort/risk.** M, about 120 lines of JS and 40 of CSS. The risk is the inert scope: inerting `<main>` when the drawer is inside `<main>` would inert the drawer itself. Mitigation: default to inerting siblings along the drawer's ancestor chain, the pattern `inert` polyfills use. Demo and axe coverage are required.

---

### L2. Bottom sheet with peek/full/drag — `.mco-sheet` + `MCO.initSheet` · P0 · 0.9.0 (MINOR)

**Problem.**
- HOUSE-STYLE §3 says detail panels on compact use a bottom sheet: "peek state, drag-up, and it must lift bottom-corner map controls and the toast (`--sheet-h`)". Only explorer has one (`explorer/index.html:821-933`, `app.js:2979-3171`).
- status, maint and umrb show the anchored 320–340 px MapLibre popup at every width (`status/app.js:1304-1307`, `maint/app.js:1180-1183`, `umrb/app.js:1182,1205`). That is what the compact flag exists to prevent (`kit/core/mco-core.js:148-152`).
- status never uses `MCO.viewport` at all.
- The dashboard's P0 branch is building the second sheet: station detail on Latest at phone widths.

**Proposed API.**
```html
<section class="mco-sheet" id="station-sheet" aria-labelledby="sheet-title" data-state="closed" hidden>
  <button class="mco-sheet-grip" aria-label="Expand details" aria-expanded="false"></button>
  <header class="mco-sheet-head"><h2 id="sheet-title">…</h2><button class="modal-close" data-close-sheet aria-label="Close">×</button></header>
  <div class="mco-sheet-body">…</div>
</section>
```
```js
const sheet = MCO.initSheet({
  sheet,
  states: ['peek', 'full'],      // detents; 'half' optional
  peekHeight: 'auto',            // 'auto' = head height; or a px number
  dock: 'compact',               // below compact it docks at the bottom; above, at the end side (explorer)
  dismissible: true,             // drag below peek, or Esc, closes it
  publishMetric: true,           // writes --sheet-h on <html> (see L6)
  onState(state) {},             // 'closed' | 'peek' | 'full'
});
// → { open(state='peek', {opener}), close({restoreFocus}), setState(s), state(), destroy() }
```
- **Drag.** Pointer Events on the grip and head only, never the body, so the body scrolls. A drag snaps to the nearest detent, or to the next one when the fling velocity exceeds 0.5 px/ms. Under `MCO.reducedMotion()` the snap is instant.
- **Height.** Uses `100dvh` math, never `100vh`.
- **Layering.** It sits at `--z-detail` (60), so it stays below the drawer and the chrome, as the ladder already intends (`kit/theme/mco-theme.css:235`).

**A11y contract.**
- **Keyboard twin for the drag.** The grip is a `<button>` whose `aria-expanded` flips between peek and full. Enter/Space steps the detent, and ArrowUp/ArrowDown move between detents. This satisfies HOUSE-STYLE §5.8.
- **Focus.** Open moves focus to the sheet's heading (`tabindex=-1`), as explorer does (`app.js:3079`). Close returns it to the opener, or to the map canvas as a fallback (explorer `app.js:3009-3016`).
- **Esc.** Esc closes the sheet, following the I1 precedence.
- **Not modal.** At peek the map stays usable, so no `inert` is applied. In the `full` detent on compact the sheet becomes modal, and `inertRoots` (as in L1) apply.
- **Announcing.** Opening a station announces "Station X opened" through the shared live region (I6).
- **Touch targets.** The grip is at least 44 × 24 px visible, with a 44 × 44 px hit area.

**Migration.**
- explorer: replace its local sheet (which keeps its `role=dialog aria-modal=false`; recommend dropping the dialog role, since it isn't one).
- status, maint, umrb: on compact, swap `new maplibregl.Popup().setHTML(...)` for `sheet.open()` with DOM content (M4). Above compact, keep the popup.
- dash: adopt it for the station detail.
- photos: keep its native `<dialog>` gallery, which is a true modal.

**Effort/risk.** L, about 220 lines of JS. Drag physics is the riskiest code the kit would own. Two mitigations: lift explorer's implementation, which is the field-proven one, and add a Playwright touch-drag check to the demo.

---

### L3. Mobile tab bar / section nav — `.mco-tabbar` · P2 · candidate (0.10.0 MINOR)

**Problem.**
- The dashboard has three top-level sections (Latest, Ag, Downloader). They are hash links styled as `.nav-btn` with `aria-current="page"` (`dash/DIVERGENCES.md` "Tabs are links"; `dash/src/styles/app.css:16-23`, a kit-override).
- At 390 px they and four icon buttons wrap the navbar to about 92 px (kit issue #4).
- The P0 branch is moving them into a bottom tab bar on compact.
- No map app has sections, so this is **one consumer** today.

**Proposed API (for when a second property appears).**
- `<nav class="mco-tabbar" aria-label="Sections">` holds `<a class="mco-tab" aria-current="page">`, each with an icon and a label.
- Fixed bottom on compact, at `--z-chrome`. It publishes `--tabbar-h` (L6).
- Hidden above compact, where the links return to the navbar.
- No JS: it is links plus `aria-current`.
- Labels never shed: an icon-only tab bar fails 2.5.3 the moment a label is visually abbreviated.

**A11y contract.**
- It is `<nav>` with links, not `role=tablist`. The hash is navigation, and back/forward must work.
- Targets are at least 48 px tall.
- `aria-current` is the styling hook. This is the same ask as #3 part 1, which should land first in 0.8.0.

**Migration.** dash only. **Effort.** S. **Second-consumer watch:** the `mesonet_app` Leaflet pages (`latest`, `stations`, `funding`), if they become one app.

---

### L4. In-flow card / section — `.mco-card` · P1 · 0.9.0 (MINOR)

**Problem.**
- `.mco-panel` is `position: absolute` glass for over-map use (`kit/theme/mco-theme.css:541-550`). The dashboard's chart and table cards are in-flow page sections, so it can't use the panel (`dash/MIGRATION-MATRIX.md:29`). It hand-rolls cards and a full-width segmented override (`dash/src/styles/cards.css:7`, a kit-override).
- The same in-flow shell exists elsewhere under other names:
  - explorer's sidebar legend block (`explorer/index.html:573-700`)
  - explorer's station-sheet sections
  - photos' gallery panels
  - the M/U popup "facts" blocks (`maint/index.html:349-369` = `umrb/index.html:365-383`, byte-identical)

**Proposed API.**
- Structure: `.mco-card` > `.mco-card-head` (`.mco-card-title` + `.mco-card-actions`) + `.mco-card-body`.
- Visuals:
  - `background: var(--bg-surface)`, which keeps the text contract intact: muted and dim text are allowed on surface but not on raised.
  - `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`.
  - Padding from the spacing scale (T2).
- Variants:
  - `.mco-card.is-flush` for tables and charts that run to the edge.
  - `.mco-card.is-glass` = `.mco-panel` visuals without the absolute positioning.
- Collapsible through the existing `MCO.initCollapsible`. No new JS.
- Also `.mco-facts`, a `<dl>` grid for label/value pairs. It replaces the M/U `.pop-facts`.

**Fixes a defect in passing.** `.pop-facts dt` uses `--text-muted` on a `--bg-raised` background (`umrb/index.html:392,396`). That is exactly the failing pair HOUSE-STYLE §2 excludes. `.mco-facts` would use `--text-secondary` for labels.

**Migration.**
- dash: cards.
- maint, umrb: popup facts.
- explorer: sheet sections and sidebar blocks.

**Effort/risk.** S, CSS only.

---

### L5. Scoped scrim — `.mco-scrim[data-scope="container"]` · P1 · 0.8.x (MINOR)

**Problem.**
- The kit scrim is viewport-`fixed` (`kit/theme/mco-theme.css:637-641`).
- explorer needs one that dims the map but not the navbar, so it hand-rolls an `absolute` `#sidebar-scrim` (`explorer/index.html:554-562`).
- HOUSE-STYLE §3 already says: "if a second consumer needs it too, the kit should grow a positioning option." The dashboard's compact drawer is that second consumer, because its navbar must stay usable.

**Proposed API.**
- `data-scope="container"` → `position: absolute; inset: 0`, so the scrim fills its positioned ancestor. The default stays `fixed`, so nothing changes for anyone today.
- The scrim always has `aria-hidden="true"`.
- Clicking it closes its owner. `initDrawer` and `initSheet` wire this up.

**Migration.** explorer: delete `#sidebar-scrim` CSS. dash: use it in the drawer. **Effort.** XS.

---

### L6. Overlay metrics and auto-lift — `--chrome-h`, `--sheet-h`, `--tabbar-h` · P1 · 0.9.0 (MINOR, opt-in) → 1.0.0 default

**Problem.**
- The toast is fixed at `bottom: 1.5rem` (`kit/theme/mco-theme.css:446`). MapLibre's bottom corners sit at the bottom edge.
- explorer hand-lifts both when its sheet opens (`explorer/index.html:124-128, 933`).
- No other app does, so on status, maint and umrb a toast lands on top of the popup's bottom half or the attribution.
- The dashboard's sticky navbar (#4) needs `scroll-padding-top` equal to the navbar's height, or skip-link and hash targets land under it.

**Proposed API.**
```js
MCO.metrics.observe('--chrome-h', navbarEl);    // ResizeObserver → writes the px height on <html>
MCO.metrics.set('--sheet-h', px);               // initSheet / tab bar publish their own
MCO.metrics.get('--sheet-h');                   // number
```
```css
:root { --chrome-h: 0px; --sheet-h: 0px; --tabbar-h: 0px; --overlay-bottom: calc(var(--sheet-h) + var(--tabbar-h)); }
html.mco-autolift .mco-toast { bottom: calc(1.5rem + var(--overlay-bottom) + env(safe-area-inset-bottom)); }
html.mco-autolift .maplibregl-ctrl-bottom-left,
html.mco-autolift .maplibregl-ctrl-bottom-right { bottom: var(--overlay-bottom); transition: bottom var(--transition); }
html { scroll-padding-top: var(--chrome-h); }   /* sticky navbar (#4) */
```
- Lifting is opt-in through the `mco-autolift` class on `<html>` in 0.9.0, and becomes the default in 1.0.0. Toast position is an observable default, which the kit treats as MAJOR.
- These three are layout metrics, not theme tokens, so they don't belong in the three theme blocks. They do get documented in tokens.json under a `metrics` group, so that the parity check knows they exist on purpose.

**A11y.**
- Keeps the toast readable: never under a sheet, a tab bar or the home indicator.
- Keeps attribution reachable (1.4.1 / 2.4.11 Focus Not Obscured, AA in WCAG 2.2).

**Migration.**
- explorer: delete its manual lift rules and call `MCO.metrics.set` from the sheet. That call becomes automatic with L2.
- status, maint, umrb: free once they adopt L2.
- dash: uses `--chrome-h` for its sticky navbar and `--tabbar-h` for its tab bar.

**Effort/risk.** S. **Risk:** `bottom` transitions on the MapLibre corners fight MapLibre's own layout. Mitigation: use `transform: translateY` instead, if the demo shows jank.

---

### L7. First-paint layout hold — `html.mco-booting` · P1 · 0.9.0 (MINOR)

**Problem.**
- 0.7.0 fixed first-paint fonts and the compact class (CHANGELOG § 0.7.0). Apps still paint their layout before their data or URL state settles:
  - explorer keys a local first-paint hold on `.is-compact` (CONSUMERS "Pick up here").
  - The dashboard waits for chart boxes to have a size, plus `document.fonts.ready` (`dash/src/ui/charts/chart.ts:67-111, 89`).
  - photos shows a blank mosaic until it paints (no loading UI at all).
- Without a shared hook, each app picks its own flag and its own timeout.

**Proposed API.**
- The anti-flash snippet adds `mco-booting` to `<html>`.
- `MCO.ready()` removes it and resolves a promise. Apps call it once their first meaningful state is applied.
- A safety timeout removes the class after 3 s anyway, so a JS failure never leaves a page held.
- CSS hooks:
  - `html.mco-booting [data-hold] { visibility: hidden }`: layout is reserved, nothing paints.
  - `html.mco-booting [data-skeleton]` shows skeletons (I3).

**A11y.** Uses `visibility`, not `display`, so there is no layout shift. The hold never hides `<main>` or the skip link.

**Migration.**
- Every consumer re-copies the anti-flash snippet, which means a **new CSP sha256 per page**. Ride it on another snippet change if possible.
- explorer deletes its local hold.

**Effort/risk.** S. **Risk:** the CSP hash churn across 7 pages.

---

## 2. Interaction

### I1. Focus/inert helper for non-dialog overlays — `MCO.overlay` · P0 · 0.9.0 (MINOR)

**Problem.** `MCO.initInfoModal` handles focus correctly for native `<dialog>` (`kit/core/mco-core.js:292-310`). Nothing handles the overlays that are not dialogs, and every app gets them wrong in a different way:
- **explorer drawer:** no focus in, no focus return, no Esc, no inert (L1).
- **status popup:** close doesn't restore focus (`status/app.js:1432-1441`).
- **status global Esc:** closes the popup even while the info modal is open (`status/app.js:1559-1564`). explorer guards this (`app.js:3486`).
- **maint/umrb popups:** opening doesn't move focus and closing doesn't restore it (`maint/app.js:1467-1472`, `umrb/app.js:1396-1397`).
- **dash:** focus moves are ad-hoc `.focus()` calls in five places (`combobox.ts:143`, `multiselect.ts:98,115`, `srTable.ts:79`, `globalNotices.ts:57`).

**Proposed API.**
```js
const ov = MCO.overlay({
  el,                       // the surface
  opener: () => btn,        // captured at open, like initInfoModal
  initialFocus,             // element/selector; default el[tabindex=-1] or its first focusable
  inert: [mapEl],           // optional; [] = non-modal
  escape: true,             // registers on the shared Esc stack
  onClose() {},
});
ov.open(); ov.close({ restoreFocus: true });
MCO.escStack;               // {push(fn), pop(fn)}: the topmost overlay handles Esc; native <dialog> always wins
```
- `initDrawer`, `initSheet`, `initSearchCollapse` (its close) and `initSearchBox` all build on `MCO.overlay`. That gives the family **one Esc precedence order**: native dialog > flyout (combobox listbox) > sheet `full` > drawer > sheet `peek` > popup.
- The dashboard's combobox already stops Esc from propagating so the dialog around it stays open (`dash/src/ui/controls/combobox.ts:176-182`). That is the same rule, implemented locally.
- **HOUSE-STYLE addition:** a short "which overlay is which" table:
  - modal `<dialog>`: info, gallery, lightbox
  - inert-making drawer
  - non-modal sheet
  - flyout (listbox, menu)
  - cursor tooltip (`aria-hidden`, decoration)

**A11y contract.**
- Focus is restored to the opener, or to a supplied fallback when the opener has been removed.
- `inert` is applied and removed symmetrically, even when one overlay opens over another (the code reference-counts inert roots).
- Esc follows a single stack.
- Global single-key shortcuts are suppressed while an inert-making overlay is open.

**Migration.**
- explorer: drawer and sheet.
- status, maint, umrb: popups (or the sheet, via L2).
- dash: all five focus sites.
- snow: its hand-rolled modals (`snow/app.js:841-848, 914-921`) should move to `initInfoModal`. That is an existing helper, so it is a local fix.

**Effort/risk.** M. This is foundational, so it ships with L1 and L2.

---

### I2. History and routing guidance — `MCO.pushUrlState`, hash-preserving writes · P1 · 0.8.0 (MINOR) + HOUSE-STYLE §4

**Problem.**
- `MCO.replaceUrlState` rebuilds the URL as `'?' + qs` or `location.pathname`, so it **drops the hash** (`kit/core/mco-core.js:476-479`). The dashboard keeps its tab in the hash and so cannot use the kit helper (`dash/MIGRATION-MATRIX.md:46`). It runs its own microtask-batched store instead (`dash/src/stores/url.ts:50-61`).
- No app uses `pushState`, so Back never steps out of a drill-down. Opening a station, then pressing Back, leaves the site entirely.
- Three apps name their `replaceUrlState` wrapper `pushState` (`maint/app.js:1309`, `umrb/app.js:1282`, `status/app.js:1410`). That shows the intent was there, but the vocabulary isn't.
- Clean-URL defaults are uneven:
  - status and photos always write `theme` and the camera (`status/app.js:1421-1423`, `photos/app.js:1512-1513`).
  - snow always writes every param and uses raw `history.replaceState` (`snow/app.js:135`).
  - The planned 0.8.0 `cameraParamsIfDefault` + `osTheme` fixes the mechanics. The *rule* still isn't written down.

**Proposed API.**
```js
MCO.replaceUrlState(params, { keepHash: true });  // 0.8.0 opt-in; the default flips in 1.0.0
MCO.pushUrlState(params, { keepHash: true, state }); // a new history entry (drill-down)
MCO.onUrlState(fn);   // popstate + hashchange → fn(URLSearchParams, hash); apps re-apply state
```
**HOUSE-STYLE §4 rule (proposed text).**
- `replaceState` is for *view adjustments*: camera, filters, theme, variable, date scrubbing.
- `pushState` is for *drill-down*, the places where a user expects Back to undo:
  - opening a station detail or sheet
  - switching a top-level section
  - opening a shareable gallery item
- Back closes the detail. It does not re-open the previous station's camera.
- Batch writes to one per task: the dashboard's microtask queue is the reference.
- `?kbd=off` re-emits on both writes and stays out of share links (this already exists as §5.9).

**A11y.** On `popstate`, announce the restored view through I6 ("Station closed", "Ag tab"). Focus goes to the restored surface's heading, or to `#main`.

**Migration.**
- Every app: rename the `pushState` wrappers.
- explorer, status, maint, umrb: `pushUrlState` on station open.
- dash: drops its store's write half and keeps its batching layer.
- snow: moves to the kit helper.

**Effort/risk.** S. **Risk:** pushState on every station click floods history. Mitigation: push only on the first drill-down from a "no detail" state, and replace while one stays open. The dashboard should prove this rule first.

---

### I3. Loading states — `.mco-progress` + `.mco-skeleton` · P1 · 0.9.0 (MINOR)

**Problem.**
- The ladder has a `--z-map-progress` tier (`kit/theme/mco-theme.css:233`), but there is no component for it.
- What apps do today:
  - explorer: a sweeping bar, a note, and error cards with Retry (`explorer/index.html:379-412`, `app.js:334-349, 1654-1676`).
  - status, maint, umrb: only a "loading…" stamp inside `.refresh-status`, which the kit **hides at ≤640 px** (`kit/theme/mco-theme.css:709`). On phones that leaves no loading cue at all.
  - umrb: adds `aria-busy` chips.
  - photos and snow: show nothing.
  - dash: a spinner, "Loading…" text and an "Updating…" badge over an opaque overlay (`dash/src/styles/latest.css:75,86`; `ag.css:48-53`).
- The dashboard's P0 branch is adding skeletons.

**Proposed API.**
- `<div class="mco-progress" role="progressbar" aria-label="Loading stations" hidden>`:
  - Indeterminate sweep when it has no `aria-valuenow`; determinate when it has one.
  - Pinned to the top edge of its container at `--z-map-progress`.
  - Under reduced motion it renders as a static bar.
- `.mco-skeleton` blocks:
  - Shimmer gradient from `--bg-raised` → `--border`.
  - `aria-hidden="true"`.
  - Line, block and chart variants, with `--skeleton-h`.
  - Reduced motion: a flat fill.
- `MCO.loading(container, {label})` → `{start(), done(), fail(msg, {retry})}`:
  - Sets `aria-busy` on the container.
  - Shows the bar after a 300 ms delay (no flash on fast loads).
  - Announces only `fail`.
  - Renders explorer's Retry card (`.mco-notice`, I7) on failure.

**A11y.**
- `aria-busy` goes on the region that is updating.
- Starting a load is never announced (it's noise). Failures and slow loads (> 8 s, "Still loading…") are.
- Skeletons are `aria-hidden`, and the real content's container carries the busy state.

**Migration.**
- explorer: lift its bar.
- status, maint, umrb: this fixes the no-cue-on-phone gap.
- photos, snow: first loading UI.
- dash: replaces the spinner and badge.

**Effort/risk.** S–M.

---

### I4. View-transition helper — `MCO.transition(fn, {name})` · P2 · candidate (0.10.0 MINOR)

**Problem.** The P0 branch is adding view transitions (tab ↔ tab, card → detail). No map app uses them yet. They are cheap to get wrong in two ways:
1. They run under reduced motion, because the CSS blanket clamps `animation-duration` (`kit/theme/mco-theme.css:256-262`), but `::view-transition-*` pseudo-elements still crossfade.
2. They are called where `document.startViewTransition` is missing.

**Proposed API.**
```js
MCO.transition(() => applyState(), { name: 'section' });
// → runs fn directly when !document.startViewTransition || MCO.reducedMotion(); else wraps it.
```
CSS: `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }`, added to the kit's blanket rule. That part is a PATCH-safe hardening and could ship now.

**A11y.** Focus and announcements happen *after* the transition's `updateCallbackDone`, never during the animation.

**Migration.** dash. Candidate second consumer: the photos gallery stepping between stations. **Effort.** XS.

---

### I5. Disclosure, tabs, segmented, and the narrow fallback — `.seg-btns.is-radio`, `MCO.initSegmentedFallback` · P1 · 0.9.0 (MINOR)

**Problem.**
- **Semantics.** The kit's `.seg-btn` is a set of `aria-pressed` buttons. The dashboard uses a native radio fieldset inside `.seg-btns > label.seg-btn` for single-choice groups (`dash/src/ui/controls/segmented.ts:40`). That gives free arrow keys and one Tab stop. It then needs two kit-overrides: one replacing pressed styling with `:has(input:checked)`, and a first-child corner fix (`dash/src/ui/controls/controls.css:127-135`).
- **Narrow widths.** HOUSE-STYLE §3 says: "Segmented button groups that don't fit under 1060 px get a `<select>` fallback (photo explorer pattern)". Only photos does it (`photos/index.html:141-144, 275-278`; `app.js:699-738`). The others do different things:
  - explorer swaps long and short labels (`explorer/index.html:1134-1135`). Its visible "Now" isn't in the name "Latest", which fails 2.5.3. photos' "NS" vs "North Sky" has the same problem.
  - status wraps at 1280 (`status/index.html:398-401`); maint and umrb wrap at 1200.
  - snow forces `nowrap` at ≥ 641 and overflows (`snow/index.html:242`).
  - Breakpoints 1200 and 1280 are not on the ladder.

**Proposed API.**
- **`.seg-btns.is-radio`:** the kit styles `label.seg-btn:has(> input:checked)` exactly like `[aria-pressed="true"]`.
  - The input is visually hidden but covers the label, so the universal focus ring lands on it.
  - Corners use `:first-of-type` / `:last-of-type`, so template nodes don't matter.
- **`MCO.initSegmentedFallback({group, select, mq = '(max-width: 1060px)'})`:**
  - Keeps one source of truth: the select mirrors the group and the group mirrors the select.
  - `[hidden]` is set on whichever is not in use.
  - Moves focus across when a breakpoint flip hides the focused one.
- **HOUSE-STYLE rules:**
  - Short labels must be a *prefix or abbreviation contained in* the accessible name, or the name must match the visible text (2.5.3).
  - Breakpoints come from the ladder only. If a bar needs 1200, it sheds at 1060 and uses this fallback.
- **Disclosure:** `MCO.initCollapsible` already covers it.
- **Tabs (`role=tablist`):** **deliberately not proposed.** Every in-family "tabs" case so far is either navigation (links + `aria-current`, issue #3) or a single choice (radio segmented). Write that down so nobody builds an ARIA tablist for a hash route.

**Migration.**
- photos: delete its local fallback and fix the NS/SS names.
- explorer: fix "Now" vs "Latest".
- status, maint, umrb: replace their off-ladder wraps.
- snow: fix the overflow.
- dash: delete two overrides.

**Effort.** S.

---

### I6. One announcer — `MCO.announce(text, {politeness})` · P0 · 0.8.0 (MINOR) + PATCH fix

**Problem.**
- Five apps hand-make `#sr-announce` instead of `MCO.createLiveRegion` (`explorer/index.html:1478`, `status/index.html:541`, `maint/index.html:665`, `umrb/index.html:596`, `snow/index.html:386`).
- The dashboard found two defects in the kit helper:
  1. Repeating the same message isn't re-read, because the helper only sets `textContent` (`kit/core/mco-core.js:285`). The dashboard clears the region first (`dash/src/ui/shell/live.ts:9`).
  2. A region created at the moment of the first message is often not read at all. The same applies to the toast, which is lazily appended. The dashboard sends Share results to both channels (`dash/src/ui/shell/navMeta.ts:15-30`).
- snow announces a pinned reading both through its region *and* through a toast. The toast is itself `role=status` (`kit/core/mco-core.js:196-198`), so screen readers hear it twice (`snow/app.js:635-648`).
- Coverage is thin elsewhere: maint and umrb announce popup opens only, never filter or count changes (§5.1).

**Proposed API.**
- `MCO.announce(text, {politeness: 'polite'|'assertive'})`: a singleton.
  - Its region is created **at script load**, not on first use.
  - It clears the region, then sets the text on the next frame.
  - It de-duplicates the same text within 500 ms.
- `createLiveRegion().announce` gets the same clear-then-set logic. This is a PATCH: it is a fix with no signature change.
- `MCO.showToast(msg, ms, {announce: false})`: lets an app that already announced suppress the toast's own live role. Additive.
- **HOUSE-STYLE §5.1 gains a short list of what must be announced:**
  - filter or count changes
  - selection opened or closed
  - load failures
  - tab or section changes

**Migration.** All six adopters delete `#sr-announce` and call `MCO.announce`. dash deletes `live.ts`. snow drops the double-announce.

**Effort/risk.** XS–S.

---

### I7. Persistent notice / banner — `.mco-notice` · P1 · 0.9.0 (MINOR)

**Problem.**
- The toast is text-only with `pointer-events: none` (`kit/theme/mco-theme.css:453`), so it can't hold a link or a Retry button.
- maint and umrb carry byte-identical `#data-banner` + `#empty-state` CSS (`maint/index.html:164-196` = `umrb/index.html:169-199`).
- explorer has error cards with Retry.
- dash added a dismissible `.notice-banner` (`dash/src/styles/app.css:49-74`) and an outage `<dialog>` that uses `--accent-line` as its tone edge (`app.css:89`, a kit-override).
- maint and umrb both place the banner on an off-ladder `calc(var(--z-map-notice) + 1)` (`maint/index.html:192`, `umrb/index.html:195`).

**Proposed API.**
- Markup: `<div class="mco-notice" data-tone="info|warning|danger|success" role="status|alert">`.
  - Contents: an icon, a text slot, optional actions, and an optional `.modal-close`.
  - It sits at `--z-map-notice` when over the map, or in-flow otherwise.
- `MCO.notice({tone, text, action: {label, onClick}, dismissKey})` → `{close()}`:
  - `dismissKey` persists dismissal in `sessionStorage`.
  - The key must be `mco-<app>-*`.
- Tone uses the T3 status tokens. The **tone word or icon is always present**, so color is never the only channel (the dashboard already does this; `dash/DIVERGENCES.md:679`).
- `.mco-empty` (the empty-state callout) is the same component with no tone.

**A11y.** `role=alert` is for failures only. Dismiss returns focus to `#main` or to the opener.

**Migration.** maint, umrb (delete identical blocks), explorer (error cards), dash. **Effort.** S.

---

## 3. Data viz

### D1. Palette module — `palette/mco-palette.js` (`MCO.palette`) · P1 · 0.9.0 (MINOR)

**Problem.**
- "A `charts/` palettes module" is on the kit-deferred list (`kit/MIGRATING.md:271-276`). It is still deferred, and every consumer holds its own copy of approved ramps:
  - explorer: ColorBrewer and Crameri (`explorer/app.js:39-61`), still with Spectral (43, accepted from `?ramp=` at 414).
  - status: roma-sampled bins (`status/app.js:65-71`), whose two semantic extremes have the same lightness (HOUSE-STYLE §6).
  - umrb: per-theme roma (`umrb/app.js:99-115`).
  - maint: a hand-picked, non-monotonic time-since ramp (`maint/app.js:59-91`; pale `#f4d88e` mid-ramp).
  - snow: the USDM ramp (`snow/app.js:43-55`).
- The dashboard has the first complete, tested version (`dash/src/core/palette/`):
  - `BATLOW`, `ROMA_O`, `RD_BU`, `BR_BG`, `YL_GN_BU`, `YL_OR_RD`, `BLUES`, `PU_RD`, plus `TOL_BRIGHT`, `TOL_MUTED`, `TOL_HIGH_CONTRAST` (`ramps.ts:12-32`).
  - `sample(ramp, n, {from, to})`, interpolated in OKLab (`ramps.ts:48`); `colorAt`, `reversed`, `toOklab`.
  - Per-theme spans that clear 3:1 against `--bg-surface` (`roles.ts:171,213,223`).
  - Tests (`palette.test.ts:139-172`) that:
    - require every line/marker role to reach ≥ 3:1 in all 3 themes
    - check that batlow is lightness-monotonic
    - check that Spectral is absent
    - check that diverging ramps have a labelled midpoint
- That is **≥ 5 consumers** of the same need. The deferral's precondition, "a design pass across its divergent app implementations", is effectively done.

**Proposed API (classic script, zero deps; a port of the TypeScript, since the logic is DOM-free).**
```js
MCO.palette.RAMPS          // {batlow, romaO, RdBu, BrBG, YlGnBu, YlOrRd, Blues, PuRd, tolBright, tolMuted, tolHC}
MCO.palette.sample(name|ramp, n, {from=0, to=1, reverse=false})   // → hex[] (OKLab)
MCO.palette.colorAt(name|ramp, t)
MCO.palette.span(name, theme)            // the per-theme [from,to] that clears 3:1 on --bg-surface
MCO.palette.categorical(n, theme)        // Tol bright/muted/HC by theme
MCO.palette.contrast(a, b)               // WCAG ratio
MCO.palette.isBanned(name)               // 'Spectral' → true
```
- **Roles stay app-local.** A "variable → color" registry is domain knowledge. But the kit documents the *pattern* in HOUSE-STYLE §6: one role registry per app, per-theme values, a contrast test.
- It also ships one cross-app role set: **network colors and shapes** (M3).
- **CI:** `tools/check-contrast.mjs` gains a "ramp spans" matrix (ramp × theme × surface).

**A11y.** Every sampled color is above 3:1 against the surface in its theme (non-text 1.4.11). Diverging ramps ship a `midpoint` that the legend must label.

**Migration.**
- explorer (drop Spectral from the picker; map legacy `?ramp=spectral` to RdBu with a toast)
- status: re-bin its extremes on batlow-style lightness
- umrb, maint: replace the non-monotonic ramp
- snow: USDM stays as named data, plus the outline rule
- dash: imports the kit copy, and its tests keep a snapshot equality check

**Effort/risk.** M. The port is about 250 lines. **Risk:** byte drift between the TS original and the kit port. Mitigation: the dashboard's test imports the kit file and compares.

---

### D2. Chart theme from tokens — `MCO.chartTokens()` (+ optional ECharts adapter) · P1/P2 · 0.9.0 (MINOR) / adapter candidate

**Problem.**
- Only the dashboard draws charts. Its ECharts theme reads 8 tokens (`dash/src/core/charts/theme.ts:10-22`: `--text-primary`, `--text-secondary`, `--border`, `--bg-surface`, `--glass`, `--accent-line`, `--font-ui`, `--font-mono`). It sets only chrome, never data colors (`theme.ts:54`).
- Three *other* apps paint canvases from hard-coded copies of the same tokens:
  - snow's export palette `#1e2530 #f0f2f5 #e8ecf0 #1a1a2e #8a99b0 #5a6070 #1a6faf` (`snow/app.js:682-685`). `#8a99b0` is a stale `--text-muted` copy, not `--text-dim`.
  - explorer's export card hard-codes font stacks (`explorer/app.js:3718,3753`).
  - photos' export (`photos/app.js:1649-1691`).
- The kit fires **no event** on theme change (`kit/core/mco-core.js:229-232`). The dashboard dispatches its own `mco-theme-change` (`dash/src/core/theme.ts:11`, `stores/theme.ts:36-43`).

**Proposed API.**
```js
MCO.cssVar('--text-primary')            // trimmed computed value (photos, dash, explorer each wrap this today)
MCO.chartTokens()                       // {text, textMuted, grid, surface, tooltipBg, tooltipBorder, fontUi, fontMono, selection}
document.addEventListener('mco:themechange', e => e.detail.theme)   // fired by MCO.setTheme
```
- **ECharts adapter (`charts/mco-echarts.js`, P2).** `MCO.echartsTheme(tokens)` returns the dashboard's chrome object. It is held until a second ECharts or Plotly consumer exists; the drought dashboard is excluded from sweeps.
- **Document the dashboard's finding.** On a theme change, *dispose and re-init* the chart while carrying zoom and legend state, rather than calling `setTheme`/`setOption`. That lost state and mis-drew dual-axis charts (`dash/src/ui/charts/chart.ts:230-240`). Note that `dash/ARCHITECTURE.md:126` is stale on this point.

**Migration.**
- snow, explorer, photos: exports read `chartTokens()`.
- dash: deletes its `getVar` and event shim.
- Every app listening for theme flips (map re-style) gets one event.

**Effort.** S. The event name `mco:themechange` vs the dashboard's `mco-theme-change` **needs a decision** (see the end of this document).

---

### D3. Chart and canvas tooltip on touch · P2 · guidance in HOUSE-STYLE §5.8 (no code)

**Problem.**
- The dashboard has no touch-specific tooltip code. It relies on ECharts defaults, plus turning off drag-pan on compact so the page scrolls (`dash/src/core/charts/axes.ts:104-115`).
- snow was hover-only until its migration (CONSUMERS).

**Proposal.** A rule for HOUSE-STYLE:
- **Tap pins a reading; a second tap or Esc unpins it.**
- The pinned reading is announced (I6).
- The tooltip stays `aria-hidden`.
- A pointer-following `.mco-tooltip` on touch is replaced by the pinned reading, anchored above the finger.
- `MCO.map.initCursorTooltip` (planned 0.8.0) should take `{pinOnTap: true}` so map apps get the same behavior. That is additive.

**Effort.** XS (an option on a planned API).

---

### D4. Hidden-table twin helper — `MCO.srTable` (planned 0.8.0), extended · P0 · 0.8.0 (MINOR)

**Problem.**
- The planned `MCO.srTable({tbody, columns, rows})` is right for maps.
- snow has **no twin at all**, including for its zonal HUC polygons (a §5.2 gap).
- The dashboard needs three more things the plan doesn't cover:
  1. **A caption, and a row-header column**, `<th scope=row>` (`dash/src/ui/charts/chart.ts:206-228`).
  2. **The wrapper.** A `<table>` ignores `height: 1px`, so `.sr-only` must go on a wrapping `div` (`chart.ts:80-85`). Today every app either gets this right by luck or wrong silently.
  3. **A row cap** with a closing "… and N more rows; download for the full data" row (`dash/DIVERGENCES.md:871-873`, 500 rows).
- The dashboard's map twin also has a **roving-tabindex, selectable** mode (one Tab stop, arrows/Home/End, `aria-current` on the selection; it rebuilds only when the set changes) (`dash/src/ui/map/srTable.ts:28`). That turns the twin into the map's keyboard route. explorer's twin is read-only.

**Proposed API (a superset of the plan; same name).**
```js
const t = MCO.srTable({
  container,                  // the kit creates <div class="sr-only"><table><caption>…
  caption: 'Stations shown on the map',
  columns: [{key:'name', label:'Station', rowHeader:true}, {key:'net', label:'Network'}, …],
  maxRows: 500, overflowText: n => `…and ${n} more`,
  selectable: false,          // true → roving tabindex + onSelect/onFocus, aria-current
  onSelect(row) {}, onFocus(row) {},
});
t.render(rows, {selected});   // rebuilds only when the row keys change
```
- Text goes in with `textContent` only. No HTML strings.
- The canvas gets `role="img"` + `aria-label` "…The data is in the table that follows." (the dashboard pattern, `chart.ts:197`).

**Migration.**
- explorer, status, photos, maint, umrb: their twins become one call each.
- snow: first twin (HUC zones).
- dash: map + chart twins.

**Effort.** S–M.

---

### D5. Legend toggles with accessible dimming — `initLegendToggles` (planned 0.8.0) + `.mco-legend-row` · P0 · 0.8.0 (MINOR)

**Problem.**
- The planned `MCO.initLegendToggles({rows, visible, onChange})` covers behavior only. The **styling** is where the family fails today:
  - `.legend-row.off { opacity: 0.4 }` on the whole row in status (`status/index.html:274`), maint (`maint/index.html:338-339`) and umrb (`umrb/index.html:342-343`). Parent opacity composites the subtree, so no child rule can restore contrast: status's attempt at `:288` cannot work.
  - explorer measured the label at 2.69:1 and fixed it by dimming only the swatch (`explorer/index.html:662-668`).
  - maint and umrb style off the `.off` class, not `aria-pressed` (`maint/app.js:1627,1655`), which breaks §5.7.
  - snow's swatches have no border, so the white "near normal" swatch vanishes on light glass (`snow/index.html:203`; HOUSE-STYLE §6 already names this).
  - On the dashboard, ECharts legends dim inactive items to `--border` (`dash/src/core/charts/theme.ts:72`), which is ≈ 1.6:1.

**Proposed API.**
```html
<button class="mco-legend-row" aria-pressed="true">
  <span class="mco-legend-swatch" style="--swatch: #…" aria-hidden="true"></span>
  <span class="mco-legend-label">Fresh</span><span class="mco-legend-count">42</span>
</button>
```
- **Styling keys off `aria-pressed`:**
  - `[aria-pressed="false"] .mco-legend-swatch { opacity: .35 }`
  - `[aria-pressed="false"] .mco-legend-label { color: var(--text-muted); text-decoration: line-through }`
  - Muted on glass needs a check, since glass reads close to surface. If it fails, use `--text-secondary`.
  - The **row itself never gets opacity.**
- **Swatches** always carry a `1px solid var(--border)` outline (fixes snow and the USDM white).
- **Shapes:** `data-shape="circle|hollow|ring|line|dash"`, so legend and map match (M3). explorer's "stale" legend swatch is dashed while the map draws a solid ring (`explorer/index.html:673` vs `app.js:1266-1273`).
- **JS:** the planned API, plus `isolate` on double-click and Shift+Enter, plus "Show all" when everything is isolated away. One announcement per change: "Fresh hidden, 3 of 4 categories shown".
- **ECharts:** `chartTokens().textMuted` for `inactiveColor`. Document that ECharts' default `--border` dim fails.

**Migration.** status, maint, umrb (the contrast fix), explorer (delete local), snow (outline), dash (inactive color).

**Effort.** S. **This fixes a shipped 1.4.3 failure in three apps.**

---

## 4. Forms

The dashboard's `ui/controls` are Alpine factories over **pure, unit-tested models** in `src/core/controls/*Model.ts`. Each one maps onto a vanilla core: the model gets ported as-is, and a roughly 100-line DOM binding replaces the Alpine layer.

### F1. Accessible combobox / search — `MCO.initSearchBox` (planned 0.8.0), built on the dashboard model · P0 · 0.8.0 (MINOR)

**Problem.**
- **Five** adopters hand-roll the same search combobox (`explorer/app.js:2350-2474`, `status/app.js:1105-1217`, `photos/app.js:984-1112`, `maint/app.js:901-1015`, `umrb/app.js:921-1064`). The dashboard has a sixth.
- Their defects differ:
  - The "no match" `<li>` has no `role=option` inside a `role=listbox` in status (`1137-1139`), photos (`1026-1028`), maint (`934-937`) and umrb (`957-960`). Only explorer is right (`2383`).
  - Only explorer sets `aria-selected` (`2442`).
  - Only explorer announces counts (`2390,2416`).
- All five copy the same search-icon data URI with a stroke of `%237a8190`, the banned drift value of `--text-dim` (`explorer/index.html:260,280`, `status/index.html:155`, `photos/index.html:157`, `maint/index.html:209`, `umrb/index.html:212`).
- The planned API (`{input, dropdown, items, renderRow, onSelect}`) was designed against the two M/U twins.

**Proposed API (the planned name, with the dashboard's model inside).**
```js
const sb = MCO.initSearchBox({
  input, listbox,                       // the kit wires role/aria-* if absent
  items: () => [{id, label, group?, keywords?}],
  renderRow(item, el) {},               // optional; default is label + mono id; must use textContent
  onSelect(id|null) {},
  limit: 200, label: 'Search stations',
  announce: true,                       // "12 results" via MCO.announce, debounced
});
MCO.searchModel.filter(items, q, limit) // → {groups, flat, total, best}  (ranking: exact > label prefix > code prefix > label substring > code substring)
```
- **Pattern.** APG editable combobox with list autocomplete:
  - `aria-activedescendant` with `aria-selected` on the active option
  - `role=group` for groups
  - the empty row is a disabled `role=option`
- **Keys** (`dash/src/ui/controls/combobox.ts:176-182`):
  - Down/Up open the list and wrap.
  - Home/End work only while navigating.
  - Enter selects.
  - Esc closes and reverts, then stops propagation (I1).
- **Composes with `MCO.initSearchCollapse`**, which is unchanged.
- **CSS:** `.mco-search` + `.mco-search-icon`, a CSS `mask` so the icon takes `currentColor` (`--text-dim`). That retires the five data-URI copies.

**A11y.** The listbox sits at `--z-flyout`. Options are at least 40 px on touch. A focus-out closes the list. The count goes through a polite region. The selected item shows ✓ plus `.is-current` (a non-color cue).

**Migration.** All five map apps delete about 100 lines of JS and 90 of CSS each. dash swaps its Alpine binding onto the kit model.

**Effort/risk.** M. The risk is behavior drift from five local versions. Mitigation: port the dashboard's Playwright combobox check (`dash/scripts/verify/keyboard.mjs:95-113`) into the kit's demo audit.

---

### F2. Stepper — `MCO.initStepper` · P0 · 0.9.0 (MINOR)

**Problem.** Three apps have date or hour steppers, with three different defects:
- snow listens only to `mousedown` and `touchstart` (`snow/app.js:412-430`), so **Enter/Space do nothing**: a 2.1.1 failure. It also re-implements `todayMT`/`shiftDate` (`67-69, 416-418`).
- explorer's `makeStepper` is correct, with hold-to-repeat plus Enter/Space (`explorer/app.js:2039-2084`). It is only 24 px tall off-touch.
- photos is 15 px tall off-touch (`photos/index.html:136-139`) and keeps a local `shiftDate` that the kit fixed in 0.4.0 (`photos/app.js:85-92`).
- photos was explicitly kept app-local "per kit-deferred" (CONSUMERS). With three implementations, it now qualifies.

**Proposed API.**
- `MCO.initStepper({prev, next, onStep(delta), canStep(delta), repeat: true})`:
  - Click and Enter/Space step once.
  - Pointer hold repeats: 400 ms delay, then 80 ms.
  - Under reduced motion the repeat rate holds steady, with no acceleration.
  - `disabled` is set at the bounds.
- `.nav-btn.mco-step` is 34 px, or 40 px on touch.
- Date use pairs it with `MCO.shiftDate` and announces the new date through `role=status` readout text (explorer `#hour-readout`).

**Migration.** snow (P0 a11y), explorer, photos. **Effort.** S.

---

### F3. Chips — `.mco-chip` · P1 · 0.9.0 (MINOR)

**Problem.**
- status, maint and umrb carry the same `.chip` pill toggles (`maint/index.html:295-314` = `umrb/index.html:298-318`; `status/index.html:237-256`), including an off-palette `rgba(0,0,0,.28)`.
- The dashboard uses `.nav-btn.ctl-chip` with `aria-pressed` and a ✓ at 28 px, restored to 40 px on touch (`dash/src/ui/controls/controls.css:83-86, 151-156`, a kit-override).

**Proposed API.**
- `.mco-chips[role=group][aria-labelledby]` > `button.mco-chip[aria-pressed]`.
- Pressed state shows ✓ (a non-color cue).
- 28 px, or 40 px under `(hover: none)`.
- `aria-busy` gives a loading variant (umrb).
- No JS. Apps own the selection, and `MCO.toggleIn(arr, v)` is a small helper.

**Migration.** status, maint, umrb, dash. **Effort.** XS.

---

### F4. Date range, multiselect, range slider · P2 · candidates (0.10.0 MINOR)

These are one consumer each (dash) today. Propose them as **kit-ready but held under the admission rule**. Write them down now so the next consumer reaches for them instead of writing a sixth combobox-style copy.

- **`MCO.dateRange`** (model: `dash/src/core/controls/dateModel.ts`):
  - Two native date inputs in a fieldset.
  - `aria-invalid` + `aria-describedby` + a polite error line.
  - It never clamps while the user types, and never calls `new Date(string)`.
  - Errors need the danger token (T3 / #2).
  - Likely second consumer: an export or download range in explorer.
- **`MCO.multiselect`** (`multiselectModel.ts`, `selectionModel.ts`):
  - A disclosure button opens a group of checkboxes with a filter box.
  - Mixed state via `indeterminate`.
  - Removable chips with focus handoff.
  - Likely second consumer: status's network filters.
- **`MCO.rangeSlider`** (`rangeModel.ts`):
  - Two native ranges with unit-bearing `aria-valuetext`.
  - Optional "none" stop.

**Native picker theming:** `color-scheme` from the theme (`dash/src/ui/controls/controls.css:24-26`). This is a 1-line kit rule that every app with a date input wants; explorer inverts the icon with `invert(60%)` instead (`explorer/index.html:228-229`). **Ship this part now:** 0.8.x, MINOR, a new rule under `[data-theme]`.

---

### F5. Primary button — `.nav-btn.is-primary` · P1 · 0.8.0 (MINOR)

**Problem.**
- The kit has no primary action button. The dashboard overrides `.nav-btn.dl-btn-primary` to `--accent` / `--text-on-accent` (`dash/src/styles/downloader.css:40`).
- explorer's `#scale-apply` uses `color: #fff` on `--accent` (`explorer/index.html:1055`), which is **2.22:1 in high contrast**. That is the same bug CONSUMERS records being fixed on its AgriMet chip.

**Proposed API.**
- `.nav-btn.is-primary { background: var(--accent); color: var(--text-on-accent); border-color: var(--accent-line) }`, with a hover step on `--accent-dk`.
- The token contract already guarantees ≥ 4.5:1 in all three themes.

**Migration.** explorer (P0 contrast fix), dash. **Effort.** XS.

---

## 5. Tokens and brand

### T1. Type scale tokens — `--fs-*` · P1 · 0.9.0 (MINOR) → kit rules adopt them in 1.0.0

**Problem.**
- The kit has no type tokens. Every size is a literal rem: 0.55 / 0.65 / 0.72 / 0.74 / 0.75 / 0.78 / 0.8 / 0.82 / 0.85 / 1 / 1.05 / 1.2 across `kit/theme/mco-theme.css:376-534`.
- Apps copy whatever is nearby:
  - explorer: 49 literal declarations
  - status: 23
  - maint: ~31
  - umrb: ~22
  - photos: 13
  - snow: 9
  - dash: everywhere, 0.65–1rem

**Proposed tokens.** Each snaps to the kit's existing clusters, so adopting a token is near-invisible:

| Token | Value | Kit sizes it absorbs | Role |
|---|---|---|---|
| `--fs-2xs` | 0.55rem | 0.55 | lockup subtitle only |
| `--fs-xs` | 0.65rem | 0.65 | brand title, mono meta, tooltip sub |
| `--fs-sm` | 0.75rem | 0.72, 0.74, 0.75 | panel titles, seg/tooltip, captions |
| `--fs-md` | 0.8125rem | 0.78, 0.8, 0.82 | buttons, toast, h3 eyebrow |
| `--fs-base` | 0.875rem | 0.85 | prose, table cells |
| `--fs-lg` | 1.0625rem | 1, 1.05 | modal and card titles |
| `--fs-xl` | 1.375rem | — | stat readouts (dash cards) |
| `--fs-2xl` | 2rem | — | hero numbers |

- **Line height:** `--lh-tight: 1.2`, `--lh-body: 1.6`.
- **Weights:** `--fw-regular: 400`, `--fw-medium: 500`, `--fw-semibold: 600`, `--fw-bold: 700`.
- These are theme-invariant, so they go in `:root` only. The CI parity check needs a "theme-invariant" allow-list, the way `--radius-*` already works.
- **0.9.0** adds the tokens, and apps adopt them. **1.0.0** rewrites the kit's own rules onto them. The 0.72→0.75 and 0.78→0.8125 snaps are visible, so that step is MAJOR under the kit's rules.

**Migration.** Each app runs a mechanical find/replace. A lint is proposed in Q1.

**Effort/risk.** S for the tokens; M for the 1.0 sweep. **Risk:** the 0.7.1 fallback metrics were fitted at current sizes (`kit/theme/mco-theme.css:58-88`). Re-measure the navbar shift after the snap.

---

### T2. Spacing scale — `--space-*` · P1 · 0.9.0 (MINOR)

**Problem.** The house rhythm is 0.4rem (the lockup, `kit/theme/mco-theme.css:368-374`), but paddings are literals everywhere.

**Proposed tokens.** `--space-1: .25rem; --space-2: .4rem; --space-3: .5rem; --space-4: .75rem; --space-5: 1rem; --space-6: 1.5rem; --space-7: 2rem`. These are the values the kit already uses, named. `--nav-gap` stays as it is and defaults to `var(--space-4)`.

**Effort.** XS.

---

### T3. Status tokens — `--danger`, `--warning`, `--success` (+ fill / on-fill) · P0 · 0.8.0 (MINOR) — kit issue #2, widened

**Problem.**
- #2 asks for `--danger` for form errors (the dashboard falls back to `--text-primary` + ⚠ + a heavier edge; `dash/src/ui/controls/controls.css:31,36`).
- The survey found the **warning** half too:
  - maint and umrb carry a byte-identical `--c-warn` / `--warn-bg` per theme with contrast comments (`maint/index.html:124-138`, `umrb/index.html:116-135`). umrb fixed it from 2.2:1 to `#7d5a0e` during its migration.
  - explorer's `.scale-hint` uses `#e5a35c` / `#96500a` with no contrast comment and no high-contrast value (`explorer/index.html:1052-1053`).
  - status's `--status-*` set (`status/index.html:96-109`) and the maint pills (`382-386`) each re-derive "ok / warn / bad".
- That is 4 consumers.

**Proposed tokens (all three themes + tokens.json).**
- `--danger`, `--warning`, `--success`:
  - text/line colors
  - ≥ 4.5:1 on deep, surface and raised
  - so ≥ 3:1 as lines
- `--danger-fill`, `--warning-fill`, `--success-fill`: tinted backgrounds for notices.
- `--text-on-danger` etc.: ≥ 4.5:1 on the matching fill.
- The CI contrast contract gains these rows.
- **Policy line (HOUSE-STYLE §2):** status tokens are chrome (form errors, notices). They are **not** for data encoding. A station "dead/stale" category is data and uses the palette.

**Migration.** maint and umrb delete `--c-warn`; explorer's `.scale-hint`; dash's errors and notices (I7). **Effort.** S. Measurement is the work.

---

### T4. 10-step brand scale for component libraries · P2 · 0.9.0 (MINOR, tokens.json only)

**Problem.**
- Non-vanilla consumers read `tokens/tokens.json` (README). Mantine, Tailwind and Quarto themes want a 10-step primary scale. The kit offers 4 named steps (`--accent-dk`, `--accent`, `--accent-light`, `--accent-line`), so each library consumer invents the other six. That's how "a fourth blue" happens (HOUSE-STYLE §1).
- The dashboard's previous React/Mantine build (CONSUMERS "next migrations") used stock Mantine blue (`dash/DIVERGENCES.md:17`).

**Proposal.**
- `tokens.json` gains `brand.scale["50".."900"]`. The values are generated by a committed `tools/brand-scale.mjs` that runs OKLCH lightness steps at the hue and chroma of `#1a6faf`, with **600 pinned to exactly `#1a6faf`**. CI regenerates the scale and checks it.
- Each step is annotated with its contrast against white and against `--bg-deep` dark, so a library consumer knows which steps can carry text.
- **No CSS custom properties.** Chrome keeps using the role tokens. The scale exists only so libraries don't invent one.

**Effort.** S. **Needs a decision:** whether a 10-step scale belongs in the kit at all, given HOUSE-STYLE §1's "never introduce a fourth blue". The argument for: the scale *prevents* invented blues.

---

### T5. Logo assets: a dark-safe wordmark and badge rules · P1 · 0.8.x (MINOR, new files)

**Problem.**
- The kit ships one logo, `assets/mco-logo.png` (the icon badge). Every app vendors it, and none has a dark variant.
- The full **wordmark SVG** in the family has near-black text (`fill="#1A1919"`):
  - `mt-normals/assets/MCO_logo.svg`
  - `mtdrought/img/MCO_logo.svg`
  - `mco-drought-dashboard/docs/logo/MCO_logo.svg`
  - On the dark default theme it is unreadable, so no MCO app can show the full lockup on dark.
- The dashboard's legacy build used `MCO_logo.svg` (`dash/MIGRATION-MATRIX.md:23`).
- snow's export **hot-links** `climate.umt.edu/assets/images/MCO_logo_icon_only.png` (`snow/app.js:713`), which its own CSP blocks (`snow/index.html:19`). So its exports have **never** carried the logo. HOUSE-STYLE §1 forbids that hot-link.

**Proposal.**
- `assets/mco-wordmark.svg`: the text paths use `fill="currentColor"` and the mark keeps its brand fills. Inline use inherits `--text-primary`.
- `assets/mco-wordmark-on-dark.svg` and `-on-light.svg` are fixed-color twins for `<img>` and canvas exports. That is the export path, where `currentColor` doesn't exist.
- `assets/mco-logo.svg`: a vector badge for crisp exports.
- **HOUSE-STYLE §1 rules:**
  - Badge in the navbar, wordmark in exports and footers.
  - Exports draw the logo from the kit asset, never from climate.umt.edu.
  - Clear space equals the badge radius.
  - Minimum size 24 px.

**Needs.** Brand-owner sign-off on the recolored wordmark. **Effort.** S. Asset work, not code.

---

### T6. Favicon, social card and page-title rules — `MCO.setPageTitle`, `MCO.setSocialMeta` · P1 · 0.9.0 (MINOR)

**Problem.**
- HOUSE-STYLE §1 specifies `<Short> · <Family>`, but it doesn't say what happens when an app puts *state* in the title. Three apps already do, in three different formats:
  - dash: `Bozeman · Dashboard · MT Mesonet`, detail-first (`dash/src/core/pageTitle.ts`, commit d5761167).
  - snow: overwrites its correct static `Snowpack · MCO` with `Snowpack Explorer · ${date} · Montana Climate Office` on every change (`snow/app.js:136`). That has the wrong short name, the long family and two middots.
  - photos: `updateSocialMeta` writes `og:title` as `Montana Mesonet Photos · {date}·{time}·{dir}` (`photos/app.js:1485`). It uses `preview.png` instead of `og-card.png`, with no dimensions, no `twitter:image:alt` and no canonical link.
- Head meta is uneven:
  - snow has no `og:image`, locale or twitter tags (`snow/index.html:42-46`).
  - status's canonical points at github.io (`status/index.html:26`).
  - Favicons are vendored in maint, umrb, explorer and snow, but hot-linked from the pinned kit in dash (`dash/index.html:64-66`).
- `theme-color` is hard-coded hex in dash (`dash/index.html:25-26`).

**Proposal.**
- **Rule:** `<Detail> · <Short> · <Family>`. Detail goes first, because tabs truncate at about 15 characters and the detail is what tells two tabs apart. Exactly one middot between each part. Detail is optional and plain text: a station name or a date, never both.
- **API:**
  - `MCO.setPageTitle({short, family = 'MT Mesonet', detail})`.
  - `MCO.setSocialMeta({short, detail, image, url})`. It writes og and twitter in the card form (`<Short> · Montana Mesonet`); `og:site_name` gets the long family alone.
  - photos' `updateSocialMeta` (kit-deferred today) now has a second consumer (snow), so it qualifies.
- **Head checklist** in `snippets/head.html`:
  - canonical on the production host
  - `og:image` = the kit `og-card.png` with width, height and alt
  - `twitter:card` = `summary_large_image`
  - `theme-color` as two `media`-qualified metas whose values the snippet documents as `--bg-deep`
- **Favicons:** the kit should pick **one** way. Recommendation: hot-link from the pinned tag, which is already CSP-allowed for the CSS, versions with the kit, and stops copies drifting. The navbar logo stays vendored as today. That needs a decision.

**Migration.** snow (title + og), photos (og), status (canonical), dash (aligns with `pageTitle.ts`). **Effort.** S.

---

### T7. Footer / credit component — `.mco-footer` · P1 · 0.9.0 (MINOR)

**Problem.**
- HOUSE-STYLE §1 Voice says: "footers and exports credit `Montana Climate Office · climate.umt.edu`".
- **No map app has an on-page footer.** Credit lives in info modals:
  - explorer: `index.html:1560`
  - status: has none even there (`index.html:543-581`)
- Export credits differ:
  - explorer and photos use "Montana Climate Office · climate.umt.edu".
  - snow uses `NOAA SNODAS | Montana Climate Office`, with a pipe (`snow/app.js:300`).
- The dashboard has the only footer (`dash/partials/shell.html:65-69`, `app.css:38-47`, links underlined).

**Proposal.**
- `<footer class="mco-footer">` holds a data-source credit slot, then `Montana Climate Office · climate.umt.edu`, then an optional version and "last updated" line in mono.
- Links are underlined (1.4.1). Text is `--text-muted` on `--bg-deep`.
- **Full-viewport map apps** don't get a footer, which would cost map height. They use `MCO.credit()`: a string helper that the info modal's Data section and every export draw from, so the wording is identical everywhere. Separator: `·`, never `|`.

**Migration.** dash (adopt the class), snow (separator), every export (string). **Effort.** XS.

---

## 6. Maps

### M1. Basemap failure: toast + retry — `MCO.map.watchBasemap` · P0 · 0.8.0 (MINOR)

**Problem.**
- **No adopter handles a basemap failure.** All six start their data load from `map.on('load')`, which never fires if the CARTO style 404s or times out:
  - `explorer/app.js:3875-3885`: the loading bar spins forever
  - `status/app.js:1387-1393`
  - `photos/app.js:545`
  - maint, umrb and snow: likewise
- The dashboard is the only one that handles it (`dash/src/ui/map/map.ts:80-87`):
  - It counts only errors whose URL ends in `/style.json`.
  - It toasts "Map basemap failed to load".
  - It retries once after 5 s.
  - A good `style.load` re-arms it.

**Proposed API.**
```js
MCO.map.watchBasemap(map, {
  styleUrl: () => MCO.map.cartoStyleUrl(),
  retries: 1, retryDelayMs: 5000,
  onFail() {},          // the app can fall back: start the data load anyway on a blank style
});
```
- On final failure it calls `map.setStyle(MCO.map.BLANK_STYLE)`: a background-only style in `--bg-deep` that **does** fire `load`, so data layers and boundaries still draw. It also shows a persistent `.mco-notice` (I7) with a Retry button. A toast alone isn't enough, because it's gone in 2.8 s.

**A11y.** The failure is announced once. Retry is a real button.

**Migration.** All six adopters; dash deletes its local copy. **Effort.** S. **This fixes an unrecoverable hang in six apps.**

---

### M2. Touch targets for MapLibre controls and kit panel toggles · P0 · 0.8.1 (PATCH) — *recommendation only; declined as an issue by the user*

**Problem.**
- MapLibre's control buttons are 29 px, and the kit doesn't enlarge them under `(hover: none)` (`kit/theme/mco-theme.css:712-721` covers kit components only).
- The kit's own `.mco-panel-toggle` is 36 px on touch (`:720`). That is below the 40 px HOUSE-STYLE §5.5 sets.
- The dashboard's verify harness has to **exempt** `.maplibregl-ctrl-group button`, `.maplibregl-ctrl-attrib-button` and `.mco-panel-toggle`, with the note "kit 0.7.1 leaves these < 40 px under (hover: none). Fix belongs in the kit." (`dash/scripts/verify/lib.mjs:260-261`).
- status's popup close button is restyled to 1.1rem with no 44 px target (`status/index.html:308-311`).

**Recommendation (no issue filed; the user declined one).**
- Under `@media (hover: none)`:
  - `.maplibregl-ctrl-group button { width: 40px; height: 40px }`
  - `.maplibregl-ctrl-attrib-button { width: 40px; height: 40px }`
  - `.maplibregl-popup-close-button { min-width: 44px; min-height: 44px }`
  - `.mco-panel-toggle` → 40 px
- Fold it into the 0.8.0 release or a later patch. It is a PATCH because it is a fix with no selector, token or signature change. If the maintainer reads a size change as an observable default, it becomes 1.0.0.
- Re-check it against the MapLibre bump (#1), since control CSS changed across majors.

**Effort.** XS.

---

### M3. Station-marker conventions: network colors + shapes · P1 · 0.9.0 (MINOR, `MCO.palette.NETWORK` + HOUSE-STYLE §7)

**Problem.** Each station map draws markers its own way:
- explorer: filled vs hollow by data state (`app.js:1257-1283`). This is the grayscale-safe pattern HOUSE-STYLE §6 praises.
- status: color only on the map (`app.js:536-550`).
- umrb: achromatic dots hard-coded in JS rather than read from its own `--c-station` (`app.js:526-534`). Its info modal says "Orange dots" (`index.html:610`), which they are not.
- dash: has a network registry (`dash/src/core/palette/roles.ts:44-56`; `src/core/map/markers.ts:37,92,126`):

  | Network | Color | Shape | Stroke |
  |---|---|---|---|
  | HydroMet | `#4477AA` (all themes) | filled circle | `--dot-stroke` 1.2 |
  | AgriMet | `#CC6622` light / `#EE7733` dark and HC | hollow circle | 2.5, fill `--bg-surface` |
  | Cooperator | `#009988` | ring | 1.5 |

  - Co-located stations merge into one feature with an outer halo in the second network's color.
  - An invisible +7 px hit layer gives a larger touch target (`dash/src/ui/map/stationLayer.ts:141-146`).
- Selection rings use three different sources:
  - explorer hard-codes **`'#5aaee8'`** (`app.js:1203`). That is the dark `--selection-ring`, so it is wrong on the light theme.
  - photos falls back to the same hex (`app.js:805,808,1586`).
  - dash uses `--selection-ring`.

**Proposal.**
- `MCO.palette.NETWORK = {hydromet: {color, shape:'circle'}, agrimet: {...}, cooperator: {...}}`, per theme, contrast-tested against both basemaps.
- `MCO.map.markerPaint(network, theme)` → circle paint.
- **HOUSE-STYLE §7 rules:**
  - **Network = shape + color, data value = fill.** Shape survives grayscale.
  - Selection = `--selection-ring` read at paint time, never a literal.
  - Keyboard focus = a `--accent-line` halo (separate from selection).
  - The hit layer is at least 22 px in diameter on touch.
  - The legend swatch uses the same `data-shape` (D5).

**Migration.**
- explorer: the selection ring (P0, light-theme bug).
- photos: the fallback.
- status: add shape.
- umrb: read the token and fix the modal text.
- dash: imports the kit copy.

**Effort.** S.

---

### M4. Popup safety — DOM content, never `setHTML` of API strings · P0 · HOUSE-STYLE §7 + `MCO.map.popupContent` 0.8.0 (MINOR) + popup shell CSS

**Problem.**
- MapLibre 5.18.0 carries a critical `DOM.sanitize` bypass, GHSA-jrc7-96c5-q579 (kit issue #1). Exposure depends on `setHTML` with untrusted strings:
  - `status/app.js:856,1306`
  - `maint/app.js:1182`
  - `umrb/app.js:216,1182,1205`
  - explorer injects `innerHTML` into its sheet (`app.js:3066,3614`)
- Most strings are escaped, but not all:
  - **maint interpolates the AirTable photo URL `p.thumb` raw into `style="background-image:url('…')"`** (`maint/app.js:1049`). That is attribute and CSS injection from an API response.
  - maint also interpolates `qualifying_visits_this_year` raw (`1154`).
  - snow puts `prov.n_reference_years` and `prov.flavor` into `innerHTML` unescaped (`snow/app.js:868,895,900`).
- The dashboard builds popups with `setDOMContent` + `textContent` only (`dash/src/ui/map/stationLayer.ts:65-81`).
- The popup *shell* is restyled in four places:
  - status uses `!important` (`index.html:297-311`)
  - maint and umrb are byte-identical (`349-369` / `365-383`)
  - dash uses a kit-override (`map.css:18-33`)

**Proposal.**
- **Rule (HOUSE-STYLE §7, new):**
  - Popup, tooltip, sheet and table content is built with DOM APIs and `textContent`.
  - `setHTML` / `innerHTML` are allowed only for static, author-written strings.
  - URLs from APIs go through `new URL()` with a scheme allow-list (`https:`) and are set via `el.style.backgroundImage = \`url(${JSON.stringify(u)})\`` or `img.src`, never through string templates.
- **API:** `MCO.map.popupContent({title, subtitle, facts: [[label, value]], actions: [{label, href|onClick}]})` → a `DocumentFragment` styled with `.mco-facts` (L4). It is the same builder `initSheet` content uses, so popup (wide) and sheet (compact) render identically.
- **CSS:** the kit styles `.maplibregl-popup-content` and the four tip arrows from tokens. It sets `--z-detail` on `.maplibregl-popup` (the ladder comment already notes popups ship with no z-index, `kit/theme/mco-theme.css:224-229`), and a 44 px close button on touch.
- **#1 interaction:** with DOM-only content, the MapLibre bump becomes routine rather than urgent. It should still happen.

**Migration.** maint (**fix `p.thumb` now; it is not a kit-blocked change**), status, umrb, explorer's sheet, snow's provenance modal; dash deletes its override. **Effort.** S.

---

### M5. Co-located marker convention · P1 · HOUSE-STYLE §7 + a kit option on `markerPaint` · 0.9.0

**Problem.** Three treatments of co-located stations exist:
- explorer, status and maint: a count badge (`#ffffff` text, `#1a1a2e` halo, with no contrast comment) and a spider fan-out on hover or click (`explorer/app.js:1220-1221, 3173-3236`; `status/app.js:457-458, 1321-1384`; `maint/app.js:456-474, 1200-1256`).
- dash: merges them into one feature (an inner dot plus an outer ring in the second network's color), and click *cycles* through the stations (`dash/src/core/map/markers.ts:92,126`).
- None of them has a keyboard path except through the sr-table.

**Proposal.**
- HOUSE-STYLE picks one convention per marker density:
  - ≤ 3 co-located: **halo + cycle on click**, the dashboard's. It is keyboard-reachable through the selectable sr-table (D4) and announces "1 of 2: Bozeman AgriMet".
  - Dense clusters: **badge + spider**. The badge colors come from tokens (`--text-on-accent` on `--accent`) with a contrast comment, and the spider gets an Esc path (I1).
- `markerPaint({colocated: 'halo'|'badge'})`.

**Effort.** S for the docs. The spider stays app code until a second app wants the badge mode in the kit.

---

### M6. Other map hygiene found in passing (local fixes; no kit change)

- **snow:**
  - Its vendor `NavigationControl` shows the compass (`snow/app.js:255`), against the reconciled `showCompass: false`.
  - It hand-rolls a zoom floor (`359-363`) and has no fit control.
  - Its data draws *below* the hillshade (`app.js:21,266,284,307`), which is the wrong layer order (§7).
- **explorer:**
  - Places navigation top-left (`app.js:1017`) where every other app uses top-right.
  - Draws overlay paints in local hex with **no tribal labels** (`1357-1395`).
- **umrb:** loads FlatGeobuf 3.36.0 from unpkg **with no SRI** (`umrb/index.html:643`).
- **snow:** loads `hyparquet@1` from esm.sh, a floating major with no SRI (`snow/app.js:13`).
- **umrb localStorage keys:** it uses the `mco-status-*` namespace (`umrb/app.js:232…1490`) on the same origin as mesonet-status. That is a §4 collision risk; maint correctly uses `mco-maint-*`.

These belong in each app's next pass and in the conformance checklist (Q2).

---

## 7. Quality gates

### Q1. Shareable verify tooling — `tools/verify/` as a copyable harness · P1 · 0.9.0 (tooling; no runtime change)

**Problem.**
- `kit/tools/consumer-verify.mjs` is a copy-and-edit skeleton. It runs axe in 3 themes at **1440 px only**; the compact run checks only the console (`consumer-verify.mjs:85-106`). HOUSE-STYLE §3 itself warns that "a shed label is invisible to a 1440 px-only audit".
- The dashboard grew the harness into a real gate (`dash/scripts/verify/`):
  - **`lib.mjs`:**
    - Fixture-recorded network; the CARTO style stubbed; the clock pinned to America/Denver.
    - Collects console, page errors and CSP violations.
    - A render-evidence wait instead of `networkidle`.
    - `smallTargets()`, the touch-target audit under `(hover: none)`.
  - **`consumer.mjs`:** static `<head>` conformance:
    - exactly one kit pin; SRI + `crossorigin` on every CDN asset
    - font preloads
    - CSP `default-src 'none'` with every inline script hashed
    - anti-flash before the first stylesheet
    - `viewport-fit=cover`
    - skip link first, `<main id=main tabindex=-1>`
    - no `:focus` or `outline:none` rules
    - `mco-` storage keys
  - **`axe.mjs`:** scenarios × 3 themes × 2 widths (1440, 390 touch), pooled.
  - **`keyboard.mjs`:**
    - tab order, a focus ring on every stop
    - dialog Esc and focus return
    - the theme cycle
    - combobox `aria-activedescendant`
    - the sr-table's single Tab stop
    - chart twins
    - a reduced-motion canvas diff

**Proposal: `tools/verify/` in the kit.**
- `lib.mjs`: the server, `open()`, `check()`, `smallTargets()`, CSP capture. The fixture recorder is optional.
- `head.mjs`: the static conformance checks. They are app-agnostic, so they run as-is.
- `axe-matrix.mjs`: `{scenarios: [{name, query, ready}]}` × themes × `[1440, 390-touch]`. The touch-target audit runs at 390.
- `keyboard.mjs`: generic probes (skip link, ring on every stop, dialog Esc/return, Esc stack, `?kbd=off`) plus hooks.
- `lint-css.mjs`, new:
  - flags raw hex outside data/contrast-commented lines
  - raw `z-index` integers
  - `font-family: 'Outfit'` literals
  - rem `font-size` once T1 ships
  - `outline: none`
  - `display: none` on `.brand` / `.control-label`
  - **untagged overrides of kit selectors**: any app rule whose selector names a kit class and lacks a `/* kit-override: … */` comment
- It stays ephemeral tooling, per AGENTS rule 1 (`npm i --no-save`). Consumers copy the directory, or run it from a pinned kit checkout: `node ../mco-web-style/tools/verify/head.mjs --root docs/`.

**Why the lint matters.** Of the six adopters, only explorer and photos use the `kit-override` tag at all, one tag each (plus one orphan header comment in photos). The survey found **dozens** of untagged overrides. Examples:
- snow's `.mco-panel` restyle at `z-index:10` with a hand-rolled collapse (`snow/index.html:153-194`)
- snow's `.control-label {display:none}`, the exact 0.5.1 regression (`snow/index.html:232`)
- snow's brand `display:none` at 1060 (`snow/index.html:235`; already noted in CONSUMERS)
- explorer's brand `display:none` at 640 (`explorer/index.html:1095`)
- status's `!important` popup restyle

The admission rule can't see what isn't tagged.

**Effort.** M (mostly lifting the dashboard's code).

---

### Q2. Consumer conformance checklist — `CONFORMANCE.md` · P1 · 0.8.0 (docs)

A one-page, checkable list. It is generated from the head and lint checks where possible, and is otherwise manual. Each CONSUMERS row gains a "conformance: N/M" cell. Sections:

1. **Head:**
   - pin + SRI
   - fonts
   - anti-flash + its hash
   - `viewport-fit=cover`
   - the title rule (T6)
   - og/twitter/canonical
   - favicon source
2. **Shell:**
   - skip link → `#main`. explorer and snow target `#map-container` (`explorer/index.html:1193`, `snow/index.html:248`).
   - brand `<h1>`. snow's is a `<span>` (`snow/index.html:259`).
   - `.nav-meta`, not `.nav-actions` (snow, `index.html:312`).
   - `.mco-btn-info` on the info button (snow, `index.html:349`).
   - the ≤ 750 collapse untouched, or a tagged override.
3. **Tokens:**
   - no raw hex outside data
   - status tokens (T3)
   - no `--accent` as a line or text. explorer has 13 such uses (`index.html:230…1019`).
4. **A11y:**
   - live region via `MCO.announce`
   - an sr-table per canvas layer
   - legend dims the swatch, not the row
   - touch targets
   - `?kbd=off` **disclosed in the info modal** (maint and umrb support it but don't disclose it)
   - steppers keyboard-operable
5. **Maps:**
   - basemap watch
   - DOM popups
   - selection token
   - `addNavigation` top-right, no compass
   - zoom floor
   - layer order
6. **URL:**
   - clean defaults
   - push vs replace (I2)
   - storage namespace
7. **Verify:** the axe matrix is green at 1440 and 390 in 3 themes. The keyboard probes pass.

**Effort.** S.

---

## 8. Process

### P1. How dashboard primitives graduate into the kit

1. **Build it in the app as a vanilla core, even inside a framework app.** The dashboard's controls already split into a pure model (`src/core/controls/*Model.ts`, DOM-free, unit-tested) and a thin Alpine binding. New primitives (drawer, sheet, skeleton, tab bar) should follow the same split. Then "upstreaming" means porting a small vanilla file, not a rewrite.
2. **Tag it.** Every local kit-shaped piece carries `/* kit-candidate: <name> */`. Every override of a kit selector carries `/* kit-override: <why> */`. Q1's lint enforces both.
3. **Log it.** `web-next/KIT-NOTES.md` (being created on `ux/p0-prototype`; not yet pushed when this was written) gets one entry per candidate:
   - the gap
   - the local file
   - the second-consumer status
4. **Two-consumer check.** A candidate becomes a kit proposal when a second MCO property has the same need. Evidence is a file:line in that property. "Would benefit" doesn't count.
   - Map apps often count as a second consumer already. They re-implement drawers, sheets, combobox, legend rows, chips and steppers today (the §0 table).
   - Back-ports of defects in kit-owned code need only one consumer (AGENTS rule 5). I6 clear-then-set, M2 touch targets and the I4 reduced-motion clamp are back-ports.
5. **Port with a parity test.** The kit file is the source. The dashboard's TS imports it, or keeps a snapshot test against it (D1), and runs its own model tests against the kit port.
6. **Demo + audit.** Every admitted component gets a `demo/` section and a scenario in the kit's axe and keyboard audit (AGENTS rule 8).
7. **Re-point.** Release; the dashboard and the second consumer re-point first, then the rest in the order below.

### P2. Recommended roadmap

**0.8.0 (MINOR): the planned seven, plus small additive pieces that unblock P0 fixes.** Keep it shippable: everything here is a token, a CSS rule, or an option on an API already planned.
- Already planned:
  - `osTheme` + `cameraParamsIfDefault`
  - `initCursorTooltip` (+ `pinOnTap`, D3)
  - `initSearchBox` (built on the dashboard model, F1)
  - `initLegendToggles` + `.mco-legend-row` (D5)
  - `srTable` (extended, D4)
  - underlined attribution links
  - `installZoomFloor` hardening
- Add:
  - T3 status tokens (#2)
  - `.nav-btn[aria-current="page"]` + the 3-state `cycle` toggle (#3)
  - `.mco-navbar.is-sticky` (#4)
  - F5 `.is-primary`
  - I6 `MCO.announce` (+ the createLiveRegion PATCH fix)
  - I2 `keepHash` / `pushUrlState` / `onUrlState`
  - M1 `watchBasemap`
  - M4 popup shell CSS + `popupContent` + the rule
  - D2 `cssVar` + the theme-change event
  - L5 scoped scrim
  - F4's `color-scheme` rule
  - T5 assets
  - Q2 checklist
- **Recommended in the same release, not filed as an issue (user declined):** M2 touch targets.
- **Separately, per #1:** the MapLibre pin bump. Test the control CSS against 5.x and the patched major. The kit CSS should support both through 0.9.x.

**0.9.0 (MINOR): layout and interaction primitives.**
- L1 drawer, L2 sheet, I1 overlay/Esc stack, L6 metrics (auto-lift **opt-in**), L7 boot hold
- L4 card + `.mco-facts`
- I3 progress/skeleton, I5 radio segmented + select fallback, I7 notice
- F2 stepper, F3 chips
- D1 palette module, M3 network markers, M5 co-located convention
- T1 type and T2 spacing tokens; T4 brand scale (tokens.json)
- T6 title and social helpers, T7 footer and credit
- Q1 verify tooling

**0.10.0 (MINOR): candidates that have found their second consumer.** L3 tab bar, I4 view transitions, F4 date range, multiselect and range slider, the D2 ECharts adapter. Each ships only on evidence.

**1.0.0 (MAJOR): flip the defaults and freeze the surface.**
- L6 auto-lift on by default.
- `replaceUrlState` keeps the hash by default.
- The kit's own rules move onto T1 and T2 tokens (visible snaps).
- `initThemeToggle` cycles 3 themes by default, if the maintainer agrees that high contrast should be one click away everywhere.
- Drop the `MT_FIT_BOUNDS`/`FIT_OPTS` aliases (planned with `cameraParamsIfDefault`).
- Drop MapLibre 5.x support.
- Ship a hand-written `types/mco.d.ts`, if the constitution allows (see the decisions below). The dashboard hand-writes one today (`dash/src/types/mco.d.ts`).
- Publish the API freeze: after 1.0, every rename goes through a deprecation minor first.

### P3. Consumer migration order (for 0.8.0 → 0.9.0)

1. **mesonet-dashboard.** It is the pilot: the primitives come from here, and its verify harness proves them. It re-points first on every release.
2. **mesonet-explorer.** It holds the reference implementations being lifted (drawer, sheet, stepper, legend dim). Re-pointing it deletes the most code and proves the lifted versions against their origin. It also picks up its P0 local fixes: the drawer a11y, `#5aaee8`, `#scale-apply`, the `/` shortcut on phones, legend-row focusability, and the seen-flag written on close.
3. **mesonet-status.** It is the first consumer of the deferred controls drawer and the compact sheet. It also gets the legend contrast fix, its Esc guard and its popup focus.
4. **mesonet-maintenance + mesonet-umrb-build, together.** They are near-identical twins, so one pass covers both. Their identical CSS blocks (search, chips, legend, popup, banner, `--c-warn`) all become kit classes. The fixes ride along:
   - maint's `p.thumb` injection (do it **before** 0.8.0; it's local)
   - umrb's FlatGeobuf SRI and storage namespace
   - the `?kbd=off` disclosure
5. **mesonet-photo-explorer.** Small: the select fallback becomes the kit's, plus the stepper, the og and title fixes, and dropping its local `shiftDate`.
6. **mco-snowpack-explorer, last for the kit but first for local fixes.** It is the most divergent. Its P0s are local and need no kit release, so do them now:
   - stepper keyboard
   - compass
   - brand at 1060 and `.control-label`
   - the `.mco-panel` restyle (z-index 10, chevron bug, collapsed body not `[hidden]`)
   - the double announcement
   - the export logo hot-link
   - the title format
   - `hyparquet` pinning
   - layer order

   It adopts the kit primitives in a later pass.

---

## Summary table

| # | Proposal | Priority | Version | Adopters affected | Effort |
|---|---|---|---|---|---|
| L1 | Drawer `.mco-drawer` + `MCO.initDrawer` | P0 | 0.9.0 | explorer, status, dash | M |
| L2 | Bottom sheet `.mco-sheet` + `MCO.initSheet` | P0 | 0.9.0 | explorer, status, maint, umrb, dash | L |
| L3 | Mobile tab bar `.mco-tabbar` | P2 | 0.10.0 cand. | dash | S |
| L4 | In-flow card `.mco-card` + `.mco-facts` | P1 | 0.9.0 | dash, maint, umrb, explorer | S |
| L5 | Scoped scrim `data-scope="container"` | P1 | 0.8.0 | explorer, dash | XS |
| L6 | Overlay metrics + auto-lift | P1 | 0.9.0 opt-in → 1.0.0 | all map apps, dash | S |
| L7 | First-paint hold `mco-booting` / `MCO.ready` | P1 | 0.9.0 | all (snippet + CSP hash) | S |
| I1 | `MCO.overlay` focus/inert + Esc stack | P0 | 0.9.0 | explorer, status, maint, umrb, snow, dash | M |
| I2 | `pushUrlState`, `keepHash`, `onUrlState` + routing rule | P1 | 0.8.0 (default 1.0.0) | all | S |
| I3 | `.mco-progress` / `.mco-skeleton` / `MCO.loading` | P1 | 0.9.0 | all | S–M |
| I4 | `MCO.transition` + reduced-motion VT clamp | P2 | 0.10.0 cand. (clamp now) | dash, (photos) | XS |
| I5 | Radio segmented + `initSegmentedFallback` + 2.5.3 rule | P1 | 0.9.0 | photos, explorer, status, maint, umrb, snow, dash | S |
| I6 | `MCO.announce` + live-region clear fix | P0 | 0.8.0 (+PATCH) | all | XS–S |
| I7 | `.mco-notice` / `MCO.notice` / `.mco-empty` | P1 | 0.9.0 | maint, umrb, explorer, dash | S |
| D1 | `MCO.palette` ramps + spans + contrast CI | P1 | 0.9.0 | explorer, status, umrb, maint, snow, dash | M |
| D2 | `MCO.cssVar` / `chartTokens` / theme event (+ ECharts adapter cand.) | P1 | 0.8.0 / adapter P2 | snow, explorer, photos, dash | S |
| D3 | Tap-to-pin tooltip rule (`pinOnTap`) | P2 | 0.8.0 option | snow, dash, map apps | XS |
| D4 | `MCO.srTable` extended (caption, rowHeader, cap, selectable) | P0 | 0.8.0 | all; snow gets its first | S–M |
| D5 | `.mco-legend-row` accessible dim + `initLegendToggles` | P0 | 0.8.0 | status, maint, umrb, explorer, snow, dash | S |
| F1 | `MCO.initSearchBox` on the dashboard model + `.mco-search-icon` | P0 | 0.8.0 | explorer, status, photos, maint, umrb, dash | M |
| F2 | `MCO.initStepper` | P0 | 0.9.0 | snow, explorer, photos | S |
| F3 | `.mco-chip` | P1 | 0.9.0 | status, maint, umrb, dash | XS |
| F4 | Date range / multiselect / range slider (+ `color-scheme` now) | P2 | 0.10.0 cand. | dash (+explorer for color-scheme) | M |
| F5 | `.nav-btn.is-primary` | P1 | 0.8.0 | explorer, dash | XS |
| T1 | Type scale `--fs-*` | P1 | 0.9.0 → kit rules 1.0.0 | all | S / M |
| T2 | Spacing scale `--space-*` | P1 | 0.9.0 | all | XS |
| T3 | `--danger`/`--warning`/`--success` (+fill, on-fill) (#2) | P0 | 0.8.0 | maint, umrb, explorer, status, dash | S |
| T4 | 10-step brand scale (tokens.json) | P2 | 0.9.0 | non-vanilla consumers | S |
| T5 | Dark-safe wordmark + SVG badge + logo rules | P1 | 0.8.0 | all; snow export | S |
| T6 | Title/social rule + `setPageTitle`/`setSocialMeta` | P1 | 0.9.0 | dash, snow, photos, status | S |
| T7 | `.mco-footer` + `MCO.credit()` | P1 | 0.9.0 | dash, all exports | XS |
| M1 | `MCO.map.watchBasemap` + blank fallback style | P0 | 0.8.0 | all six + dash | S |
| M2 | Touch targets: MapLibre ctrls, popup close, panel toggle (**declined as an issue**) | P0 | 0.8.x PATCH | all map apps | XS |
| M3 | Network color + shape registry, selection-token rule | P1 | 0.9.0 | explorer, photos, status, umrb, dash | S |
| M4 | DOM-only popups + `popupContent` + popup shell CSS | P0 | 0.8.0 | status, maint, umrb, explorer, snow, dash | S |
| M5 | Co-located convention (halo+cycle / badge+spider) | P1 | 0.9.0 | explorer, status, maint, dash | S |
| Q1 | `tools/verify/` harness + CSS lint (untagged overrides) | P1 | 0.9.0 (tooling) | all | M |
| Q2 | `CONFORMANCE.md` checklist | P1 | 0.8.0 (docs) | all | S |

## Brand-consistency risks observed today

1. **Untagged overrides hide drift.** Only 2 of 6 adopters use `kit-override` at all (one tag each). snow restyles `.mco-panel`, hides the brand at 1060 with `display:none`, and `display:none`s `.control-label`, all untagged. explorer `display:none`s the brand at 640.
2. **A stale `--text-dim` lives on in five copies of one icon.** The search-icon data URI uses stroke `%237a8190`, the AA-failing value the kit retired. It is in explorer, status, photos, maint and umrb.
3. **Selection color is a literal.** explorer `'#5aaee8'` (`app.js:1203`) and the photos fallbacks paint the dark-theme ring on the light theme.
4. **Accent misuse.** explorer uses `--accent` as border, text or icon color 13 times, and `#fff` on `--accent` in `#scale-apply` (2.22:1 in high contrast).
5. **The logo can't go on dark, and exports lack it.** The only wordmark SVG is near-black text (`#1A1919`). snow's export logo is hot-linked from climate.umt.edu and blocked by its own CSP, so the brand mark never appears in its exports.
6. **Titles and cards in three formats.** Dashboard is detail-first; snow uses the long family with two middots; photos' `og:title` is "Montana Mesonet Photos · …". Social cards also differ (`preview.png` vs `og-card.png`; snow has no og:image), and so do canonical hosts (status → github.io).
7. **Credit wording and separator drift.** Credits read "Montana Climate Office · climate.umt.edu" in some places and "NOAA SNODAS | Montana Climate Office" in others. Status credits MCO nowhere on the page.
8. **Five warning/status palettes.** `--c-warn` (maint and umrb), `.scale-hint` (explorer, no high-contrast value), `--status-*` (status), maint pill colors, and the dashboard's ⚠ fallback. The kit has no status tokens (#2).
9. **Mobile chrome differs per app.** Brand collapse happens at 750 (kit), 640 (explorer) or 1060 (snow). Controls wrap at 1200 or 1280, with a select at 1060 in photos. Navigation sits top-left in explorer and top-right elsewhere. The compass shows in snow only.
10. **Legend dimming fails contrast in three apps.** status, maint and umrb apply `opacity: .4` to the whole row; explorer dims the swatch. Same component, two looks, one of them failing 1.4.3.

## Decisions for the user / kit maintainer

1. **Theme-change event name.** The kit standard `mco:themechange` (proposed) or the dashboard's existing `mco-theme-change`. The dashboard would rename to match the kit.
2. **Favicon/og source.** Hot-link from the pinned kit tag (recommended) or vendor per app. The family does both today.
3. **A 10-step brand scale in tokens.json (T4).** It helps library consumers avoid inventing blues, but it is a new kind of token.
4. **Recolored wordmark (T5).** It needs brand-owner sign-off.
5. **Shipping a hand-written `types/mco.d.ts`.** The constitution says "no TypeScript". A `.d.ts` is documentation, not a build, but it is still the maintainer's call.
6. **3-state theme toggle as the 1.0.0 default**, not only opt-in (#3).
7. **pushState for drill-down (I2).** It changes Back-button behavior family-wide, so prove it on the dashboard first.
8. **M2 touch targets** stays a recommendation (the user declined an issue). Confirm whether it should ride 0.8.0 anyway.
9. **The 0.8.0 scope.** The additions above roughly double a release CONSUMERS already calls "the largest piece of work waiting". The alternative is 0.8.0 = the planned seven + T3/#3/#4/I6/M1/M4, with the rest in 0.8.1–0.8.x minors.
