# Legacy Dashboard Fidelity Checklist

Inventory of the behaviours of the legacy Dash app (`app/mdb`, origin/main, including commit
`5afb746f` "grey outage boxes end on sensor replacement"). It is used to audit the React rewrite
(`web/src`) for fidelity.

Columns:

- **ID**: stable identifier, by section prefix.
- **Feature / expected behavior**: what the legacy app does, with concrete defaults, option lists, limits, labels, units and colours. Anything not read directly from code is marked *(inferred)*. Items marked **[legacy bug]** describe behaviour that is probably unintended. The rewrite may reasonably choose not to port it, but it should be a deliberate decision.
- **Legacy ref**: `file:line` relative to `app/mdb/` (for example `app.py:1234`, `utils/plotting.py:228`).
- **Auto**: `H` = automatable by the Playwright harness (plot `gd.data`/`gd.layout`, DOM text, network requests); `P` = partially automatable (some visual or timing judgement needed); `M` = manual.
- **Status**: left blank here. The orchestrator fills it with one of `match`, `intentional divergence`, `gap`, `legacy bug not ported`.

API base is `https://mesonet.climate.umt.edu/api/` (`utils/params.py:23`), written `{API}` below.

---

## 1. Global shell & routing

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| GS-001 | Document title "Montana Mesonet"; favicon `MCO_logo.svg`; Bootstrap theme | `app.py:70-87` | H | |
| GS-002 | Viewport meta `width=device-width, initial-scale=1.0, maximum-scale=1.2, minimum-scale=0.5` | `app.py:74-79` | H | |
| GS-003 | Served under `/dash/` prefix when `ON_SERVER` is set, otherwise `/` | `app.py:66-80` | P | |
| GS-004 | Google Analytics gtag script `UA-149859729-3` loaded | `app.py:81-84` | H | |
| GS-005 | Navbar (bg `#E9ECEF`): MCO logo (50px) linking to `https://climate.umt.edu/`; centered title "The Montana Mesonet Dashboard" (bold 150% Helvetica) | `layout.py:258-351`, `assets/base-styles.css:615` | H | |
| GS-006 | Navbar buttons in order: "GIVE FEEDBACK" (opens Airtable form `https://airtable.com/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form` in new tab), "LEARN MORE" (opens help modal), "SHARE PLOT" (opens share modal) | `layout.py:315-345` | H | |
| GS-007 | Banner title becomes "The Montana Mesonet Dashboard: {station name}" only when a station is selected AND the Latest Data tab is active; otherwise the default title. Unknown station falls back to the default | `app.py:249-287` | H | |
| GS-008 | Main tabs in order: "Latest Data" (station-tab, default), "Ag Tools" (derived-tab), "Data Downloader" (download-tab), "Satellite Indicators" (satellite-tab); grow to full width, outline variant | `layout.py:1561-1580` | H | |
| GS-009 | Each main tab is rebuilt from scratch when selected (content swapped, not hidden), so per-tab control state resets on tab switch *(inferred from children replacement)* | `app.py:1712-1758` | P | |
| GS-010 | Station list from `{API}stations?type=csv`; `long_name = "{name} ({sub_network})"`; sorted by long_name; station `mcoopsbe` excluded | `utils/get_data.py:36-58` | H | |
| GS-011 | Page background `#E9ECEF`; container padding `0 1rem`; `overflow-y: clip` | `layout.py:1606-1612` | M | |
| GS-012 | The whole layout is rebuilt on every page load (layout is a lambda), so the outage config and station list are refreshed per load | `app.py:244-245` | P | |

## 2. Station selection & map (Latest Data)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| ST-001 | Station Select: placeholder "Select a Mesonet Station...", searchable, clearable; option label = long_name, value = station code | `layout.py:541-557` | H | |
| ST-002 | Network Filter chips "HydroMet", "AgriMet" (multi). Both are selected by default. Help text: "Filter stations by network type. Leave both checked to show all stations." | `layout.py:642-669` | H | |
| ST-003 | Network filter: if no chip is selected, ALL stations are shown (not none). Otherwise stations whose `sub_network` contains any selected network (regex `str.contains`) | `app.py:1799-1836` | H | |
| ST-004 | Locator Map tab is an iframe `{API}map/stations/?station={station or "none"}`, 100% x 300px, no border | `app.py:93-117`, `app.py:335-337` | H | |
| ST-005 | Choosing a station on the iframe map does NOT update the dashboard dropdown. The iframe is external, and the `station-fig` clickData callback is effectively dead because `station-fig` is a Div wrapping an iframe | `app.py:1568-1616`, `layout.py:445` | M | |
| ST-006 | Station popup modal (if clickData existed): "#### {name}", "**Latitude, Longitude**: lat, lon", "**Elevation (m)**: …", "###### View Station Dashboard" + link markdown | `app.py:1597-1616` | M | |

