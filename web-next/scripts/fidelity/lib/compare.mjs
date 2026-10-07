// Comparator: web/ (A, Plotly) vs web-next (B, ECharts) figures, cards and CSVs.
//   PASS        equal within tolerance
//   DOCUMENTED  compared content differs on purpose (a DOCUMENTED_ROWS row; run.mjs: redesigned card text)
//   WARN  label wording, edge-only point differences (captures are seconds apart), advisory card text,
//         off-palette colors
//   FAIL  a trace or panel missing/extra, interior value or null differences, sensor spans, CSV rows/values
//   ERROR one side failed to load
// Colors are never compared between the apps (the house palette is intentional); B's data colors are
// checked against core/palette instead (paletteCheck).
import { TOLERANCE } from '../config.mjs'
import { parseCsv, worst } from './util.mjs'

/** x → comparable string: wall clock 'YYYY-MM-DDTHH:MM', midnight = the date; numbers rounded. */
export function normX(x) {
  if (x == null) return String(x)
  if (typeof x === 'number') return String(Math.round(x * 1e6) / 1e6)
  const s = String(x).trim().replace(' ', 'T')
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?/)
  if (!m) return s
  return m[2] && m[2] !== '00:00' ? `${m[1]}T${m[2]}` : m[1]
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export const normLabel = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** Known renames between the apps' trace names (same data, different label). */
function canonicalName(t, side) {
  const n = String(t.name ?? '').replace(/\s+/g, ' ').trim()
  if (side === 'A') {
    const avg = /^Average (Max|Min)\./.exec(n)
    if (avg) return `normal ${avg[1].toLowerCase()}`
    if (/^(Feels Like|Risk)$/.test(n)) return 'index line'
  } else {
    const edge = /^aux:p\d+-normal-(min|max)$/.exec(t.id ?? '')
    if (edge) return `normal ${edge[1]}`
    if (t.id === 'aux:index-line') return 'index line'
    // CCI classes say which side (cold/heat).
    const side = /^(No Stress|Mild|Moderate|Severe|Extreme|Extreme Danger) \((cold|heat)\)$/.exec(n)
    if (side) return side[1]
  }
  // wind-rose bins: web-next adds the unit ("4 – 6 mph")
  return n.replace(/ mph$/, '')
}

