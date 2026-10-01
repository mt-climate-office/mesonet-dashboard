/**
 * Ag Tools contract: the interface between workstream A (pure compute,
 * `features/ag/compute/**`) and workstream B (data layer,
 * `features/ag/data/**`). Types only. Extend via PR to the orchestrator.
 *
 * Conventions (apply to every type below unless a field says otherwise):
 *
 *  - **Time.** Datetimes are America/Denver *local* ISO strings:
 *    `"YYYY-MM-DD"` for daily rows, `"YYYY-MM-DDTHH:mm"` (no offset) for
 *    hourly rows. Hourly series also carry `epochMs` (UTC ms since epoch) so
 *    DST transitions are unambiguous. Daily grouping, DOY and cumulative sums
 *    use the local date.
 *  - **Units.** SI internally: °C, m/s, %, W/m², kPa, mm (and cm for depths,
 *    m for heights/elevation). Conversion to US units (°F, mph, in, bar…)
 *    happens only at the display edge, never in compute or data code.
 *  - **Missing values** are `null`, never `NaN` or `undefined`. Compute
 *    functions propagate `null` and must not emit `NaN`.
 *  - **Columnar.** Series are struct-of-arrays; every array in one series has
 *    the same length and index `i` refers to the same row.
 *  - **QC.** Every series carries `level` (the API QC level the inputs came
 *    from) and a per-row `provisional` flag. Derived outputs set
 *    `provisional[i]` true if any input at row `i` was provisional.
 */

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

/** API QC level: 0 raw, 1 provisional QC (legacy dashboard default), 2 full QC. */
export type QcLevel = 0 | 1 | 2

/** Local date, `"YYYY-MM-DD"` (America/Denver). */
export type LocalDate = string

/** Local hourly timestamp, `"YYYY-MM-DDTHH:mm"` (America/Denver, no offset). */
export type LocalDateTime = string

/** A value that may be missing. */
export type Nullable = number | null

/** Fields every series carries. */
export interface SeriesBase {
  station: string
  level: QcLevel
  /** Per-row; same length as the series' time axis. */
  provisional: boolean[]
}

/* -------------------------------------------------------------------------- */
/* Inputs (produced by B, consumed by A)                                       */
/* -------------------------------------------------------------------------- */

export type Network = 'HydroMet' | 'AgriMet'

export interface StationMeta {
  id: string
  /** Decimal degrees, WGS84. */
  lat: number
  lon: number
  elevationM: number
  network: Network
  /** Anemometer height in metres: 10 (HydroMet) or 2.44 (AgriMet 8 ft). */
  windHeightM: 10 | 2.44
  hasSwp: boolean
  /** Install date. */
  installed: LocalDate
}

/** Daily aggregates (from `/observations/daily` with agg_func min/max/avg). */
export interface DailyMet extends SeriesBase {
  date: LocalDate[]
  tminC: Nullable[]
  tmaxC: Nullable[]
  tavgC: Nullable[]
  rhMin: Nullable[]
  rhMax: Nullable[]
  rhAvg: Nullable[]
  /** Daily mean shortwave, W/m². */
  sradWm2: Nullable[]
  /** Daily mean wind speed at `StationMeta.windHeightM`, m/s. */
  windMs: Nullable[]
}

/** Hourly observations (from `/observations/hourly`). */
export interface HourlyMet extends SeriesBase {
  /** Hour-beginning local timestamp. */
  time: LocalDateTime[]
  epochMs: number[]
  tC: Nullable[]
  rh: Nullable[]
  sradWm2: Nullable[]
  /** At `StationMeta.windHeightM`, m/s. */
  windMs: Nullable[]
}

/**
 * Soil observations by depth. `vwcPct[d][i]` / `tempC[d][i]` is depth
 * `depthsCm[d]` at row `i`. Depths are positive cm below the surface, shallow
 * → deep. The time axis is daily (`LocalDate`) or hourly (`LocalDateTime`),
 * and `epochMs` is always present.
 */
export interface SoilSeries extends SeriesBase {
  depthsCm: number[]
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  vwcPct: Nullable[][]
  tempC: Nullable[][]
}

/** Fredlund–Xing fit. `h` is the residual suction parameter, kPa. */
export interface FxParams {
  r: number
  s: number
  n: number
  m: number
  h: number
}

/** van Genuchten fit (θr, θs, α, n). */
export interface VgParams {
  r: number
  s: number
  a: number
  n: number
}

