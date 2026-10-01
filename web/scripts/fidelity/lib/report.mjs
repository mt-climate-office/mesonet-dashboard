// Self-contained HTML report: one matrix per comparison (scenario x station)
// with expandable details. Screenshots are linked relatively (not embedded)
// to keep the file small.
import { relative, dirname } from 'node:path'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const badge = (s) => `<span class="b ${esc(s)}">${esc(s)}</span>`

function traceRows(plot) {
  const bad = (plot.traces ?? []).filter((t) => t.status !== 'PASS')
  if (!bad.length) return ''
  return `<table class="t"><tr><th>trace</th><th>status</th><th>A/B pts</th><th>only A/B (interior)</th><th>diffs</th><th>max |d|</th><th>samples / note</th></tr>${bad
    .map(
      (t) =>
        `<tr><td>${esc(t.key)}${t.labelDiff ? `<br><small>B: ${esc(t.labelDiff.b)}</small>` : ''}</td><td>${badge(t.status)}</td><td>${t.nA ?? ''}/${t.nB ?? ''}</td><td>${
          t.onlyA ?? ''
        }/${t.onlyB ?? ''} (${(t.onlyInteriorA ?? []).length}/${(t.onlyInteriorB ?? []).length})</td><td>${t.nDiff ?? ''}${
          t.nullMismatch ? ` +${t.nullMismatch} null` : ''
        }</td><td>${t.maxAbs ?? ''}</td><td><code>${esc(t.issue ?? JSON.stringify(t.samples ?? []).slice(0, 300))}</code></td></tr>`,
    )
    .join('')}</table>`
}

function setDiffHtml(label, d) {
  if (!d || (!d.onlyA?.length && !d.onlyB?.length)) return ''
  return `<div class="sd"><b>${esc(label)}</b> only A: <code>${esc((d.onlyA ?? []).join(' | ').slice(0, 800))}</code><br>only B: <code>${esc(
    (d.onlyB ?? []).join(' | ').slice(0, 800),
  )}</code></div>`
}