/** The variable a series name belongs to: the name before " @ " (depth/height) or " [" (unit). */
const family = (name) => String(name ?? '').replace(/\s*(@|\[).*$/, '').trim()

/**
 * Panel key per y-axis title, from the compared traces: the variable of the panel's first data series
 * (not an AUX series, a hidden/helper Plotly trace or a normals/index alias). Panels pair by the
 * series they draw, not by their titles, so web-next's plain axis titles ("Air temperature (°F)",
 * DESIGN "Visual language") still pair with web/'s ("Air Temp. (°F)"). A panel without such a
 * series keys by its title.
 */
function panelKeys(traces) {
  const keys = new Map()
  for (const t of traces) {
    const title = normLabel(t.panel)
    if (keys.has(title) || t.aux || t.hidden || t.helper || /^(normal (min|max)|index line)$/.test(t.name)) continue
    keys.set(title, `panel:${normLabel(family(t.name)) || title}`)
  }
  return (title) => keys.get(normLabel(title)) ?? normLabel(title)
}

/**
 * Drop drawing aids that have no counterpart (Plotly hover polygons / band helpers; ECharts AUX
 * series without a canonical name), turn constant SWP band/limit lines into refs. Traces key by
 * their panel's key (`panelKeys`) and name.
 */
function prepare(fig, side) {
  const refs = [...(fig.refs ?? [])].map((r) => r.y)
  const traces = []
  for (const t of fig.traces ?? []) {
    if (side === 'A' && t.fill === 'toself') continue // sensor-span hover polygon (web/ only)
    const ys = (t.y ?? []).map(num)
    const valid = ys.filter((v) => v !== null)
    if (!valid.length && !(t.notes ?? []).some(Boolean)) continue // empty "not available" placeholder
    if (side === 'A' && /Field Capacity|Wilting Point|Saturated/.test(t.name) && new Set(valid).size === 1) {
      refs.push(valid[0])
      continue
    }
    // Feels like: web/ marks every non-index day "Average Temperature"; web-next marks only wind
    // chill / heat index and draws the air temperature as its own line instead (DIVERGENCES
    // "Feels like and livestock risk colors").
    if (side === 'A' && t.name === 'Average Temperature') continue
    if (side === 'B' && t.id === 'feels:air-temp') continue
    const name = canonicalName(t, side)
    if (side === 'B' && (t.id === 'aux:bands' || /^(aux:normal-base|gridMET normal)$/.test(name))) continue
    let x = (t.x ?? []).map(normX)
    // Daily points sit at local noon in web-next (DIVERGENCES "Daily points at local noon").
    const timed = x.filter((v, i) => ys[i] !== null && /T\d\d:\d\d$/.test(v))
    if (timed.length && timed.length === x.filter((_, i) => ys[i] !== null).length && timed.every((v) => v.endsWith('T12:00')))
      x = x.map((v) => v.replace(/T12:00$/, ''))
    // A CCI class on both sides (Mild cold, Mild heat) is one web/ trace: merge them.
    const same = side === 'B' && traces.find((p) => p.name === name && p.panel === t.panel && p.kind === t.kind)
    if (same) {
      same.x = [...same.x, ...x]
      same.y = [...same.y, ...t.y]
      continue
    }
    traces.push({ ...t, name, x, y: t.y })
  }
  const panelOf = panelKeys(traces)
  for (const t of traces) {
    t.panelKey = panelOf(t.panel)
    t.key = `${t.panelKey}|${normLabel(t.name)}`
  }
  return { ...fig, traces, panelIds: (fig.panels ?? []).map(panelOf), refValues: [...new Set(refs.filter(Number.isFinite).map((v) => +v.toPrecision(4)))].sort((a, b) => a - b) }
}

/** Every comparable trace of `figs` after the same normalisation compareFigures applies. */
export const preparedTraces = (figs, side) => figs.flatMap((f) => prepare(f, side).traces)

/** Diff two series by x. Returns counts, samples and a status. */
export function diffSeries(a, b, tol = TOLERANCE) {
  const xa = (a.x ?? []).map(normX)
  const xb = (b.x ?? []).map(normX)
  const ma = new Map(xa.map((x, i) => [x, a.y?.[i]]))
  const mb = new Map(xb.map((x, i) => [x, b.y?.[i]]))
  // A point on one side only that is null there (gap marker, all-NA row) is not a difference.
  const onlyA = xa.filter((x) => !mb.has(x) && num(ma.get(x)) !== null)
  const onlyB = xb.filter((x) => !ma.has(x) && num(mb.get(x)) !== null)
  let nDiff = 0
  let nullMismatch = 0
  let caseOnly = 0
  let maxAbs = 0
  let common = 0
  const samples = []
  const diffXs = []
  for (const [x, va] of ma) {
    if (!mb.has(x)) continue
    common++
    const vb = mb.get(x)
    const na = num(va)
    const nb = num(vb)
    if (na === null && nb === null) {
      const sa = va == null ? '' : String(va)
      const sb = vb == null ? '' : String(vb)
      if (sa !== sb) {
        if (sa.toLowerCase() === sb.toLowerCase()) caseOnly++
        else {
          nDiff++
          diffXs.push(x)
          if (samples.length < 5) samples.push({ x, a: va, b: vb })
        }
      }
      continue
    }
    if (na === null || nb === null) {
      nullMismatch++
      diffXs.push(x)
      if (samples.length < 5) samples.push({ x, a: va ?? null, b: vb ?? null })
      continue
    }
    const d = Math.abs(na - nb)
    if (d > tol.abs && d > tol.rel * Math.max(Math.abs(na), Math.abs(nb))) {
      nDiff++
      diffXs.push(x)
      maxAbs = Math.max(maxAbs, d)
      if (samples.length < 5) samples.push({ x, a: na, b: nb, d: +d.toPrecision(4) })
    }
  }
  const sa = [...xa].sort()
  const sb = [...xb].sort()
  const lo = sa[0] > sb[0] ? sa[0] : sb[0]
  const hi = sa.at(-1) < sb.at(-1) ? sa.at(-1) : sb.at(-1)
  const interior = (x) => (sa.length && sb.length ? x >= lo && x <= hi : true)
  const onlyInteriorA = onlyA.filter(interior)
  const onlyInteriorB = onlyB.filter(interior)
  const edge = new Set(sa.filter((x) => mb.has(x)).slice(-(tol.edgePoints ?? 2)))
  const edgeOnly = diffXs.length > 0 && diffXs.every((x) => edge.has(x))
  let status = 'PASS'
  if (onlyA.length || onlyB.length || caseOnly || (diffXs.length && edgeOnly)) status = 'WARN'
  if ((diffXs.length && !edgeOnly) || onlyInteriorA.length || onlyInteriorB.length) status = 'FAIL'
  return {
    status,
    nA: xa.length,
    nB: xb.length,
    common,
    onlyA: onlyA.length,
    onlyB: onlyB.length,
    onlyInteriorA: onlyInteriorA.slice(0, 5),
    onlyInteriorB: onlyInteriorB.slice(0, 5),
    nDiff,
    nullMismatch,
    edgeOnly,
    caseOnly,
    maxAbs: +maxAbs.toPrecision(4),
    samples,
  }
}

const setDiff = (a, b) => {
  const A = new Set(a)
  const B = new Set(b)
  return { onlyA: [...A].filter((x) => !B.has(x)), onlyB: [...B].filter((x) => !A.has(x)) }
}

/** Best content match for `a` among `pool` (most common x, fewest diffs). */
function contentMatch(a, pool) {
  let best = null
  for (const b of pool) {
    const d = diffSeries(a, b)
    if (!d.common) continue
    const score = d.nDiff + d.nullMismatch + d.onlyInteriorA.length + d.onlyInteriorB.length - d.common * 1e-6
    if (!best || score < best.score) best = { b, d, score }
  }
  return best && best.d.status !== 'FAIL' ? best : null
}

/** Compare one figure pair (same role). */
export function compareFigures(fa, fb) {
  const A = prepare(fa, 'A')
  const B = prepare(fb, 'B')
  const used = new Set()
  const traces = []
  for (const a of A.traces) {
    let b = B.traces.find((t) => !used.has(t) && t.key === a.key)
    let how = 'exact'
    if (!b) {
      b = B.traces.find((t) => !used.has(t) && normLabel(t.name) === normLabel(a.name))
      how = 'name'
    }
    if (!b) {
      const m = contentMatch(a, B.traces.filter((t) => !used.has(t) && t.panelKey === a.panelKey))
      b = m?.b
      how = 'content'
    }
    if (!b) {
      // Plotly-only helpers (invisible lines, legend-less fills) have no counterpart by design.
      if (a.hidden || a.helper) continue
      traces.push({ key: a.key, status: 'FAIL', issue: 'missing in web-next' })
      continue
    }
    used.add(b)
    const d = diffSeries(a, b)
    const labelDiff = a.key !== b.key ? { a: a.key, b: b.key } : undefined
    let notes
    if (a.notes && b.notes) {
      // web/ annual hovers carry the ISO date, web-next the short date ("Jan 1"): same day.
      const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const an = a.notes.map((v) => (/^\d{4}-\d\d-\d\d$/.test(v ?? '') ? `${MON[Number(v.slice(5, 7)) - 1]} ${Number(v.slice(8))}` : v))
      const n = diffSeries({ x: a.x, y: an }, { x: b.x, y: b.notes })
      if (n.status !== 'PASS') notes = { status: 'WARN', nDiff: n.nDiff, samples: n.samples }
    }
    traces.push({
      key: a.key,
      matchedBy: how,
      labelDiff,
      notes,
      ...d,
      status: worst(d.status, labelDiff ? 'WARN' : 'PASS', notes ? 'WARN' : 'PASS'),
    })
  }
  for (const b of B.traces) {
    if (used.has(b) || b.aux) continue
    traces.push({ key: b.key, status: 'FAIL', issue: 'extra in web-next (not in web/)' })
  }
  // Panels pair by key (their series); a title that differs only in wording is reported, not scored.
  const panels = setDiff(A.panelIds, B.panelIds)
  const titleOf = (fig, prep) => new Map(prep.panelIds.map((k, i) => [k, fig.panels[i]]))
  const ta = titleOf(fa, A)
  const tb = titleOf(fb, B)
  const panelTitles = [...ta].filter(([k, t]) => tb.has(k) && normLabel(tb.get(k)) !== normLabel(t)).map(([k, t]) => ({ key: k, a: t, b: tb.get(k) }))
  const spanKey = (s) => `${normX(s.x0)}..${normX(s.x1)}`
  const spans = setDiff((fa.spans ?? []).map(spanKey), (fb.spans ?? []).map(spanKey))
  // Every web/ threshold line must be drawn in web-next (band ends >= 1000 bar and GDD stage lines,
  // which web/ shows as marker colors, are not compared).
  const refs = { onlyA: A.refValues.filter((v) => v < 1000 && !B.refValues.includes(v)), onlyB: [] }
  const na = (texts) => (texts ?? []).filter((t) => /not available/i.test(t)).map(normLabel)
  const notAvailable = setDiff(na(fa.texts), na(fb.texts))
  return {
    role: fa.role,
    status: worst(
      traces.map((t) => t.status),
      panels.onlyA.length || panels.onlyB.length ? 'WARN' : 'PASS',
      spans.onlyA.length || spans.onlyB.length ? 'FAIL' : 'PASS',
      refs.onlyA.length || refs.onlyB.length ? 'WARN' : 'PASS',
      notAvailable.onlyA.length || notAvailable.onlyB.length ? 'WARN' : 'PASS',
    ),
    nTracesA: A.traces.length,
    nTracesB: B.traces.length,
    traces,
    panels,
    panelTitles,
    spans: { nA: fa.spans?.length ?? 0, nB: fb.spans?.length ?? 0, ...spans },
    refs,
    notAvailable,
  }
}

const rgb = (c) => {
  const s = String(c ?? '').trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16)).join(',')
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',')
  m = /^rgba?\(([^)]+)\)$/.exec(s)
  if (m) return m[1].split(',').slice(0, 3).map((v) => Math.round(Number(v))).join(',')
  return s
}