## 3. Latest Data: controls (sidebar)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| LDC-001 | Sidebar header "Controls" with chevron-left collapse button | `layout.py:527-539` | H | |
| LDC-002 | Collapse hides the sidebar (lg/xl size 0) and widens the plot column to 9, and a floating blue menu button appears at top-left (10px, 10px). Expand restores 3/6 | `app.py:2517-2566`, `layout.py:771-787` | P | |
| LDC-003 | Start Date picker default = today − 14 days, maxDate = today; End Date default = today, maxDate = today | `layout.py:564-579` | H | |
| LDC-004 | **[legacy bug]** Start date min is never bounded by the station's install date. The callback targets the non-existent id `dates` | `app.py:939-968` | H | |
| LDC-005 | "Display Period of Record" button (light, full width). Odd clicks set period=daily, start=station date_installed, end=today, and the label becomes "Display Latest 2 Weeks". Even clicks set period=hourly, start=today−14d, end=today, and the label becomes "Display Period of Record" | `layout.py:583-589`, `app.py:2461-2514` | H | |
| LDC-006 | **[legacy bug]** The POR button is never disabled when no station is selected (the callback targets the non-existent `date-button`). Clicking it with no station errors *(inferred)* | `app.py:971-989` | P | |
| LDC-007 | Time Aggregation chips (single): "Hourly"(hourly, default), "Daily"(daily), "Raw"(raw) | `layout.py:594-610` | H | |
| LDC-008 | Aggregation help text: "Hourly and daily averages are pre-computed and will load faster. Avoid selecting periods longer than 1 year for daily, 3 months for hourly, or 2 weeks for raw data." These are advisory only, and no hard limit is enforced | `layout.py:611-618` | H | |
| LDC-009 | "Climate Normals" switch "Show gridMET Normals" is disabled initially and is enabled only when period == daily. Help: "Shows 1991-2020 gridMET climate normals. Only available on daily data." | `layout.py:623-640`, `app.py:1466-1487` | H | |
| LDC-010 | Normals are applied only if switch checked AND period == daily (switch state persists but is ignored otherwise) | `app.py:1057` | H | |
| LDC-011 | Variables chip group (multi) inside 200px scroll area. With no station, the chips are the sorted `default_vars` (Atmospheric Pressure, Air Temperature, Precipitation, Reference ET, Relative Humidity, Soil Temperature, Soil VWC, Solar Radiation, Wind Speed) | `layout.py:671-678`, `app.py:495-499`, `utils/params.py:66-76` | H | |
| LDC-012 | Default selected variables (when selection empty): Precipitation, Reference ET, Soil VWC, Soil Temperature, Air Temperature | `app.py:487-494` | H | |
| LDC-013 | With a station selected, the chips come from `{API}elements/{station}?type=csv` `description_short` with text before "@" stripped, deduped, plus "Reference ET" always added, sorted alphabetically. Current selection is filtered to available vars | `app.py:501-508` | H | |
| LDC-014 | If the selection becomes empty after filtering (or the user deselects all), the next station change re-applies the default 5 variables | `app.py:487-494` | P | |
| LDC-015 | "About These Variables" subtle button linking to `https://climate.umt.edu/mesonet/variables/` (new tab) | `layout.py:679-688` | H | |
| LDC-016 | Data request params (Latest): `stations`, `elements` (comma list), `start_time` (YYYY-MM-DD), `end_time`, `level=1`, `type=csv`, `rm_na=True`, `premade=True`, `na_info=False`, `public=True` | `utils/get_data.py:121-131` | H | |
| LDC-017 | If end date == today, `end_time` is sent as current local datetime `YYYY-MM-DDTHH:MM:SS` (not date) | `utils/get_data.py:133-137` | H | |
| LDC-018 | Endpoints: hourly→`observations/hourly`, daily→`observations/daily`, raw→`observations`; ETr via `derived/hourly` / `derived/daily` (raw uses `derived/hourly`) with same params and `elements=etr`, left-merged on station+datetime | `utils/params.py:309-321`, `utils/get_data.py:152-163` | H | |
| LDC-019 | Wind Speed + Wind Direction elements are ALWAYS added to the request (for the wind rose) regardless of selected variables | `app.py:850` | H | |
| LDC-020 | Variable→element prefix map: Precipitation→ppt; Reference ET→etr; Soil VWC→soil_vwc; Air Temperature→air_temp; Solar Radiation→sol_rad; Soil Temperature→soil_temp; Relative Humidity→rh; Wind Speed→wind_spd+wind_dir; Atmospheric Pressure→bp; Bulk EC→soil_ec_blk; Gust Speed→windgust; Well EC→well_eco; Well Water Level→well_lvl; Well Water Temperature→well_tmp; VPD→vpd_atmo; Snow Depth→snow_depth; Max Precip Rate→ppt_max_rate; elements expanded by substring match against all API elements | `utils/params.py:248-267`, `app.py:851-852` | H | |
| LDC-021 | Caching: a full refetch happens on station/date/period change. Adding a variable fetches only the new elements and inner-merges them on station+datetime. Removing a variable does not refetch | `app.py:854-936` | H | |
| LDC-022 | Fetch failure (HTTPError) stores `-1`, which drives the "no data" state. An HTTPError while adding vars keeps the cached data | `app.py:874-876`, `app.py:927-928` | H | |
| LDC-023 | Station data cached in session storage (`temp-station-data`, storage_type=session) | `layout.py:718` | P | |

## 4. Latest Data: top cards (Wind rose / Forecast / Photos)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| LDT-001 | Segmented control: "Wind Rose" (wind-tab), "Weather Forecast" (wx-tab), "Latest Photo" (photo-tab); full width, xs | `layout.py:375-385` | H | |
| LDT-002 | "Latest Photo" is always shown but disabled unless the station's sub_network == HydroMet (disabled when no station) | `app.py:1117-1164` | H | |
| LDT-003 | Default tab on station change: photo-tab for HydroMet, wind-tab otherwise/none | `app.py:1167-1196` | H | |
| LDT-004 | No station: top card content is empty | `app.py:1239-1240` | H | |
| LDT-005 | Wind rose: polar bar of frequency by 16-point compass direction (N, NNE … NNW) × wind speed bins; speeds rounded to integer then `qcut` into 8 quantile bins (duplicates dropped); missing directions filled with 0; `Plasma_r` colors; `plotly_white` template; height 40vh | `utils/plotting.py:791-856`, `app.py:1258-1272` | H | |
| LDT-006 | Wind rose title "<b>Wind Data from {start_date} to {end_date}</b>" (dates = min/max of fetched data in America/Denver), Courier New 15 black, centered | `app.py:1252-1270` | H | |
| LDT-007 | Wind rose uses the same fetched range/period as the main plot (follows date pickers and aggregation) | `app.py:1241-1258` | H | |
| LDT-008 | Wind tab with fetch failure (-1): no-data figure "<b>No data available for selected dates.</b>" (40vh) | `app.py:1273-1282` | H | |
| LDT-009 | Weather Forecast: iframe `https://forecast.weather.gov/MapClick.php?lon={lon}&lat={lat}` 100% x 300px | `app.py:1284-1294` | H | |
| LDT-010 | Photo directions from `{API}deployments/{station}/?type=csv` rows of type "IP Camera". No camera gives North(n)/South(s)/Ground(g). Model "EC-ScoutIP" gives North/South/East(e)/West(w)/Snow(snow). Any other model gives North/South/North Sky(ns)/South Sky(ss). Default "n"; single-row chips | `app.py:1297-1334` | H | |
| LDT-011 | Photo time Select: dates from camera `date_start` to now (America/Denver), each date gives "YYYY-MM-DD Morning" (value `YYYY-MM-DDT09:00:00`) and "… Afternoon" (`T15:00:00`), newest first; default = newest | `app.py:1336-1367` | H | |
| LDT-012 | Photo time cutoffs: before 09:30 MT the list ends yesterday. Between 09:30 and 15:30 the newest (today Afternoon) entry is dropped | `app.py:1339-1355` | H | |
| LDT-013 | No camera deployment: time Select has the single option today `YYYY-MM-DD` | `app.py:1368-1377` | H | |
| LDT-014 | Photo image src `{API}photos/{station}/{direction}?dt={value}` (direction lowercased, default n) | `app.py:1490-1503`, `app.py:1506-1550` | H | |
| LDT-015 | Clicking the photo opens a centered modal (92vw, overlay 0.7, blur 2) with the same image (max 86vh) | `app.py:1426-1455`, `app.py:1553-1565` | P | |
| LDT-016 | No station in photo callback: orange light Alert "Photo unavailable" / "No station selected." | `app.py:1519-1527` | H | |

