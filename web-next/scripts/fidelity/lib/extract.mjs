// In-page extractors. Both return figures in one shape so compare.mjs can diff Plotly (web/)
// against ECharts (web-next):
//   { host, source, title, panels[], traces[{ panel, name, id, kind, aux, x[], y[], notes?, color }],
//     spans[{ x0, x1 }], refs[{ name, y }], texts[], legend[] }
// panel = the y-axis title ("polar" for the wind rose); x = wall-clock 'YYYY-MM-DDTHH:MM' (time axes),
// numbers (value axes) or category labels. The functions run in the browser: no closures, no imports.

/** web/: every `.js-plotly-plot` (gd.data + gd._fullLayout). */
export function extractPlotly(page) {
  return page.evaluate(() => {
    const arr = (v) => (v == null ? [] : ArrayBuffer.isView(v) ? Array.from(v) : Array.isArray(v) ? v : [])
    const strip = (s) => (s == null ? '' : String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    const title = (t) => strip(t == null ? '' : typeof t === 'string' ? t : t.text)
    const host = (gd) => {
      for (let el = gd; el && el !== document.body; el = el.parentElement) if (el.dataset?.testid) return el.dataset.testid
      return ''
    }
    return [...document.querySelectorAll('.js-plotly-plot')]
      .filter((gd) => gd.data && gd._fullLayout && gd.getBoundingClientRect().height > 0)
      .map((gd) => {
        const L = gd._fullLayout
        const axisTitle = (ref) => title(L[`yaxis${ref && ref !== 'y' ? ref.slice(1) : ''}`]?.title)
        const panels = Object.keys(L)
          .filter((k) => /^yaxis\d*$/.test(k))
          .map((k) => title(L[k].title))
          .filter((t) => t && !/^Click to enter/.test(t))
        const traces = []
        gd.data.forEach((t, i) => {
          const base = {
            id: String(i),
            kind: t.type ?? 'scatter',
            hidden: t.visible === false || t.visible === 'legendonly',
            helper: t.showlegend === false && /rgba\(0, ?0, ?0, ?0\)/.test(String(t.line?.color ?? '')),
            fill: t.fill,
            color: typeof t.marker?.color === 'string' ? t.marker.color : t.line?.color,
          }
          if (t.type === 'barpolar') {
            traces.push({ ...base, panel: 'polar', name: strip(t.name), x: arr(t.theta).map(String), y: arr(t.r) })
          } else if (t.type === 'heatmap') {
            const ys = arr(t.y)
            const xs = arr(t.x)
            arr(t.z).forEach((row, j) => {
              const frozen = /frozen/i.test(t.name ?? '')
              const vals = arr(row).map((v) => (v == null || Number.isNaN(v) ? null : frozen ? 1 : v))
              traces.push({ ...base, panel: axisTitle(t.yaxis), name: `${frozen ? 'frozen|' : ''}${strip(ys[j] ?? j)}`, x: xs, y: vals })
            })
          } else {
            const notes = arr(t.customdata)
            traces.push({
              ...base,
              panel: axisTitle(t.yaxis),
              name: strip(t.name),
              x: arr(t.x),
              y: arr(t.y),
              notes: notes.length && notes.some((n) => typeof n === 'string') ? notes.map((n) => (n == null ? null : String(n))) : undefined,
            })
          }
        })
        const spans = (L.shapes ?? [])
          // sensor spans: data-x rects spanning the panel height (yref 'paper' or 'y3 domain')
          .filter((s) => s.type === 'rect' && /^x\d*$/.test(String(s.xref ?? 'x')) && /paper|domain/.test(String(s.yref ?? '')))
          .map((s) => ({ x0: String(s.x0), x1: String(s.x1) }))
        return {
          host: host(gd),
          source: 'plotly',
          title: title(L.title),
          panels,
          traces,
          spans,
          refs: [],
          texts: (L.annotations ?? []).map((a) => strip(a.text)).filter(Boolean),
          legend: traces.filter((t) => !t.hidden && t.name).map((t) => t.name),
        }
      })
  })
}

/**
 * web-next: every chart host (`.chart`, ui/charts/chart.ts) via
 * `echarts.getInstanceByDom(canvas).getOption()`. The ECharts module is the one chart.ts
 * lazy-loaded (same Vite dev URL, so the same instance registry; nothing new is global). Its
 * resource-timing entry gives the exact URL, else the dev path under `base`: the timing buffer
 * (250 entries) can fill with map tiles before a lazy chart loads (Download's preview).
 * Without an instance (e.g. a production build) it falls back to the host's sr-only table twin.
 */
export function extractECharts(page, base) {
  return page.evaluate(async (base) => {
    const url =
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((n) => /\/ui\/charts\/echarts\.ts(\?|$)/.test(n)) ?? `${new URL(base).pathname}src/ui/charts/echarts.ts`
    let lib = null
    try {
      lib = url ? (await import(url)).echarts : null
    } catch {
      lib = null
    }
    const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16) : null)
    const host = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) if (e.dataset?.testid) return e.dataset.testid
      return ''
    }
    const texts = (g, out = []) => {
      for (const x of Array.isArray(g) ? g : g ? [g] : []) {
        if (x?.style?.text != null) out.push(String(x.style.text))
        if (x?.children) texts(x.children, out)
        if (x?.elements) texts(x.elements, out)
      }
      return out
    }
    const tableTwin = (h) => {
      const t = h.querySelector('.chart-table table')
      if (!t) return null
      const cols = [...t.querySelectorAll('thead th')].map((c) => c.textContent.trim())
      const rows = [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim()))
      return { caption: t.caption?.textContent ?? '', cols, rows }
    }
    const out = []
    for (const h of document.querySelectorAll('.chart')) {
      const canvas = h.querySelector('.chart-canvas')
      if (!canvas || canvas.getBoundingClientRect().height === 0) continue
      const inst = lib && lib.getInstanceByDom(canvas)
      if (!inst) {
        const tw = tableTwin(h)
        if (!tw) continue
        // sr-only fallback: one trace per column, x = the first column's text.
        out.push({
          host: host(h),
          source: 'table',
          zoom: h.dataset.zoom ?? null,
          title: tw.caption,
          panels: [],
          traces: tw.cols.slice(1).map((c, i) => ({
            panel: '',
            name: c,
            id: c,
            kind: 'table',
            x: tw.rows.map((r) => r[0]),
            y: tw.rows.map((r) => (r[i + 1] === '—' ? null : Number.isFinite(Number(r[i + 1])) ? Number(r[i + 1]) : r[i + 1])),
          })),
          spans: [],
          refs: [],
          texts: [],
          legend: [],
        })
        continue
      }
      const o = inst.getOption()
      const xAxes = o.xAxis ?? []
      const yAxes = o.yAxis ?? []
      const yName = (i) => String(yAxes[i ?? 0]?.name ?? '').replace(/\s+/g, ' ').trim()
      const xval = (ax, v) => (ax?.type === 'time' || (ax?.type === 'category' && typeof v === 'number' && v > 1e11) ? iso(v) : v)
      const stacks = new Map()
      const traces = []
      const spans = []
      const refs = []
      for (const s of o.series ?? []) {
        const id = String(s.id ?? '')
        const aux = id.startsWith('aux:')
        const color = typeof s.color === 'string' ? s.color : s.itemStyle?.color ?? s.lineStyle?.color
        const base = { id, kind: s.type, aux, color: typeof color === 'string' ? color : undefined }
        for (const m of s.markLine?.data ?? []) {
          const y = Array.isArray(m) ? m[0]?.yAxis : m?.yAxis
          if (y != null) refs.push({ name: String((Array.isArray(m) ? m[0]?.name : m?.name) ?? ''), y: Number(y), series: s.name })
        }
        for (const m of s.markArea?.data ?? []) {
          if (Array.isArray(m)) refs.push({ name: String(m[0]?.name ?? ''), y: Number(m[0]?.yAxis), y1: Number(m[1]?.yAxis), series: s.name })
        }
        if (s.type === 'custom' && /sensor/.test(id)) {
          for (const d of s.data ?? []) spans.push({ x0: iso(d[0]), x1: iso(d[1]), text: d[2] })
          continue
        }
        if (s.coordinateSystem === 'polar' || (o.polar?.length && s.type === 'bar')) {
          const cats = (o.angleAxis?.[0]?.data ?? []).map((c) => (typeof c === 'object' ? c.value : c))
          traces.push({ ...base, panel: 'polar', name: String(s.name ?? ''), x: cats.map(String), y: (s.data ?? []).map((d) => (typeof d === 'object' && d ? d.value : d)) })
          continue
        }
        const xa = xAxes[s.xAxisIndex ?? 0]
        const ya = yAxes[s.yAxisIndex ?? 0]
        if (s.type === 'heatmap' || (s.type === 'custom' && ya?.type === 'category')) {
          const xc = xa?.data ?? []
          const yc = (ya?.data ?? []).map((c) => (typeof c === 'object' ? c.value : c))
          const frozen = s.type === 'custom'
          const rows = yc.map(() => new Array(xc.length).fill(null))
          for (const d of s.data ?? []) {
            const v = Array.isArray(d) ? d : d?.value
            if (!v) continue
            rows[v[1]][v[0]] = frozen ? 1 : v[2] ?? null
          }
          yc.forEach((label, j) =>
            traces.push({ ...base, panel: yName(s.yAxisIndex), name: `${frozen ? 'frozen|' : ''}${label}`, x: xc.map((c) => xval(xa, c)), y: rows[j] }),
          )
          continue
        }
        const xs = []
        const ys = []
        const notes = []
        ;(s.data ?? []).forEach((d, i) => {
          const v = Array.isArray(d) ? d : d && typeof d === 'object' ? d.value : d
          if (Array.isArray(v)) {
            xs.push(xval(xa, v[0]))
            ys.push(v[1] ?? null)
            notes.push(v[2] == null ? null : String(v[2]))
          } else {
            xs.push(xval(xa, xa?.data?.[i] ?? i))
            ys.push(v ?? null)
            notes.push(null)
          }
        })
        // A stacked series draws on top of the earlier ones: report the absolute (drawn) values.
        if (s.stack) {
          const acc = stacks.get(s.stack) ?? new Map()
          ys.forEach((y, i) => {
            const prev = acc.get(xs[i]) ?? 0
            if (y != null) {
              ys[i] = prev + y
              acc.set(xs[i], ys[i])
            }
          })
          stacks.set(s.stack, acc)
        }
        traces.push({
          ...base,
          panel: yName(s.yAxisIndex),
          name: String(s.name ?? ''),
          x: xs,
          y: ys,
          notes: notes.some((n) => n != null) ? notes : undefined,
        })
      }
      const legend = (o.legend ?? []).flatMap((l) => (l.data ?? []).map((d) => (typeof d === 'object' ? d.name : d)))
      out.push({
        host: host(h),
        source: 'echarts',
        zoom: h.dataset.zoom ?? null,
        title: String((o.title?.[0]?.text ?? '') || ''),
        panels: yAxes.map((a) => String(a.name ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean),
        traces,
        spans,
        refs,
        texts: texts(o.graphic ?? []),
        legend,
        visualColors: (o.visualMap ?? []).flatMap((v) => v.inRange?.color ?? []),
      })
    }
    return out
  }, base)
}

