#!/usr/bin/env node
// web-next fidelity harness: web-next vs the current React app (web/) on the same API (level 2),
// and web-next Ag vs /derived. Starts both Vite dev servers if they are not running.
//
//   node scripts/fidelity/run.mjs [--compare latest,ag,downloader,ag-api] [--stations a,b]
//        [--scenarios x,y] [--out DIR] [--headed] [--recompare] [--report-only]
//   --recompare    re-diff the saved captures (no browser), e.g. after a comparator change
//   --report-only  rebuild DIR/report.html and DIR/results.json from DIR/<compare>/results.json
//
// Output: DIR/<compare>/{results.json,captures/,shots/,files/}, DIR/results.json (summary),
// DIR/report.html. Exits 1 if any item FAILs or ERRORs.
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { API_V2, DEFAULT_OUT, TARGETS, LATEST_SCENARIOS, AG_SCENARIOS, AG_API_SCENARIOS, DOWNLOADER_SCENARIOS, TIMEOUTS, loadStations } from './config.mjs'
import { launch } from './lib/browser.mjs'
import { captureLatest, captureAg, captureDownloader } from './lib/drivers.mjs'
import { compareFigures, compareCard, compareCsv, paletteCheck } from './lib/compare.mjs'
import { fetchDerived, compareAgApi } from './lib/derived.mjs'
import { renderReport } from './lib/report.mjs'
import { ensureServer, stopServers } from './lib/servers.mjs'
import { fetchText, mtDate, parseCsv, readJson, sleep, slug, worst, writeJson } from './lib/util.mjs'

const ALL = ['latest', 'ag', 'downloader', 'ag-api']

function parseArgs(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    a[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  }
  return a
}
const args = parseArgs(process.argv.slice(2))
const OUT = args.out ?? DEFAULT_OUT
const compares = args.compare ? String(args.compare).split(',') : ALL
const matrix = loadStations()
const info = Object.fromEntries(matrix.map((s) => [s.station, s]))
const stations = args.stations ? String(args.stations).split(',') : matrix.map((s) => s.station)
const pick = (all) => (args.scenarios ? all.filter((s) => String(args.scenarios).split(',').includes(s.id)) : all)
const A = TARGETS.web
const B = TARGETS.next

/* ------------------------------------------------------------- persistence */

const capPath = (compare, st, sc, side) => join(OUT, compare, 'captures', `${slug(`${st}-${sc}-${side}`)}.json`)

async function capture(compare, st, sc, side, fn) {
  if (args.recompare) {
    const c = await readJson(capPath(compare, st, sc, side), null)
    if (c?.download?.path) c.download.text = await readFile(c.download.path, 'utf8').catch(() => '')
    return c
  }
  const c = await fn()
  await writeJson(capPath(compare, st, sc, side), { ...c, download: c.download && { ...c.download, text: undefined } })
  return c
}

/** Non-2xx requests and console/page errors; `newInB` = web-next's that web/ does not also have. */
function network(ca, cb) {
  const list = (c) => [...(c?.log?.bad ?? []), ...(c?.log?.pageErrors ?? []).map((e) => `pageerror ${e}`), ...(c?.log?.consoleErrors ?? []).map((e) => `console ${e}`)]
  const key = (e) => e.replace(/https?:\/\/localhost:\d+(\/mesonet-dashboard(\/next)?)?/g, '')
  const a = list(ca)
  const b = list(cb)
  return { A: a, B: b, newInB: b.filter((e) => !a.map(key).includes(key(e))) }
}

/** Pair figures by role and diff each pair. */
function figurePairs(ca, cb) {
  const by = (c) => (c?.figures ?? []).reduce((m, f) => ((m[f.role] ??= []).push(f), m), {})
  const fa = by(ca)
  const fb = by(cb)
  const out = []
  for (const role of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    const la = fa[role] ?? []
    const lb = fb[role] ?? []
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (!la[i] || !lb[i]) out.push({ role, status: 'FAIL', issue: `figure '${role}' only in ${la[i] ? 'web/' : 'web-next'}` })
      else out.push(compareFigures(la[i], lb[i]))
    }
  }
  return out
}

