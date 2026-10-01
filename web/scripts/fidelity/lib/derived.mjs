// Ag comparison: new-app Ag Tools plots vs mesonet2 /derived/{daily,hourly}
// (NO premade -- it 500s on mesonet2 -- keep=true, alpha=0.23, rm_na=true,
// matching legacy get_data.py get_derived()).
//
// Trace<->column matching is content-based because the new app's trace names
// are not a contract: for every numeric /derived column we find the trace
// (raw or cumulative) with the most common x and smallest error.
import { API, QC_LEVEL } from '../config.mjs'
import { fetchText, parseCsv } from './util.mjs'
import { diffSeries, normX, worst } from './compare.mjs'

const nextDay = (d) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

export function derivedUrl(station, sc, range) {
  const q = new URLSearchParams({
    stations: station,
    elements: sc.derived.elements,
    start_time: range.start,
    // API end_time is exclusive; the new app's range is inclusive of `end`
    end_time: nextDay(range.end),
    alpha: '0.23',
    type: 'csv',
    rm_na: 'true',
    keep: 'true',
    level: String(QC_LEVEL),
  })
  if (sc.derived.crop) q.set('crop', sc.derived.crop)
  return `${API.v2}derived/${sc.derived.period}/?${q.toString().replace(/%2C/g, ',')}`
}

export async function fetchDerived(station, sc, range) {
  const url = derivedUrl(station, sc, range)
  const r = await fetchText(url, { retries: 1 })
  if (!r.ok) return { url, status: r.status, error: r.text.slice(0, 300) }
  const rows = parseCsv(r.text)
  return { url, status: r.status, ms: r.ms, rows, columns: Object.keys(rows[0] ?? {}) }
}

const CM_TO_IN = { 5: 2, 10: 4, 20: 8, 50: 20, 61: 24, 76: 30, 91: 36, 100: 40 }

const cumsum = (ys) => {
  let s = 0
  return ys.map((v) => {
    const n = Number(v)
    if (Number.isFinite(n)) s += n
    return v === null || v === '' || v === undefined ? null : s
  })
}

/** Compare a new-app Ag capture with a /derived response. */
export function compareAg(capture, derived, sc = {}) {
  if (derived.error) return { status: 'ERROR', error: `derived ${derived.status}: ${derived.error}`, url: derived.url }
  if (capture.error) return { status: 'ERROR', error: `new app: ${capture.error}` }
  const traces = (capture.plots ?? []).flatMap((p) => p.traces.filter((t) => t.x && t.y))
  if (!traces.length) {
    return {
      status: 'FAIL',
      issue: 'new app rendered no Ag traces',
      alerts: capture.alerts,
      bad: capture.log?.bad,
      derivedRows: derived.rows.length,
    }
  }
  const skip = /^(station|datetime|date|has_na|provisional|obs_count)$/i
  // Only the derived *outputs* are compared; keep=true input columns (Tmax, RH,
  // wind...) are not necessarily plotted.
  const out = sc.outputs ? new RegExp(sc.outputs, 'i') : null
  const cols = derived.columns.filter(
    (c) => !skip.test(c) && (!out || out.test(c)) && derived.rows.some((r) => r[c] !== '' && Number.isFinite(Number(r[c]))),
  )
  const xs = derived.rows.map((r) => r.datetime ?? r.date)
  const results = []
  for (const c of cols) {
    const ys = derived.rows.map((r) => r[c])
    let best = null
    // depth-aware candidates: "-10 cm" column -> "4 in" trace (legacy depth labels)
    const cm = c.match(/-?(\d+)\s*cm/)
    const want = cm ? `${CM_TO_IN[Number(cm[1])] ?? Math.round(Number(cm[1]) / 2.54)} in` : null
    const depthTraces = want ? traces.filter((t) => String(t.name).trim() === want) : []
    for (const t of depthTraces.length ? depthTraces : traces) {
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
    status: worst(results.map((r) => r.status)),
    url: derived.url,
    derivedRows: derived.rows.length,
    derivedSpan: [normX(xs[0]), normX(xs.at(-1))],
    columns: results,
    alerts: capture.alerts,
    bad: capture.log?.bad,
  }
}
