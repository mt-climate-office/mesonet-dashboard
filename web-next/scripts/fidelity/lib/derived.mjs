// ag-api: web-next Ag Tools traces vs mesonet2 /derived/{daily,hourly} (no premade, keep=true,
// alpha=0.23, rm_na=true, level QC_LEVEL), as legacy get_derived() asked for them. Each derived
// output column is matched by content to the closest trace (raw or cumulative), depth-aware.
import { API_V2, QC_LEVEL } from '../config.mjs'
import { addDays, fetchText, parseCsv, worst } from './util.mjs'
import { diffSeries, normX, preparedTraces } from './compare.mjs'

export function derivedUrl(station, sc, range) {
  const q = new URLSearchParams({
    stations: station,
    elements: sc.derived.elements,
    start_time: range.start,
    end_time: addDays(range.end, 1), // the API's end is exclusive; the apps' is inclusive
    alpha: '0.23',
    type: 'csv',
    rm_na: 'true',
    keep: 'true',
    level: String(QC_LEVEL),
  })
  if (sc.derived.crop) q.set('crop', sc.derived.crop)
  return `${API_V2}derived/${sc.derived.period}/?${q.toString().replace(/%2C/g, ',')}`
}

export async function fetchDerived(station, sc, range) {
  const url = derivedUrl(station, sc, range)
  const r = await fetchText(url, { retries: 1 })
  if (!r.ok) return { url, status: r.status, error: r.text.slice(0, 300) }
  const rows = parseCsv(r.text)
  return { url, status: r.status, ms: r.ms, rows, columns: Object.keys(rows[0] ?? {}) }
}

const CM_TO_IN = { 5: 2, 10: 4, 20: 8, 50: 20, 61: 24, 70: 28, 76: 30, 91: 36, 100: 40 }

const cumsum = (ys) => {
  let s = 0
  return ys.map((v) => {
    const n = Number(v)
    if (v !== '' && v != null && Number.isFinite(n)) s += n
    return v === null || v === '' || v === undefined ? null : s
  })
}

export function compareAgApi(capture, derived, sc) {
  if (derived.error) return { status: 'ERROR', error: `derived ${derived.status}: ${derived.error}`, url: derived.url }
  if (capture.error) return { status: 'ERROR', error: `web-next: ${capture.error}` }
  const traces = preparedTraces(capture.figures ?? [], 'B')
  if (!traces.length) return { status: 'FAIL', issue: 'web-next rendered no Ag traces', messages: capture.messages, derivedRows: derived.rows.length }
  const skip = /^(station|datetime|date|has_na|provisional|obs_count)$/i
  const out = new RegExp(sc.outputs, 'i')
  const cols = derived.columns.filter((c) => !skip.test(c) && out.test(c) && derived.rows.some((r) => r[c] !== '' && Number.isFinite(Number(r[c]))))
  const xs = derived.rows.map((r) => r.datetime ?? r.date)
  const results = []
  for (const c of cols) {
    const ys = derived.rows.map((r) => r[c])
    const cm = c.match(/-?(\d+)\s*cm/)
    const want = cm ? `${CM_TO_IN[Number(cm[1])] ?? Math.round(Number(cm[1]) / 2.54)} in` : null
    const depth = want ? traces.filter((t) => String(t.name).trim() === want) : []
    let best = null
    for (const t of depth.length ? depth : traces) {
      for (const [mode, yy] of [
        ['raw', ys],
        ['cumulative', cumsum(ys)],
      ]) {
        const d = diffSeries({ x: xs, y: yy }, t)
        if (!d.common) continue
        const score = d.nDiff + d.nullMismatch + d.onlyA + d.onlyB - d.common * 1e-6
        if (!best || score < best.score) best = { score, trace: t.name || '(unnamed)', mode, ...d }
      }
    }
    results.push(best ? { column: c, ...best, score: undefined } : { column: c, status: 'FAIL', issue: 'no trace shares x values' })
  }
  return {
    status: results.length ? worst(results.map((r) => r.status)) : 'FAIL',
    issue: results.length ? undefined : 'no derived output columns',
    url: derived.url,
    derivedRows: derived.rows.length,
    derivedSpan: [normX(xs[0]), normX(xs.at(-1))],
    columns: results,
    messages: capture.messages,
  }
}
