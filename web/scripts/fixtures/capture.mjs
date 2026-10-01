#!/usr/bin/env node
/**
 * Capture golden fixtures for the client-side Ag Tools compute library.
 *
 * For each station × closed window we save:
 *   - the raw /observations inputs each derived algorithm consumes, and
 *   - the API's own /derived output for the same window (keep=true, no
 *     `premade`), so compute tests can assert parity without the network.
 *
 * Windows are closed and in the past so provisional data / QC reruns can't
 * shift them, but QC tiers can still be reprocessed upstream — re-run this
 * script and review the diff if golden tests start drifting.
 *
 * Usage: node scripts/fixtures/capture.mjs [--out <dir>] [--only <station>]
 *
 * `--only <station>` captures just that station and merges it into the
 * existing manifest (the other stations' files are left untouched).
 */
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.MESONET_API_URL ?? 'https://mesonet2.climate.umt.edu/api/v2/'
const OUT = (() => {
  const i = process.argv.indexOf('--out')
  return i > -1
    ? process.argv[i + 1]
    : path.resolve(import.meta.dirname, '../../src/features/ag/__fixtures__')
})()

// QC tier for every request. The derived endpoints default to 2; set it
// explicitly so inputs and outputs are on the same tier.
const LEVEL = 2

const STATIONS = [
  { id: 'acebozem', why: 'HydroMet, has_swp, 10 m wind, 5 soil depths' },
  { id: 'arskeogh', why: 'AgriMet, has_swp, 2.44 m (8 ft) wind' },
  { id: 'acecrowa', why: 'HydroMet without soil water parameters' },
  // Percent-saturation only (AG-PS-001): soil inputs + /derived output.
  {
    id: 'mdamalta',
    why: 'has_swp; API DB porosity differs from mesonet-soils and the API has none at 91 cm (AG-PS-001)',
    psOnly: true,
  },
]

const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i > -1 ? process.argv[i + 1] : null
})()

// end is exclusive (v2 `end_time` semantics).
const WINDOWS = {
  daily: [
    { name: 'season2025', start: '2025-04-01', end: '2025-10-01' },
    { name: 'winter2526', start: '2025-12-01', end: '2026-03-01' },
  ],
  hourly: [
    { name: 'jul2025', start: '2025-07-01', end: '2025-08-01' },
    { name: 'jan2026', start: '2026-01-01', end: '2026-02-01' },
  ],
}

const GDD_CROPS = ['wheat', 'barley', 'canola', 'corn', 'sugarbeet', 'sunflower', 'hemp']