/** Soil hydraulic parameters for one (station, depth). */
export interface SoilParams {
  station: string
  depthCm: number
  model: 'FX' | 'VG'
  fx?: FxParams
  vg?: VgParams
  porosityPct?: number
  /** Lab-observed VWC range (%) used to clip VWC before inversion. */
  labVwcMin?: number
  labVwcMax?: number
  /** Where the row came from. */
  source: 'data2' | 'vendored'
  /** Release tag / date of the mesonet-soils build, e.g. "2026-09-25". */
  release: string
}

export type GddCrop =
  | 'wheat'
  | 'barley'
  | 'canola'
  | 'corn'
  | 'sugarbeet'
  | 'sunflower'
  | 'hemp'

/**
 * GDD temperature cutoffs. Stored in °C per the SI convention; the UI slider
 * works in °F and converts at the edge. (Legacy °F defaults live in
 * `lib/params` `GDD_CROP_THRESHOLDS`.)
 */
export interface GddCutoffs {
  lowC: number
  highC: number
}

export interface GddStage {
  stage: number
  name: string | null
  description: string | null
  /** Cumulative GDD (°F·day, as published) at which this stage begins. */
  gdd: number
}

/** Stage table for one crop. An empty `stages` means "no stage table". */
export interface GddStageTable {
  crop: GddCrop
  stages: GddStage[]
}

/** Interquartile summary of one variable for one calendar day. */
export interface Quantiles {
  q25: Nullable
  median: Nullable
  q75: Nullable
}

/** One calendar day of gridMET 1991–2020 normals. */
export interface DailyNormal {
  tminC: Quantiles
  tmaxC: Quantiles
  /** Median daily precipitation, mm. */
  prMm: Nullable
  /** Median daily reference ET, mm. */
  petMm: Nullable
}

/** Station normals keyed by `"MM-DD"` (Feb 29 may be absent). */
export interface DailyNormals {
  station: string
  byMonthDay: Record<string, DailyNormal>
}

/** Short-range daily forecast (≤ 7 days) used for GDD projection. */
export interface ForecastDaily {
  date: LocalDate[]
  tminC: Nullable[]
  tmaxC: Nullable[]
  source: 'nws'
  /** ISO timestamp the forecast was issued. */
  issued?: string
}

/* -------------------------------------------------------------------------- */
/* Outputs (produced by A, rendered by Wave 3 UI)                              */
/* -------------------------------------------------------------------------- */

/** Reference ET (ASCE/FAO-56 short grass). Daily or hourly. */
export interface EtoSeries extends SeriesBase {
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  etoMm: Nullable[]
}

export interface GddProjection {
  date: LocalDate[]
  daily: Nullable[]
  cumulative: Nullable[]
  stage: (number | null)[]
  stageName: (string | null)[]
  /** Which input drove each projected day. */
  basis: ('forecast' | 'normals')[]
}

export interface GddSeries extends SeriesBase {
  crop: GddCrop
  cutoffs: GddCutoffs
  date: LocalDate[]
  /** Daily GDD (°F·day, matching published stage tables). */
  daily: Nullable[]
  /** Running sum from the first date; carries forward over missing days. */
  cumulative: Nullable[]
  /** Last stage whose `gdd` ≤ cumulative; null when no stage table. */
  stage: (number | null)[]
  stageName: (string | null)[]
  projected?: GddProjection
}

export type FeelsLikeRegime = 'wind_chill' | 'heat_index' | 'air_temp'

export interface FeelsLikeSeries extends SeriesBase {
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  valueC: Nullable[]
  regime: (FeelsLikeRegime | null)[]
}

export type CciClass =
  | 'No Stress'
  | 'Mild'
  | 'Moderate'
  | 'Severe'
  | 'Extreme'
  | 'Extreme Danger'

/** Comprehensive Climate Index (Mader 2010). */
export interface CciSeries extends SeriesBase {
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  valueC: Nullable[]
  /** Risk class; depends on adult vs newborn thresholds. */
  class: (CciClass | null)[]
  livestock: 'adult' | 'newborn'
}

/** Soil water potential per depth. Values are positive suction magnitudes, kPa. */
export interface SwpSeries extends SeriesBase {
  depthsCm: number[]
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  /** `kPa[d][i]` for depth `depthsCm[d]`. */
  kPa: Nullable[][]
  /** True where VWC was clipped to the lab min/max before inversion. */
  clipped: boolean[][]
}

/** `clip(vwc / porosity · 100, 0, 100)` per depth. */
export interface PercentSaturationSeries extends SeriesBase {
  depthsCm: number[]
  time: (LocalDate | LocalDateTime)[]
  epochMs: number[]
  pct: Nullable[][]
}
