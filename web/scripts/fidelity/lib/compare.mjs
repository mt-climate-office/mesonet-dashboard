// Comparator: match Plotly traces between two captures and diff them
// numerically; diff axis titles / annotations / shapes / card text / CSVs.
//
// Status semantics:
//   PASS  identical within tolerance
//   WARN  only edge differences (trailing/leading points from capture-time
//         skew, label wording) or informational
//   FAIL  missing/extra traces, interior value deltas, length mismatches
//   ERROR one side failed to load
import { TOLERANCE } from '../config.mjs'
import { parseCsv } from './util.mjs'

const RANK = { PASS: 0, WARN: 1, FAIL: 2, ERROR: 3 }
export const worst = (...s) => s.flat().reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'PASS')

/** Normalize an x value: Mountain wall-clock 'YYYY-MM-DDTHH:MM' (drop offset/seconds). */
export function normX(x) {
  if (x == null) return String(x)
  if (typeof x === 'number') return String(Math.round(x * 1e6) / 1e6)
  const s = String(x).trim().replace(' ', 'T')
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?/)
  if (!m) return s
  return m[2] && m[2] !== '00:00' ? `${m[1]}T${m[2]}` : m[2] ? `${m[1]}T00:00` : m[1]
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Normalize a label for fuzzy matching: lowercase, drop units/punctuation. */
export const normLabel = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9@]+/g, ' ')
    .trim()

/** Build comparable trace descriptors with a stable key. */
function describe(plot) {
  const axisTitle = (t) => {
    const yk = `yaxis${t.yaxis === 'y' ? '' : t.yaxis.replace(/^y/, '')}`
    return plot.axes[yk]?.title ?? ''
  }
  const counts = {}
  return plot.traces
    .filter((t) => t.visible !== false)
    .map((t) => {
      const ax = axisTitle(t)
      const base = `${ax} | ${t.name || '(unnamed)'} | ${t.type}`
      counts[base] = (counts[base] ?? 0) + 1
      const key = counts[base] > 1 ? `${base} #${counts[base]}` : base
      const fuzzy = `${normLabel(ax)}|${normLabel(t.name)}|${counts[base]}`
      return { ...t, axisTitle: ax, key, fuzzy }
    })
}

/** Diff two series. Returns stats + status. */
export function diffSeries(a, b, tol = TOLERANCE) {
  // polar: theta/r ; heatmap: z ; else x/y
  let xa, ya, xb, yb
  if (a.r || b.r) {
    xa = (a.theta ?? []).map(String)
    ya = a.r ?? []
    xb = (b.theta ?? []).map(String)
    yb = b.r ?? []
  } else if (a.z || b.z) {
    const flat = (t) => {
      const xs = []
      const vs = []
      ;(t.z ?? []).forEach((row, i) =>
        (Array.isArray(row) ? row : [row]).forEach((v, j) => {
          xs.push(`${t.y?.[i] ?? i}@${normX(t.x?.[j] ?? j)}`)
          vs.push(v)
        }),
      )
      return [xs, vs]
    }
    ;[xa, ya] = flat(a)
    ;[xb, yb] = flat(b)
  } else {
    xa = (a.x ?? []).map(normX)
    ya = a.y ?? []
    xb = (b.x ?? []).map(normX)
    yb = b.y ?? []
  }
  const ma = new Map()
  xa.forEach((x, i) => ma.set(x, ya[i]))
  const mb = new Map()
  xb.forEach((x, i) => mb.set(x, yb[i]))
  const onlyA = xa.filter((x) => !mb.has(x))
  const onlyB = xb.filter((x) => !ma.has(x))
  let nDiff = 0
  let nullMismatch = 0
  let maxAbs = 0
  let worstX = null
  const samples = []
  let common = 0
  for (const [x, va] of ma) {
    if (!mb.has(x)) continue
    common++
    const na = num(va)
    const nb = num(mb.get(x))
    if (na === null && nb === null) {
      if (typeof va === 'string' && va !== mb.get(x)) {
        nDiff++
        if (samples.length < 5) samples.push({ x, a: va, b: mb.get(x) })
      }
      continue
    }
    if (na === null || nb === null) {
      nullMismatch++
      if (samples.length < 5) samples.push({ x, a: va ?? null, b: mb.get(x) ?? null })
      continue
    }
    const d = Math.abs(na - nb)
    if (d > tol.abs && d > tol.rel * Math.max(Math.abs(na), Math.abs(nb))) {
      nDiff++
      if (d > maxAbs) {
        maxAbs = d
        worstX = x
      }
      if (samples.length < 5) samples.push({ x, a: na, b: nb, d: +d.toPrecision(4) })
    }
  }
  // "edge" = points only on one side that fall outside the other side's x span
  // (capture-time skew: one side loaded a few minutes later).
  const sorted = (arr) => [...arr].sort()
  const sa = sorted(xa)
  const sb = sorted(xb)
  const lo = sa[0] > sb[0] ? sa[0] : sb[0]
  const hi = sa.at(-1) < sb.at(-1) ? sa.at(-1) : sb.at(-1)
  const interior = (x) => (sa.length && sb.length ? x >= lo && x <= hi : true)
  const onlyInteriorA = onlyA.filter(interior)
  const onlyInteriorB = onlyB.filter(interior)
  let status = 'PASS'
  if (onlyA.length || onlyB.length) status = 'WARN'
  if (nDiff || nullMismatch || onlyInteriorA.length || onlyInteriorB.length) status = 'FAIL'
  return {
    status,
    nA: xa.length,
    nB: xb.length,
    common,
    onlyA: onlyA.length,
    onlyB: onlyB.length,
    onlyInteriorA: onlyInteriorA.slice(0, 5),
    onlyInteriorB: onlyInteriorB.slice(0, 5),
    edgeOnlyA: onlyA.length - onlyInteriorA.length,
    edgeOnlyB: onlyB.length - onlyInteriorB.length,
    nDiff,
    nullMismatch,
    maxAbs: +maxAbs.toPrecision(4),
    worstX,
    samples,
    spanA: [sa[0], sa.at(-1)],
    spanB: [sb[0], sb.at(-1)],
  }
}

