#!/usr/bin/env node
// Fidelity harness entry point.
//
//   node scripts/fidelity/run.mjs --compare data-parity[,ui-latest,ui-downloader,ag]
//        [--stations acebozem,lololowr] [--scenarios default,daily]
//        [--out DIR] [--a prodLegacy] [--b localLegacy] [--legacy localLegacy]
//        [--concurrency 1] [--headed] [--report-only] [--recompare]
//   --recompare: data-parity/ui-latest only; re-diff saved captures without a browser
//
// Comparisons:
//   api-parity     legacy API vs mesonet2 v2, raw /observations (no browser)
//   data-parity    A=prodLegacy  B=localLegacy  (proves mesonet2 data == prod)
//   ui-latest      A=--legacy    B=newApp       (Latest Data plots + cards)
//   ui-downloader  A=--legacy    B=newApp       (CSV filename/columns/values)
//   ag             new app Ag Tools vs mesonet2 /derived (no premade, keep=true)
//
// Results: DIR/<compare>/results.json, captures/ and shots/, and DIR/report.html
// (rebuilt from every results.json in DIR).
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import {
  DEFAULT_OUT,
  TARGETS,
  LATEST_SCENARIOS,
  DATA_PARITY_SCENARIOS,
  DOWNLOADER_SCENARIOS,
  AG_SCENARIOS,
  loadStations,
} from './config.mjs'
import { launch } from './lib/browser.mjs'
import {
  captureLegacyLatest,
  captureNewLatest,
  captureLegacyDownloader,
  captureNewDownloader,
  captureNewAg,
} from './lib/drivers.mjs'
import { compareCaptures, compareCsv, worst } from './lib/compare.mjs'
import { fetchDerived, compareAg } from './lib/derived.mjs'
import { renderReport } from './lib/report.mjs'
import { compareApi, API_PARITY_SCENARIOS } from './lib/api-parity.mjs'
import { writeJson, readJson, isoDate, daysAgo, pool, slug } from './lib/util.mjs'

function parseArgs(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) continue
    const key = k.slice(2)
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
    a[key] = v
  }
  return a
}
const args = parseArgs(process.argv.slice(2))
const OUT = args.out ?? DEFAULT_OUT
const compares = String(args.compare ?? 'data-parity').split(',')
const matrix = loadStations()
const stations = args.stations ? String(args.stations).split(',') : matrix.map((s) => s.station)
const stationInfo = Object.fromEntries(matrix.map((s) => [s.station, s]))
const pickScenarios = (all, defaults) => {
  const ids = args.scenarios ? String(args.scenarios).split(',') : defaults ?? all.map((s) => s.id)
  return all.filter((s) => ids.includes(s.id))
}
const concurrency = Number(args.concurrency ?? 1)

const yesterday = daysAgo(1)
const rangeDays = (n) => ({ start: isoDate(daysAgo(n, yesterday)), end: isoDate(yesterday) })

/** Drop bulky arrays before writing captures next to results. */
const slim = (c) => c

async function saveCapture(dir, name, cap) {
  await writeJson(join(dir, 'captures', `${slug(name)}.json`), slim(cap))
}

function summarize(cmp) {
  if (!cmp) return ''
  if (cmp.status === 'ERROR') return JSON.stringify(cmp.error).slice(0, 160)
  if (cmp.issue) return cmp.issue
  const bits = []
  for (const p of cmp.plots ?? []) {
    if (p.status === 'PASS') continue
    const bad = (p.traces ?? []).filter((t) => t.status === 'FAIL')
    const warn = (p.traces ?? []).filter((t) => t.status === 'WARN')
    bits.push(`${p.role}: ${p.issue ?? `${bad.length} fail/${warn.length} warn traces${p.shapes?.onlyA?.length || p.shapes?.onlyB?.length ? `, shapes A${p.shapes.nA}/B${p.shapes.nB}` : ''}`}`)
  }
  for (const [k, c] of Object.entries(cmp.cards ?? {})) if (c.status !== 'PASS') bits.push(`card ${k} ${c.status}`)
  if (cmp.filename) bits.push(`rows ${cmp.rows.A}/${cmp.rows.B}, cols -${cmp.columns.onlyA.length}/+${cmp.columns.onlyB.length}`)
  if (Array.isArray(cmp.columns)) bits.push(cmp.columns.map((c) => `${c.column}:${c.status}`).join(' '))
  return bits.join('; ')
}