function cellDetails(item, outDir) {
  const c = item.comparison ?? {}
  const parts = []
  if (c.error || item.error) parts.push(`<pre>${esc(JSON.stringify(c.error ?? item.error, null, 1))}</pre>`)
  if (c.issue) parts.push(`<p>${esc(c.issue)}</p>`)
  for (const p of c.plots ?? []) {
    parts.push(
      `<h5>plot: ${esc(p.role)} ${badge(p.status)} ${p.issue ? esc(p.issue) : `traces A=${p.nTracesA} B=${p.nTracesB}; shapes A=${p.shapes?.nA} B=${p.shapes?.nB}`}</h5>`,
    )
    parts.push(traceRows(p))
    parts.push(setDiffHtml('axis titles', p.axes))
    parts.push(setDiffHtml('annotations', p.annotations))
    parts.push(setDiffHtml('shapes (sensor overlays)', p.shapes))
  }
  for (const [k, cd] of Object.entries(c.cards ?? {})) {
    if (cd.status === 'PASS') continue
    parts.push(`<h5>card: ${esc(k)} ${badge(cd.status)} ${esc(cd.note ?? '')}</h5>`)
    parts.push(setDiffHtml('text lines', cd))
    if (cd.valueDiffs?.length)
      parts.push(`<div class="sd"><b>value diffs</b> <code>${esc(cd.valueDiffs.map((v) => `${v.key}: ${v.a} vs ${v.b}`).join(' | '))}</code></div>`)
    if (cd.brokenImages) parts.push(`<div class="sd">broken images: <code>${esc(JSON.stringify(cd.brokenImages))}</code></div>`)
  }
  // downloader
  if (c.filename) {
    parts.push(
      `<p>filename A=<code>${esc(c.filename.A)}</code> B=<code>${esc(c.filename.B)}</code>; rows A=${c.rows.A} B=${c.rows.B}</p>`,
    )
  }
  if (c.rows && !c.filename) parts.push(`<p>rows A=${c.rows.A} B=${c.rows.B}${c.ms ? `; ms A=${c.ms.A} B=${c.ms.B}` : ''}</p>`)
  if (c.columns && !Array.isArray(c.columns)) parts.push(setDiffHtml('columns', c.columns))
  for (const v of c.valueDiffs ?? [])
    parts.push(
      `<div class="sd">${badge(v.status)} <b>${esc(v.column)}</b> pts A/B=${v.nA}/${v.nB} edge-only A/B=${v.edgeOnlyA}/${v.edgeOnlyB} interior-only A/B=${(v.onlyInteriorA ?? []).length}/${(v.onlyInteriorB ?? []).length} diffs=${v.nDiff} null=${v.nullMismatch} max=${v.maxAbs} <code>${esc(JSON.stringify(v.samples).slice(0, 300))}</code></div>`,
    )
  // ag
  if (c.columns && Array.isArray(c.columns)) {
    parts.push(`<p>derived: <a href="${esc(c.url)}">${esc(c.url)}</a> rows=${c.derivedRows}</p>`)
    parts.push(
      `<table class="t"><tr><th>derived column</th><th>status</th><th>matched trace</th><th>mode</th><th>common</th><th>diffs</th><th>max |d|</th><th>samples</th></tr>${c.columns
        .map(
          (r) =>
            `<tr><td>${esc(r.column)}</td><td>${badge(r.status)}</td><td>${esc(r.trace ?? '')}</td><td>${esc(r.mode ?? '')}</td><td>${r.common ?? ''}</td><td>${
              r.nDiff ?? ''
            }</td><td>${r.maxAbs ?? ''}</td><td><code>${esc(r.issue ?? JSON.stringify(r.samples ?? []).slice(0, 200))}</code></td></tr>`,
        )
        .join('')}</table>`,
    )
  }
  const bad = [...(c.network?.A ?? []).map((u) => `A ${u}`), ...(c.network?.B ?? []).map((u) => `B ${u}`), ...(c.bad ?? []).map((u) => `new ${u}`)]
  if (bad.length) parts.push(`<div class="sd"><b>non-2xx requests</b><br><code>${bad.map(esc).join('<br>')}</code></div>`)
  if (c.alerts?.length) parts.push(`<div class="sd"><b>alerts</b> <code>${esc(c.alerts.join(' | '))}</code></div>`)
  const shots = (item.shots ?? []).filter(Boolean)
  if (shots.length)
    parts.push(`<p>screenshots: ${shots.map((s) => `<a href="${esc(relative(outDir, s))}">${esc(s.split('/').pop())}</a>`).join(' · ')}</p>`)
  if (item.urls) parts.push(`<p>urls: ${item.urls.map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ')}</p>`)
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
      const matrix = `<table class="m"><tr><th>scenario \\ station</th>${stations.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>${scenarios
        .map(
          (sc) =>
            `<tr><th>${esc(sc)}</th>${stations
              .map((st) => {
                const it = get(st, sc)
                return `<td>${it ? `<a href="#${esc(`${run.compare}-${st}-${sc}`)}">${badge(it.status)}</a>` : ''}</td>`
              })
              .join('')}</tr>`,
        )
        .join('')}</table>`
      const details = run.items
        .map(
          (it) =>
            `<details id="${esc(`${run.compare}-${it.station}-${it.scenario}`)}"${it.status === 'PASS' ? '' : ''}><summary>${badge(it.status)} <b>${esc(
              it.station,
            )}</b> · ${esc(it.scenario)} ${it.summary ? `— ${esc(it.summary)}` : ''}</summary>${cellDetails(it, outDir)}</details>`,
        )
        .join('\n')
      return `<section><h2>${esc(run.compare)}</h2><p class="meta">A = ${esc(run.A)}<br>B = ${esc(run.B)}<br>started ${esc(run.started)} · ${Object.entries(
        counts,
      )
        .map(([k, v]) => `${badge(k)} ${v}`)
        .join(' ')}</p>${run.notes ? `<p>${esc(run.notes)}</p>` : ''}${matrix}${details}</section>`
    })
    .join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mesonet Fidelity Report</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6470;--line:#d8dde3;--card:#f6f8fa;--pass:#1a7f37;--warn:#9a6700;--fail:#cf222e;--err:#6e40c9}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--card:#161b22;--pass:#3fb950;--warn:#d29922;--fail:#f85149;--err:#a371f7}}
:root[data-theme="dark"]{--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--card:#161b22;--pass:#3fb950;--warn:#d29922;--fail:#f85149;--err:#a371f7}
body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:16px;max-width:1400px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;border-bottom:1px solid var(--line);padding-bottom:4px;margin-top:28px} h5{margin:10px 0 4px;font-size:13px}
.meta{color:var(--muted);font-size:12px} a{color:inherit}
table{border-collapse:collapse;margin:6px 0} .m{overflow-x:auto;display:block} th,td{border:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top}
.t{font-size:12px;display:block;overflow-x:auto} code{font-size:11px;word-break:break-all}
.b{display:inline-block;padding:0 6px;border-radius:9px;font-size:11px;font-weight:600;color:#fff}
.PASS{background:var(--pass)}.WARN{background:var(--warn)}.FAIL{background:var(--fail)}.ERROR{background:var(--err)}
details{background:var(--card);border:1px solid var(--line);border-radius:6px;margin:6px 0;padding:4px 8px} summary{cursor:pointer}
.sd{margin:4px 0;font-size:12px}
</style></head><body>
<h1>Mesonet dashboard fidelity report</h1>
<p class="meta">generated ${esc(new Date().toISOString())}${meta.note ? ` · ${esc(meta.note)}` : ''}. Status: PASS identical within tolerance · WARN edge-only point differences (capture-time skew) or label wording · FAIL missing/extra traces or interior value differences · ERROR a side failed to load.</p>
${sections}
</body></html>`
}