/** B's data series colors must come from core/palette (light theme). Off-palette colors WARN. */
export function paletteCheck(figs, palette) {
  if (!palette) return { status: 'WARN', note: 'palette module not loadable (not a dev server?)' }
  const allowed = new Set(palette.map(rgb))
  const off = []
  let checked = 0
  for (const f of figs) {
    for (const t of f.traces ?? []) {
      if (t.aux || !t.color) continue
      checked++
      if (!allowed.has(rgb(t.color))) off.push(`${f.role}: ${t.name} ${t.color}`)
    }
    for (const c of f.visualColors ?? []) {
      checked++
      if (!allowed.has(rgb(c))) off.push(`${f.role}: heatmap ${c}`)
    }
  }
  return { status: off.length ? 'WARN' : 'PASS', checked, off: [...new Set(off)].slice(0, 20) }
}

/** Label → value from every two-column row of the card's tables. */
const kv = (card) => new Map((card?.tables ?? []).flat().filter((r) => r.length === 2).map(([k, v]) => [k.replace(/\s+/g, ' ').trim(), v.trim()]))

/**
 * Rows that differ on purpose: web/ label → web-next label. Left out of the key and value diff,
 * reported under `documented`, and the card is DOCUMENTED (not PASS) when one is present. Real Feel → Feels like: DIVERGENCES "Feels like uses the NWS method".
 */