const setDiff = (a, b) => ({ onlyA: [...new Set(a)].filter((x) => !b.includes(x)), onlyB: [...new Set(b)].filter((x) => !a.includes(x)) })

function summarize(c) {
  if (!c) return ''
  if (c.status === 'ERROR') return JSON.stringify(c.error).slice(0, 200)
  if (c.issue) return c.issue
  const bits = []
  for (const p of c.figures ?? []) {
    if (p.status === 'PASS') continue
    const n = (s) => (p.traces ?? []).filter((t) => t.status === s).length
    const extra = [p.panels?.onlyA?.length || p.panels?.onlyB?.length ? 'panels' : '', p.spans?.onlyA?.length || p.spans?.onlyB?.length ? `spans ${p.spans.nA}/${p.spans.nB}` : '', p.refs?.onlyA?.length || p.refs?.onlyB?.length ? 'refs' : '']
    bits.push(`${p.role}: ${p.issue ?? `${n('FAIL')} fail/${n('WARN')} warn traces${extra.filter(Boolean).map((e) => `, ${e}`).join('')}`}`)
  }
  for (const [k, v] of Object.entries(c.cards ?? {})) if (v.status !== 'PASS') bits.push(`card ${k} ${v.status}`)
  if (c.palette && c.palette.status !== 'PASS') bits.push(`palette ${c.palette.off?.length ?? ''} off`)
  if (c.map && c.map.status !== 'PASS') bits.push(`map ${c.map.note ?? c.map.status}`)
  if (c.messages?.status && c.messages.status !== 'PASS') bits.push('messages differ')
  if (c.csv) bits.push(c.csv.bytes?.identical ? 'CSV byte-identical' : `CSV ${c.csv.status}: rows ${c.csv.rows?.A}/${c.csv.rows?.B}`)
  if (Array.isArray(c.columns)) bits.push(c.columns.map((x) => `${x.column}:${x.status}`).join(' '))
  if (c.network?.newInB?.length) bits.push(`${c.network.newInB.length} web-next-only errors`)
  if (c.moved?.length) bits.push(`moved (not scored): ${c.moved.map((m) => m.part).join(', ')}`)
  return bits.join('; ')
}

/** Write DIR/<compare>/results.json; a partial run (--stations/--scenarios) keeps the other items. */
async function writeRun(run) {
  run.finished = new Date().toISOString()
  const file = join(OUT, run.compare, 'results.json')
  const prior = args.stations || args.scenarios ? (await readJson(file, null))?.items ?? [] : []
  const id = (i) => `${i.station}|${i.scenario}`
  const fresh = new Set(run.items.map(id))
  const items = [...prior.filter((i) => !fresh.has(id(i))), ...run.items]
  await writeJson(file, { ...run, items: prior.length ? items.sort((a, b) => matrix.findIndex((m) => m.station === a.station) - matrix.findIndex((m) => m.station === b.station)) : run.items })
}

/* ------------------------------------------------------------- comparisons */

let catalog = null
async function stationCatalog() {
  if (catalog) return catalog
  const r = await fetchText(`${API_V2}stations/?type=csv`)
  catalog = r.ok ? parseCsv(r.text).map((s) => s.station) : []
  return catalog
}

async function mapCheck(map, station, required) {
  if (!map) return required ? { status: 'FAIL', note: 'map host not found' } : undefined
  const ids = await stationCatalog()
  const rows = map.rows.map((r) => r.id)
  const missing = ids.filter((i) => !rows.includes(i))
  const extra = rows.filter((i) => !ids.includes(i))
  const current = map.rows.find((r) => r.current)?.id ?? null
  const bad = missing.length || extra.length || (station && current !== station) || !map.canvas
  return { status: bad ? 'WARN' : 'PASS', note: bad ? 'station list/selection differs from /stations' : undefined, rows: rows.length, catalog: ids.length, missing: missing.slice(0, 20), extra, current, canvas: map.canvas }
}

/** web/ wording → web-next's plain name in Ag notes: DOCUMENTED (DIVERGENCES "Charts: plain names in tooltips and tables"). */
const DOCUMENTED_WORDING = [[/^Percent saturation /, 'Soil saturation ']]