/** Each request: [file stem, path, params]. */
function requestsFor(station, hasSwp, psOnly = false) {
  const reqs = []
  if (psOnly) {
    for (const [period, w] of [['daily', WINDOWS.daily[0]], ['hourly', WINDOWS.hourly[0]]]) {
      const base = { stations: station, start_time: w.start, end_time: w.end, level: LEVEL }
      const tag = `${station}.${period}.${w.name}`
      reqs.push([`${tag}.obs-soil`, `observations/${period}/`, {
        ...base, elements: 'soil_vwc,soil_temp', agg_func: 'avg',
      }])
      reqs.push([`${tag}.derived-percent_saturation`, `derived/${period}/`, {
        ...base, elements: 'percent_saturation', keep: true,
      }])
    }
    return reqs
  }
  for (const w of WINDOWS.daily) {
    const base = { stations: station, start_time: w.start, end_time: w.end, level: LEVEL }
    const tag = `${station}.daily.${w.name}`
    // Inputs: ETo needs min/max temp & RH, mean solar & wind; feels_like and
    // CCI need mean temp & RH.
    reqs.push([`${tag}.obs-met`, 'observations/daily/', {
      ...base,
      elements: 'air_temp,air_temp,air_temp,rh,rh,rh,sol_rad,wind_spd',
      agg_func: 'min,max,avg,min,max,avg,avg,avg',
    }])
    reqs.push([`${tag}.obs-soil`, 'observations/daily/', {
      ...base, elements: 'soil_vwc,soil_temp', agg_func: 'avg',
    }])
    reqs.push([`${tag}.derived-etr`, 'derived/daily/', { ...base, elements: 'etr', keep: true }])
    reqs.push([`${tag}.derived-feels_like`, 'derived/daily/', { ...base, elements: 'feels_like', keep: true }])
    reqs.push([`${tag}.derived-cci`, 'derived/daily/', { ...base, elements: 'cci', keep: true }])
    reqs.push([`${tag}.derived-gdd`, 'derived/daily/', { ...base, elements: 'gdd', keep: true }])
    for (const crop of GDD_CROPS) {
      reqs.push([`${tag}.derived-gdd-${crop}`, 'derived/daily/', { ...base, elements: 'gdd', crop, keep: true }])
    }
    if (hasSwp) {
      reqs.push([`${tag}.derived-swp`, 'derived/daily/', { ...base, elements: 'swp', keep: true }])
      reqs.push([`${tag}.derived-percent_saturation`, 'derived/daily/', { ...base, elements: 'percent_saturation', keep: true }])
    }
  }
  for (const w of WINDOWS.hourly) {
    const base = { stations: station, start_time: w.start, end_time: w.end, level: LEVEL }
    const tag = `${station}.hourly.${w.name}`
    reqs.push([`${tag}.obs-met`, 'observations/hourly/', {
      ...base, elements: 'air_temp,rh,sol_rad,wind_spd', agg_func: 'avg',
    }])
    reqs.push([`${tag}.obs-soil`, 'observations/hourly/', {
      ...base, elements: 'soil_vwc,soil_temp', agg_func: 'avg',
    }])
    reqs.push([`${tag}.derived-etr`, 'derived/hourly/', { ...base, elements: 'etr', keep: true }])
    reqs.push([`${tag}.derived-feels_like`, 'derived/hourly/', { ...base, elements: 'feels_like', keep: true }])
    reqs.push([`${tag}.derived-cci`, 'derived/hourly/', { ...base, elements: 'cci', keep: true }])
    if (hasSwp) {
      reqs.push([`${tag}.derived-swp`, 'derived/hourly/', { ...base, elements: 'swp', keep: true }])
      reqs.push([`${tag}.derived-percent_saturation`, 'derived/hourly/', { ...base, elements: 'percent_saturation', keep: true }])
    }
  }
  // Lab retention points (hidden route) — gives the VWC clip range for SWP.
  if (hasSwp) reqs.push([`${station}.soil-raw`, 'derived/swp', { stations: station }])
  // Wind height comes from the station's element list (_1000 vs _0244).
  reqs.push([`${station}.elements`, `elements/${station}/`, {}])
  return reqs
}

function url(p, params) {
  const qs = new URLSearchParams({ ...Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ), type: 'csv' })
  return `${API}${p}?${qs.toString().replace(/%2C/g, ',')}`
}

async function get(u, attempt = 0) {
  const r = await fetch(u)
  if (r.ok) return r.text()
  if (r.status >= 500 && attempt < 2) {
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
    return get(u, attempt + 1)
  }
  throw new Error(`HTTP ${r.status} ${u}: ${(await r.text()).slice(0, 200)}`)
}

fs.mkdirSync(OUT, { recursive: true })
const stationsCsv = await get(url('stations/', {}))
if (!ONLY) fs.writeFileSync(path.join(OUT, 'stations.csv'), stationsCsv)
const header = stationsCsv.split('\n')[0].split(',')
const swpIdx = header.indexOf('has_swp')
const swpBy = Object.fromEntries(
  stationsCsv.trim().split('\n').slice(1).map((l) => {
    const c = l.split(',')
    return [c[0], /^t(rue)?$/i.test(c[swpIdx])]
  }),
)

const manifestPath = path.join(OUT, 'manifest.json')
const manifest = ONLY && fs.existsSync(manifestPath)
  ? { ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')), stations: STATIONS, windows: WINDOWS }
  : {
      captured_at: new Date().toISOString(),
      api: API,
      level: LEVEL,
      units: 'us (API default)',
      stations: STATIONS,
      windows: WINDOWS,
      files: {},
    }

for (const s of STATIONS) {
  if (ONLY && s.id !== ONLY) continue
  for (const [stem, p, params] of requestsFor(s.id, swpBy[s.id], s.psOnly)) {
    const u = url(p, params)
    try {
      const body = await get(u)
      fs.writeFileSync(path.join(OUT, `${stem}.csv`), body)
      const rows = Math.max(0, body.trim().split('\n').length - 1)
      manifest.files[`${stem}.csv`] = { url: u, rows }
      console.log(`ok   ${stem} (${rows})`)
    } catch (e) {
      manifest.files[`${stem}.csv`] = { url: u, error: String(e.message ?? e).slice(0, 300) }
      console.log(`FAIL ${stem}: ${String(e.message ?? e).slice(0, 160)}`)
    }
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
