# mesonet-dashboard

- `app/` — the legacy Dash dashboard (served at mesonet.climate.umt.edu/dash).
- `web/` — the React rebuild, live on GitHub Pages at `/mesonet-dashboard/`. **Frozen:** hotfixes only, each mirrored into `web-next/src/core/` in the same PR.
- `web-next/` — the house-style rebuild (Alpine + ECharts), previewed at `/mesonet-dashboard/next/`. **Start with [`web-next/ARCHITECTURE.md`](web-next/ARCHITECTURE.md)** (layers, conventions, how to add a chart/card/tab/URL key/color).

## House style
This app consumes mco-web-style (pinned + SRI in index.html). Design tokens,
a11y mandates, and interaction conventions: see HOUSE-STYLE.md in
https://github.com/mt-climate-office/mco-web-style — tokens only (no raw
hexes), --accent is fill-only, aria-pressed drives toggle styling, canvas
data needs a live region + sr-only table twin. To change shared styling,
change the kit and bump the pinned version here; never patch a local copy.

Kit version pinned: **@0.7.1** (`web-next/index.html`).
