# Ag compute: intentional divergences from the API

The client-side compute library (`compute/`) ports the Mesonet API's derived
variables (`mesonet-db-rds/api/app/app/{etr,derived}.py`). The policy is
**"correct + documented"**: port each formula faithfully, fix the API's known
bugs, and record every intentional difference here. Golden tests in
`compute/*.test.ts` check parity against the Wave 0 fixtures
(`__fixtures__/`, level 2, US units, 3-decimal rounding) everywhere else.

To print the per-variable parity table, run `VITE_PARITY=1 npx vitest run src/features/ag --silent=false`.

API line numbers refer to `mesonet-db-rds` as of 2026-10-01.

## Parity achieved (no divergence)

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

## Divergences

### D-ETO-1: a missing input gives null hourly ETo, not 0

- **API:** `etr.py:726` runs `eto = np.where(eto > 0, eto, 0)`. `NaN > 0` is
  false, so any missing input (e.g. wind) becomes **0 mm**.
- **Here:** `null`. A missing input is not zero evapotranspiration, and a 0
  would also bias daily and annual sums.
- **Observed:** arskeogh `hourly.jul2025` has 33 hours with no wind. The API
  reports 0.000 in for them, and we report null.
- **Test:** `compute/eto.test.ts`, "etoHourly golden parity", arskeogh jul2025
  (null count equals the missing-wind count), and "missing hourly input → null,
  not 0 (D-ETO-1)".

### D-CCI-1: negative night-time solar radiation is clamped to 0

- **API:** `derived.py:669` takes `np.sqrt(avg_sol_rad)`. Pyranometers often
  report small negative values at night, which make the CCI NaN.
- **Here:** R is set to `max(0, R)` before the radiation correction
  (`compute/cci.ts` `cciRadCorrection`).
- **Observed:** none of the fixtures have negative solar values (night hours
  read 0.0), so golden parity is unaffected.
- **Test:** `compute/cci.test.ts`, "negative night-time solar is clamped to 0,
  not NaN (D-CCI-1)".

### D-SWP-1: each station's VWC is clipped to its own lab range

- **API:** `derived.py:255` selects `clip_range = vwc_range[vwc_range["depth"] == depth]`
  with no station filter. `derived.py:262-263` then uses `.values[0]`, so a
  multi-station request clips every station with the **first** station's lab
  range for that depth.
- **Here:** `swp()` uses only the `SoilParams` rows whose `station` matches
  the series, including `labVwcMin`/`labVwcMax`.
- **Observed:** none. Each fixture is a single-station request.
- **Test:** `compute/soil.test.ts`, "clips each station to its own lab range
  (D-SWP-1)".

### D-SWP-2: the soil parameters come from vendored mesonet-soils, not the API DB (data divergence)

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

### D-PS-1: percent saturation uses the API DB porosity, not mesonet-soils (data divergence)

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

### D-GDD-1: wheat and barley stage labels are recomputed after the NDAWN switch

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

### D-GDD-2: a crop with no stage table gets null labels, not "Planted"/0

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

### D-GDD-3: the cumulative carries forward over missing days

- **API:** `derived.py:1029` uses `groupby().cumsum()`, which leaves NaN on a
  missing day (and `merge_asof` at line 1040 rejects null keys).
- **Here:** the contract's semantics apply: a running sum that skips nulls and
  carries the previous total forward, and stays null until the first valid day.
  Daily GDD stays null on missing days.
- **Observed:** the fixtures have no missing temperature days.
- **Test:** `compute/gdd.test.ts`, "cumulative skips nulls and carries forward
  (D-GDD-3)".

### D-GDD-4: the API's hemp stage ids differ from `write_hemp_table.sql` (data, informational)

The API's first hemp stage is "BBCH Stage 11". `write_hemp_table.sql` (and so
the vendored table) has "BBCH Stages 0-11". Names and thresholds match.
`checkStages` compares hemp by name. Workstream B should decide which spelling
to ship.

### D-GDD-5: explicit cutoffs override the crop's

- **API:** when `crop` is given, `derived.py:58-62` ignores `low`/`high`.
- **Here:** if `lowC`/`highC` are passed, they win, which supports the UI
  threshold slider. The series is then not a crop series (`crop = null`,
  `ndawnSwitch = null`), and any bound left out falls back to the named crop's.
  Without custom cutoffs, the crop's cutoffs from `derived.py:80-90` apply.
  `GddSeries.ndawnSwitch` records whether the wheat/barley rule was applied,
  and `projectGdd` follows that record rather than re-deriving it.
- **Test:** `compute/gdd.test.ts`, "custom cutoffs in °C override the crop
  (D-GDD-5)".

## Conventions that are not divergences

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

## UI divergences vs the legacy dashboard (Wave 3)

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
