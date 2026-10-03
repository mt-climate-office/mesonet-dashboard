// report.html: one matrix (scenario × station) per comparison, with an expandable details block
// per item. Screenshots are linked relatively, not embedded, to keep the file small.
import { relative, dirname } from 'node:path'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const badge = (s) => `<span class="b ${esc(s)}">${esc(s)}</span>`
const code = (v, n = 400) => `<code>${esc(typeof v === 'string' ? v : JSON.stringify(v)).slice(0, n)}</code>`
const both = (label, d) =>
  d && (d.onlyA?.length || d.onlyB?.length)
    ? `<div class="sd"><b>${esc(label)}</b> only web/: ${code((d.onlyA ?? []).join(' | '), 900)}<br>only web-next: ${code((d.onlyB ?? []).join(' | '), 900)}</div>`
    : ''

function traceTable(p) {
  const bad = (p.traces ?? []).filter((t) => t.status !== 'PASS')
  if (!bad.length) return ''
  return `<table class="t"><tr><th>trace (panel | name)</th><th>status</th><th>pts A/B</th><th>only A/B (interior)</th><th>diffs</th><th>max |d|</th><th>samples / note</th></tr>${bad
    .map(
      (t) =>
        `<tr><td>${esc(t.key)}${t.labelDiff ? `<br><small>web-next: ${esc(t.labelDiff.b)} (${esc(t.matchedBy)})</small>` : ''}</td><td>${badge(t.status)}</td><td>${t.nA ?? ''}/${t.nB ?? ''}</td><td>${t.onlyA ?? ''}/${t.onlyB ?? ''} (${(t.onlyInteriorA ?? []).length}/${(t.onlyInteriorB ?? []).length})</td><td>${t.nDiff ?? ''}${t.nullMismatch ? ` +${t.nullMismatch} null` : ''}</td><td>${t.maxAbs ?? ''}</td><td>${code(t.issue ?? (t.notes ? { notes: t.notes } : t.samples ?? []), 300)}</td></tr>`,
    )
    .join('')}</table>`
}

function details(item, outDir) {
  const c = item.comparison ?? {}
  const parts = []
  if (c.error) parts.push(`<pre>${esc(JSON.stringify(c.error, null, 1))}</pre>`)
  if (c.issue) parts.push(`<p>${esc(c.issue)}</p>`)
  for (const p of c.figures ?? []) {
    parts.push(`<h5>figure ${esc(p.role)} ${badge(p.status)} ${p.issue ? esc(p.see ? `${p.issue}; ${p.see}` : p.issue) : `traces web/ ${p.nTracesA} · web-next ${p.nTracesB}; sensor spans ${p.spans?.nA}/${p.spans?.nB}`}</h5>`)
    parts.push(traceTable(p), both('panels (y-axis titles)', p.panels), both('sensor spans', p.spans), both('reference lines', p.refs), both('"not available" notes', p.notAvailable))
  }
  for (const [k, cd] of Object.entries(c.cards ?? {})) {
    if (cd.status === 'PASS') continue
    parts.push(`<h5>card ${esc(k)} ${badge(cd.status)} ${esc(cd.note ?? '')}</h5>`, both('table rows', cd.keys), both('text', cd.lines), both('images', cd.images), both('select options', cd.options))
    if (cd.valueDiffs?.length) parts.push(`<div class="sd"><b>values</b> ${code(cd.valueDiffs.map((v) => `${v.key}: ${v.a} → ${v.b}`).join(' | '), 900)}</div>`)
    if (cd.documented?.length) parts.push(`<div class="sd"><b>documented rows</b> ${code(cd.documented.map((d) => `${d.a} ${d.valueA} → ${d.b} ${d.valueB} (${d.see})`).join(' | '), 900)}</div>`)
    if (cd.brokenImages?.length) parts.push(`<div class="sd"><b>broken images (web-next)</b> ${code(cd.brokenImages)}</div>`)
  }
  // Moved parts: informational, not scored.
  if (c.moved?.length) parts.push(`<h5>moved (not scored)</h5><ul class="sd">${c.moved.map((m) => `<li>${esc(m.part)}: ${esc(m.note)}; ${esc(m.see)}</li>`).join('')}</ul>`)
  if (c.palette && c.palette.status !== 'PASS') parts.push(`<h5>palette ${badge(c.palette.status)} ${c.palette.checked ?? ''} colors checked</h5><div class="sd">${code(c.palette.off ?? c.palette.note, 900)}</div>`)
  if (c.map && c.map.status !== 'PASS') parts.push(`<h5>map ${badge(c.map.status)}</h5><div class="sd">${code(c.map, 900)}</div>`)
  if (c.messages?.status && c.messages.status !== 'PASS') parts.push(`<h5>messages ${badge(c.messages.status)}</h5>`, both('notes / alerts', c.messages))
  if (c.csv) {
    const v = c.csv
    parts.push(
      `<h5>CSV ${badge(v.status)} ${v.bytes?.identical ? 'byte-identical' : ''}</h5><p>filename web/ ${code(v.filename?.A)} · web-next ${code(v.filename?.B)}; rows ${v.rows?.A}/${v.rows?.B}; bytes ${v.bytes?.A}/${v.bytes?.B}</p>`,
      both('columns', v.columns),
    )
    for (const d of v.valueDiffs ?? []) parts.push(`<div class="sd">${badge(d.status)} <b>${esc(d.column)}</b> diffs=${d.nDiff} null=${d.nullMismatch} ${code(d.samples, 300)}</div>`)
  }
  if (Array.isArray(c.columns)) {
    parts.push(`<p>derived: <a href="${esc(c.url)}">${esc(c.url)}</a> rows=${c.derivedRows}</p>`)
    parts.push(
      `<table class="t"><tr><th>derived column</th><th>status</th><th>trace</th><th>mode</th><th>common</th><th>diffs</th><th>max |d|</th><th>samples</th></tr>${c.columns
        .map((r) => `<tr><td>${esc(r.column)}</td><td>${badge(r.status)}</td><td>${esc(r.trace ?? '')}</td><td>${esc(r.mode ?? '')}</td><td>${r.common ?? ''}</td><td>${r.nDiff ?? ''}</td><td>${r.maxAbs ?? ''}</td><td>${code(r.issue ?? r.samples ?? [], 200)}</td></tr>`)
        .join('')}</table>`,
    )
  }
  const net = [...(c.network?.A ?? []).map((u) => `web/ ${u}`), ...(c.network?.B ?? []).map((u) => `web-next ${u}`)]
  if (net.length) parts.push(`<div class="sd"><b>non-2xx requests / console errors</b><br>${net.map((u) => code(u, 300)).join('<br>')}</div>`)
  const shots = (item.shots ?? []).filter(Boolean)
  if (shots.length) parts.push(`<p>screenshots: ${shots.map((s) => `<a href="${esc(relative(outDir, s))}">${esc(s.split('/').pop())}</a>`).join(' · ')}</p>`)
  if (item.urls) parts.push(`<p>urls: ${item.urls.filter(Boolean).map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ')}</p>`)
  return parts.join('\n')
}