/**
 * Card / table / text extractor (both apps). `sel` maps a name to a CSS selector. Visible text only
 * (sr-only twins, hidden templates and closed switchers are skipped); tables as cell rows.
 */
export function extractCards(page, sel) {
  return page.evaluate((sel) => {
    // Charts and maps are compared as data (extractPlotly / extractECharts / extractMap), and select
    // options separately, so their text is not card text.
    // Control labels, date pickers and the map legend are UI chrome; the wind-rose title is checked
    // against web/'s Plotly title separately.
    const SKIP =
      'svg, .js-plotly-plot, .chart, .maplibregl-map, .mco-panel, select, .ctl-label, .mantine-InputWrapper-label, .sr-only, template, legend, [class*="DatePickerInput"], [class*="DateInput"], [data-testid="wind-rose-title"]'
    const hidden = (el, skip = SKIP) => {
      if (el?.closest?.(skip)) return true
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden') return true
      }
      return false
    }
    const visibleText = (root) => {
      const parts = []
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent.replace(/\s+/g, ' ').trim()
        if (t && !hidden(n.parentElement)) parts.push(t)
      }
      return parts
    }
    const out = {}
    for (const [k, s] of Object.entries(sel)) {
      const el = document.querySelector(s)
      if (!el) {
        out[k] = null
        continue
      }
      out[k] = {
        lines: visibleText(el),
        titles: [...el.querySelectorAll('h2, h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
        tables: [...el.querySelectorAll('table')]
          .filter((t) => !hidden(t))
          // Header rows name the columns (About's "Reading | Value"); they are not label/value rows.
          // A cell with data-col (About's plain-label readings) is keyed by its API column, as web/ labels it.
          .map((t) => [...t.querySelectorAll('tr')].filter((tr) => !tr.closest('thead')).map((tr) => [...tr.children].map((c) => c.dataset.col ?? visibleText(c).join(' ')))),
        // A lazy image that has not loaded yet is not broken: only a finished load with no pixels is.
        images: [...el.querySelectorAll('img')].filter((i) => !hidden(i)).map((i) => ({ src: i.currentSrc || i.src, ok: !(i.complete && i.naturalWidth === 0), loaded: i.complete && i.naturalWidth > 0 })),
        links: [...el.querySelectorAll('a[href]')].filter((a) => !hidden(a)).map((a) => a.href),
        options: [...el.querySelectorAll('select')].filter((x) => !hidden(x, '.sr-only, template')).map((x) => [...x.options].map((o) => o.textContent.trim())),
      }
    }
    return out
  }, sel)
}