function messageCheck(ca, cb) {
  const norm = (l) => (l ?? []).map((m) => m.replace(/\s+/g, ' ').trim()).filter(Boolean)
  let renamed = false
  const a = norm(ca?.messages).map((m) => DOCUMENTED_WORDING.reduce((s, [re, to]) => (re.test(s) ? ((renamed = true), s.replace(re, to)) : s), m))
  const d = setDiff(a, norm(cb?.messages))
  return { status: d.onlyA.length || d.onlyB.length ? 'WARN' : renamed ? 'DOCUMENTED' : 'PASS', ...d }
}

async function runLatest(browser) {
  const run = { compare: 'latest', A: `${A.label} <${A.base}>`, B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const dir = join(OUT, 'latest')
  for (const st of stations) {
    for (const sc of pick(LATEST_SCENARIOS)) {
      if (sc.onlyRoles && !(info[st]?.roles ?? []).some((r) => sc.onlyRoles.includes(r))) continue
      const ca = await capture('latest', st, sc.id, 'A', () => captureLatest(browser, A, st, sc, dir))
      const cb = await capture('latest', st, sc.id, 'B', () => captureLatest(browser, B, st, sc, dir))
      if (!ca || !cb) continue
      let cmp
      if (ca.error || cb.error) cmp = { status: 'ERROR', error: { 'web/': ca.error, 'web-next': cb.error } }
      else {
        // What web-next's page for this scenario shows (config `sc.next`); a Now card only when Now shows its medium.
        const nx = sc.next
        const shown = !nx.media || cb.media === nx.media
        const figs = shown ? nx.figures : []
        const cards = shown ? nx.cards : {}
        // Parts web/ shows that this page does not draw (moved section, or absent by design) are
        // listed as `moved` notes citing DIVERGENCES; they are not compared and do not lower the status.
        const where = `not on web-next #${nx.tab}${nx.media && !shown ? ` (Now shows the ${cb.media})` : ''}`
        const pairs = figurePairs(ca, cb)
        cmp = {
          figures: pairs.filter((f) => figs.includes(f.role)),
          cards: {},
          moved: [],
          palette: paletteCheck(cb.figures, cb.palette),
        }
        const move = (part) => cmp.moved.push({ part, note: where, see: nx.see })
        for (const f of pairs) if (!figs.includes(f.role)) move(`figure ${f.role}`)
        for (const k of ['top', 'bottom']) {
          if (!cards[k]) {
            move(`${k} card`)
            continue
          }
          const c = compareCard(ca.cards?.[k], cb.cards?.[k])
          // The card was redesigned on its new page: text (and, if `relabeled`, row label) changes
          // are documented; a value under a shared label, an image or a missing card still counts.
          const layoutOnly = c.status === 'WARN' && !c.valueDiffs.length && !c.images.onlyA.length && !c.images.onlyB.length && (nx.relabeled || (!c.keys.onlyA.length && !c.keys.onlyB.length))
          cmp.cards[k] = layoutOnly ? { ...c, status: 'DOCUMENTED', note: `documented: text changed; ${nx.see}`, see: nx.see } : c
        }
        // The map pane is compared as data (mapCheck), not as text (web/ and web-next legends differ by design).
        if (cb.map) cmp.cards.bottom = { status: 'PASS', note: 'map pane: see the map check' }
        // web/ draws the wind-rose title inside the Plotly figure; web-next as a heading in the card.
        const roseTitle = figs.includes('windrose') && ca.figures.find((f) => f.role === 'windrose')?.title
        if (roseTitle) {
          const text = (cb.cards?.top?.titles ?? []).join(' ')
          // web-next words it plainly ("Wind, Sep 17 – Sep 19"): the same dates are DOCUMENTED.
          const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const md = (d) => `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`
          const span = /(\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)/.exec(roseTitle)
          const sameDates = span && text.includes(md(span[1])) && text.includes(md(span[2]))
          cmp.cards.windTitle = text.includes(roseTitle)
            ? { status: 'PASS' }
            : sameDates
              ? { status: 'DOCUMENTED', note: `plain wording of "${roseTitle}": DIVERGENCES "Charts: plain names in tooltips and tables"` }
              : { status: 'WARN', note: `title "${roseTitle}" not in web-next card`, lines: { onlyA: [roseTitle], onlyB: [] } }
        }
        cmp.map = await mapCheck(cb.map, st, sc.id === 'info-map')
        cmp.network = network(ca, cb)
        cmp.status = worst(
          cmp.figures.map((f) => f.status),
          Object.values(cmp.cards).map((c) => c.status),
          cmp.palette.status,
          cmp.map?.status ?? 'PASS',
          cmp.network.newInB.length ? 'WARN' : 'PASS',
        )
      }
      const item = { station: st, roles: info[st]?.roles, scenario: sc.id, status: cmp.status, summary: summarize(cmp), comparison: cmp, urls: [ca.url, cb.url], shots: [ca.shot, cb.shot], loadMs: { A: ca.loadMs, B: cb.loadMs } }
      run.items.push(item)
      console.log(`[latest] ${st} ${sc.id}: ${item.status} ${item.summary}`)
      if (!args.recompare) await sleep(TIMEOUTS.between)
    }
    await writeRun(run)
  }
  await writeRun(run)
}

async function runAg(browser) {
  const run = { compare: 'ag', A: `${A.label} <${A.base}>`, B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const dir = join(OUT, 'ag')
  for (const st of stations) {
    for (const sc of pick(AG_SCENARIOS)) {
      if (sc.needsSwp && info[st] && !info[st].has_swp) continue
      const range = sc.days ? { start: mtDate(sc.days), end: mtDate(1) } : null
      const ca = await capture('ag', st, sc.id, 'A', () => captureAg(browser, A, st, sc, range, dir))
      const cb = await capture('ag', st, sc.id, 'B', () => captureAg(browser, B, st, sc, range, dir))
      if (!ca || !cb) continue
      let cmp
      if (ca.error || cb.error) cmp = { status: 'ERROR', error: { 'web/': ca.error, 'web-next': cb.error } }
      else {
        cmp = { figures: figurePairs(ca, cb), palette: paletteCheck(cb.figures, cb.palette), messages: messageCheck(ca, cb), network: network(ca, cb) }
        // Both apps showing only a message (no chart) is a pass when the messages agree.
        cmp.status = worst(cmp.figures.map((f) => f.status), cmp.palette.status, cmp.messages.status, cmp.network.newInB.length ? 'WARN' : 'PASS')
      }
      const item = { station: st, scenario: sc.id, status: cmp.status, summary: summarize(cmp), comparison: cmp, urls: [ca.url, cb.url], shots: [ca.shot, cb.shot] }
      run.items.push(item)
      console.log(`[ag] ${st} ${sc.id}: ${item.status} ${item.summary}`)
      if (!args.recompare) await sleep(TIMEOUTS.between)
    }
    await writeRun(run)
  }
  await writeRun(run)
}

async function runDownloader(browser) {
  const run = { compare: 'downloader', A: `${A.label} <${A.base}>`, B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const dir = join(OUT, 'downloader')
  for (const st of stations) {
    for (const sc of pick(DOWNLOADER_SCENARIOS)) {
      // End two days back (no partial day); start no earlier than the install date (both apps clamp).
      let start = mtDate(2 + sc.days)
      const inst = info[st]?.date_installed
      if (inst && start < inst) start = inst
      const range = { start, end: mtDate(2) }
      const ca = await capture('downloader', st, sc.id, 'A', () => captureDownloader(browser, A, st, sc, range, dir))
      const cb = await capture('downloader', st, sc.id, 'B', () => captureDownloader(browser, B, st, sc, range, dir))
      if (!ca || !cb) continue
      const cmp = { csv: compareCsv(ca, cb), figures: figurePairs(ca, cb), palette: paletteCheck(cb.figures ?? [], cb.palette), network: network(ca, cb) }
      // web-next's Download sheet has no map (the header picks the station), so no map check.
      cmp.status = cmp.csv.status === 'ERROR' ? 'ERROR' : worst(cmp.csv.status, cmp.figures.map((f) => f.status), cmp.palette.status, cmp.network.newInB.length ? 'WARN' : 'PASS')
      if (cmp.csv.status === 'ERROR') cmp.error = cmp.csv.error
      const item = { station: st, scenario: sc.id, status: cmp.status, summary: summarize(cmp), comparison: cmp, urls: [ca.url, cb.url], shots: [ca.shot, cb.shot] }
      run.items.push(item)
      console.log(`[downloader] ${st} ${sc.id}: ${item.status} ${item.summary}`)
      if (!args.recompare) await sleep(TIMEOUTS.between)
    }
    await writeRun(run)
  }
  await writeRun(run)
}

async function runAgApi(browser) {
  const run = { compare: 'ag-api', A: 'mesonet2 /derived (no premade, keep=true, alpha=0.23, rm_na=true, level 2)', B: `${B.label} <${B.base}>`, started: new Date().toISOString(), items: [] }
  const dir = join(OUT, 'ag-api')
  for (const st of stations) {
    for (const sc of pick(AG_API_SCENARIOS)) {
      if (sc.needsSwp && info[st] && !info[st].has_swp) continue
      const range = { start: mtDate(sc.derived.period === 'hourly' ? 7 : 30), end: mtDate(1) }
      const cb = await capture('ag-api', st, sc.id, 'B', () => captureAg(browser, B, st, sc, range, dir))
      const derived = await fetchDerived(st, sc, range)
      const cmp = compareAgApi(cb, derived, sc)
      const item = { station: st, scenario: sc.id, status: cmp.status, summary: summarize(cmp), comparison: cmp, urls: [derived.url, cb?.url], shots: [cb?.shot] }
      run.items.push(item)
      console.log(`[ag-api] ${st} ${sc.id}: ${item.status} ${item.summary}`)
      if (!args.recompare) await sleep(TIMEOUTS.between)
    }
    await writeRun(run)
  }
  await writeRun(run)
}

/* ------------------------------------------------------------- main */

async function rebuild() {
  const runs = (await Promise.all(ALL.map((c) => readJson(join(OUT, c, 'results.json'), null)))).filter(Boolean)
  const file = join(OUT, 'report.html')
  await writeFile(file, renderReport(runs, file, { note: `stations: ${[...new Set(runs.flatMap((r) => r.items.map((i) => i.station)))].join(', ')}` }))
  const summary = {
    generated: new Date().toISOString(),
    A: `${A.label} <${A.base}>`,
    B: `${B.label} <${B.base}>`,
    runs: runs.map((r) => ({
      compare: r.compare,
      started: r.started,
      finished: r.finished,
      counts: r.items.reduce((m, i) => ((m[i.status] = (m[i.status] ?? 0) + 1), m), {}),
      items: r.items.map((i) => ({ station: i.station, scenario: i.scenario, status: i.status, summary: i.summary, moved: i.comparison?.moved })),
    })),
  }
  await writeJson(join(OUT, 'results.json'), summary)
  console.log(`report: ${file}`)
  for (const r of summary.runs) console.log(`  ${r.compare}: ${JSON.stringify(r.counts)}`)
  return runs
}

if (!args['report-only']) {
  const browser = args.recompare ? null : await launch({ headless: !args.headed })
  try {
    if (!args.recompare) {
      if (compares.some((c) => c !== 'ag-api')) await ensureServer(A)
      await ensureServer(B)
    }
    for (const c of compares) {
      if (c === 'latest') await runLatest(browser)
      else if (c === 'ag') await runAg(browser)
      else if (c === 'downloader') await runDownloader(browser)
      else if (c === 'ag-api') await runAgApi(browser)
      else console.error(`unknown --compare ${c}`)
    }
  } finally {
    await browser?.close()
    stopServers()
  }
}
const runs = await rebuild()
const overall = worst(runs.filter((r) => compares.includes(r.compare)).flatMap((r) => r.items.map((i) => i.status)))
console.log(`overall: ${overall}`)
if (overall === 'FAIL' || overall === 'ERROR') process.exitCode = 1
