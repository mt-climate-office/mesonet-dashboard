# Intentional divergences from the legacy dashboard (non-Ag)

This file lists the places where the React dashboard (`web/`) deliberately behaves differently from the legacy Dash app (`app/mdb`). It covers the shell, Latest Data and shared data behaviour. Ag Tools divergences are documented with the Ag code. Each entry gives the legacy behaviour, what we do instead, and why. The IDs refer to `scripts/fidelity/CHECKLIST.md`.

## Data

### QC level 2 by default (LDC-016, DL-010)
- **Legacy:** every request sent `level=1` (provisional data).
- **New:** observations, derived, latest and downloader requests default to `level=2` (quality-controlled). The Downloader keeps a QC selector (`qc=0|1|2`).
- **Why:** level 1 passes through flatlined sensors and false precipitation spikes (mesonet-db-rds#189). Level 2 is what the Mesonet publishes as its quality-controlled product.

### Precipitation is the API's merged `ppt`; `ppt_corrected` is ignored
- **Legacy:** built its element list by substring match against `{API}elements`. On mesonet2 this would also pull in `ppt_corrected`, and `plot_ppt` would then plot that column.
- **New:** Latest Data plots the default merged `ppt` element only. The mesonet2-only element `ppt_corrected` ("Precipitation (fill-corrected)") is never offered as a variable chip, never requested, and never mapped to a panel (`LATEST_EXCLUDED_ELEMENTS`, `latestVariableForColumn`).
- **Why:** at QC level 2 the merged `ppt` is already wind-corrected. `ppt_corrected` is NULL inside high-wind events and puts the event total at the end, so plotting it next to `ppt` would duplicate and confuse the series.

### Request shape (LDC-016, LDC-017)
- **No `premade`:** with it, `/derived/*` returns 500 (an upstream duplicate-label bug).
- **`rm_na=false` on the Latest plot:** missing observations stay as nulls, so lines break at gaps (`connectgaps: false`) instead of being drawn straight across them.
- **Inclusive end dates:** the API's `end_time` is an exclusive cutoff, so we send `end + 1 day`. Legacy sent the current local time when the end date was today.

### Variables offered at a station (LDC-013)
- **Same as legacy:** chips come from `/elements/{station}/`: `description_short` before "@", deduplicated, plus Reference ET, sorted.
- **New:**
  - A variable missing from `ELEM_MAP` is requested by the station's own element codes and plotted with its name as the axis title. A new API element therefore degrades gracefully instead of crashing.
  - A variable the station doesn't offer is ignored instead of erroring.

## Latest Data UI

### Native NWS forecast cards (LDT-009)
- **Legacy:** embedded `forecast.weather.gov/MapClick.php` in an iframe.
- **New:** renders the NWS API forecast periods as cards, with a link to the full MapClick page.
- **Why:** the iframe is not mobile friendly, can't be themed, and shows NWS chrome inside our card.

### MapLibre locator map (ST-004, ST-005, DL-018)
- **Legacy:** an `{API}map/stations` iframe (Latest) and a Scattermapbox figure (Downloader).
- **New:** an in-app MapLibre map on the Carto positron basemap. Clicking a marker selects the station. Legacy's click callback was dead, so its iframe map never selected anything.
- **Why:** one map component for both tabs, no external iframe, and working selection. The USGS relief tiles, county lines and the co-located colour are not ported.

### Photo directions come from the `/photos` catalog (LDT-010, LDT-013)
- **Legacy:** guessed directions from the camera model on `/deployments/{station}`. EC-ScoutIP gave N/S/E/W/Snow, other models N/S/North Sky/South Sky, and no camera N/S/Ground.
- **New:** the `/photos/` catalog lists the directions each station actually has. For example, acebozem (EC-IRB2-2x) has seven. The chips use legacy's human labels (North, South, East, West, North Sky, South Sky, Ground, Snow) and fall back to the catalog label.
- **No camera in the catalog:** we show "No camera images are available for this station" instead of legacy's three blind chips with a single "today" option.
- **Why:** the catalog is the source of truth. The model rule mislabels newer cameras.

### Photo tab enabled when the catalog lists the station (LDT-002)
- **Same as legacy:** "Latest Photo" is disabled for non-HydroMet stations.
- **New:** it is also enabled when the `/photos` catalog lists the station, so a camera at a non-HydroMet station is never hidden. No such station exists as of 2026-10.

### Photo modal (LDT-015)
- **Same as legacy:** clicking the photo opens a centered 92vw modal.
- **New:** the modal also has a "Download original" button. It fetches the full-resolution image and falls back to opening it in a new tab.

### Photo time list (LDT-011)
- **Same as legacy:** every Morning/Afternoon slot back to the camera's start date, with the same 09:30/15:30 cutoffs.
- **New:** the Select is searchable and renders at most 400 options at a time.

### Card defaults are "auto" (LDT-003, LDB-001, LDB-002)
- **Same as legacy:** with no `card`/`info` in the URL, the top card is Latest Photo for HydroMet stations and Wind Rose otherwise. The bottom card is Current Conditions with a station and Locator Map without one. Choosing a station from the dropdown or the map resets both cards to auto.
- **New:** an explicit `card=`/`info=` in a shared link is honoured.

### Current Conditions failure falls back to metadata (LDB-010)
- **Legacy:** switched to the metadata tab when the station *record* request failed.
- **New:** switches when the `/latest` request fails, and only while the bottom card is on auto. If the user explicitly picked Current Conditions, it shows "No data available for selected dates." instead.

### Current Conditions rows (LDB-006, LDB-007, LDB-008)
- **Same as legacy:**
  - The row set and order: Timestamp, then the legacy `elem_labs` columns in API order, then Real Feel.
  - Raw values, and wind direction as "N (357.3 deg)".
  - The wind-chill-at-all-temperatures Real Feel (legacy bug kept for parity).
- **New:**
  - Snow Depth is shown. Legacy listed it as `Snow Depth [in.]` while the API sends `[in]`, so legacy silently dropped it (legacy bug not ported).
  - The timestamp is formatted ("Oct 1, 2026 2:30 PM").
  - Precipitation Summary values carry an " in" suffix.

### Wind rose (LDT-005, LDT-006, LDT-007)
- **Same as legacy:** the rose follows the plotted date range and aggregation, and is titled "Wind Data from {start} to {end}" (Courier New).
- **New:**
  - The title wraps onto two lines at 14 px, because the card is narrower than legacy's.
  - The rose uses its own `wind_spd,wind_dir` request (with `rm_na=true`) instead of riding on the main record.

### Plot layout (LDP-001, LDP-002, LDP-021, MOB-002)
- **Legacy:** fixed 500 px (one panel) or 250 px per panel, in an 88vh scroll column. The x axes were independent but forced to the same range.
- **New:**
  - The plot fills its column, with a 200 px minimum per panel. Long selections scroll instead of squashing.
  - The x axes are linked (`matches: 'x'`), so pan and zoom move every panel together. Panning writes `from`/`to` to the URL and refetches.
  - On wide screens the card column is viewport-tall and scrolls internally.

### Soil depth colours (LDP-011)
- **Legacy:** the Plotly default colours per depth (2 in `#636efa`, 4 in `#EF553B`, …).
- **New:** a Viridis sample, a CVD-safe palette (`lib/params/palettes.ts`). The x-unified hover is applied to every panel, not just soil.

### "Not available" panels (LDP-014, LDP-015)
- **Same as legacy:** a selected variable with no data in the window keeps an empty panel with "**{Variable} data are not available for this time period.**" (`add_nodata_lab`).
- **New:**
  - The text is 14 px, not 18 px, so it fits a narrow panel.
  - Legacy's early return (no notes or soil legends at all once any soil panel was empty, LDP-015) is not ported.

### Empty and error states (ES-001 to ES-005)
- **Same as legacy:** the texts ("Select Station", "No variables selected", "No data available for selected station and dates / Either change the date range or select a new station.").
- **New:**
  - They render as centred text, not as a 500 px blank Plotly figure (ES-004).
  - Raw HTTP errors are logged to the console, never shown.
  - Malformed `?from`/`?to` show the no-data message without sending a request.

### Variable selection (ES-002, LDC-014)
- **Same as legacy:** deselecting every chip shows "No variables selected" instead of re-applying the defaults.
- **New:** in the URL, an absent `vars` means the five defaults and `vars=` (empty) means none.

### Period of record (LDC-005)
- **Same as legacy:** "Display Period of Record" switches to Daily from the install date to today, and the label becomes "Display Latest 2 Weeks", which restores Hourly for the last 14 days.
- **New:** the label is derived from the URL (Daily + install date + today), so a shared POR link shows the right label. The button is disabled with no station (legacy bug LDC-006 not ported).

## Sensor-change overlays (SC-001 to SC-010)
- **Same as legacy:** a port of legacy `_build_sensor_events` / `_filter_outage_events_to_metric_na` / `_add_sensor_event_overlays`, including 5afb746f (an outage ends at sensor replacement).
- **New:**
  - The config comes from `/config/{station}/`, which has no `public` parameter in v2.
  - The element→column map adds the 28 in (−70 cm) soil depth, which legacy lacked.
  - Times are computed as America/Denver wall-clock milliseconds, with no timezone library.
  - The hover polygon uses `hoveron: 'points'`, so it still fires under x-unified hover.

## Shell, routing and links

### Base path (GS-003)
- **Legacy:** served at `/dash/` when `ON_SERVER` was set.
- **New:** the base comes from `VITE_BASE` (default `/mesonet-dashboard/`, for GitHub Pages behind mesonet2). `/dash` is pointed at it at cutover. `vite.config.ts` has the details.

### NWSLI and station ids are case-insensitive (URL-002)
- **Legacy:** matched `/dash/<segment>` exactly against station id, then NWSLI id.
- **New:** `?s=` and `/<segment>` resolve case-insensitively (`?s=KEEM8`, `?s=keem8` and `?s=ACEABSAR` all work). The URL is then rewritten to the canonical id (`lib/stations.ts#resolveStationId`).

### `?state=` legacy share links (URL-006 to URL-010)
- **Legacy:** share links pointed at layouts saved on the old server (`./share/{hash}.json`).
- **New:** this client can't read those files. The `?state=` param is dropped (other params are kept), and a notice links to the same layout on the legacy dashboard. "Share" copies the live URL, which holds the full state in query params, instead of creating a server-side hash.

### Outage notice freshness (OUT-001, OUT-006)
- **Legacy:** fetched `outage.json` server-side, cached for 60 s, and rendered the modal open on first paint.
- **New:** fetches the same file client-side on page load (5 s timeout, 60 s staleTime, failure means inactive), so the modal opens when the fetch resolves. raw.githubusercontent.com's own CDN cache (about 5 min) still applies to both.

### Satellite Indicators hidden (GS-008, HELP-003)
- **New:** the tab is not routed. `#satellite` falls back to Latest Data with a link to the legacy dashboard's satellite view. The help modal says satellite indicators are available on the legacy dashboard.

### Help modal (HELP-001 to HELP-006)
- **Same as legacy:** the content (welcome text with the crowagen example link, contacts, feedback form, GitHub issues, Background, Source Code).
- **New:**
  - The API docs link points to `mesonet2.climate.umt.edu/api/v2/docs` (the legacy AWS execute-api URL is gone).
  - The satellite paragraph is replaced by a short note on the Ag Tools and Downloader tabs.
  - The feedback form is the current Airtable form (GS-006, user-confirmed).

### Tabs keep their state (GS-009)
- **Legacy:** rebuilt each tab from scratch.
- **New:** tab panels still unmount, but each tab's controls live in its own URL keys (`lib/url-state.ts`), so switching tabs and coming back restores them.
