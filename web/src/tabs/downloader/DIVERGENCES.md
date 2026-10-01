# Data Downloader: intentional divergences from legacy

The Downloader tab (`tabs/DownloaderTab.tsx`, `tabs/downloader/`) ports the
legacy Dash downloader (`app/mdb/layout.py` `build_downloader_content`,
`app/mdb/app.py` ~2146-2369). This file records every deliberate
difference. The IDs refer to `web/scripts/fidelity/CHECKLIST.md` sections 12
and 13.

## Downloader

### Request and QC

- **A QC level control replaces "Remove Flagged Data" (DL-007).** Legacy
  sent `rm_na = not checked`, so the switch did the opposite of its label
  (legacy bug). The rewrite offers a Raw / Provisional / Quality-controlled
  control (`level` 0 / 1 / 2) instead. Old links that carry `?rmna=true` map to
  level 2 (`DownloaderTab.tsx`, `lib/url-state.ts`).
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

### Monthly aggregation (DL-012)

Monthly data is computed from the daily endpoints in `lib/aggregate.ts`.
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

### Variables

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

### Dates

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

### Station selection

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

### Funding footer (DL-020)

The footer "Supported by Bureau of Land Management (RM-CESU Award
L16AC00359)" is in bold, on `#129dff`, with a minimum height of 40px. It
is part of the tab's normal flow, at the bottom of the tab. It is not
`position: fixed` as in legacy, because a fixed bar would cover the controls
and the preview on small screens. It wraps to two lines at 375px.

## Downloads (CSV)

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
