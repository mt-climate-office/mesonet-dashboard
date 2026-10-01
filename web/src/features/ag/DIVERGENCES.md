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
| Percent saturation | — | 0.0005 % | 2 × 4 |

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
- Percent saturation, which uses porosity from the same release, matches to
  0.0005 %.

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
  exists, the API behaviour is kept: before the first threshold the row is
  stage 0, named "Planted" if the table has names (and null otherwise, as for
  sugarbeet and sunflower).
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
  threshold slider. The NDAWN switch is then off. Without them, the crop's
  cutoffs from `derived.py:80-90` apply.
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
