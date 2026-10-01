#!/usr/bin/env node
/**
 * Porosity survey (AG-PS-001 / DIVERGENCES.md D-PS-1): for every has_swp
 * station, compare the API DB porosity (`/derived/daily?elements=
 * percent_saturation&keep=true` → `Porosity @ … [%]`, last 30 days of
 * September 2026, level 2) with the vendored mesonet-soils porosity.
 * Requests are serialized with a 400 ms pause.
 *
 * Usage: node scripts/fixtures/porosity-survey.mjs [soil_params.json] [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
const A = process.env.MESONET_API_URL ?? 'https://mesonet2.climate.umt.edu/api/v2/'
const here = import.meta.dirname
const IN = process.argv[2] ?? path.resolve(here, '../../public/data/soil_params.json')
const OUT = process.argv[3] ?? 'porosity-survey.json'
const j = JSON.parse(fs.readFileSync(IN, 'utf8'))
const ven = new Map()
for (const r of j.rows) {
  if (!ven.has(r[0])) ven.set(r[0], {})
  ven.get(r[0])[r[1]] = r[4]
}
const parse = (t) => {
  const L = t.trim().split('\n')
  const h = L[0].split(',')
  return L.slice(1).map((l) => {
    const v = l.split(',')
    return Object.fromEntries(h.map((k, i) => [k, v[i]]))
  })
}
const st = parse(await (await fetch(A + 'stations/?type=csv')).text())
  .filter((s) => s.has_swp === 'True')
  .map((s) => s.station)
const out = []
for (const s of st) {
  const url = `${A}derived/daily/?stations=${s}&start_time=2026-09-01&end_time=2026-10-01&elements=percent_saturation&keep=true&level=2&type=csv`
  let rows = []
  try {
    const r = await fetch(url)
    const t = await r.text()
    if (r.ok && t.startsWith('station')) rows = parse(t)
    else out.push({ s, err: r.status + ' ' + t.slice(0, 80) })
  } catch (e) {
    out.push({ s, err: String(e) })
  }
  const api = {}
  const vwcDepths = new Set()
  for (const row of rows)
    for (const [k, v] of Object.entries(row)) {
      let m = k.match(/^Porosity @ (-?\d+) cm/)
      if (m && v !== '' && v !== undefined) api[-Number(m[1])] = Number(v)
      m = k.match(/^Soil VWC @ (-?\d+) cm/)
      if (m) vwcDepths.add(-Number(m[1]))
    }
  const v = ven.get(s) || {}
  const depths = [...new Set([...Object.keys(api), ...Object.keys(v), ...vwcDepths].map(Number))].sort((a, b) => a - b)
  const d = depths.map((dp) => ({ dp, api: api[dp] ?? null, ven: v[dp] ?? null, vwc: vwcDepths.has(dp) }))
  if (rows.length || !out.find((o) => o.s === s)) out.push({ s, rows: rows.length, d })
  await new Promise((r) => setTimeout(r, 400))
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
let diff = 0
for (const o of out) {
  if (o.err) {
    console.log(o.s, 'ERR', o.err)
    continue
  }
  const bad = o.d.filter(
    (x) =>
      (x.vwc && (x.api === null) !== (x.ven === null)) ||
      (x.api !== null && x.ven !== null && Math.abs(x.api - x.ven) > 0.005),
  )
  if (bad.length) {
    diff++
    console.log(o.s, o.rows, bad.map((x) => `${x.dp}cm api=${x.api} ven=${x.ven}${x.vwc ? '' : ' (no vwc)'}`).join('; '))
  }
}
console.log('stations', st.length, 'differing', diff)