## 5. Latest Data: bottom cards (Map / Metadata / Current table)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| LDB-001 | Segmented control: "Locator Map" (map-tab), "Station Metadata" (meta-tab), "Current Conditions" (data-tab); initial value data-tab | `layout.py:431-441` | H | |
| LDB-002 | Choosing a station from the dropdown auto-switches the bottom card to Current Conditions. With no station, data-tab falls back to the map | `app.py:329-337` | H | |
| LDB-003 | Metadata table rows: Station Name, Long Name (=`name`), [Station One-Pager], Date Installed, Sub Network, Longitude, Latitude, Elevation (ft) where elevation = round(m × 3.281) | `utils/tables.py:43-69`, `app.py:339-349` | H | |
| LDB-004 | Metadata Value column renders markdown (for the one-pager link) | `app.py:353-360` | H | |
| LDB-005 | Table styling (both tables): header row hidden (`tr:first-child{display:none}`), left aligned, odd rows `rgb(220,220,220)`, black text on white | `layout.py:32-44` | H | |
| LDB-006 | Current Conditions table "Latest Data Summary" from `{API}latest?stations={s}&type=csv`; only known element labels + datetime; labels normalized via lab_swap; "datetime" row renamed "Timestamp"; NaN rows dropped | `app.py:366-381`, `utils/get_data.py:229-280` | H | |
| LDB-007 | Current table adds "Real Feel [°F]" = NWS wind-chill formula `35.74 + 0.6215T − 35.75V^0.16 + 0.4275TV^0.16` rounded to 2 decimals. **[legacy bug]** It is applied at ALL temperatures, not just cold ones | `utils/get_data.py:258-267` | H | |
| LDB-008 | Current table Wind Direction is formatted "{compass} ({deg} deg)", e.g. "SW (225 deg)" | `utils/get_data.py:269-274`, `utils/plotting.py:769-788` | H | |
| LDB-009 | HydroMet only: second table "Precipitation Summary" from `{API}derived/ppt/?stations={s}&type=csv`, melted to name/value rows, order REVERSED; omitted if empty or request not ok | `app.py:382-398`, `utils/get_data.py:283-310` | H | |
| LDB-010 | Current Conditions when station fetch failed (-1): shows the no-data figure ("No data available for selected dates.") and switches the tab to meta-tab | `app.py:401` | H | |
| LDB-011 | Unknown station on data-tab: no update | `app.py:362-365` | P | |

## 6. Latest Data: timeseries plot

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| LDP-001 | One subplot row per selected variable, in selection order *(inferred: chip value order)*; not shared x-axes | `utils/plotting.py:1020-1047` | H | |
| LDP-002 | Figure height 500 if one panel, else 250 × panels; margin r0 t20 l0 b0; transparent plot bg; grey gridlines; no legend | `utils/plotting.py:1082-1089`, `utils/plotting.py:40-74` | H | |
| LDP-003 | X range forced on all subplots: [min date − 1 day, max date + 1 day] | `utils/plotting.py:1084-1088` | H | |
| LDP-004 | Datetimes converted from UTC to America/Denver before plotting | `app.py:1041-1046`, `utils/get_data.py:203-226` | H | |
| LDP-005 | Y-axis titles: Precipitation "Precipitation<br>(inches)", Soil VWC "Soil VWC.<br>(%)", Bulk EC "Soil Bulk<br>EC (mS cm<sup>-1</sup>)", Air Temp "Air Temp.<br>(°F)", RH "Relative Hum.<br>(%)", Solar "Solar Rad.<br>(W/m<sup>2</sup>)", Wind "Wind Spd.<br>(mph)", Soil Temp "Soil Temp.<br>(°F)", Pressure "Atmos. Pres. (mbar)", ETr "Reference ET<br>(inches)", Snow "Snow Depth<br>(in.)", Gust "Gust Speed<br>(mi/hr)", Max Precip Rate "Max Precip Rate<br>(in/hr)", VPD "VPD (mbar)", Well level "Well Depth<br>(in.)", Well temp "Well Temperature<br>(°F)", Well EC "Well EC<br>(mS cm<sup>-1</sup>)", Wind Dir "Wind Direction<br>(deg)" | `utils/params.py:288-307` | H | |
| LDP-006 | Precip/ETr unit suffix by period: daily gives "(inches/day)". Hourly gives "(inches/hour)". Raw gives Precipitation "(inches)" but ETr "(inches/hour)" | `utils/plotting.py:1051-1060` | H | |
| LDP-007 | Line colors: Air Temp `#c42217`, Solar `#c15366`, RH `#a16a5c`, Snow Depth `#A020F0`, Wind Speed `#ec6607`, Pressure `#A020F0`, Well Level `#0000FF`, Well Temp `#c42217`, Well EC `#AEF359`, Gust `#FEC20C`, Max Precip Rate `#000080`, VPD `#32612D`, Wind Dir `#607D3B`; `connectgaps=False` | `utils/params.py:268-286`, `utils/plotting.py:635-637` | H | |
| LDP-008 | Met hover: "<b>Date</b>: %{x}<br><b>{column label}</b>: %{y}" | `utils/plotting.py:641-643` | H | |
| LDP-009 | Precipitation as bars (default plotly color), hover "<b>Precipitation Total</b>: %{y}" | `utils/plotting.py:731-752` | H | |
| LDP-010 | Reference ET as red (`#FF0000`) bars of column "Reference ET (a=0.23) [in]", hover "<b>Reference ET Total</b>: %{y}"; no sensor overlays on ETr | `utils/plotting.py:859-873` | H | |
| LDP-011 | Soil (Soil VWC / Soil Temperature / Bulk EC) as multi-line, one per depth, depth colors: 2 in `#636efa`, 4 in `#EF553B`, 8 in `#00cc96`, 20 in `#ab63fa`, 28 in `#FFA15A`, 36 in `#FFA15A`, 40 in `#301934`; hovermode "x unified" | `utils/plotting.py:554-608` | H | |
| LDP-012 | Soil depth labels converted from cm to in: −5→2 in, −10→4, −20→8, −50→20, −70→28, −91→36, −100→40 | `utils/params.py:144-189` | H | |
| LDP-013 | Soil depth legend: white Courier New annotations, background = depth color, placed in the right ~35% of the x-axis at the panel's max value; depths = VWC columns with non-zero sum | `utils/plotting.py:930-991`, `utils/plotting.py:1093-1105` | H | |
| LDP-014 | Missing variable panel: empty line plus annotation "<b>{Variable} data are not available for this time period.</b>" (black 18, white bg) at mean date | `utils/plotting.py:994-1017`, `utils/plotting.py:1041-1043` | H | |
| LDP-015 | **[legacy bug]** If any soil variable (Soil Temperature/Soil VWC/Bulk EC) has no data, the function returns early, so NO "not available" annotations and no soil depth legends are drawn for any panel | `utils/plotting.py:1090-1091` | H | |
| LDP-016 | Snow Depth y-range forced to [0, max(1, data max)] | `utils/plotting.py:1065-1080` | H | |
| LDP-017 | gridMET normals source: `https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/normals/{station}_{pr|tmmn|tmmx|rmin|rmax|pet}.csv`, rows with type=="daily", joined by month/day | `utils/plotting.py:77-131` | H | |
| LDP-018 | Normals for Air Temperature/RH: band between q25 of daily-min variable and q75 of daily-max variable, as dashed black lines with fill `rgba(107,107,107,0.4)`; trace names "Average Max.<br>{var}" / "Average Min.<br>{var}" | `utils/plotting.py:120-128`, `utils/plotting.py:645-672` | H | |
| LDP-019 | Normals for Precipitation (pr) and ETr (pet): black markers triangle-down "75th Percentile", circle "Median", triangle-up "25th Percentile" | `utils/plotting.py:684-728`, `utils/plotting.py:754-757`, `utils/plotting.py:868-871` | H | |
| LDP-020 | Normals only for Precipitation, Air Temperature, Relative Humidity, Reference ET; other variables ignore the switch | `utils/params.py:323-330` | H | |
| LDP-021 | Plot loading spinner (dash_loading_spinners Bars); plot container 88vh with vertical scroll | `layout.py:714-726` | M | |