function setDiff(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  return { onlyA: [...A].filter((x) => !B.has(x)), onlyB: [...B].filter((x) => !A.has(x)) }
}

/** Compare two plots (same role). */
export function comparePlots(pa, pb, { fuzzy = false } = {}) {
  const ta = describe(pa)
  const tb = describe(pb)
  const used = new Set()
  const traces = []
  for (const a of ta) {
    let b = tb.find((t) => !used.has(t) && t.key === a.key)
    let how = 'exact'
    if (!b && fuzzy) {
      b = tb.find((t) => !used.has(t) && t.fuzzy === a.fuzzy)
      how = 'fuzzy'
    }
    if (!b) {
      traces.push({ key: a.key, status: 'FAIL', issue: 'missing in B' })
      continue
    }
    used.add(b)
    const d = diffSeries(a, b)
    const labelDiff = a.key !== b.key ? { a: a.key, b: b.key } : undefined
    traces.push({ key: a.key, matchedBy: how, labelDiff, ...d, status: labelDiff ? worst(d.status, 'WARN') : d.status })
  }
  for (const b of tb) if (!used.has(b)) traces.push({ key: b.key, status: 'FAIL', issue: 'extra in B (missing in A)' })

  const axA = Object.values(pa.axes).map((a) => a.title).filter((t) => t && !/^Click to enter/.test(t))
  const axB = Object.values(pb.axes).map((a) => a.title).filter((t) => t && !/^Click to enter/.test(t))
  const axes = setDiff(axA, axB)
  const ann = setDiff(pa.annotations.map((a) => a.text).filter(Boolean), pb.annotations.map((a) => a.text).filter(Boolean))
  const shapeKey = (s) => `${s.type}:${normX(s.x0)}..${normX(s.x1)}:${s.fillcolor ?? ''}`
  const shapes = setDiff(pa.shapes.map(shapeKey), pb.shapes.map(shapeKey))
  const textStatus = axes.onlyA.length || axes.onlyB.length || ann.onlyA.length || ann.onlyB.length ? 'WARN' : 'PASS'
  const shapeStatus = shapes.onlyA.length || shapes.onlyB.length ? 'FAIL' : 'PASS'
  return {
    role: pa.role,
    status: worst(traces.map((t) => t.status), textStatus, shapeStatus),
    nTracesA: ta.length,
    nTracesB: tb.length,
    traces,
    axes,
    annotations: ann,
    shapes: { nA: pa.shapes.length, nB: pb.shapes.length, ...shapes },
  }
}

/**
 * Compare card text. "label<TAB>value" lines (Current Conditions / metadata
 * tables) are compared as key/value pairs, numbers within display rounding
 * (half a unit in the last shown decimal of the coarser side); other lines
 * as an unordered set.
 */
