# Kit notes (mco-web-style @0.7.1)

A running log, for the kit proposal: every place the UX refactor needed something
mco-web-style does not have, or had to override. Each entry names the local
selector or function, why it exists, and the kit API it suggests. The new
primitives are written to be lifted as they are: framework-free CSS on kit tokens
plus a small vanilla `init…({…})`, with the Alpine wrapper separate
(`src/ui/layout/*` → wrappers in `src/ui/picker`, `src/ui/shell`).

Status key: **new** = the kit has nothing; **override** = a kit rule is changed
locally (`/* kit-override */` in the CSS); **gap** = the kit has the piece but it
falls short.

## Components

### Bottom sheet — new
- **Here:** `.dash-sheet` (`ui/layout/sheet.css`), `initSheet({ panel, handle, scrim, background, toggles, onChange })`
  (`ui/layout/sheet.ts`).
- **Why:** HOUSE-STYLE §3 names the bottom sheet as *the* compact pattern (mesonet-explorer's
  `#station-sheet`, `app.js:3062-3171`), but every app hand-rolls it. Explorer's version has no Esc,
  no focus move or return, and no `inert` background; this one adds all three.
- **Behaviour:** `data-state="peek" | "full"`; drag the handle up → full, down → peek → closed (distance
  or velocity, explorer's thresholds); tap/Enter on the handle toggles; `.enter`/`.leaving` slide (220 ms,
  instant under `MCO.reducedMotion()`); publishes `--sheet-h` on `<html>`; sits at `bottom: var(--tabbar-h)`
  and `--z-detail`.
- **Proposed:** `.mco-sheet` (+ `.mco-sheet-head`, `.mco-sheet-handle`, `.mco-sheet-grab`, `.mco-sheet-body`)
  and `MCO.initSheet({ panel, handle, scrim?, background, toggles?, onChange? }) → { open({state, opener, focus}), close({restoreFocus}), setState, isOpen, state, destroy }`.

### Side drawer — new
- **Here:** `.dash-drawer[data-presentation="inline" | "overlay"]` (`ui/layout/drawer.css`),
  `initDrawer({ panel, toggles, scrim, overlay, background, onChange })` (`ui/layout/drawer.ts`).
- **Why:** HOUSE-STYLE §3 mentions "off-canvas drawer + `.mco-scrim`, panel at `--z-drawer`" but ships only the
  scrim and the tier. Explorer's sidebar (inline, margin slide) and its compact drawer (overlay) are two
  copies of one idea.
- **Behaviour:** inline = in the flex row, slides by `margin-left`, sticky under the navbar with its own
  scroll, not modal; overlay = fixed at `--z-drawer` with the scrim, modal (`inert` background). Closed =
  `visibility: hidden` after the slide **and `inert`**: `visibility` alone is not enough, because MapLibre's
  compact attribution sets `visibility: visible` on itself and stays focusable inside a hidden drawer.
- **Proposed:** `.mco-drawer` with the same attribute, and `MCO.initDrawer({ panel, toggles, scrim?, overlay: () => boolean, background, onChange? })`.
  The overlay breakpoint stays the app's choice (here: below 1060 px).

### Focus scope for non-`<dialog>` surfaces — new
- **Here:** `createFocusScope({ panel, background, onEscape })` (`ui/layout/focusScope.ts`), used by the
  drawer and the sheet.
- **Why:** `MCO.initInfoModal` gives `<dialog>` its focus return and Esc; a sheet or drawer is not a
  `<dialog>` (it must coexist with the page, and the inline drawer is not modal), so it has to do
  focus-in, `inert` on the background, Esc (only when no inner control consumed it, e.g. an open combobox),
  and focus-return itself.
- **Proposed:** `MCO.focusScope({ panel, background, onEscape }) → { activate({modal, opener, focus}), deactivate({restoreFocus}), setModal, destroy }`.

### Bottom tab bar and section row — new
- **Here:** `.dash-tabbar` / `.dash-tab` (compact) and `.dash-sections` / `.dash-section-link`
  (tablet/desktop), `initSectionNav({ root, onNavigate })` (`ui/layout/sectionNav.{ts,css}`).
- **Why:** the kit's chrome is the top navbar only. A phone app with several sections needs a bottom bar
  (56 px targets, safe-area padding, `--z-chrome`), and the links must stay real `<a href>` (new tab, copy,
  no-JS) while a plain click goes through the app's router and view transition.