## 7. Sensor-change overlays

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| SC-001 | Config from `{API}config/{station}?public=False`; `instruments` exploded per element; element codes mapped to plot column labels via short_to_long_map; only elements present in the panel are used | `utils/get_data.py:513-553`, `app.py:1050-1051`, `utils/plotting.py:559-560`, `utils/plotting.py:612-614` | H | |
| SC-002 | Event times = config date + 12 hours (America/Denver) | `utils/plotting.py:213-216` | H | |
| SC-003 | "added" (date_start) and "removed" (date_end) events are drawn as boxes of default width. The width is 6h for soil and precip panels. For met panels it is 6h if the data span is ≤31 days, else 48h. Events are drawn only if they overlap the data range | `utils/plotting.py:250-278`, `utils/plotting.py:561-566`, `utils/plotting.py:617-623`, `utils/plotting.py:735-740` | H | |
| SC-004 | Outage ranges (`outage_ranges`, list or string literal) run from start+12h to end+12h. An open-ended outage runs to now | `utils/plotting.py:182-203`, `utils/plotting.py:280-289` | H | |
| SC-005 | (5afb746f) An outage is capped at the sensor's removal time (date_end+12h) if that is earlier. Such an outage is no longer "open_ended". It is skipped entirely if the sensor was removed before the outage started | `utils/plotting.py:290-307` | H | |
| SC-006 | (5afb746f) Outage boxes are clipped to the times where the panel's metric is actually NA. Cadence is the median timestep. A gap longer than 1.5× cadence counts as missing. Adjacent intervals are merged. An outage with all-valid data draws nothing | `utils/plotting.py:326-462` | H | |
| SC-007 | Events with identical (reason, x0, x1, open_ended) are merged and their element lists sorted/deduped. Zero-width events get the default width | `utils/plotting.py:313-323` | H | |
| SC-008 | Overlay drawing: `add_vrect` fill `rgba(200,200,200,1)` opacity 0.75, no line, layer below. A hover scatter rectangle (fill toself, `rgba(200,200,200,0.5)`, opacity 0.5) spans y_min..y_max of the panel data (0..1 if NaN; ±1 if flat) | `utils/plotting.py:465-538` | H | |
| SC-009 | Hover texts: "A sensor was added/replaced on {d0}, affecting the following elements:<br>{elems}"; "A sensor was sunset/removed on {d0}, …"; open outage "A sensor outage was reported on {d0} and is ongoing as of {d1}, …"; same-day "A sensor outage was reported on {d0}, …"; else "… reported on {d0} and lasted through {d1}, …"; elems joined ",<br>" | `utils/plotting.py:477-514` | H | |
| SC-010 | Overlays apply to met, soil and precipitation panels in Latest Data only (not ETr, not Ag Tools) | `utils/plotting.py:599-604`, `utils/plotting.py:674-679`, `utils/plotting.py:759-764` | H | |

