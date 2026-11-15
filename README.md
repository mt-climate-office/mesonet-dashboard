# The Montana Mesonet Dashboard

Weather and soil data from one Montana Mesonet station.

https://mesonet2.climate.umt.edu/dash/

## Run it

The app is in `web/`. The dev server proxies the API. Open http://localhost:5174/mesonet-dashboard/.

```sh
cd web
npm ci
npm run dev
```

## Deploy

`.github/workflows/deploy-web.yml` publishes `web/` to GitHub Pages on a push to `main`.
The Mesonet host proxies `/dash/` to Pages.
Cutover: change `MESONET_ORIGIN` in `web/src/core/config.ts` and the CSP `connect-src`.

## URL parameters

The section is the hash: `#now`, `#charts` or `#about`.

| Parameter | Values | What it does |
|---|---|---|
| `s` | station id, e.g. `aceabsar` | Opens that station |
| `units` | `us`, `si` | Display units |
| `theme` | `dark`, `light`, `high-contrast` | Theme |
| `v` | variable or Ag tool id, e.g. `air_temp`, `gdd` | Opens that chart |
| `from`, `to` | `YYYY-MM-DD` | Chart window |
| `agg` | `hourly`, `daily`, `raw` | Chart interval |
| `cmp` | `1` | Opens Compare |
| `dl` | `1` | Opens Download |

Every key is in `web/src/core/url-schema.ts`.

## Data

- Mesonet API: https://mesonet2.climate.umt.edu/api/v2/docs
- Forecasts and alerts: https://api.weather.gov
- Station photos: https://data2.climate.umt.edu/mesonet/photos/schedule/schedule.json
- Soil parameters: https://data2.climate.umt.edu/mesonet/soils/soil_params.json
- Normals, the outage notice and one-pager links, read from `main` on raw.githubusercontent.com: `normals/`, `outage.json`, `one-pagers.json`.

Workflows rebuild `normals/` weekly with `calc_normals.R`, and `one-pagers.json` every 3 hours with `get_pager_urls.py`.

The retired Python Dash app is in `app/`, with the root `Dockerfile`. It still serves mesonet.climate.umt.edu/dash/ until the cutover.

## Tests

```sh
cd web
npm run typecheck
npm run lint
npm test
npm run verify
```

`.github/workflows/web-check.yml` runs them on pull requests.

## Kit

`mco-web-style` 1.0.0.
Design rules: mco-web-style/HOUSE-STYLE.md
