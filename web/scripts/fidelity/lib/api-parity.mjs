// API-level parity: legacy API (mesonet.climate.umt.edu/api, what prod legacy
// calls) vs mesonet2 v2, same query. Separates *data/backend* differences from
// *UI* differences seen in data-parity.
import { API } from '../config.mjs'
import { fetchText, parseCsv } from './util.mjs'
import { diffSeries, worst } from './compare.mjs'

export const API_PARITY_ELEMENTS = 'air_temp,ppt,rh,soil_vwc,soil_temp,soil_ec_blk,sol_rad,wind_spd,wind_dir,bp,snow_depth'

/** Variants: legacy side sends premade=True like prod (get_data.py:128). */
export const API_PARITY_SCENARIOS = [
  { id: 'hourly', period: 'hourly', days: 14, legacyPremade: true },
  { id: 'daily', period: 'daily', days: 14, legacyPremade: true },
  { id: 'hourly-nopremade', period: 'hourly', days: 14, legacyPremade: false },
  { id: 'daily-nopremade', period: 'daily', days: 14, legacyPremade: false },
]

function url(base, station, sc, range, premade) {
  const q = new URLSearchParams({
    stations: station,
    elements: API_PARITY_ELEMENTS,
    start_time: range.start,
    end_time: range.end,
    level: '1',
    type: 'csv',
    rm_na: 'True',
    na_info: 'False',
    public: 'True',
  })
  if (premade) q.set('premade', 'True')
  return `${base}observations/${sc.period}/?${q.toString().replace(/%2C/g, ',')}`
}

export async function compareApi(station, sc, range) {
  const ua = url(API.legacy, station, sc, range, sc.legacyPremade)
  const ub = url(API.v2, station, sc, range, false)
  const [ra, rb] = await Promise.all([fetchText(ua), fetchText(ub)])
  const out = { urls: [ua, ub], status: 'PASS' }
  if (!ra.ok || !rb.ok) {
    return { ...out, status: 'ERROR', error: { A: ra.ok ? undefined : `${ra.status} ${ra.text.slice(0, 200)}`, B: rb.ok ? undefined : `${rb.status} ${rb.text.slice(0, 200)}` } }
  }
  const A = parseCsv(ra.text)
  const B = parseCsv(rb.text)
  const ca = Object.keys(A[0] ?? {})
  const cb = Object.keys(B[0] ?? {})
  const columns = { onlyA: ca.filter((c) => !cb.includes(c)), onlyB: cb.filter((c) => !ca.includes(c)) }
  const diffs = []
  for (const c of ca.filter((c) => cb.includes(c) && !['station', 'datetime'].includes(c))) {
    const d = diffSeries({ x: A.map((r) => r.datetime), y: A.map((r) => r[c]) }, { x: B.map((r) => r.datetime), y: B.map((r) => r[c]) })
    diffs.push({ column: c, ...d })
  }
  // columns that only differ in presence of known-benign extras
  const benignExtra = columns.onlyB.every((c) => ['provisional'].includes(c)) && !columns.onlyA.length
  return {
    ...out,
    status: worst(diffs.map((d) => d.status), benignExtra ? (columns.onlyB.length ? 'WARN' : 'PASS') : 'FAIL'),
    rows: { A: A.length, B: B.length },
    columns,
    valueDiffs: diffs.filter((d) => d.status !== 'PASS'),
    ms: { A: ra.ms, B: rb.ms },
  }
}