## 8. Ag Tools (derived tab)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| AG-001 | Station Select (label "Select Station", placeholder "Select a Mesonet Station Dropdown...", searchable, not clearable); independent of the Latest Data station | `layout.py:1096-1109` | H | |
| AG-002 | "Select Variable" options in order: Reference ET (etr), Feels Like Temperature (feels_like), Growing Degree Days (gdd), Soil Profile Plot (`soil_temp,soil_ec_blk`), Annual Comparison Plot (""), Livestock Risk Index (cci), Soil Water Potential (swp), Percent Soil Saturation (percent_saturation); default gdd; searchable | `layout.py:1115-1154` | H | |
| AG-003 | Dates: Start default today − 365 days (max today); End default today + 1 day (max today + 1 day) | `layout.py:1186-1198` | H | |
| AG-004 | "Learn More" button (info icon) links to `https://climate.umt.edu/mesonet/ag_tools/{var}/`, where gdd→`gdds/#{crop}-growing-degree-days`, soil profile→`soil_profile/`, cci→`risk/`, otherwise the raw value. **[legacy bug]** Annual gives `ag_tools//` | `layout.py:1157-1172`, `app.py:686-717` | H | |
| AG-005 | Panel visibility: etr/feels_like/cci/swp/percent_saturation show only the Time Aggregation panel. gdd shows only the GDD panel. Annual ("") shows only the Comparison Variable panel. Soil profile shows only the Soil Variable panel | `app.py:628-683` | H | |
| AG-006 | Changing the variable resets: GDD slider [50,86], crop wheat, time agg daily, soil var soil_vwc | `app.py:567-599` | H | |
| AG-007 | Derived request: `{API}derived/{time}` (or `observations/{time}` if variable contains "soil") with `stations`, `start_time`, `end_time` (dates), `alpha=0.23`, `elements`, `type=csv`, `premade=True`, `rm_na=True`, `keep=True`, plus `crop` when given; columns renamed via lab_swap | `utils/get_data.py:556-616`, `app.py:557-564` | H | |
| AG-008 | For soil/swp/percent_saturation variables, a second request `elements=percent_saturation,swp` (derived endpoint) is inner-merged on common columns | `app.py:557-560` | H | |
| AG-009 | No station: no-data figure "<b>Select Station</b> <br><br> To get started, select a station from the dropdown." | `app.py:1999-2006` | H | |
| AG-010 | Derived data cached in session storage `temp-derived-data`; plot height 500, horizontal legend; x range [min−1d, max+1d] | `layout.py:1516-1519`, `utils/plot_derived.py:40-70` | P | |
| AG-011 | Datetimes converted to America/Denver before plotting | `app.py:2027-2029` | H | |
| AG-012 | Time Aggregation chips "Hourly"(hourly)/"Daily"(daily), default daily | `layout.py:1221-1242` | H | |
| AG-ETR-001 | ETr: red bars "ETr" of "Reference ET (a=0.23) [in]" (hover "Reference ET Total") + "Cumulative ETr" line (cumsum) on right y2 (tickmode sync); left title "<b>Reference ET<br>(a=0.23) [in]</b>", right "<b>Cumulative Reference ET<br>(a=0.23) [in]</b>"; both ranges [0,max]; legend shown | `utils/plot_derived.py:73-112` | H | |
| AG-GDD-001 | GDD panel: label "GDD Generic Crop Type"; crop chips in order Wheat, Barley, Canola, Corn, Sunflower, Sugarbeet, Hemp; default wheat | `layout.py:1017-1062` | H | |
| AG-GDD-002 | GDD range slider is disabled (display only), min 30 max 100 step 1, marks 30°F/50°F/70°F/90°F, initial [50,86] | `layout.py:1063-1083` | H | |
| AG-GDD-003 | Crop→slider thresholds (°F): canola [41,100], corn [50,86], sunflower [44,100], wheat [32,95], barley [32,95], sugarbeet [34,86], hemp [34,100] | `app.py:720-756` | H | |
| AG-GDD-004 | **[legacy bug]** Initial/reset slider [50,86] does not match default crop wheat [32,95] until the crop changes. The slider value is never sent to the API; only `crop` is sent | `layout.py:1065`, `app.py:599`, `app.py:551-562` | H | |
| AG-GDD-005 | GDD plot: orange bars "Daily GDDs" ("GDDs [GDD °F]") + "Cumulative GDDs" orange line+markers on y2, markers colored per "Growth Stage" from a 24-color qualitative palette (`#a6cee3`, `#1f78b4`, …); hover shows Cumulative GDDs and Growth Stage; spikes across; axis titles "<b>Daily GDDs [GDD °F]</b>" / "<b>Cumulative GDDs [GDD °F]</b>"; ranges [0,max] | `utils/plot_derived.py:115-200` | H | |
| AG-GDD-006 | No separate growth-stage table is rendered. Stages appear only via marker color and hover. The stage list comes from the API's "Growth Stage" column | `utils/plot_derived.py:154-169` | H | |
| AG-FL-001 | Feels Like: scatter of "Feels Like Temperature [°F]" colored by "Index Used": Wind Chill (blue) if Wind Chill not NA, else Heat Index (red) if Heat Index not NA, else Average Temperature (green); black line underneath; legend shown | `utils/plot_derived.py:306-345` | H | |
| AG-CCI-001 | Livestock type chips "Adult"(adult, default)/"Newborn"(newborn), visible only for cci | `layout.py:1243-1261`, `app.py:602-625` | H | |
| AG-CCI-002 | CCI classes (°F). Heat: ≥113 Extreme Danger, 105–113 Extreme, 96–105 Severe, 87–96 Moderate, 77–87 Mild. Adult cold: 33–77 No Stress, 14–33 Mild, −4–14 Moderate, −22–−4 Severe, −40–−22 Extreme, <−40 Extreme Danger. Newborn cold: 42–77 No Stress, 32–42 Mild, 23–32 Moderate, 14–23 Severe, 5–14 Extreme, <5 Extreme Danger | `utils/plot_derived.py:203-264` | H | |
| AG-CCI-003 | CCI plot: scatter "Livestock Risk Index [°F]" colored Extreme Danger `#843094`, Extreme `#CC0606`, Severe `#FF4400`, Moderate `#FFAD00`, Mild `#FFFF00`, No Stress `#A5A5A5`; black line underneath; y title "<b>Livestock Risk Index [degF]</b>"; empty x title | `utils/plot_derived.py:267-303` | H | |
| AG-SOIL-001 | Soil Variable chips (before station chosen): Electrical Conductivity (soil_blk_ec), Volumetric Water Content (soil_vwc, default), Temperature (soil_temp), Soil Water Potential (swp), Percent Saturation (percent_saturation) | `layout.py:1267-1291` | H | |
| AG-SOIL-002 | Soil profile heatmap (`px.imshow`, aspect auto): y = depths sorted numerically ("2 in", "4 in", …), x = datetime; "Clipped" columns dropped | `utils/plot_derived.py:364-440` | H | |
| AG-SOIL-003 | Heatmap colorbar labels: "Soil VWC [%]", "Soil Temperature [degF]", "Soil Electrical Conductivity [mS/cm]", "Soil Water Potential [negative bar]", "Percent Saturation [%]" | `utils/plot_derived.py:403-409` | H | |
| AG-SOIL-004 | Heatmap colorscales: soil_temp `RdBu_r` with midpoint 32; swp `BrBG_r`; others `BrBG`; midpoint (min+max)/2 for non-temp | `utils/plot_derived.py:411-438` | H | |
| AG-SOIL-005 | Soil profile ignores Time Aggregation (panel hidden, reset to daily), so data comes from `observations/daily` | `app.py:599`, `app.py:661-683`, `utils/get_data.py:593-594` | H | |
| AG-SWP-001 | SWP plot: lines per depth of "Soil Water Potential @ … [bar]" (depth colors as LDP-011), log y axis, reversed, tick prefix "-"; y title "Soil Water Potential [Bar]" | `utils/plot_derived.py:443-469`, `utils/plot_derived.py:511-517` | H | |
| AG-SWP-002 | SWP bands: grey `rgba(128,128,128,0.2)` from 0 to 0.33 bar ("Field Capacity", hover "Soil Is Saturated") and from 15 bar to max+200 ("Wilting Point", hover "Water Not Plant Available"); stacked traces | `utils/plot_derived.py:446-510` | H | |
| AG-SWP-003 | SWP annotations "Field Capacity" (paper 0,1) and "Wilting Point" (paper 0,0), black border 2, white 0.8 bg | `utils/plot_derived.py:517-548` | H | |
| AG-PS-001 | Percent Saturation: lines per depth "Percent Saturation @ … [%]" with depth colors; y title "Percent Saturation [%]"; legend shown with no title | `utils/plot_derived.py:554-588` | H | |
| AG-ANN-001 | Annual Comparison: "Comparison Variable" Select (placeholder "Select a Variable..."), options = station elements (`{API}elements/{station}/?type=csv&public=True`, cm→in/m→ft relabeled, natural-sorted); keeps the current value if available, else the first element | `layout.py:1208-1220`, `app.py:2441-2458`, `utils/get_data.py:475-510` | H | |
| AG-ANN-002 | Annual data: daily record from 2000-01-01 to today for the one element, `has_etr=False`, `na_info=False` (ignores the Ag Tools date pickers) | `app.py:2011-2019` | H | |
| AG-ANN-003 | Annual plot: x = day of year (computed in UTC), one line per Year; previous years colored from `YlGnBu` sampled 0.15–0.75; current (last) year black width 3; legend right (x 1.01); x "Day of Year", y = column label | `utils/plotting.py:1200-1248` | H | |
| AG-ANN-004 | Annual Precipitation [in] plotted as annual cumulative sum, y label "Annual Cumulative Precipitation [in]" | `utils/plotting.py:1207-1215` | H | |
| AG-ANN-005 | Annual with no variable: no-data figure "Select a variable for comparison..." | `app.py:2007-2009` | H | |