- **Also:** current = `aria-current="page"`. The kit styles toggles by `[aria-pressed]` only, so app.css
  already mirrors that for `a.nav-btn[aria-current]` (W1). Not colour alone: the tab bar adds an indicator
  line and a bolder label.
- **Proposed:** `.mco-tabbar` / `.mco-tab`, `.mco-section-nav` / `.mco-section-link`, kit styling for
  `.nav-btn[aria-current="page"]`, and `MCO.initSectionNav({ root, onNavigate }) → { setCurrent, destroy }`.

### Height custom properties — new
- **Here:** `publishHeight(el, '--tabbar-h')`, `publishHeight(navbar, '--chrome-h')` (`ui/layout/sectionNav.ts`).
- **Why:** explorer's `syncOverlayMetrics()` (`app.js:2914-2920`) does the same by hand for `--chrome-h` and
  `--sheet-h`. Any app with fixed chrome needs it.
- **Proposed:** `MCO.publishHeight(el, prop) → dispose` (ResizeObserver + resize; 0 while not rendered),
  with the kit documenting `--chrome-h`, `--tabbar-h`, `--sheet-h` as the shared names.

### In-flow card — new
- **Here:** `.dash-card`, `.dash-card-head`, `.dash-card-title`, `--card-pad` (`ui/layout/card.css`).
- **Why:** `.mco-panel` is glass, absolutely positioned, for floating over maps; page content needs a flat
  surface. web-next had three (`.latest-card`, `.ag-card`, `.dl-card`). The card is `position: relative` so
  `.sr-only` descendants (absolute) cannot escape and widen the page (seen with the forecast strip).
- **Proposed:** `.mco-card` (+ `-head`, `-title`), `a.mco-card` hover state.

### Skeletons — new
- **Here:** `.dash-skel` + shapes `--line`, `--value`, `--spark`, `--media`, `--period`, `--chart`, `--table`
  (`ui/layout/skeleton.css`).
- **Why:** no kit loading placeholder; apps print "Loading…" and the layout jumps when data arrives.
- **Behaviour:** token shimmer (`--bg-raised` + `--border-glass` sweep), static under reduced motion, always
  `aria-hidden` (the slot carries `role="status"` text).
- **Proposed:** `.mco-skel` with the same modifiers.

### Status badge — new
- **Here:** `.dash-badge`, `.dash-badge--warn` (`ui/layout/card.css`): "No report for over 2 hours".
- **Proposed:** `.mco-badge` (+ `--warn`): text + border, the warning variant heavier and with an icon, never colour alone.

### Toggletip — new
- **Here:** `.dash-toggletip` + `.dash-toggletip-btn` (on `.nav-btn.mco-btn-info`) + `.dash-toggletip-tip`
  (`ui/layout/toggletip.css`), `initToggletip({ button, tip })` (`ui/layout/toggletip.ts`). The Now
  "Provisional data" note.
- **Why:** the kit's `.mco-tooltip` is pointer-following and `aria-hidden`, so it cannot carry an explanation
  that touch and screen-reader users need. `.mco-btn-info` is sized for the navbar (34 px), so inline next to
  text it is overridden to 24 px on hover devices (touch keeps 40 px).
- **Behaviour:** click/tap toggles; `aria-expanded` + `aria-controls`; the note follows the button in the DOM;
  Esc or a pointer press outside closes it. The note hangs from the nearest positioned ancestor.
- **Proposed:** `.mco-toggletip` and `MCO.initToggletip({ button, tip })`, plus an inline size for `.mco-btn-info`.

### Sparkline — new (optional for the kit)
- **Here:** pure geometry `core/charts/sparkline.ts` → `<svg viewBox preserveAspectRatio="none"><path vector-effect="non-scaling-stroke">`,
  `.dash-spark` styles (`styles/now.css`).
- **Why:** inline SVG never captures touch scrolling and needs no chart library. Stroke is `--accent-line`
  (≥ 3:1 on every surface, WCAG 1.4.11); the range goes to an `.sr-only` sentence.
- **Proposed:** `.mco-spark` CSS and a tiny `MCO.sparkPath(t[], v[], {kind, width, height})` if a second app wants it.

