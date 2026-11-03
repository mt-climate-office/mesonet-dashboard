# mesonet-dashboard

- `app/` — the legacy Dash dashboard (served at mesonet.climate.umt.edu/dash).
- `web/` — the dashboard (Alpine + ECharts, house style), on GitHub Pages at `/mesonet-dashboard/`, which the Caddy proxy (mesonet_app) also serves as `mesonet.climate.umt.edu/dash/next/` (the install address). **Start with [`web/ARCHITECTURE.md`](web/ARCHITECTURE.md)** (layers, conventions, how to add a chart/card/tab/URL key/color). The earlier React app was retired 2026-10-12 (in git history).

## House style
This app consumes mco-web-style (pinned + SRI in index.html). Design tokens,
a11y mandates, and interaction conventions: see HOUSE-STYLE.md in
https://github.com/mt-climate-office/mco-web-style — tokens only (no raw
hexes), --accent is fill-only, aria-pressed drives toggle styling, canvas
data needs a live region + sr-only table twin. To change shared styling,
change the kit and bump the pinned version here; never patch a local copy.

Kit version pinned: **@0.17.0** (`web/index.html`; MapLibre 6.11.2 through the kit's import map). Station photos are the kit's `MCO.photos` (`photos/mco-photos.js`), typed in `web/src/types/mco-photos.d.ts`. The station search is the kit's `MCO.places.initPlaceSearch` on `MCO.initSearchBox` (`places/mco-places.js`; gazetteer from the same tag), typed in `web/src/types/mco-places.d.ts`. The Now hero's one-line summary (with the 24 h peak gust, the hourly rain sums and the current NWS period) is the kit's `MCO.summary` (`summary/mco-summary.js`), typed in `web/src/types/mco-summary.d.ts`. The vitest suite loads the same pinned, SRI-checked files, and the gazetteer by the hash `mco-places.js` carries (`web/test/kit.ts`). No TypeScript copy of kit logic.