const DOCUMENTED_ROWS = new Map([['Real Feel [°F]', 'Feels like [°F]']])

const CONTROL = new Set(['Map', 'Wind Rose', 'Weather Forecast', 'Latest Photo', 'Locator Map', 'Station Metadata', 'Current Conditions', 'Top card', 'Bottom card'])

/**
 * Card diff: table rows as key/value (numbers within the coarser side's display rounding),
 * image sources, select options, then the remaining visible text lines. Advisory (WARN) except a
 * card web/ shows that web-next leaves empty, or a broken image in web-next (FAIL).
 */
export function compareCard(a, b, { volatile = [/^Timestamp$/] } = {}) {
  if (!a && !b) return { status: 'PASS', note: 'absent on both' }
  if (!b) return { status: 'FAIL', note: 'card missing in web-next' }
  if (!a) return { status: 'WARN', note: 'card missing in web/' }
  const ka = kv(a)
  const kb = kv(b)
  const documented = []
  for (const [ra, rb] of DOCUMENTED_ROWS) {
    if (!ka.has(ra) && !kb.has(rb)) continue
    documented.push({ a: ra, valueA: ka.get(ra) ?? null, b: rb, valueB: kb.get(rb) ?? null, see: 'DIVERGENCES "Feels like uses the NWS method"' })
    ka.delete(ra)
    kb.delete(rb)
  }
  const keys = setDiff([...ka.keys()], [...kb.keys()])
  const dec = (v) => (String(v).split('.')[1] ?? '').replace(/\D.*$/, '').length
  const valueDiffs = []
  // Current Conditions captured either side of a 5-minute update: values legitimately differ.
  const stale = ka.has('Timestamp') && kb.has('Timestamp') && ka.get('Timestamp') !== kb.get('Timestamp')
  for (const [k, va] of ka) {
    if (stale || !kb.has(k) || volatile.some((r) => r.test(k))) continue
    const vb = kb.get(k)
    if (va === vb) continue
    const x = parseFloat(va)
    const y = parseFloat(vb)
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 0.5 * 10 ** -Math.min(dec(va), dec(vb)) + 1e-9) continue
    valueDiffs.push({ key: k, a: va, b: vb })
  }
  // Text as tokens, so "43 ° F" (split spans) and "43°F" compare equal; table cells are compared above.
  const tokens = (c) => {
    const cells = new Set([...kv(c).keys(), ...kv(c).values()])
    return (c.lines ?? [])
      .filter((l) => !CONTROL.has(l) && !cells.has(l))
      .join(' ')
      .replace(/\p{Extended_Pictographic}/gu, ' ')
      .replace(/\s*([^\p{L}\p{N}\s])\s*/gu, '$1')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  }
  const lines = setDiff(tokens(a), tokens(b))
  const imgs = setDiff((a.images ?? []).map((i) => i.src), (b.images ?? []).map((i) => i.src))
  const broken = (b.images ?? []).filter((i) => !i.ok).map((i) => i.src)
  // web/'s Mantine Selects render no options until opened: compare options only when both have them.
  const oa = (a.options ?? []).flat()
  const ob = (b.options ?? []).flat()
  const opts = oa.length && ob.length ? setDiff(oa, ob) : { onlyA: [], onlyB: [] }
  const emptyB = !(b.lines ?? []).length && (a.lines ?? []).filter((l) => !CONTROL.has(l)).length > 0
  const soft = keys.onlyA.length || keys.onlyB.length || valueDiffs.length || lines.onlyA.length || lines.onlyB.length || imgs.onlyA.length || imgs.onlyB.length || opts.onlyA.length || opts.onlyB.length
  return {
    status: emptyB || broken.length ? 'FAIL' : soft ? 'WARN' : documented.length ? 'DOCUMENTED' : 'PASS',
    rows: { A: ka.size, B: kb.size },
    stale,
    keys,
    documented,
    valueDiffs: valueDiffs.slice(0, 40),
    lines: { onlyA: lines.onlyA.slice(0, 30), onlyB: lines.onlyB.slice(0, 30) },
    images: imgs,
    brokenImages: broken,
    options: { onlyA: opts.onlyA.slice(0, 20), onlyB: opts.onlyB.slice(0, 20) },
  }
}