/** web-next map host: the station rows of its sr-only table twin (ui/map/srTable.ts). */
export function extractMap(page, sel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel)
    if (!root) return null
    const rows = [...root.querySelectorAll('.sr-only table tbody tr')].map((tr) => {
      const b = tr.querySelector('button')
      const cells = [...tr.children].map((c) => c.textContent.trim())
      return { id: b?.dataset.id ?? null, name: cells[0], network: cells[1], county: cells[2], current: b?.getAttribute('aria-current') === 'true' }
    })
    return { caption: root.querySelector('.sr-only table caption')?.textContent ?? '', rows, canvas: !!root.querySelector('canvas') }
  }, sel)
}

/**
 * The palette colors web-next may use for data in the light theme: every color reachable from
 * core/palette for 'light' (ramps, roles, sampled ramps, token roles resolved on the page).
 * Loaded from the Vite dev server, like the ECharts module; null when unavailable (built app).
 */
export function paletteColors(page, base) {
  return page.evaluate(async (base) => {
    let P
    try {
      P = await import(`${new URL(base).pathname}src/core/palette/index.ts`)
    } catch {
      return null
    }
    const theme = 'light'
    const css = getComputedStyle(document.documentElement)
    const set = new Set()
    const add = (c) => {
      if (typeof c === 'string' && /^#|^rgb/i.test(c.trim())) set.add(c.trim().toLowerCase())
    }
    const walk = (v, depth = 0) => {
      if (depth > 6 || v == null) return
      if (typeof v === 'string') return add(v)
      if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1))
      if (typeof v === 'object') {
        if (typeof v.token === 'string') return add(css.getPropertyValue(v.token))
        const keys = Object.keys(v)
        if (keys.includes('light') && keys.includes('dark')) return walk(v[theme], depth + 1)
        keys.forEach((k) => walk(v[k], depth + 1))
      }
    }
    for (const v of Object.values(P)) if (typeof v !== 'function') walk(v)
    for (const d of [2, 4, 6, 8, 12, 20, 24, 28, 30, 36, 40]) add(P.depthColor?.(d, theme))
    for (let n = 1; n <= 16; n++) (P.binColors?.(n, theme) ?? []).forEach(add)
    for (let n = 1; n <= 40; n++) (P.yearColors?.(n, theme) ?? []).forEach(add)
    for (let i = 0; i < 64; i++) add(P.previewColor?.(i, theme))
    for (const side of ['cold', 'heat']) for (const c of P.CCI_CLASSES ?? []) add(P.cciStyle?.(c, side, theme)?.color)
    for (const v of P.STYLED_VARIABLES ?? []) add(P.variableStyle?.(v, theme)?.color)
    return [...set]
  }, base)
}