## 9. Frozen-soil mask

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| FS-001 | In the Ag Tools soil profile heatmap, for each depth+time where Soil Temperature ≤ 32°F, the values for Soil VWC, Bulk EC, Percent Saturation and Water Potential are set to NaN | `utils/plot_derived.py:349-361`, `utils/plot_derived.py:374-375` | H | |
| FS-002 | The mask is not applied when the heatmap variable is soil_temp | `utils/plot_derived.py:374` | H | |
| FS-003 | The mask is NOT applied to the SWP or Percent Saturation line plots (`plot_swp` / `plot_percent_saturation`), nor to Latest Data soil panels | `utils/plot_derived.py:628-631`, `utils/plotting.py:554-608` | H | |

## 10. has_swp filtering

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| SWP-001 | When the Ag Tools variable is swp or percent_saturation, the station dropdown is limited to stations with `has_swp`. A current station not in that list is cleared (None) | `app.py:2419-2438` | H | |
| SWP-002 | On Ag Tools station change, the soil chips are rebuilt as EC/VWC/Temperature plus SWP and Percent Saturation only if the station has `has_swp` | `app.py:2372-2396` | H | |
| SWP-003 | If the current soil chip is swp/percent_saturation and the new station lacks has_swp, it resets to soil_vwc. No station resets to soil_vwc | `app.py:2399-2416` | H | |
| SWP-004 | Downloader does NOT offer Soil Water Potential (has_swp branch commented out) | `app.py:2168-2174` | H | |

## 11. Satellite Indicators (brief; deferred)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| SAT-001 | Mode chips "Timeseries Plot" (default) / "Comparison Plot"; station dbc Select "Select a Mesonet Station..." | `layout.py:1453-1501` | H | |
| SAT-002 | Timeseries indicators checklist ET, EVI, FPAR(Fpar), GPP, LAI, NDVI, PET; default ET, GPP, NDVI; "Percentiles" switch default on, tooltip "Show the 5th and 95th percentile of observations for the period of record." | `layout.py:1302-1374` | H | |
| SAT-003 | Data 2000-01-01..today from the Neo4j satellite DB (not the REST API); dates normalized to the current year, Feb 29 dropped; −9999→NaN | `app.py:1938-1947`, `utils/get_data.py:313-396` | P | |
| SAT-004 | Timeseries plot draws only current-year lines, colored by platform (MODIS Aqua `#1f78b4`, Terra `#33a02c`, SMAP L4C `#e31a1c`, SMAP L4SM `#ff7f00`, VIIRS `#b15928`). **[legacy bug]** It filters to the current year before drawing, so the "previous years as grey lines" described in the help text never appear | `utils/plot_satellite.py:96-155`, `layout.py:101` | H | |
| SAT-005 | Percentile band: 5th/95th per month-day, 5-day rolling mean, dashed black, fill `rgba(107,107,107,0.4)`; x range Jan 1−1d to Dec 31+1d; height 500 or 250×n; hovermode x unified | `utils/plot_satellite.py:32-93`, `utils/plot_satellite.py:158-210` | H | |
| SAT-006 | Comparison: X options = station elements (`{v}-station`) + "SATELLITE VARIABLES" product list. Y options = satellite products only. Dates default today−1y..today. Scatter colored by day of year (Magma), nearest match within 16 days, height 600 | `app.py:2035-2143`, `layout.py:1377-1450`, `utils/plot_satellite.py:220-293` | P | |
| SAT-007 | Satellite empty states: "Select Station"; "<b>Select Indicator</b> … Select an indicator from the checkbox to view the plot."; "<b>Select Indicators</b> … Please select two indicators to view the plot."; HTTPError "<b>No Station Data Available</b> … Please select a new station variable." | `app.py:1921-1936`, `app.py:2083-2098`, `app.py:2135-2142` | H | |

