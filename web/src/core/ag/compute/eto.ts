/**
 * ASCE/FAO-56 standardized reference ET (short grass), ported from the API:
 * `mesonet-db-rds/api/app/app/etr.py` (`eto_daily` 303-506, `eto_hourly`
 * 615-729, helpers 9-289). Inputs and outputs are SI (°C, %, W/m², m/s, mm).
 *
 * Input conventions follow `main.py` `handle_derived_logic` /
 * `derived.py` `process_derived_to_pandas`:
 *  - daily: min/max air temperature and min/max RH, daily mean solar and wind;
 *  - hourly: hourly means; the hour for solar time is taken in fixed UTC−7
 *    (no DST) and shifted to the period midpoint (+0.5); the day of year is the
 *    local (America/Denver) date's;
 *  - wind is converted from the anemometer height to 2 m with the FAO-56
 *    log profile (10 m HydroMet, 2.44 m AgriMet).
 *
 * Divergence (see DIVERGENCES.md): the API's hourly `np.where(eto > 0, eto, 0)`
 * turns a missing input into 0 mm; here a missing input gives `null`.
 */
import type { DailyMet, EtoSeries, HourlyMet, Nullable, StationMeta } from '../contract'
import { clean, dailyEpochMs, dayOfYear, ok } from './util'

/* ------------------------------------------------------------------------ */
/* Helpers (etr.py 9-289)                                                    */
/* ------------------------------------------------------------------------ */

/** Solar declination, rad (etr.py:9-20). */
export function solarDeclination(doy: number): number {
  return 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39)
}

/** Inverse relative Earth–Sun distance (etr.py:23-36). */
export function inverseRelativeDistance(doy: number): number {
  return 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy)
}

/** Saturation vapour pressure, kPa (etr.py:96-105). */
export function satVaporPressure(tC: number): number {
  return 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3))
}

/** Slope of the saturation vapour pressure curve, kPa/°C (etr.py:208-219). */
export function svpSlope(tC: number): number {
  return (4098 * satVaporPressure(tC)) / (tC + 237.3) ** 2
}

/** Atmospheric pressure from elevation, kPa (etr.py:222-231). */
export function pressureKPa(elevationM: number): number {
  return 101.3 * ((293 - 0.0065 * elevationM) / 293) ** 5.26
}

/** Psychrometric constant, kPa/°C (etr.py:234-243). */
export function psychrometricConstant(pressure: number): number {
  return 0.000665 * pressure
}

/** Wind speed adjusted to 2 m with the FAO-56 log profile (etr.py:246-262). */
export function windAt2m(windMs: number, heightM: number): number {
  return heightM !== 2 ? windMs * (4.87 / Math.log(67.8 * heightM - 5.42)) : windMs
}

/** Clear-sky radiation from extraterrestrial radiation (etr.py:81-93). */
function clearSky(elevationM: number, ra: number): number {
  return (0.75 + 2e-5 * elevationM) * ra
}

/** Rs/Rso, 0.8 when Rso is 0, clipped to [0.3, 1] (etr.py:123-141). */
function radiationFraction(rs: number, rso: number): number {
  const frac = rso === 0 ? 0.8 : rs / rso
  return Math.min(1, Math.max(0.3, frac))
}

/** Net outgoing longwave (etr.py:144-177). `temp4` is the mean of (T+273.16)^4. */
function longwave(temp4: number, ea: number, frac: number, daily: boolean): number {
  const coef = daily ? 4.903e-9 : 2.041308e-10
  return coef * temp4 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * frac - 0.35)
}

/* ------------------------------------------------------------------------ */
/* Scalar kernels                                                            */
/* ------------------------------------------------------------------------ */

export interface EtoSite {
  latDeg: number
  lonDeg: number
  elevationM: number
  windHeightM: number
}

/** Daily ETo (mm/day) for one row (etr.py:303-506). */
export function etoDailyValue(
  site: EtoSite,
  doy: number,
  tminC: number,
  tmaxC: number,
  rhMin: number,
  rhMax: number,
  sradWm2: number,
  windMs: number,
  alpha = 0.23,
): number {
  const tmean = (tminC + tmaxC) / 2
  const rs = sradWm2 * 3600 * 24 * 1e-6
  const u2 = windAt2m(windMs, site.windHeightM)
  const delta = svpSlope(tmean)
  const psy = psychrometricConstant(pressureKPa(site.elevationM))
  const esMin = satVaporPressure(tminC)
  const esMax = satVaporPressure(tmaxC)
  const es = (esMin + esMax) / 2
  const ea = (esMin * (rhMax / 100) + esMax * (rhMin / 100)) / 2
  const dec = solarDeclination(doy)
  const dr = inverseRelativeDistance(doy)
  const lat = (Math.PI / 180) * site.latDeg
  const ws = Math.acos(-Math.tan(lat) * Math.tan(dec))
  const ra =
    ((24 * 60) / Math.PI) *
    (0.082 * dr * (ws * Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.sin(ws)))
  const rso = clearSky(site.elevationM, ra)
  const rns = (1 - alpha) * rs
  const temp4 = ((tmaxC + 273.16) ** 4 + (tminC + 273.16) ** 4) / 2
  const rnl = longwave(temp4, ea, radiationFraction(rs, rso), true)
  const rn = rns - rnl
  return (
    (0.408 * delta * (rn - 0) + psy * (900 / (tmean + 273)) * (u2 * (es - ea))) /
    (delta + psy * (1 + 0.34 * u2))
  )
}

