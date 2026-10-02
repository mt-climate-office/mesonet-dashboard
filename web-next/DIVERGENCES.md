# Intentional divergences

What web-next deliberately does differently, in three parts:

1. **House style**: visual changes that come from adopting mco-web-style (palette, fonts, themes).
2. **vs web/**: behaviour that differs from the React app this replaces.
3. **Carried over from web/**: divergences from the legacy Dash app (`app/mdb`) that web/ already documented and that still apply. IDs refer to `web/scripts/fidelity/CHECKLIST.md`.

Each entry gives the old behaviour, the new one, and why. Add an entry in the same PR as the change.

## House style

> Placeholder. W1 (palette) fills this in: one entry per changed color role from the plan's palette table (networks, per-variable lines, precipitation/ETr, soil depths, wind-rose bins, annual years, GDD, CCI, feels-like, heatmaps, normals/sensor events/FC–WP), each naming the legacy color it replaces (about 18 CHECKLIST color matches).

### Fonts, chrome and themes
- **web/:** system font stack, stock Mantine blue, light theme only.
- **New:** kit tokens and fonts (Outfit for UI, Space Mono for numbers and ids), the kit navbar, and three themes (dark, light, high contrast). The theme follows `?theme=`, then the org-wide `mco-theme` choice, then the OS setting.
- **Why:** HOUSE-STYLE §1–§2; the user chose the full house style.

### Page title
- **web/:** "Montana Mesonet Dashboard".
- **New:** `Dashboard · MT Mesonet` in the tab and `Dashboard · Montana Mesonet` on link cards; the navbar reads "Mesonet Dashboard / A service of the Montana Climate Office."
- **Why:** HOUSE-STYLE §1 Naming.

## vs web/

### Tabs are links
- **web/:** Mantine tabs (`role=tab`) driven by the hash.
- **New:** `<a href="#ag">` links styled as kit buttons, with `aria-current="page"` on the active one. Routing works before JS runs, and back/forward move between tabs. Tab switches are announced in the live region.
- **Why:** the hash is navigation, so links are the native control; it keeps the shell to one tiny component.

### URL writing
- **Same as web/:** key names, defaults, legacy-key migration, `/<station>` path links, commas kept literal and spaces as `+`; Ag `var` stays in the URL at its default once it has been set or was in the link (nuqs `clearOnDefault: false`).
- **New:** every write is one batched `replaceState` per tick that keeps the hash. A value outside a key's allowed set (for example `agg=weekly`) is dropped from the URL on the first write instead of lingering.
- **Why:** one URL owner (`stores/url.ts`), HOUSE-STYLE §4.

### Theme in the URL
- **New:** when the URL carries `?theme=`, the toggle updates it, so a reload or a shared link shows the theme on screen.
- **Why:** the anti-flash script gives `?theme=` precedence over the saved choice; a stale value would undo the toggle on reload.

### Fetch cache
- **Same as web/:** in-flight requests are shared; network errors and 5xx retry twice, 4xx never (TanStack `retry` in `web/src/lib/queryClient.ts`).
- **New:** an errored request stays errored until something calls `refresh()` (for example a Retry button); TanStack refetched on remount.
- **Why:** Alpine re-evaluates templates freely; an automatic refetch on read could loop on a failing request.

### Outage notice color
- **web/:** mapped `outage.json`'s Bootstrap color to a Mantine color.
- **New:** maps it to a tone (`warning`, `danger`, `info`, `success`, `neutral`; unknown → `warning`) that the notice styles with kit tokens (`core/outage.ts#outageTone`).
- **Why:** no Mantine.

### Chart time axes
- **New:** chart x values are Denver wall-clock milliseconds rendered with `useUTC: true`, so labels and hovers read in Mountain Time for every viewer, as the Plotly charts did by ignoring offsets.
- **Why:** HOUSE-STYLE settled precedent (Mountain Time stamps), no time-zone library.

### Help dialog
- **New:** placeholder content until the global UI wave ports the full text (HELP-001 to HELP-006 below still describe the target).
## Carried over from web/: shell, Latest Data and shared data

> From `web/DIVERGENCES.md`. These describe behaviour versus the legacy Dash app and still apply. Renderer details written for Plotly (`connectgaps`, `matches: 'x'`, x-unified hover, `hoveron`) state the behaviour to keep; W2 re-verifies each against ECharts.


### Data

#### QC level 2 by default (LDC-016, DL-010)
- **Legacy:** every request sent `level=1` (provisional data).
- **New:** observations, derived, latest and downloader requests default to `level=2` (quality-controlled). The Downloader keeps a QC selector (`qc=0|1|2`).
- **Why:** level 1 passes through flatlined sensors and false precipitation spikes (mesonet-db-rds#189). Level 2 is what the Mesonet publishes as its quality-controlled product.

#### Precipitation is the API's merged `ppt`; `ppt_corrected` is ignored
- **Legacy:** built its element list by substring match against `{API}elements`. On mesonet2 this would also pull in `ppt_corrected`, and `plot_ppt` would then plot that column.
- **New:** Latest Data plots the default merged `ppt` element only. The mesonet2-only element `ppt_corrected` ("Precipitation (fill-corrected)") is never offered as a variable chip, never requested, and never mapped to a panel (`LATEST_EXCLUDED_ELEMENTS`, `latestVariableForColumn`).
- **Why:** at QC level 2 the merged `ppt` is already wind-corrected. `ppt_corrected` is NULL inside high-wind events and puts the event total at the end, so plotting it next to `ppt` would duplicate and confuse the series.

#### Request shape (LDC-016, LDC-017)
- **No `premade`:** with it, `/derived/*` returns 500 (an upstream duplicate-label bug).
- **`rm_na=false` on the Latest plot:** missing observations stay as nulls, so lines break at gaps (`connectgaps: false`) instead of being drawn straight across them.
- **Inclusive end dates:** the API's `end_time` is an exclusive cutoff, so we send `end + 1 day`. Legacy sent the current local time when the end date was today.

#### Variables offered at a station (LDC-013)
- **Same as legacy:** chips come from `/elements/{station}/`: `description_short` before "@", deduplicated, plus Reference ET, sorted.
- **New:**
  - A variable missing from `ELEM_MAP` is requested by the station's own element codes and plotted with its name as the axis title. A new API element therefore degrades gracefully instead of crashing.
  - A variable the station doesn't offer is ignored instead of erroring.

### Latest Data UI

#### Native NWS forecast cards (LDT-009)
- **Legacy:** embedded `forecast.weather.gov/MapClick.php` in an iframe.
- **New:** renders the NWS API forecast periods as cards, with a link to the full MapClick page.
- **Why:** the iframe is not mobile friendly, can't be themed, and shows NWS chrome inside our card.

#### MapLibre locator map (ST-004, ST-005, DL-018)
- **Legacy:** an `{API}map/stations` iframe (Latest) and a Scattermapbox figure (Downloader).
- **New:** an in-app MapLibre map on the Carto positron basemap. Clicking a marker selects the station. Legacy's click callback was dead, so its iframe map never selected anything.
- **Why:** one map component for both tabs, no external iframe, and working selection. The USGS relief tiles, county lines and the co-located colour are not ported.

#### Photos come from the data2 archive, not the API (LDT-010, LDT-011, LDT-012, LDT-013, LDT-014)
- **Legacy:** directions guessed from the camera model on `/deployments/{station}` (EC-ScoutIP gave N/S/E/W/Snow, other models N/S/North Sky/South Sky, no camera N/S/Ground). The time list was every 09:00/15:00 "Morning/Afternoon" slot back to the camera start date, and each image came from `{API}photos/{station}/{dir}?dt=…`.
- **New:** everything comes from the Mesonet photo archive at `https://data2.climate.umt.edu/mesonet/photos/` (CORS-open CDN). The app makes no `/photos` API requests.
  - **Cameras and directions:** from the camera registry `photos/schedule/schedule.json`. A station has a camera when it has a current schedule period (`until: null`) with views. The direction chips show the views that have frames on the chosen day. On a day with no frames they show the views the schedule had that day, so a past date can show views the camera has since dropped (for example acecrowa's North Sky and South Sky before 2026-09-07). Labels use legacy's words (North, South, East, West, North Sky, South Sky, Ground, Snow).
  - **Times:** a date picker (from the camera's `first_month` to today) and a Select of the frames that actually exist that day, newest first, labelled in Mountain Time (for example "Oct 1, 2026 3:00 PM"). The default is the newest frame. Schedules change over time (acebozem went from 09:00/15:00 to 09:00/12:00/15:00 on 2026-09-20), and the list follows whatever was really captured.
  - **Where frames come from:** today and yesterday (Mountain Time) use live S3 listings of `photos/webp/large/{station}/{station}_{TOKEN}_{YYYYMMDD}`, one UTC day per direction for UTC today and yesterday, refreshed every 5 minutes. Older days use the station's monthly manifest `photos/manifest/{station}/{station}_{YYYY-MM}.csv`. Some manifest rows leave `webp_large` blank. For those, the WebP path is worked out from `slot_utc` (or the capture time snapped to the hour) and checked against a listing before it is shown, because most of those WebPs don't exist.
  - **Image:** the display image is the `webp_large` WebP for the chosen slot.
- **No camera in the schedule:** the "Latest Photo" choice is disabled. If a shared link asks for the photo card anyway, it shows "No camera images are available for this station." Legacy showed three blind chips and a single "today" option. If `schedule.json` can't load, the card says "Camera schedule unavailable." There is no API fallback.
- **Why:** the archive is the source of truth. It is fast (the schedule file is about 5 KB), while the API `/photos/` catalog took 22–80 s and lagged reality: nine cameras that were live in September 2026 were missing from it. The old 09:00/15:00 assumption also missed the new midday slot.

#### Photo tab enabled when the station has a camera (LDT-002, LDT-003)
- **Legacy:** "Latest Photo" was enabled only for HydroMet stations, and it was the default top card for them.
- **New:** "Latest Photo" is enabled when the data2 camera schedule lists the station with a current period. It is the default top card for those stations, as legacy made it the default for camera stations. Every scheduled camera is at a HydroMet station today. While the schedule loads, the auto default is Wind Rose. An explicit `card=photo` waits for the schedule.

#### Photo modal (LDT-015)
- **Same as legacy:** clicking the photo opens a centered 92vw modal.
- **New:** the modal has a "Download original" button. It downloads the same large WebP the card shows (`photos/webp/large/…_{slot_utc}.webp`) and saves it under that file's own name, for example `acebozem_N_20261001T150000Z.webp`. If the fetch fails, the image opens in a new tab.

#### Card defaults are "auto" (LDT-003, LDB-001, LDB-002)
- **Same as legacy:** with no `card`/`info` in the URL, the top card is Latest Photo for stations with a camera and Wind Rose otherwise. The bottom card is Current Conditions with a station and Locator Map without one. Choosing a station from the dropdown or the map resets both cards to auto.
- **New:** an explicit `card=`/`info=` in a shared link is honoured.

#### Current Conditions failure falls back to metadata (LDB-010)
- **Legacy:** switched to the metadata tab when the station *record* request failed.
- **New:** switches when the `/latest` request fails, and only while the bottom card is on auto. If the user explicitly picked Current Conditions, it shows "No data available for selected dates." instead.

#### Current Conditions rows (LDB-006, LDB-007, LDB-008)
- **Same as legacy:**
  - The row set and order: Timestamp, then the legacy `elem_labs` columns in API order, then Real Feel.
  - Raw values, and wind direction as "N (357.3 deg)".
  - The wind-chill-at-all-temperatures Real Feel (legacy bug kept for parity).
- **New:**
  - Snow Depth is shown. Legacy listed it as `Snow Depth [in.]` while the API sends `[in]`, so legacy silently dropped it (legacy bug not ported).
  - The timestamp is formatted ("Oct 1, 2026 2:30 PM").
  - Precipitation Summary values carry an " in" suffix.

#### Wind rose (LDT-005, LDT-006, LDT-007)
- **Same as legacy:** the rose follows the plotted date range and aggregation, and is titled "Wind Data from {start} to {end}" (Courier New).
- **New:**
  - The title wraps onto two lines at 14 px, because the card is narrower than legacy's.
  - The rose uses its own `wind_spd,wind_dir` request (with `rm_na=true`) instead of riding on the main record.
  - The speed bins are identical to legacy's (numpy half-even rounding, `pd.qcut(q=8)` linear-quantile edges). The legend shows the whole-mph speeds in each bin ("4 – 6") instead of pandas interval text ("(3.75, 6.0]").

#### Plot layout (LDP-001, LDP-002, LDP-021, MOB-002)
- **Legacy:** fixed 500 px (one panel) or 250 px per panel, in an 88vh scroll column. The x axes were independent but forced to the same range.
- **New:**
  - The plot fills its column, with a 200 px minimum per panel. Long selections scroll instead of squashing.
  - The x axes are linked (`matches: 'x'`), so pan and zoom move every panel together. Panning writes `from`/`to` to the URL and refetches.
  - On wide screens the card column is viewport-tall and scrolls internally.

#### Soil depth colours (LDP-011)
- **Legacy:** the Plotly default colours per depth (2 in `#636efa`, 4 in `#EF553B`, …).
- **New:** a Viridis sample, a CVD-safe palette (`core/params/palettes.ts` (legacy; replaced by `core/palette`)). The x-unified hover is applied to every panel, not just soil.

#### "Not available" panels (LDP-014, LDP-015)
- **Same as legacy:** a selected variable with no data in the window keeps an empty panel with "**{Variable} data are not available for this time period.**" (`add_nodata_lab`).
- **New:**
  - The text is 14 px, not 18 px, so it fits a narrow panel.
  - Legacy's early return (no notes or soil legends at all once any soil panel was empty, LDP-015) is not ported.

#### Empty and error states (ES-001 to ES-005)
- **Same as legacy:** the texts ("Select Station", "No variables selected", "No data available for selected station and dates / Either change the date range or select a new station.").
- **New:**
  - They render as centred text, not as a 500 px blank Plotly figure (ES-004).
  - Raw HTTP errors are logged to the console, never shown.
  - Malformed `?from`/`?to` show the no-data message without sending a request.

#### Variable selection (ES-002, LDC-014)
- **Same as legacy:** deselecting every chip shows "No variables selected" instead of re-applying the defaults.
- **New:** in the URL, an absent `vars` means the five defaults and `vars=` (empty) means none.

#### Period of record (LDC-005)
- **Same as legacy:** "Display Period of Record" switches to Daily from the install date to today, and the label becomes "Display Latest 2 Weeks", which restores Hourly for the last 14 days.
- **New:** the label is derived from the URL (Daily + install date + today), so a shared POR link shows the right label. The button is disabled with no station (legacy bug LDC-006 not ported).

### Sensor-change overlays (SC-001 to SC-010)
- **Same as legacy:** a port of legacy `_build_sensor_events` / `_filter_outage_events_to_metric_na` / `_add_sensor_event_overlays`, including 5afb746f (an outage ends at sensor replacement).
- **New:**
  - The config comes from `/config/{station}/`, which has no `public` parameter in v2.
  - The element→column map adds the 28 in (−70 cm) soil depth, which legacy lacked.
  - Times are computed as America/Denver wall-clock milliseconds, with no timezone library.
  - The hover polygon uses `hoveron: 'points'`, so it still fires under x-unified hover.

### Shell, routing and links

#### Base path (GS-003)
- **Legacy:** served at `/dash/` when `ON_SERVER` was set.
- **New:** the base comes from `VITE_BASE` (default `/mesonet-dashboard/`, for GitHub Pages behind mesonet2). `/dash` is pointed at it at cutover. `vite.config.ts` has the details.

#### NWSLI and station ids are case-insensitive (URL-002)
- **Legacy:** matched `/dash/<segment>` exactly against station id, then NWSLI id.
- **New:** `?s=` and `/<segment>` resolve case-insensitively (`?s=KEEM8`, `?s=keem8` and `?s=ACEABSAR` all work). The URL is then rewritten to the canonical id (`core/stations.ts#resolveStationId`).

#### `?state=` legacy share links (URL-006 to URL-010)
- **Legacy:** share links pointed at layouts saved on the old server (`./share/{hash}.json`).
- **New:** this client can't read those files. The `?state=` param is dropped (other params are kept), and a notice links to the same layout on the legacy dashboard. "Share" copies the live URL, which holds the full state in query params, instead of creating a server-side hash.

#### Outage notice freshness (OUT-001, OUT-006)
- **Legacy:** fetched `outage.json` server-side, cached for 60 s, and rendered the modal open on first paint.
- **New:** fetches the same file client-side on page load (5 s timeout, 60 s staleTime, failure means inactive), so the modal opens when the fetch resolves. raw.githubusercontent.com's own CDN cache (about 5 min) still applies to both.

#### Satellite Indicators hidden (GS-008, HELP-003)
- **New:** the tab is not routed. `#satellite` falls back to Latest Data with a link to the legacy dashboard's satellite view. The help modal says satellite indicators are available on the legacy dashboard.

#### Help modal (HELP-001 to HELP-006)
- **Same as legacy:** the content (welcome text with the crowagen example link, contacts, feedback form, GitHub issues, Background, Source Code).
- **New:**
  - The API docs link points to `mesonet2.climate.umt.edu/api/v2/docs` (the legacy AWS execute-api URL is gone).
  - The satellite paragraph is replaced by a short note on the Ag Tools and Downloader tabs.
  - The feedback form is the current Airtable form (GS-006, user-confirmed).

#### Tabs keep their state (GS-009)
- **Legacy:** rebuilt each tab from scratch.
- **New:** tab panels still unmount, but each tab's controls live in its own URL keys (`core/url-schema.ts`), so switching tabs and coming back restores them.

## Carried over from web/: Ag Tools

> From `web/src/features/ag/DIVERGENCES.md` (paths now under `core/ag/`).

The client-side compute library (`compute/`) ports the Mesonet API's derived
variables (`mesonet-db-rds/api/app/app/{etr,derived}.py`). The policy is
**"correct + documented"**: port each formula faithfully, fix the API's known
bugs, and record every intentional difference here. Golden tests in
`compute/*.test.ts` check parity against the Wave 0 fixtures
(`__fixtures__/`, level 2, US units, 3-decimal rounding) everywhere else.

To print the per-variable parity table, run `VITE_PARITY=1 npx vitest run src/core/ag --silent=false`.

API line numbers refer to `mesonet-db-rds` as of 2026-10-01.

### Parity achieved (no divergence)

Every computed value matches the fixture to its 3-decimal rounding, with a
maximum absolute difference of 0.0005 in the fixture's units:

| Variable | Tolerance (brief) | Observed max abs diff | Fixtures |
|---|---|---|---|
| ETo daily | 0.005 in/day | 0.0005 in | 3 stations × 2 windows (arskeogh winter: API 404) |
| ETo hourly | 0.001 in/h | 0.0005 in | 3 × 2 (arskeogh Jan: API 404) |
| Wind chill, heat index, feels-like (daily and hourly) | 0.1 °F | 0.0005 °F | 3 × 4 |
| CCI (daily and hourly) | 0.1 °F | 0.0005 °F | 3 × 4 (2 API 404s) |
| GDD daily and cumulative (default + 7 crops) | exact to 3 dp | 0.0005 °F·day | 3 × 2 × 8 |
| GDD stage labels | exact | exact (except D-GDD-1/2/4) | 3 × 2 × 6 crops |
| Percent saturation (vendored porosity, acebozem/arskeogh) | — | 0.0005 % | 2 × 4 |
| Percent saturation (API porosity, D-PS-1; incl. mdamalta) | — | 0.0005 % | 3 × 2 |

When the API returns 404 because `sol_rad` is missing for the whole window
(arskeogh winter, daily and hourly, for ETo and CCI), compute returns an
all-null series and does not throw.

### Divergences

#### D-ETO-1: a missing input gives null hourly ETo, not 0

- **API:** `etr.py:726` runs `eto = np.where(eto > 0, eto, 0)`. `NaN > 0` is
  false, so any missing input (e.g. wind) becomes **0 mm**.
- **Here:** `null`. A missing input is not zero evapotranspiration, and a 0
  would also bias daily and annual sums.
- **Observed:** arskeogh `hourly.jul2025` has 33 hours with no wind. The API
  reports 0.000 in for them, and we report null.
- **Test:** `compute/eto.test.ts`, "etoHourly golden parity", arskeogh jul2025
  (null count equals the missing-wind count), and "missing hourly input → null,
  not 0 (D-ETO-1)".

#### D-CCI-1: negative night-time solar radiation is clamped to 0

- **API:** `derived.py:669` takes `np.sqrt(avg_sol_rad)`. Pyranometers often
  report small negative values at night, which make the CCI NaN.
- **Here:** R is set to `max(0, R)` before the radiation correction
  (`compute/cci.ts` `cciRadCorrection`).
- **Observed:** none of the fixtures have negative solar values (night hours
  read 0.0), so golden parity is unaffected.
- **Test:** `compute/cci.test.ts`, "negative night-time solar is clamped to 0,
  not NaN (D-CCI-1)".

#### D-SWP-1: each station's VWC is clipped to its own lab range

- **API:** `derived.py:255` selects `clip_range = vwc_range[vwc_range["depth"] == depth]`
  with no station filter. `derived.py:262-263` then uses `.values[0]`, so a
  multi-station request clips every station with the **first** station's lab
  range for that depth.
- **Here:** `swp()` uses only the `SoilParams` rows whose `station` matches
  the series, including `labVwcMin`/`labVwcMax`.
- **Observed:** none. Each fixture is a single-station request.
- **Test:** `compute/soil.test.ts`, "clips each station to its own lab range
  (D-SWP-1)".

#### D-SWP-2: the soil parameters come from vendored mesonet-soils, not the API DB (data divergence)

The SWP formula is a verbatim port: `derived.py:1099-1123`, with clipping at
`188-299`. The parameters differ. The API reads `SoilParams` from its database,
which is not public. Our tests use the mesonet-soils release `2026-09-25`
(`compat/soil_parameters.csv`, copied to `__fixtures__/soil_params.test.csv`).
That release fits FX with θr = 0. The DB holds older fits.

Supporting evidence:

- The **clip ranges and clipped flags match the API exactly** on every row:
  `flagMismatch = 0` for all 8 cores × 4 windows.
- `fxInverse` exactly inverts the FX forward model.
- The vendored parameters reproduce the lab retention data
  (`<station>.soil-raw.csv`) with θ RMSE < 0.01 (test "vendored params
  reproduce the lab retention data").
- Percent saturation with porosity from the same release matches to
  0.0005 % **at these two stations**, whose porosities equal the DB's. That
  does not hold network-wide; see D-PS-1.

So the SWP gap comes from the parameters, not the code. Per the brief, the
tolerance is **not** loosened. These cores are listed in
`EXPECTED_SWP_DIVERGENCES` in `compute/soil.test.ts`. The tests assert that
they still differ, so a parameter refresh that brings them into agreement
fails the test and prompts removing them from the list.

| Station @ depth | Max abs diff (bar) | Median relative diff (per window) | Notes |
|---|---|---|---|
| acebozem @ 5 cm | 3765.9 | 0.24 – 9.6 | Dry-end clip (θ = 7.75 %): API 391.0 bar, vendored 4156.9 bar. The lab point there is about 309 bar. |
| acebozem @ 10 cm | 5.2 | 0.04 – 0.20 | |
| acebozem @ 20 cm | 2.2 | 0.01 – 0.13 | |
| acebozem @ 50 cm | 0.96 | 0.05 – 0.16 | |
| acebozem @ 100 cm | 11065.8 | 0.18 – 14.2 | Dry-end clip (θ = 5.65 %), vendored about 14× the API. The lab point there is about 417 bar. |
| arskeogh @ 10 cm | 0.31 | 0.03 – 0.06 | |
| arskeogh @ 20 cm | 1.57 | 0.03 – 0.23 | |
| arskeogh @ 50 cm | 0.83 | 0.03 – 0.12 | |

Both tested stations differ at every depth. At the dry-end clip, the API's
legacy fits are closer to the lab measurement than the θr = 0 vendored fits.
Choosing the parameter source is a decision for workstream B and the
orchestrator: data2 `mesonet/soils/…` should serve the DB parameters if parity
is wanted.

#### D-PS-1: percent saturation uses the API DB porosity, not mesonet-soils (data divergence)

The formula is a verbatim port (`derived.py:302-359`,
`clip(VWC / porosity · 100, 0, 100)`), and the VWC is the same level-2
observation the API uses. The porosity is what differed (AG-PS-001: mdamalta
1.4–18 percentage points below `/derived` at 4/8/20 in, plus a 36 in trace
the API does not have).

Root cause: a data-source difference, not a mapping or unit bug. Depths map
1:1 (10/20/50/91 cm ↔ `Porosity @ -10/-20/-50/-91 cm`), both sources are
Vol%, and the code was correct. mdamalta's porosity in the API DB is
58.95 / 61.8 / 48.47 % at 10 / 20 / 50 cm and **absent at 91 cm**. The
vendored mesonet-soils `2026-09-25` release has 62.64 / 67.06 / 54.46 /
66.92 %.

Survey (`scripts/fixtures/porosity-survey.mjs`; one keep=true request per
station, 2026-09-01..30, level 2, serialized): **31 of 91 has_swp stations
match at every depth, and 60 differ**. Of the 329 depths with both values,
171 agree to 0.005 and 158 differ. The API/vendored ratio has a median of
0.900 (IQR 0.899–0.918): most BLM/MDA stations look systematically scaled by
about 0.9. The DB lacks porosity at 47 depths that vendored has (mostly
91 cm; also acedupuy, acehuntl and aceingom at 50 cm; all of mdagildf), and
has 5 that vendored lacks (acerapl2 at all depths, nctbirne at 91 cm). Some DB
values are implausibly low, 14–20 % (blmterry, mdabench, mdafroid, wsrabsaw,
wsrboydw, wsrmelvi), and pin the API's saturation at 100 %. Vendored
acechest at 100 cm has porosity 0.

Fix (the smallest that matches the API everywhere): percent saturation is
still computed client-side from the level-2 VWC, but the **porosity comes
from the API**. `ui/porositySource.ts` reads it from `/derived/{daily,hourly}?elements=percent_saturation&keep=true`
(the `Porosity @ … [%]` columns, row by row) and keeps only the depths the API
reports. `POROSITY_SOURCE = 'vendored'` is the one-line switch back to
`compute` `percentSaturation()` over mesonet-soils, mirroring `SWP_SOURCE`
(D-SWP-2). Which porosity is physically right (for example, whether the DB
values are 0.9 × HYPROP initial water content, or bad rows such as blmterry)
is for the mesonet-soils and mesonet-db-rds maintainers to decide.

- **Tests:** `ui/porositySource.test.ts` checks golden parity with API
  porosity for acebozem, arskeogh and **mdamalta** (daily season2025, hourly
  jul2025; mdamalta fixtures from `capture.mjs --only mdamalta`). It also
  asserts that mdamalta's vendored porosity still differs, so a parameter
  refresh that fixes this fails the test and prompts the switch.
- **Live:** the harness `ag/percent-saturation` comparison passes at every
  station, mdamalta included.

#### D-GDD-1: wheat and barley stage labels are recomputed after the NDAWN switch

- **API:** `derived.py:1040-1048` derives `stage`/`name` from the first-pass
  (32/70 °F) cumulative. `derived.py:1051-1059` then switches rows at Haun ≥ 2
  to 32/95 °F and recomputes `gdd` and `cumulative_gdd`, but **not** the stage
  labels. Labels after the switch are therefore stale: they belong to a smaller
  cumulative than the one reported next to them.
- **Here:** the switch logic is identical (the same rows switch, and daily and
  cumulative values match the API), and the labels come from the final
  cumulative.
- **Observed:** in season2025 the fix changes 26 labels for acebozem wheat and
  27 for acebozem barley. The golden test also confirms that every API label
  after the switch equals the first-pass label.
- **Tests:** `compute/gdd.test.ts`, "gdd golden parity" (wheat/barley branch of
  `checkStages`), and "wheat switches to 32/95 at Haun 2 and relabels on the
  final cumulative (D-GDD-1)".

#### D-GDD-2: a crop with no stage table gets null labels, not "Planted"/0

- **API:** if no stage matches, `derived.py:1041-1048` fills `stage` with 0
  and `name` with "Planted". The API's DB also has a **corn** stage table
  (labels VE, V2, V3, V6, V9, V10, VT, R2, R4, and the name "Emergence") that
  is in neither vendored source (`derived/combined_stages.tsv`,
  `write_hemp_table.sql`).
- **Here:** an empty or missing `GddStageTable` gives `stage = null` and
  `stageName = null` on every row, never a fake "stage 0". When a table
  exists, the API behaviour is kept exactly: rows before the first threshold
  are stage 0, and they are named "Planted" only if some row in the series
  reached a *named* stage. Otherwise every name is null, which matches the API
  dropping the `Stage Name` column (`derived.py:1045-1048`; this always
  happens for canola, sugarbeet and sunflower, whose tables have no names).
  `projectGdd` continues the observed series' naming.
- **Tests:** `compute/gdd.test.ts`, corn branch of `checkStages`, and "crop
  without a stage table → null labels, not stage 0 (D-GDD-2)".

#### D-GDD-3: the cumulative carries forward over missing days

- **API:** `derived.py:1029` uses `groupby().cumsum()`, which leaves NaN on a
  missing day (and `merge_asof` at line 1040 rejects null keys).
- **Here:** the contract's semantics apply: a running sum that skips nulls and
  carries the previous total forward, and stays null until the first valid day.
  Daily GDD stays null on missing days.
- **Observed:** the fixtures have no missing temperature days.
- **Test:** `compute/gdd.test.ts`, "cumulative skips nulls and carries forward
  (D-GDD-3)".

#### D-GDD-4: the API's hemp stage ids differ from `write_hemp_table.sql` (data, informational)

The API's first hemp stage is "BBCH Stage 11". `write_hemp_table.sql` (and so
the vendored table) has "BBCH Stages 0-11". Names and thresholds match.
`checkStages` compares hemp by name. Workstream B should decide which spelling
to ship.

#### D-GDD-5: explicit cutoffs override the crop's

- **API:** when `crop` is given, `derived.py:58-62` ignores `low`/`high`.
- **Here:** if `lowC`/`highC` are passed, they win, which supports the UI
  threshold slider. The series is then not a crop series (`crop = null`,
  `ndawnSwitch = null`), and any bound left out falls back to the named crop's.
  Without custom cutoffs, the crop's cutoffs from `derived.py:80-90` apply.
  `GddSeries.ndawnSwitch` records whether the wheat/barley rule was applied,
  and `projectGdd` follows that record rather than re-deriving it.
- **Test:** `compute/gdd.test.ts`, "custom cutoffs in °C override the crop
  (D-GDD-5)".

### Conventions that are not divergences

- **GDD units exception:** GDD values and stage thresholds are °F·day, as in
  the contract and the published stage tables. GDD is computed in °F
  internally because clip-then-average is not unit-invariant once the cutoffs
  bind. `GddSeries.cutoffs` is reported in °C.
- **Wind height:** ETo converts wind to 2 m with the FAO-56 log profile.
  Wind chill and CCI use the raw sensor-height wind, as the API does.
- **Solar time:** hourly ETo uses the hour on a fixed UTC−7 clock plus 0.5,
  and the day of year of the local date (`derived.py:927-934`).
- **feels_like with missing wind or RH:** falls back to air temperature, as
  the API's NaN handling does.
- **Daily `epochMs`:** the UTC instant of local (America/Denver) midnight.
- **Annual:** `groupByYear` accepts daily rows only. It throws on hourly
  timestamps or duplicate dates. `hourlyToDaily(…, 'sum')` returns null for
  any day with fewer valid hours than the local day has (23, 24 or 25 across
  DST), unless `minHours` is passed, so a partial day never looks like a low
  total. A mean needs one valid hour.

### UI divergences vs the legacy dashboard (Wave 3)

Ag Tools is now computed in the browser from raw `/observations` (QC level
2) with the library above; the figures live in `figures/`, the views in
`ui/`. Differences a user can see, compared with the legacy Dash app
(`app/mdb/app.py`, `utils/plot_derived.py`):

- **Data source and QC.** Every variable except soil water potential is
  computed client-side from level-2 observations (legacy: `/derived` at the
  API's default level). Live check, last 30 days (2026-09-02..10-01) vs
  `/derived/daily` (level 2, no `premade`): max |Δ| ETo 0.0005 in, GDD (corn)
  0 (≤ 1e-13), feels-like 0.0004 °F, CCI 0.0005 °F at acebozem, arskeogh and
  acecrowa (`ui/crosscheck.live.test.ts`).
- **SWP stays on the API** (`/derived/{daily,hourly}?elements=swp`) until
  mesonet-db-rds#186 resolves (D-SWP-2). `ui/swpSource.ts` `SWP_SOURCE` is the
  one-line switch to the tested client path (`compute` `swp()`). Percent
  saturation is computed client-side from VWC, with the **porosity from the
  API** (`keep=true` Porosity columns; D-PS-1, switch `POROSITY_SOURCE`), so
  it matches `/derived` at every has_swp station (to 0.0005 %).
- **`var` is always in the URL.** The rebuild briefly defaulted to `etr`
  and dropped `var=etr` from links as the default; those links now open
  the legacy default (Growing Degree Days). `var` is now written even when
  it equals the default, so links name their variable explicitly.
- **Variable default and reset** match legacy: the default variable is
  Growing Degree Days, and changing the variable resets crop (wheat), custom
  GDD cutoffs, time aggregation (daily) and soil variable (VWC), as in
  `app.py` ~567-599. Explicit URL params in a deep link are kept on the
  initial load; only a user's change of variable resets them.
- **SWP annotations** match legacy: boxed "Field Capacity" (top-left) and
  "Wilting Point" (bottom-left) labels. The grey bands also have dashed
  0.33 / 15 bar reference lines, which legacy did not draw.
- **Plot size and x range.** The chart fills its card (at least 540 px) and
  the x axis fits the data (Plotly autorange), instead of legacy's fixed
  500 px height and [first − 1 day, last + 1 day] range. A fixed pad would
  fight the GDD projection, which extends the axis past the last observation.
  Derived data are cached in memory (TanStack Query), not in session storage.
- **No-station state** uses the legacy text: "Select Station" / "To get
  started, select a station from the dropdown."
- **Static data sources.** `data/staticSource.ts` `DATA2_STATIC_ENABLED =
  false`: the soil parameters and GDD stage tables load straight from the
  vendored `public/data/` files, with no data2 probes (and no console 404s),
  until data2 publishes `derived/gdd_stages.json` and the soils manifest. The
  data2 paths stay implemented and tested (`deps.data2Enabled`).
- **GDD cutoffs.** The slider shows the crop's cutoffs from `GDD_CUTOFFS_F`
  (what the API computes, incl. wheat/barley 32–70 °F switching to 32–95 °F at
  Haun stage 2), not the legacy slider table (wheat/barley 32–95, hemp 34–100,
  sunflower 44–100), which never matched the API's numbers. Open-ended caps
  (sunflower, hemp) sit at the slider's right end and read "no upper cutoff".
  Moving the slider switches to **custom cutoffs** (URL `gdd_lo`/`gdd_hi`),
  which drop growth-stage labels (the stage tables assume the crop's cutoffs);
  the UI says so and offers "Reset to <crop> cutoffs".
- **GDD stages** come from the vendored stage tables; hover shows
  "<stage> – <name>". Corn has no public stage table (D-GDD-2), so corn shows
  "No stage table for corn" (legacy showed the API DB's corn stages).
- **GDD projection (new).** When the window ends today, a projection runs
  through the chosen horizon (URL `gdd_proj`): default **end of season
  (Oct 31)**, falling back to +60 days when fewer than 14 days remain; also
  +30 / +60 days / off. NWS forecast days (dotted) then the 1991–2020 gridMET
  normals median (dashed) with a 25th–75th percentile band. A failed NWS
  forecast degrades to normals only, with a note.
- **Soil profile frozen mask.** Same rule as legacy (soil temperature ≤ 32 °F
  hides VWC, EC, SWP and saturation), but masked cells are drawn light grey
  with a legend note instead of blank. The profile is always daily (legacy hid
  the time toggle and reset it to daily). Only has_swp stations offer the SWP
  and saturation chips (legacy `update_swp_chips`); EC comes from
  `soil_ec_blk` observations.
- **SWP / saturation station filter.** Only has_swp stations are listed (as
  legacy `filter_to_only_swp_stations`); an ineligible station is cleared
  **with a notification** (legacy cleared it silently).
- **Missing sensors.** A window where a required input is entirely missing
  shows e.g. "Solar radiation unavailable for this period." (ETr, CCI; e.g.
  arskeogh with its dead pyranometer) instead of an empty plot; partial gaps
  get a note and stay gaps (hourly ETo is null, not 0: D-ETO-1).
- **Annual comparison.** Option labels show depths and heights in US units,
  like legacy `dist_swap` ("Soil VWC @ 4 in", "Air Temperature @ 6.6 ft"),
  and are naturally sorted. One `/observations/daily` request per year (level 2,
  daily mean; daily total for precipitation), drawn as each year arrives
  (legacy: one full-record request). The current year is black, width 3; prior
  years are Viridis samples (the pre-Wave-3 palette; legacy used YlGnBu).
  Precipitation is cumulative and stops at the last observed day rather than
  running flat to Dec 31. The y label keeps the sensor height
  ("Air Temperature @ 2 m [°F]").
- **Learn More.** Same slugs as legacy (gdd → `gdds/#<crop>-growing-degree-days`,
  soil profile → `soil_profile/`, cci → `risk/`, others pass through), except
  Annual, which links the base Ag Tools page instead of legacy's `ag_tools//`.
- **Date picker** ends at today (legacy allowed tomorrow).
- **Colors** (CCI YlOrRd ramp, GDD sand/indigo, Viridis heatmaps) are the
  pre-Wave-3 dashboard's CVD-safe palettes, unchanged in Wave 3.
- **Satellite tab** is hidden; `#satellite` links open Latest with a notice
  linking the legacy satellite view.

## Carried over from web/: Data Downloader

> From `web/src/tabs/downloader/DIVERGENCES.md`.

The Downloader tab (`tabs/DownloaderTab.tsx`, `tabs/downloader/`) ports the
legacy Dash downloader (`app/mdb/layout.py` `build_downloader_content`,
`app/mdb/app.py` ~2146-2369). This file records every deliberate
difference. The IDs refer to `web/scripts/fidelity/CHECKLIST.md` sections 12
and 13.

### Downloader

#### Request and QC

- **A QC level control replaces "Remove Flagged Data" (DL-007).** Legacy
  sent `rm_na = not checked`, so the switch did the opposite of its label
  (legacy bug). The rewrite offers a Raw / Provisional / Quality-controlled
  control (`level` 0 / 1 / 2) instead. Old links that carry `?rmna=true` map to
  level 2 (`core/url-schema.ts`).
- **The default is QC level 2, not legacy level 1 (DL-010).** Provisional
  data keeps gauge artefacts. For example, arskeogh precipitation for August
  2026 is 13.8 in at level 1 but 0.86 in at level 2 (mesonet-db-rds#189).
  Rows the daily QC pipeline has not reached yet are served provisionally and
  marked in the `provisional` column (`request.ts` `DEFAULT_QC_LEVEL`).
- **No `premade` data and an outer join (DL-010).** Observations and derived
  variables are fetched separately and joined with a full outer join on
  (station, datetime). Flags are OR-combined, as legacy did for
  `has_na_x`/`has_na_y`.
- **Raw API headers.** Columns keep the API's
  `{description} [{unit}]` names. Latest Data's sensor-height label swaps
  (LAB_SWAP) are not applied, so heights such as "@ 2 m" or "@ 8 ft" stay in
  the CSV exactly as the API reports them.
- **Only-derived selections are not padded with every element (DL-011,
  legacy bug not ported).** In legacy, `elements=""` fell back to every
  element.

#### Monthly aggregation (DL-012)

Monthly data is computed from the daily endpoints in `core/aggregate.ts`.
The audit noted that this choice was documented only in code comments; it is
recorded here as well.

- **Strict monthly sums.** Precipitation and Reference ET are summed only
  when every calendar day of the month has a value. Otherwise the total is
  blank. Legacy summed whatever days existed, so a total built from 1 of 31
  days looked like a real monthly total. A month that falls only partly
  inside the requested range is therefore blank. All other columns are means
  of the days available.
- **Stricter "Contains Missing Data".** On monthly rows this flag is also
  true when any value column is null on any day, or when a calendar day has
  no row at all.
- **A "Days With Data" column** counts the daily rows in each month, so
  partial months (range edges, outages) are visible. `obs_count` is dropped
  in favour of it.
- Every numeric column is aggregated. Legacy dropped any column missing from
  its hard-coded label list. Boolean flags (`provisional`) use any().
  Values are rounded to 3 decimals.

#### Variables

- **Soil Water Potential and Percent Saturation are derived options at
  `has_swp` stations (SWP-004 / DL-003).** Legacy commented them out of the
  picker but still treated them as derived codes, so old `els=swp,…` links
  depended on them. The rewrite offers them only at stations with SWP
  parameters (`request.ts` `DERIVED_OPTIONS`, `requiresSwp`). At a non-SWP
  station they are dropped from the request with a visible notice. The audit
  noted that this choice was documented only in code comments; it is recorded
  here as well. Monthly values are means.
- Option groups ("Standard elements" / "Derived variables") replace legacy's
  disabled header rows (DL-003).

#### Dates

- **Hourly defaults to the last 30 days (DL-009).** Daily and monthly start
  at the install date, as in legacy. Hourly starts 30 days back instead
  (`HOURLY_DEFAULT_DAYS`), because years of hourly rows are rarely what the
  user wants.
- **Large hourly requests need confirmation.** Hourly ranges longer than 366
  days (`HOURLY_CONFIRM_DAYS`) show a warning, and Run Request must be clicked
  a second time ("Confirm large request").
- **A start before the install date is clamped.** As with legacy's DatePicker
  `minDate`, a start date before `date_installed` (from an old link or typed
  in) is moved to the install date, and a small note explains the change. The
  request still runs. A start after the end is still an inline error.

#### Station selection

- **No implicit default station (DL-002).** Legacy preselected the first
  station in the sorted list. The Downloader shares the `?s=` URL key with the
  other tabs, so writing a default would change the station on every tab. The
  tab uses `?s=` when it is set and otherwise starts empty.
- **The map (DL-018)** is a Downloader-specific MapLibre map
  (`tabs/downloader/DownloaderMap.tsx`). It draws USGS shaded-relief tiles
  with Montana county outlines and merges co-located stations into one
  marker. Marker colours are AgriMet `#00cc96`, HydroMet `#7A7AFB`,
  co-located `#FB7A7A` and selected `#FFD700`. Hovering a marker shows
  "**Station(s)**: …". Clicking selects the group's first station code.
  Differences from legacy:
  - the map fits Montana's bounds at any width, where legacy used a fixed
    zoom of 5 and a height of 300;
  - markers have a thin white outline;
  - a small colour legend is shown;
  - selecting a station does not re-center the map, which matches legacy.

#### Funding footer (DL-020)

The footer "Supported by Bureau of Land Management (RM-CESU Award
L16AC00359)" is in bold, on `#129dff`, with a minimum height of 40px. It
is part of the tab's normal flow, at the bottom of the tab. It is not
`position: fixed` as in legacy, because a fixed bar would cover the controls
and the preview on small screens. It wraps to two lines at 375px.

### Downloads (CSV)

- **No leading index column (DLF-002, legacy bug not ported).** Legacy's
  pandas `to_csv` wrote an unnamed integer index column by accident.
- **Lowercase `true` / `false` booleans (DLF-003).** Flag columns are
  written as `true`/`false`. Legacy wrote Python's `True`/`False`. Either form
  parses in R, pandas and spreadsheets.
- **Extra columns (DLF-003).** `provisional` (QC state per row) is always
  included. Monthly CSVs also have `Days With Data`. "Contains Missing Data"
  keeps its legacy name (DL-013).
- The filename is unchanged: `{station}_{period}_{YYYYMMDD}_to_{YYYYMMDD}.csv`
  (DLF-001). When the start date was clamped, the filename uses the clamped
  start.

## Global UI

> W1 global UI (outage notice, notices, Help, Share, theme toggle, footer). Compared with web/ unless noted. This replaces the "Help dialog" placeholder under "vs web/".

### Outage notice
- **Same as web/:** `outage.json` from the repo's main branch, shown once per browser tab per notice `id`; any failure means inactive.
- **New:** a kit `<dialog class="mco-modal">` fed by `$store.data.cached('outage', …)` (60 s TTL, no retry), rechecked every 60 s while the tab is visible, so a notice posted while the page is open still appears. The sessionStorage key is `mco-dashboard-outage-<id>` (was `outageModalShown:<id>`). sessionStorage is per tab, so the rename makes no one see a notice twice. The tone (`color`) shows as an icon plus a word (Warning, Alert, Information, Resolved, Notice), never as color alone. The MCO logo header is gone; the notice title is the dialog heading.
- **Markdown:** a small built-in subset (`core/markdown.ts`): paragraphs, bold, italic, `[links](…)` and `<https://…>` autolinks. Raw HTML in the message shows as text. Only `http(s):` and `mailto:` targets become links (new tab, `rel="noopener noreferrer"`). react-markdown also rendered lists, headings and code, but outage messages have never used them.
- **Why:** no Mantine or react-markdown. The message is remote content rendered with `x-html`, so it has to be escaped.

### Legacy `?state=` links and `#satellite`
- **web/:** a Mantine notification, open until closed, with a link to the previous dashboard.
- **New:** a dismissible banner at the top of `<main>` carries the sentence and the link, and a plain-text kit toast (2800 ms) points to it. `state` is removed and the other params stay byte-for-byte (`core/legacyLinks.ts#withoutLegacyState`). `#satellite` becomes `#latest`, both on load and on later hash changes.
- **Why:** the kit toast is text-only with `pointer-events: none`, so it can't hold a link. The banner keeps the link reachable by keyboard and screen reader.

### Station id resolution announced
- **New:** when an NWSLI or mis-cased `?s=` is rewritten to the catalog id, the live region says so ("Station ACEBOZEM opened as Bozeman (acebozem).").
- **Why:** HOUSE-STYLE §5.1. Otherwise the URL change is silent.

### Help dialog content
- **Same as web/:** the content (welcome with the crowagen example, the tabs, API docs on mesonet2, contacts, Background, Source Code, satellite on the previous dashboard). It opens only from the "?" button.
- **New:** kit `.info-section` blocks with headings (Welcome, Using the tabs, Data source, Contact, Montana Mesonet background, Source code). Data source adds "Times are Mountain Time." There is no first-visit auto-open: HOUSE-STYLE §4 suggests one, gated by `mco-dashboard-help-seen`, but neither web/ nor the legacy app opened Help on load.

### Share
- **New:** copies `$store.url.href`, the view's URL built from the store state (`core/url-schema.ts#viewHref`), so the link matches the view even before the store's batched write reaches the address bar. The result appears as a toast and is also sent to the page live region.

### Theme toggle
- **New:** one button cycles dark → light → high contrast. Its icon and `aria-label` ("Switch to light theme") name the theme a click switches to, a matching tooltip shows on hover, and the new theme is announced in the live region. `MCO.setTheme` saves the choice in the shared `mco-theme` key.

### Footer
- **New:** every tab ends with "Data from the Montana Mesonet, quality-controlled and served by the Mesonet API." and "Montana Climate Office · climate.umt.edu" (HOUSE-STYLE §1 voice), with underlined links. The Downloader's BLM funding footer stays on that tab only.