async function runLatest(browser, compare, A, B, scenarios, { fuzzy }) {
  const dir = join(OUT, compare)
  const run = { compare, A: `${A.label} <${A.base}>`, B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const work = stations.flatMap((st) => scenarios.map((sc) => ({ st, sc })))
  await pool(work, concurrency, async ({ st, sc }) => {
    const cap = (T) =>
      T.kind === 'legacy' ? captureLegacyLatest(browser, T, st, sc, join(dir, 'shots')) : captureNewLatest(browser, T, st, sc, join(dir, 'shots'))
    // A and B in parallel (different servers) to minimize capture-time skew.
    let ca, cb
    if (args.recompare) {
      // re-run only the comparator on saved captures (after comparator changes)
      ca = await readJson(join(dir, 'captures', `${slug(`${st}-${sc.id}-A`)}.json`), null)
      cb = await readJson(join(dir, 'captures', `${slug(`${st}-${sc.id}-B`)}.json`), null)
      if (!ca || !cb) return
    } else {
      ;[ca, cb] = await Promise.all([cap(A), cap(B)])
      await saveCapture(dir, `${st}-${sc.id}-A`, ca)
      await saveCapture(dir, `${st}-${sc.id}-B`, cb)
    }
    const comparison = compareCaptures(ca, cb, { fuzzy })
    const item = {
      station: st,
      roles: stationInfo[st]?.roles,
      scenario: sc.id,
      status: comparison.status,
      summary: summarize(comparison),
      comparison,
      urls: [ca.url, cb.url],
      shots: [ca.shot, cb.shot],
      loadMs: { A: ca.loadMs, B: cb.loadMs },
    }
    run.items.push(item)
    console.log(`[${compare}] ${st} ${sc.id}: ${item.status} ${item.summary}`)
  })
  await writeJson(join(dir, 'results.json'), run)
  return run
}

async function runDownloader(browser, A, B) {
  const compare = 'ui-downloader'
  const dir = join(OUT, compare)
  const run = { compare, A: `${A.label} <${A.base}>`, B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const scenarios = pickScenarios(DOWNLOADER_SCENARIOS)
  for (const st of stations) {
    for (const sc of scenarios) {
      const range = rangeDays(sc.days)
      const capA = A.kind === 'legacy' ? captureLegacyDownloader : captureNewDownloader
      const capB = B.kind === 'legacy' ? captureLegacyDownloader : captureNewDownloader
      const [ca, cb] = await Promise.all([
        capA(browser, A, st, sc, range, join(dir, 'files')),
        capB(browser, B, st, sc, range, join(dir, 'files')),
      ])
      await saveCapture(dir, `${st}-${sc.id}-A`, { ...ca, download: ca.download && { ...ca.download, text: undefined } })
      await saveCapture(dir, `${st}-${sc.id}-B`, { ...cb, download: cb.download && { ...cb.download, text: undefined } })
      const comparison = compareCsv(ca, cb)
      comparison.network = { A: ca.log?.bad ?? [], B: cb.log?.bad ?? [] }
      comparison.alerts = cb.alerts
      const item = { station: st, scenario: sc.id, status: comparison.status, summary: summarize(comparison), comparison, urls: [ca.url, cb.url], shots: [ca.shot, cb.shot] }
      run.items.push(item)
      console.log(`[${compare}] ${st} ${sc.id}: ${item.status} ${item.summary}`)
    }
  }
  await writeJson(join(dir, 'results.json'), run)
  return run
}

async function runAg(browser, N) {
  const compare = 'ag'
  const dir = join(OUT, compare)
  const run = {
    compare,
    A: 'mesonet2 /derived (no premade, keep=true, alpha=0.23, rm_na=true, level=1)',
    B: `${N.label} <${N.base}>`,
    started: new Date().toISOString(),
    items: [],
  }
  for (const st of stations) {
    for (const sc of pickScenarios(AG_SCENARIOS)) {
      // SWP / percent saturation only exist where has_swp=True (legacy filters the station list).
      if (sc.needsSwp && stationInfo[st] && !stationInfo[st].has_swp) continue
      const range = rangeDays(sc.derived.period === 'hourly' ? 7 : 30)
      const [derived, cap] = await Promise.all([fetchDerived(st, sc, range), captureNewAg(browser, N, st, sc, range, join(dir, 'shots'))])
      await saveCapture(dir, `${st}-${sc.id}-new`, cap)
      const comparison = compareAg(cap, derived)
      const item = { station: st, scenario: sc.id, status: comparison.status, summary: summarize(comparison), comparison, urls: [derived.url, cap.url], shots: [cap.shot] }
      run.items.push(item)
      console.log(`[ag] ${st} ${sc.id}: ${item.status} ${item.summary}`)
    }
  }
  await writeJson(join(dir, 'results.json'), run)
  return run
}

async function runApiParity() {
  const compare = 'api-parity'
  const dir = join(OUT, compare)
  const run = {
    compare,
    A: 'legacy API https://mesonet.climate.umt.edu/api/ (premade per scenario)',
    B: 'mesonet2 https://mesonet2.climate.umt.edu/api/v2/ (no premade)',
    started: new Date().toISOString(),
    notes: 'Same /observations query on both backends; isolates data differences from UI differences.',
    items: [],
  }
  for (const st of stations) {
    for (const sc of pickScenarios(API_PARITY_SCENARIOS)) {
      const comparison = await compareApi(st, sc, rangeDays(sc.days))
      const item = { station: st, scenario: sc.id, status: comparison.status, summary: apiSummary(comparison), comparison, urls: comparison.urls }
      run.items.push(item)
      console.log(`[api-parity] ${st} ${sc.id}: ${item.status} ${item.summary}`)
    }
  }
  await writeJson(join(dir, 'results.json'), run)
  return run
}

function apiSummary(c) {
  if (c.status === 'ERROR') return JSON.stringify(c.error).slice(0, 160)
  const cols = c.valueDiffs.filter((d) => d.status === 'FAIL').map((d) => `${d.column} (${d.nDiff}${d.nullMismatch ? `+${d.nullMismatch}null` : ''}, max ${d.maxAbs})`)
  return `${c.rows.A}/${c.rows.B} rows${c.columns.onlyB.length ? `; B extra cols: ${c.columns.onlyB.join(',')}` : ''}${c.columns.onlyA.length ? `; A-only cols: ${c.columns.onlyA.join(',')}` : ''}${cols.length ? `; differ: ${cols.join('; ')}` : ''}`
}

async function rebuildReport() {
  const runs = []
  for (const d of await readdir(OUT).catch(() => [])) {
    const r = await readJson(join(OUT, d, 'results.json'), null)
    if (r) runs.push(r)
  }
  const order = ['api-parity', 'data-parity', 'ui-latest', 'ui-downloader', 'ag']
  runs.sort((a, b) => order.indexOf(a.compare) - order.indexOf(b.compare))
  const file = join(OUT, 'report.html')
  await writeFile(file, renderReport(runs, file, { note: `stations: ${stations.join(', ')}` }))
  console.log(`report: ${file}`)
}

if (!args['report-only']) {
  const browser = await launch({ headless: !args.headed })
  try {
    const legacyRef = TARGETS[args.legacy ?? 'localLegacy']
    for (const c of compares) {
      if (c === 'api-parity') {
        await runApiParity()
      } else if (c === 'data-parity') {
        const A = TARGETS[args.a ?? 'prodLegacy']
        const B = TARGETS[args.b ?? 'localLegacy']
        await runLatest(browser, c, A, B, pickScenarios(LATEST_SCENARIOS, DATA_PARITY_SCENARIOS), { fuzzy: false })
      } else if (c === 'ui-latest') {
        await runLatest(browser, c, legacyRef, TARGETS.newApp, pickScenarios(LATEST_SCENARIOS), { fuzzy: true })
      } else if (c === 'ui-downloader') {
        await runDownloader(browser, legacyRef, TARGETS.newApp)
      } else if (c === 'ag') {
        await runAg(browser, TARGETS.newApp)
      } else {
        console.error(`unknown --compare ${c}`)
        process.exitCode = 2
      }
    }
  } finally {
    await browser.close()
  }
}
await rebuildReport()
// exit non-zero if anything failed (useful for the cutover gate)
const runs = await Promise.all(compares.map((c) => readJson(join(OUT, c, 'results.json'), null)))
const overall = worst(runs.filter(Boolean).flatMap((r) => r.items.map((i) => i.status)))
console.log(`overall: ${overall}`)
if (overall === 'FAIL' || overall === 'ERROR') process.exitCode = process.exitCode || 1
