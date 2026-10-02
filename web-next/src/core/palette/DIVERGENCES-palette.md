# Palette divergences (to merge into `web-next/DIVERGENCES.md`)

Every legacy data color is replaced by a role in `core/palette/roles.ts` (house palette, HOUSE-STYLE §6).
"web/" is the current React port; "legacy" is the Dash app. Every role is per theme; the
light-theme value is listed unless noted. Every line, marker and bar clears 3:1 on `--bg-surface`.

| ID | Legacy (and web/) | New role → color |
|---|---|---|
| LDP-007 | `COLOR_MAPPER`: Air Temp / Well Temp `#c42217`, Solar `#c15366`, RH `#a16a5c`, Snow Depth / Pressure `#A020F0`, Wind Speed `#ec6607`, Gust `#FEC20C`, Well Level `#0000FF`, Well EC `#AEF359`, Max Precip Rate `#000080`, VPD `#32612D`, Wind Dir `#607D3B` | `variableStyle()` by family. Temperature `#CC6677`; moisture (RH, VPD, well level, well EC) `#3388BB`; radiation `#998833`; wind (speed, gust, direction) `#117733`, gust dashed; pressure/snow `#AA4499`; precip rate `#332288`. Light = Tol muted, dark = Tol bright, HC = Tol high-contrast, darkened or lightened where needed for 3:1 |
| LDP-009 | Precip bars Plotly default `#636efa` | `PRECIP`: Blues bars `#2171b5` + cumulative `#08306b` |
| LDP-010 | ETr bars `#FF0000` | `ETR`: YlOrRd bars `#e31a1c` + cumulative `#800026` |
| LDP-011 | Depth colors: Plotly qualitative (legacy); Viridis sample (web/) | `depthColor(in, theme)`: batlow by fixed depth rank (2–40 in). Light uses 0–0.55, dark 0.45–1, HC 0.35–1 |
| LDP-013 | Depth legend chips filled with the depth color, white text | Same `depthColor()` fill. White text does not reach 4.5:1 on every chip, so the chip text color is an open question for the Latest agent |
| LDP-018 | Normals band `rgba(107,107,107,0.4)` between dashed black q25/q75 lines | `NORMALS`: band `--text-dim` at 18% + dashed `--text-dim` median line |
| LDP-019 | Precip/ETr normals markers black | `NORMALS.line` (`--text-dim`); marker shapes unchanged |
| SC-008 | Sensor-event rect `rgba(200,200,200,1)` at 0.75 opacity | `SENSOR_EVENT`: `--text-dim` at 25% + hatch + label "Sensor change" |
| LDT-005 | Wind rose `Plasma_r` | `binColors(n, theme)`: batlow, slow → fast |
| LDT-006 | Wind rose title black | Kit `--text-primary` (chrome, not a palette role) |
| LDB-005 | Table odd rows `rgb(220,220,220)`, black on white | Kit table tokens (chrome, not a palette role) |
| AG-FL-001 | Feels-like markers blue / red / green over a black line | `FEELS_LIKE`: wind chill `#2166ac` diamond, heat index `#b2182b` triangle, average temp grey `#767676` circle; line `INDEX_LINE` (`--text-dim`). Dark/HC step along RdBu toward the light end |
| AG-CCI-003 | Extreme Danger `#843094`, Extreme `#CC0606`, Severe `#FF4400`, Moderate `#FFAD00`, Mild `#FFFF00`, No Stress `#A5A5A5`; black line (legacy). YlOrRd + `#BBBBBB` (web/) | `cciColor()`: No Stress grey + 5 YlOrRd samples, using the part of the ramp that clears 3:1 on each surface (light 0.6–1); line `INDEX_LINE` |
| AG-GDD-005 | Orange bars + orange line, markers in a 24-color stage palette (legacy); Tol sand/indigo + Tol stage colors (web/) | `GDD`: YlOrRd bars `#fc4e2a` + cumulative `#bd0026`; projection band = cumulative at 15%; stages are labelled markLines in `--text-dim` (`GDD_STAGE_LINE`), not marker colors |
| AG-SOIL-004 | soil_temp `RdBu_r` mid 32; swp `BrBG_r`; others `BrBG` (legacy). Viridis / custom diverging (web/) | `HEATMAP`: soil_temp RdBu reversed, midpoint 32 °F; VWC YlGnBu; EC batlow; SWP BrBG reversed (wet teal → dry brown); percent saturation Blues. Frozen cells `FROZEN` grey (`#d9d9d9` light) + hatch |
| AG-SWP-001 | Depth colors as LDP-011 | `depthColor()` (cm ÷ 2.54) |
| AG-SWP-002 | FC/WP bands `rgba(128,128,128,0.2)` (legacy), `rgba(150,150,150,0.18)` + `#444` dashed lines (web/) | `SWP_BANDS`: `--text-dim` at 12% + dashed `--text-dim` lines, labelled "Field Capacity" / "Wilting Point" |
| AG-SWP-003 | Annotation boxes: black border, white 0.8 background | Kit tokens (`--text-primary` border, `--bg-surface` fill), not a palette role |
| AG-PS-001 | Depth colors as LDP-011 | `depthColor()` |
| AG-ANN-003 | Past years YlGnBu 0.15–0.75 (legacy), Viridis (web/); current year black, width 3 | `yearColors(n, theme)`: batlow old → new; current year `ANNUAL_CURRENT` = `--text-primary`, width 3 |
| DL-017 | Preview lines black | `previewColor(i, theme)`: Tol bright cycle (light keeps blue, green, red, purple) |
| DL-018 | AgriMet `#00cc96`, HydroMet `#7A7AFB`, co-located `#FB7A7A`, selected `#FFD700` | `NETWORK_COLOR`: HydroMet `#4477AA` circle, AgriMet `#CC6622` (light; `#EE7733` dark/HC) hollow circle, Cooperator `#009988` ring; selected `SELECTION_RING` = `--selection-ring`. A color for co-located stations is still an open question |
| (Latest map, `web/src/lib/networks.ts`) | HydroMet `#7A7AFB`, AgriMet `#00cc96`, Cooperator `#FB7A7A`, selected `#FFD700` | Same as DL-018 |
