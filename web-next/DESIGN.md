# web-next design

How the dashboard is laid out and why: the information architecture, the
layout ladder, the shared components, motion and type. Read it with
ARCHITECTURE.md (code layers, data flow, "How to …"). It describes the P0
prototype of the UX refactor (plan "offer-this-as-a-unified-quill"); P1 fills
in Charts, Ag, Download and About.

## Information architecture

```
Station view (?s=<id>; remembered in localStorage mco-dashboard-station)
├─ Now       #now (default)  current-conditions overview
├─ Charts    #charts         P0: the existing Latest view as "Compare" (cmp=1)
│                            P1: variable list → variable page (v=…) | Compare
├─ Ag        #ag             the Ag Tools view
├─ Download  #download       the Data Downloader view
└─ About     #about          metadata, all current readings, locator map
Station picker: drawer (desktop/tablet) or bottom sheet (phones):
                search · Near me · recents · network chips · map
```

- **Entry:** `?s=` opens that station; otherwise the last one; otherwise the picker (first visit).
- **Picking** a station closes the picker at every size (the desktop drawer saves "closed") and moves focus
  to `<main>`, the new station's content.
- **History:** a section change is `pushState`, so Back returns to the previous section; changes inside a
  section (dates, toggles) replace the entry. Section links are real `<a href>`s: they open in a new tab
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
| Freshness | "Updated 7 min ago", **Provisional** badge, **No report for over 2 hours** warning | `/latest` (1) |
| Hero | Air temperature; NWS feels-like with "Wind chill"/"Heat index"; today's high/low; gridMET normal high/low; 48 h sparkline | `/latest` (1); hourly + `tmmx`/`tmmn` (2) |
| Tiles | Wind (speed, gust, compass glyph pointing where it blows), Precipitation (today, 24 h, 7 d, YTD vs normal), Humidity, Solar, Pressure, Soil (depth profile: temp + VWC bar), Snow depth (only with snow: ≥ 0.5 in now or in any hour of the last 72 h), VPD (AgriMet); each a link to its variable, with a 48 h sparkline | `/latest`, `/derived/ppt/` (1); hourly + `pr` (2) |
| Media | Latest camera frame (opens the photo dialog), or the wind rose without a camera | photo schedule (1) |
| Forecast | NWS periods in a horizontal strip with scroll snap | NWS (1) |
| All readings | link to About | — |

Tier 1 requests start together when Now mounts; tier 2 (one 72 h hourly request for every sparkline, the
normals CSVs) once `/latest` is in. Every slot holds its size with a skeleton while it loads, so nothing
shifts. Values are Space Mono on the type scale; labels are small caps in `--text-muted`.

Screenshots (P0, in the session scratchpad `ux-p0/`): `390-dark-now-acebozem.png`,
`390-dark-sheet-peek.png`, `768-light-now-acebozem.png`, `1440-dark-now-acebozem.png`,
`1440-dark-drawer-open.png`, `390-light-now-arskeogh.png` (AgriMet, wind rose).

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

New CSS uses only these. Older per-tab CSS (latest/ag/downloader) moves onto them as P1 rebuilds each section.

## Accessibility notes

- Every new surface is in the axe matrix (`scripts/verify/axe.mjs`: `now`, `picker`) × 3 themes × 1440/390.
- Touch targets ≥ 40 px under `(hover: none)`; the tab bar is 56 px.
- Status is text: "Provisional", "No report for over 2 hours", "Feels like 41° · Wind chill".
- The picker is `role="dialog" aria-modal="true"` only when it is modal (sheet, overlay drawer); the inline
  drawer is a plain landmark beside the content.