/** Two downloaded CSVs: byte-identical, else filename / columns / rows / values by datetime. */
export function compareCsv(A, B) {
  if (!A?.download || !B?.download)
    return { status: 'ERROR', error: { A: A?.download ? 'ok' : A?.error ?? 'no download', B: B?.download ? 'ok' : B?.error ?? 'no download' } }
  const bytes = { A: A.download.bytes, B: B.download.bytes, identical: A.download.text === B.download.text, shaA: A.download.sha, shaB: B.download.sha }
  const ra = parseCsv(A.download.text)
  const rb = parseCsv(B.download.text)
  const colsA = Object.keys(ra[0] ?? {})
  const colsB = Object.keys(rb[0] ?? {})
  const cols = setDiff(colsA, colsB)
  const order = colsA.join(',') === colsB.join(',')
  const key = (cs) => cs.find((c) => /^datetime$/i.test(c)) ?? cs[1]
  const columns = []
  for (const c of colsA.filter((c) => colsB.includes(c) && c !== key(colsA))) {
    const d = diffSeries({ x: ra.map((r) => r[key(colsA)]), y: ra.map((r) => r[c]) }, { x: rb.map((r) => r[key(colsB)]), y: rb.map((r) => r[c]) }, { ...TOLERANCE, abs: 0, rel: 0, edgePoints: 0 })
    if (d.status !== 'PASS') columns.push({ column: c, ...d })
  }
  return {
    status: bytes.identical
      ? 'PASS'
      : worst(
          A.download.filename === B.download.filename ? 'PASS' : 'FAIL',
          cols.onlyA.length || cols.onlyB.length ? 'FAIL' : order ? 'PASS' : 'WARN',
          ra.length === rb.length ? 'PASS' : 'FAIL',
          columns.map((c) => (c.status === 'PASS' ? 'PASS' : 'FAIL')),
          'WARN',
        ),
    bytes,
    filename: { A: A.download.filename, B: B.download.filename },
    rows: { A: ra.length, B: rb.length },
    columns: { onlyA: cols.onlyA, onlyB: cols.onlyB, sameOrder: order },
    valueDiffs: columns,
  }
}