### View Transitions — new
- **Here:** `withTransition(update, { direction, morph })` (`ui/layout/transition.ts`) and
  `ui/layout/transition.css` (180 ms cross-fade + 12 px slide on one named region; `dash-morph` shared element).
- **Gap in the kit:** the reduced-motion blanket (`*, *::before, *::after`) does not match the
  `::view-transition-*` pseudo-elements, so an app has to add its own reduced-motion block (done here) as
  well as skip `startViewTransition` in JS.
- **Proposed:** `MCO.transition(update, { direction, morph })` and add
  `::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important }`
  to the kit's reduced-motion block.

## Tokens

### Type scale — new
- **Here:** `--fs-xs .75 · --fs-sm .875 · --fs-md 1 · --fs-lg 1.25 · --fs-xl 1.75 · --fs-2xl 2.5` rem (`ui/layout/type.css`).
- **Why:** the kit sets sizes per component (0.55–1.05 rem, nine distinct values in this app alone).
- **Proposed:** kit `--fs-*` tokens (theme-independent, one `:root` block), used by the kit's own components over time.

### Breakpoints — gap
- **Here:** the desktop edge `(min-width: 1060px)` is written in JS (`ui/picker/stationPicker.ts`) and CSS.
- **Why:** the kit's ladder has 1060 only as "tighten chrome", and `MCO.viewport` knows only compact/touch.
- **Proposed:** `MCO.viewport.DESKTOP_MQ` / `isDesktop()` and the CSS comment beside `COMPACT_MQ`, so
  "tablet" (641–1059) and "desktop" (≥ 1060) are named once.

## Overrides

| Local rule | Why | Proposed kit change |
|---|---|---|
| `.mco-navbar { flex-wrap: nowrap }` (`ui/layout/shell.css`) | One-row navbar at every width; the kit wraps (mesonet-status relies on it). | `.mco-navbar--single-row` modifier. |
| `.mco-navbar > .controls { flex: 1 1 auto; min-width: 0 }`, `.dash-switcher { flex-shrink: 1; min-width: 0 }` | The station switcher takes the free width and truncates; `.nav-btn` is `flex-shrink: 0; white-space: nowrap`. | `.nav-btn.is-truncating` (shrinks, ellipsis on its text span). |
| `.mco-toast { bottom: calc(var(--tabbar-h) + var(--sheet-h) + 1rem) }` on compact (`ui/layout/sectionNav.css`) | The toast must clear the tab bar and an open sheet; explorer has the same override for `--sheet-h`. | Kit toast `bottom: calc(1.5rem + var(--tabbar-h, 0px) + var(--sheet-h, 0px))` by default. |
| `.ctl-input { font-size: 1rem }` under `(hover: none)` (`ui/controls/controls.css`) | iOS Safari zooms into any focused field under 16 px. | Kit base rule for form fields on touch, or an `.mco-input`. |
| `.dash-scrim` adds `backdrop-filter: blur(2px)` to `.mco-scrim` | Explorer's look. | Optional `.mco-scrim--blur`. |
| `.dash-toggletip-btn.mco-btn-info { width/height: 1.5rem }` under `(hover: hover)` (`ui/layout/toggletip.css`) | An ⓘ inline next to text; the kit's is a 34 px navbar button. Touch keeps 40 px. | An inline `.mco-btn-info--sm`. |
| `.dash-link` and `.dash-section-link` get `min-height: 40px` under `(hover: none)` | HOUSE-STYLE §5.5 for standalone links (not prose). | A kit `.mco-link` for standalone links. |

## Notes for kit consumers (not kit changes)
- **Skip link + hash routing:** the kit skip link (`href="#main"`) changes the hash. A hash router must
  ignore unknown hashes or the skip link navigates away (fixed in `core/router.ts` `sectionForHash`). Worth a
  line in HOUSE-STYLE §5.6 or a JS skip link.
- **Alpine + SVG:** `:viewBox` binds lower-case `viewbox`, which SVG ignores; use `:view-box.camel`.
  `<template x-for>` cannot live inside `<svg>`; draw repeated shapes as one path (`sparkline` bars).
- **`.mco-panel` legend in a narrow drawer:** `MCO.initCollapsible({ startCollapsed: true })` already
  covers it (the map legend now takes `legendCollapsed`); no kit change.