export function renderReport(runs, outFile, meta = {}) {
  const outDir = dirname(outFile)
  const sections = runs
    .map((run) => {
      const stations = [...new Set(run.items.map((i) => i.station))]
      const scenarios = [...new Set(run.items.map((i) => i.scenario))]
      const get = (st, sc) => run.items.find((i) => i.station === st && i.scenario === sc)
      const counts = run.items.reduce((m, i) => ((m[i.status] = (m[i.status] ?? 0) + 1), m), {})
      const id = (it) => `${run.compare}-${it.station}-${it.scenario}`
      const matrix = `<div class="scroll"><table class="m"><tr><th>scenario \\ station</th>${stations.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>${scenarios
        .map((sc) => `<tr><th>${esc(sc)}</th>${stations.map((st) => {
          const it = get(st, sc)
          return `<td>${it ? `<a href="#${esc(id(it))}">${badge(it.status)}</a>` : ''}</td>`
        }).join('')}</tr>`)
        .join('')}</table></div>`
      const items = run.items
        .map((it) => `<details id="${esc(id(it))}"><summary>${badge(it.status)} <b>${esc(it.station)}</b> · ${esc(it.scenario)}${it.summary ? ` — ${esc(it.summary)}` : ''}</summary>${details(it, outDir)}</details>`)
        .join('\n')
      return `<section><h2>${esc(run.compare)}</h2><p class="meta">A = ${esc(run.A)}<br>B = ${esc(run.B)}<br>started ${esc(run.started)} · ${Object.entries(counts)
        .map(([k, v]) => `${badge(k)} ${v}`)
        .join(' ')}</p>${run.notes ? `<p>${esc(run.notes)}</p>` : ''}${matrix}${items}</section>`
    })
    .join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>web-next Fidelity Report</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6470;--line:#d8dde3;--card:#f6f8fa;--pass:#1a7f37;--warn:#9a6700;--fail:#cf222e;--err:#6e40c9;--doc:#0969da}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--card:#161b22;--pass:#238636;--warn:#9e6a03;--fail:#da3633;--err:#8957e5;--doc:#1f6feb}}
:root[data-theme="dark"]{--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--card:#161b22;--pass:#238636;--warn:#9e6a03;--fail:#da3633;--err:#8957e5;--doc:#1f6feb}
body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;margin:0 auto;padding:16px;max-width:1400px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;border-bottom:1px solid var(--line);padding-bottom:4px;margin-top:28px} h5{margin:10px 0 4px;font-size:13px}
.meta{color:var(--muted);font-size:12px} a{color:inherit}
table{border-collapse:collapse;margin:6px 0} .scroll{overflow-x:auto} th,td{border:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top}
.t{font-size:12px;display:block;overflow-x:auto} code{font-size:11px;word-break:break-all}
.b{display:inline-block;padding:0 6px;border-radius:9px;font-size:11px;font-weight:600;color:#fff}
.PASS{background:var(--pass)}.WARN{background:var(--warn)}.FAIL{background:var(--fail)}.ERROR{background:var(--err)}.DOCUMENTED{background:var(--doc)}
details{background:var(--card);border:1px solid var(--line);border-radius:6px;margin:6px 0;padding:4px 8px} summary{cursor:pointer}
.sd{margin:4px 0;font-size:12px}
</style></head><body>
<h1>web-next fidelity report</h1>
<p class="meta">generated ${esc(new Date().toISOString())}${meta.note ? ` · ${esc(meta.note)}` : ''}. A = web/ (React, Plotly), B = web-next (Alpine, ECharts), same API and level 2, 1440 px, light theme. PASS everything web-next draws matches · DOCUMENTED compared content differs on purpose (a renamed row, redesigned card text), citing DIVERGENCES · moved parts (web/ figures or cards this web-next page does not draw by design) are listed per item, citing DIVERGENCES, and not scored · WARN label wording, edge-only point differences (captures seconds apart), advisory card text, off-palette colors · FAIL missing/extra traces, interior value differences, sensor spans, CSV rows/values · ERROR a side failed to load. Colors are not compared between apps (house palette); web-next data colors are checked against core/palette.</p>
${sections}
</body></html>`
}