/**
 * Hourly ETo (mm/h) for one row (etr.py:615-729). `hourUtcMinus7` is the
 * hour-beginning clock hour in fixed UTC−7; `doy` is the local date's day of
 * year. Negative results are clipped to 0 as in the API.
 */
export function etoHourlyValue(
  site: EtoSite,
  doy: number,
  hourUtcMinus7: number,
  tC: number,
  rh: number,
  sradWm2: number,
  windMs: number,
  alpha = 0.23,
  lz = 105,
): number {
  const lat = (Math.PI / 180) * site.latDeg
  const hour = hourUtcMinus7 + 0.5
  const lon = Math.abs(site.lonDeg)
  const u2 = windAt2m(windMs, site.windHeightM)
  const dec = solarDeclination(doy)
  const dr = inverseRelativeDistance(doy)
  // Seasonal correction for solar time (etr.py:509-522).
  const b = (2 * Math.PI * (doy - 81)) / 364
  const sc = 0.1645 * Math.sin(2 * b) - 0.1255 * Math.cos(b) - 0.025 * Math.sin(b)
  // Solar time angles (etr.py:525-568).
  const w = (Math.PI / 12) * (hour + 0.06667 * (lz - lon) + sc - 12)
  let w1 = w - Math.PI / 24
  let w2 = w + Math.PI / 24
  const ws = Math.acos(-Math.tan(lat) * Math.tan(dec))
  if (w1 < -ws) w1 = -ws
  if (w2 < -ws) w2 = -ws
  if (w1 > ws) w1 = ws
  if (w2 > ws) w2 = ws
  if (w1 > w2) w1 = w2
  // Extraterrestrial radiation for the hour (etr.py:571-599).
  const ra =
    ((12 * 60) / Math.PI) *
    (0.082 *
      dr *
      ((w2 - w1) * Math.sin(lat) * Math.sin(dec) +
        Math.cos(lat) * Math.cos(dec) * (Math.sin(w2) - Math.sin(w1))))
  const rso = clearSky(site.elevationM, ra)
  const rs = sradWm2 * 3600 * 1e-6
  const es = satVaporPressure(tC)
  const ea = es * (rh / 100)
  const rnl = longwave((tC + 273.16) ** 4, ea, radiationFraction(rs, rso), false)
  const rn = (1 - alpha) * rs - rnl
  const delta = svpSlope(tC)
  const psy = psychrometricConstant(pressureKPa(site.elevationM))
  // Soil heat flux (etr.py:602-612): 0.1·Rn by day, 0.5·Rn by night.
  const g = rs > 0 ? 0.1 * rn : 0.5 * rn
  const eto =
    (0.408 * delta * (rn - g) + psy * (37 / (tC + 273)) * (u2 * (es - ea))) /
    (delta + psy * (1 + 0.24 * u2))
  return eto > 0 ? eto : 0
}

/* ------------------------------------------------------------------------ */
/* Series                                                                     */
/* ------------------------------------------------------------------------ */

function site(station: StationMeta): EtoSite {
  return {
    latDeg: station.lat,
    lonDeg: station.lon,
    elevationM: station.elevationM,
    windHeightM: station.windHeightM,
  }
}

/** Daily reference ET (mm/day). Rows with any missing input are `null`. */
export function etoDaily(met: DailyMet, station: StationMeta, alpha = 0.23): EtoSeries {
  const s = site(station)
  const etoMm: Nullable[] = met.date.map((date, i) => {
    const tmin = met.tminC[i]
    const tmax = met.tmaxC[i]
    const rhMin = met.rhMin[i]
    const rhMax = met.rhMax[i]
    const srad = met.sradWm2[i]
    const wind = met.windMs[i]
    if (!ok(tmin) || !ok(tmax) || !ok(rhMin) || !ok(rhMax) || !ok(srad) || !ok(wind)) return null
    return clean(etoDailyValue(s, dayOfYear(date), tmin, tmax, rhMin, rhMax, srad, wind, alpha))
  })
  return {
    station: met.station,
    level: met.level,
    provisional: [...met.provisional],
    time: [...met.date],
    epochMs: dailyEpochMs(met.date),
    etoMm,
  }
}

/** Hour (0–23) of an instant on a fixed UTC−7 clock, as the API uses for solar time. */
export function hourUtcMinus7(epochMs: number): number {
  return new Date(epochMs - 7 * 3_600_000).getUTCHours()
}

/** Hourly reference ET (mm/h). Rows with any missing input are `null`. */
export function etoHourly(met: HourlyMet, station: StationMeta, alpha = 0.23): EtoSeries {
  const s = site(station)
  const etoMm: Nullable[] = met.time.map((time, i) => {
    const t = met.tC[i]
    const rh = met.rh[i]
    const srad = met.sradWm2[i]
    const wind = met.windMs[i]
    if (!ok(t) || !ok(rh) || !ok(srad) || !ok(wind)) return null
    return clean(
      etoHourlyValue(s, dayOfYear(time), hourUtcMinus7(met.epochMs[i]), t, rh, srad, wind, alpha),
    )
  })
  return {
    station: met.station,
    level: met.level,
    provisional: [...met.provisional],
    time: [...met.time],
    epochMs: [...met.epochMs],
    etoMm,
  }
}