export function compareText(a, b, { volatile = [/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/, /^©/] } = {}) {
  if (a == null && b == null) return { status: 'PASS', note: 'absent on both' }
  if (a == null || b == null) return { status: 'FAIL', note: `absent on ${a == null ? 'A' : 'B'}` }
  const parse = (t) => {
    const kv = new Map()
    const plain = []
    for (const raw of t.split('\n')) {
      const l = raw.trim()
      if (!l) continue
      const m = l.match(/^(.+?)\t+(.+)$/)
      if (m) kv.set(m[1].replace(/\s+/g, ' ').trim(), m[2].trim())
      else plain.push(l.replace(/\s+/g, ' '))
    }
    return { kv, plain }
  }
  const A = parse(a)
  const B = parse(b)
  const d = setDiff(A.plain, B.plain)
  const isVol = (l) => volatile.some((r) => r.test(l))
  const keys = setDiff([...A.kv.keys()], [...B.kv.keys()])
  const valueDiffs = []
  const decimals = (v) => (String(v).split('.')[1] ?? '').replace(/\D.*$/, '').length
  for (const [k, va] of A.kv) {
    if (!B.kv.has(k)) continue
    const vb = B.kv.get(k)
    if (va === vb || isVol(va) || isVol(vb)) continue
    const na = parseFloat(va)
    const nb = parseFloat(vb)
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      const tol = 0.5 * 10 ** -Math.min(decimals(va), decimals(vb)) + 1e-9
      if (Math.abs(na - nb) <= tol) continue
    }
    valueDiffs.push({ key: k, a: va, b: vb })
  }
  const hard = [...d.onlyA, ...d.onlyB].filter((l) => !isVol(l)).length + keys.onlyA.length + keys.onlyB.length + valueDiffs.length
  return {
    status: hard ? 'FAIL' : d.onlyA.length || d.onlyB.length ? 'WARN' : 'PASS',
    onlyA: [...d.onlyA, ...keys.onlyA.map((k) => `${k}: ${A.kv.get(k)}`)].slice(0, 40),
    onlyB: [...d.onlyB, ...keys.onlyB.map((k) => `${k}: ${B.kv.get(k)}`)].slice(0, 40),
    valueDiffs: valueDiffs.slice(0, 40),
  }
}

/** Compare two full Latest captures (A = reference). */
export function compareCaptures(A, B, { fuzzy = false, cards = true } = {}) {
  if (A.error || B.error) {
    return { status: 'ERROR', error: { A: A.error, B: B.error } }
  }
  const out = { plots: [], cards: {} }
  const byRole = (c) => {
    const m = {}
    for (const p of c.plots ?? []) (m[p.role] ??= []).push(p)
    return m
  }
  const ra = byRole(A)
  const rb = byRole(B)
  for (const role of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
    if (role === 'map') continue // map figures/iframes aren't data-comparable
    const la = ra[role] ?? []
    const lb = rb[role] ?? []
    if (!la.length || !lb.length) {
      out.plots.push({ role, status: 'FAIL', issue: `plot '${role}' only in ${la.length ? 'A' : 'B'}` })
      continue
    }
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (!la[i] || !lb[i]) {
        out.plots.push({ role, status: 'FAIL', issue: `extra '${role}' plot #${i} in ${la[i] ? 'A' : 'B'}` })
        continue
      }
      out.plots.push(comparePlots(la[i], lb[i], { fuzzy }))
    }
  }
  if (cards) {
    // only cards both drivers know how to locate (e.g. legacy-only sidebar is skipped vs new app)
    for (const k of Object.keys(A.cards ?? {}).filter((k) => k in (B.cards ?? {}))) {
      out.cards[k] = compareText(A.cards?.[k]?.text, B.cards?.[k]?.text)
      const brokenImgs = (c) => (c?.images ?? []).filter((i) => !i.ok).map((i) => i.src)
      const bi = { A: brokenImgs(A.cards?.[k]), B: brokenImgs(B.cards?.[k]) }
      if (bi.A.length || bi.B.length) out.cards[k].brokenImages = bi
    }
  }
  const net = { A: A.log?.bad ?? [], B: B.log?.bad ?? [] }
  out.network = net
  out.status = worst(
    out.plots.map((p) => p.status),
    Object.values(out.cards).map((c) => (c.status === 'FAIL' ? 'WARN' : c.status)), // card text is advisory
  )
  return out
}

/** Compare two downloaded CSVs: filename, columns, rows, values by datetime. */
export function compareCsv(A, B) {
  if (!A?.download || !B?.download)
    return {
      status: 'ERROR',
      error: { A: A?.download ? 'ok' : A?.error ?? 'no download', B: B?.download ? 'ok' : B?.error ?? 'no download' },
    }
  const ra = parseCsv(A.download.text)
  const rb = parseCsv(B.download.text)
  const colsA = Object.keys(ra[0] ?? {})
  const colsB = Object.keys(rb[0] ?? {})
  const cols = setDiff(colsA, colsB)
  const keyCol = (cols) => cols.find((c) => /^datetime$/i.test(c)) ?? cols.find((c) => /date|time/i.test(c))
  const ka = keyCol(colsA)
  const kb = keyCol(colsB)
  const columns = []
  for (const c of colsA.filter((c) => colsB.includes(c) && c !== ka)) {
    const d = diffSeries({ x: ra.map((r) => r[ka]), y: ra.map((r) => r[c]) }, { x: rb.map((r) => r[kb]), y: rb.map((r) => r[c]) })
    if (d.status !== 'PASS') columns.push({ column: c, ...d })
  }
  return {
    status: worst(
      A.download.filename === B.download.filename ? 'PASS' : 'WARN',
      cols.onlyA.length || cols.onlyB.length ? 'FAIL' : 'PASS',
      ra.length === rb.length ? 'PASS' : 'FAIL',
      columns.map((c) => c.status),
    ),
    filename: { A: A.download.filename, B: B.download.filename },
    rows: { A: ra.length, B: rb.length },
    columns: { onlyA: cols.onlyA, onlyB: cols.onlyB },
    valueDiffs: columns,
  }
}