## 12. Data Downloader

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| DL-001 | Station Select label "Select Station", placeholder "Select a Mesonet Station from the Map or Dropdown...", searchable, clearable | `layout.py:836-848` | H | |
| DL-002 | On opening the tab, the station is preselected to the FIRST station in the sorted list (not empty) | `app.py:1749-1755` | H | |
| DL-003 | Variables MultiSelect labelled "Select Variable(s)", searchable, clearable. The options are: a disabled header "STANDARD ELEMENTS", then the station elements, then a disabled header "DERIVED VARIABLES", then Feels Like Temperature (feels_like), Reference ET (etr), Livestock Risk Index (cci) | `layout.py:849-857`, `app.py:2146-2190` | H | |
| DL-004 | Station elements: `{API}elements/{station}/?type=csv&public={not switch}`; labels have cm→in and m→ft swaps (−5 cm→2 in … 10 m→33 ft, 2 m→6.6 ft); natural sort | `utils/get_data.py:475-510`, `utils/params.py:237-246` | H | |
| DL-005 | "Show Uncommon Variables" switch (default off). On sends `public=False` to the elements endpoint (more elements); off sends `public=True` | `layout.py:878-885`, `app.py:2161`, `utils/get_data.py:499` | H | |
| DL-006 | Changing the station/switch keeps selected variables that still exist; no selection gives an empty value | `app.py:2183-2190` | H | |
| DL-007 | "Remove Flagged Data" switch (default off). **[legacy bug, inferred semantics]** The request sends `rm_na = not checked`, so checked gives `rm_na=False` and unchecked gives `rm_na=True` | `layout.py:886-893`, `app.py:2264` | H | |
| DL-008 | Time Aggregation chips: Monthly (monthly), Daily (daily, default), Hourly (hourly). There is no Raw option | `layout.py:858-863`, `layout.py:896-916` | H | |
| DL-009 | Start Date: set to the station `date_installed` on station change, and minDate for both pickers = date_installed. End default today; maxDate today for both | `layout.py:921-940`, `app.py:2193-2206` | H | |
| DL-010 | Request params: `level=1`, `type=csv`, `premade=True`, `na_info=True`, `public=False`, `rm_na` per DL-007, `has_etr=False`; standard elements via observations endpoint; derived (feels_like, etr, swp, percent_saturation, cci) via `derived/{period}` with the same params, left-merged; `has_na_x`/`has_na_y` OR-combined | `app.py:2234-2266`, `utils/get_data.py:165-181` | H | |
| DL-011 | **[legacy bug]** If only derived variables are selected, `elements=""` falls back to ALL API elements, so every standard element is downloaded as well | `utils/get_data.py:119`, `app.py:2243-2260` | H | |
| DL-012 | Monthly: fetched from the daily endpoints, then grouped by year/month in America/Denver. Precipitation and Reference ET are summed, all other columns averaged, and `has_na` is any(). The datetime becomes the naive first of the month | `utils/get_data.py:183-198`, `utils/params.py:137-142` | H | |
| DL-013 | `has_na` column renamed "Contains Missing Data" | `app.py:2267` | H | |
| DL-014 | "Logger Reference Pressure [mbar]" column dropped unless element `bp_logger_0244` selected | `app.py:2268-2272` | H | |
| DL-015 | "Run Request" (gradient) shows a loading state while running. With no station or no variables, a red filled Alert appears: "Please select a station and variable first!" | `layout.py:943-960`, `app.py:2209-2236`, `app.py:2313-2321` | H | |
| DL-016 | "Download Data" before a successful run shows the Alert "Please 'Run Request' before attempting to download." | `app.py:2292-2321` | H | |
| DL-017 | After Run Request: one preview line chart per data column (excluding station, datetime, Contains Missing Data), black line, no x title, grey grid | `app.py:2338-2357`, `utils/plotting.py:1359-1364` | H | |
| DL-018 | Downloader map (Scattermapbox, height 300, zoom 5, center −109.5/47, USGS shaded-relief tiles + MT counties GeoJSON). Colors: AgriMet `#00cc96`, HydroMet `#7A7AFB`, co-located stations `#FB7A7A`; hover "<b>Station(s)</b>: {long names}" | `utils/plotting.py:1112-1197`, `app.py:1750` | H | |
| DL-019 | Clicking a map marker selects that station in the downloader dropdown (first station code if co-located) | `app.py:2324-2335` | P | |
| DL-020 | Fixed footer (40px, bg `#129dff`): "Supported by Bureau of Land Management (RM-CESU Award L16AC00359)" bold | `layout.py:1003-1013` | H | |
| DL-021 | Downloaded data held in memory store `dl-data` (lost on reload) | `layout.py:991` | P | |

## 13. Downloads (filename, columns)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| DLF-001 | Downloader filename `{station}_{period}_{YYYYMMDD}_to_{YYYYMMDD}.csv` (start/end with dashes removed; period monthly/daily/hourly) | `app.py:2309` | H | |
| DLF-002 | CSV written with pandas `to_csv` default, so it includes a leading unnamed integer index column | `app.py:2310` | H | |
| DLF-003 | CSV columns: (index), station, datetime (ISO, round-tripped through JSON), each element "{description} [{unit}]", derived columns, "Contains Missing Data" *(order inferred from API + merge order)* | `app.py:2267-2274`, `app.py:2308` | H | |
| DLF-004 | Latest Data has a download callback (`{station}_{period}_{start}_to_{end}.csv`), but no `download-button` exists in the layout, so Latest Data has no CSV download (dead code) | `app.py:404-450` | H | |

## 14. Outage modal

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| OUT-001 | Config fetched server-side from `https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/outage.json` (timeout 5s), cached 60s; failures are cached too | `utils/outage.py:29-35`, `utils/outage.py:86-116` | P | |
| OUT-002 | Defaults: active False, id "", title "Montana Mesonet Notice", color "warning", message "", button_text "Got it"; null keys fall back to defaults | `utils/outage.py:40-47`, `utils/outage.py:53-83` | H | |
| OUT-003 | Notice is active only if `active` is truthy AND `message` is non-blank | `utils/outage.py:77` | H | |
| OUT-004 | Modal content: header MCO logo (40px); body Alert with color=config.color, H5 title, Markdown message; footer primary button with button_text; centered, size md | `layout.py:133-208` | H | |
| OUT-005 | Shown at most once per browser tab session. The sessionStorage key is `outageModalShown:{id}`, so a new id re-shows the notice. The close button hides it. Inactive config means it never opens | `app.py:1647-1681` | H | |
| OUT-006 | Modal `is_open` defaults to `active` server-side (so the first render already shows it) | `layout.py:193-206` | P | |

## 15. One-pager links

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| OP-001 | One-pagers fetched on each Metadata tab render from `https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/one-pagers.json` (list of `{station, url}`) | `app.py:341-346` | H | |
| OP-002 | If found, a row "Station One-Pager" with markdown "[Click to View]({url})" is inserted at index 2 (after Long Name). Missing station or fetch error means no row | `app.py:346-352` | H | |

## 16. URL / deep-link / share behaviors

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| URL-001 | Path `/dash/{station}` (or `/{station}`) preselects the Latest Data station; the last path segment (`Path.stem`) is matched against the station code | `app.py:1079-1114` | H | |
| URL-002 | If no code matches, the segment is matched against `nwsli_id` (NWSLI ids resolve to the station code) | `app.py:1109-1110` | H | |
| URL-003 | Root path, a segment containing "dash", or no match gives no station | `app.py:1112-1113` | H | |
| URL-004 | Hash routing: `#satellite`→Satellite tab, `#ag`→Ag Tools, `#downloader`→Downloader, any other non-empty hash→Latest Data, empty hash keeps the current tab | `app.py:1761-1796` | H | |
| URL-005 | URL station only drives the Latest Data dropdown (not Ag Tools/Downloader/Satellite) | `app.py:1079-1114` | H | |
| URL-006 | "SHARE PLOT" opens a modal: "#### Copy link below to share data:" / "The link will stay active for 90 days.", a textarea with the URL, and a Clipboard "Copy URL" icon | `utils/update.py:163-214`, `utils/update.py:313-332` | H | |
| URL-007 | Share URL = `{scheme}://{host}[/dash]/?state={hash}`, where hash = SHAKE-128 of the JSON layout state, 4 bytes (8 hex chars) | `utils/update.py:342-387` | H | |
| URL-008 | Saved state = the entire Dash layout tree written to `./share/{hash}.json` (not overwritten if it exists). Data stores and figures are cleared before saving (temp_station_data=-1, dl_data, derived/satellite figures, etc.) | `app.py:186-234` | P | |
| URL-009 | `?state={hash}` on load replaces the whole layout with the saved one and closes the share modal. A missing file leaves the default layout | `app.py:155-184`, `utils/update.py:334-340` | H | |
| URL-010 | During state load, callbacks decorated with `pause_update` are suppressed (lock) until a 2000ms one-shot interval fires | `utils/update.py:285-311`, `utils/update.py:228-248` | P | |
| URL-011 | Help text cites the example deep link `https://mesonet.climate.umt.edu/dash/crowagen` | `layout.py:97` | H | |

## 17. Empty / error states (Latest Data)

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| ES-001 | No station: main plot "<b>Select Station</b> <br><br> To get started, select a station from the dropdown above<br>or the map to the right." | `app.py:1070-1076` | H | |
| ES-002 | No variables selected: "No variables selected" (takes precedence over the station check) | `app.py:1036-1037` | H | |
| ES-003 | Fetch failed (-1): "<b>No data available for selected station and dates</b> <br><br> Either change the date range or select a new station." | `app.py:1061-1068` | H | |
| ES-004 | No-data figure style: black 18px centered paper annotation, hidden axes, white bg, height 500; default text "No data available for selected dates." | `utils/plotting.py:1313-1356` | H | |
| ES-005 | Date parse error returns -1 (no-data state) | `app.py:831-848` | P | |

## 18. Mobile / responsive

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| MOB-001 | Latest Data columns: sidebar xs/sm 12, md 4, lg/xl 3; plot xs/sm 12, md 8, lg/xl 6; info cards xs/sm/md 12, lg/xl 3 (stacked order sidebar → plot → cards) | `layout.py:752-829` | H | |
| MOB-002 | Sidebar, plot and card column each 88vh tall with own vertical scroll | `layout.py:725`, `layout.py:756`, `layout.py:822-827` | P | |
| MOB-003 | ≤600px: `.stationSelect` gets bottom padding; `.toggle`/`.dlbutton` hidden | `assets/base-styles.css:645-662` | M | |
| MOB-004 | Satellite selector columns xs/sm 12 (station, mode), md 2; comparison selects xs 5 | `layout.py:1302-1501` | M | |
| MOB-005 | Ag Tools selectors in a 3-column Grid (span 4 each), grow, justify space-around | `layout.py:1091-1299` | M | |

## 19. Help / about text & external links

| ID | Feature / expected behavior | Legacy ref | Auto | Status |
|---|---|---|---|---|
| HELP-001 | Help modal (size xl, scrollable) heading "#### The Montana Mesonet Dashboard" with welcome text explaining dropdown / locator map / URL path selection | `layout.py:71-130` | H | |
| HELP-002 | Link to the Montana Mesonet API docs `https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com/docs` | `layout.py:98` | H | |
| HELP-003 | Satellite paragraph ("previous years plotted as grey lines…", "Comparison" button) | `layout.py:100-102` | H | |
| HELP-004 | Contacts: james.seielstad@mso.umt.edu; feedback form (Airtable); GitHub issues `https://github.com/mt-climate-office/mesonet-dashboard/issues`; Mesonet Manager Kevin Hyde kevin.hyde@umontana.edu; state climatologist Kelsey Jencso kelsey.jencso@umontana.edu | `layout.py:103-110` | H | |
| HELP-005 | "#### Montana Mesonet Background" (6 stations in 2016, MREDI, grown to 94 stations, 2020 U.S. Army Corps contract for 205 stations every 500 sq mi) | `layout.py:112-118` | H | |
| HELP-006 | "#### Source Code" link `https://github.com/mt-climate-office/mesonet-dashboard/tree/main` | `layout.py:119-120` | H | |
| HELP-007 | Feedback modal (embedded Airtable iframe) exists but is disabled. The GIVE FEEDBACK button navigates to the form instead | `layout.py:211-255`, `layout.py:1589`, `app.py:1684-1709` | H | |
| HELP-008 | No-funding modal present but all funding callbacks commented out (never opens) | `layout.py:1590-1597`, `app.py:2569-2661` | H | |
