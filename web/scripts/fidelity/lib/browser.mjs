// Playwright page instrumentation: console errors, network log, settle waits,
// and in-page extraction of Plotly figures + visible card/table text.
import { chromium } from 'playwright'
import { TIMEOUTS } from '../config.mjs'

export async function launch({ headless = true } = {}) {
  // FIDELITY_CHROMIUM=/path/to/chrome overrides; otherwise Playwright's bundled
  // build, falling back to the system Chrome channel if that isn't installed.
  if (process.env.FIDELITY_CHROMIUM) return chromium.launch({ headless, executablePath: process.env.FIDELITY_CHROMIUM })
  try {
    return await chromium.launch({ headless })
  } catch (e) {
    console.warn(`bundled chromium unavailable (${String(e.message).split('\n')[0]}); trying channel=chrome`)
    return chromium.launch({ headless, channel: 'chrome' })
  }
}

/**
 * Open an instrumented page. Returns { page, log } where log collects
 * console errors, page errors and every xhr/fetch/document request + status.
 */
export async function openPage(browser, { viewport = { width: 1440, height: 1000 } } = {}) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const log = { console: [], pageErrors: [], requests: [], inflight: 0, lastActivity: Date.now() }
  const tracked = (req) => ['xhr', 'fetch', 'document', 'image'].includes(req.resourceType())
  const live = new Set()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push({ type: m.type(), text: m.text().slice(0, 500) })
  })
  page.on('pageerror', (e) => log.pageErrors.push(String(e?.message ?? e).slice(0, 500)))
  page.on('request', (req) => {
    if (!tracked(req)) return
    live.add(req)
    log.inflight = live.size
    log.lastActivity = Date.now()
  })
  const done = async (req, failed) => {
    if (!live.has(req)) return
    live.delete(req)
    log.inflight = live.size
    log.lastActivity = Date.now()
    let status = 0
    let ms = null
    try {
      const res = failed ? null : await req.response()
      status = res?.status() ?? 0
      const t = req.timing()
      ms = t.responseEnd > 0 ? Math.round(t.responseEnd) : null
    } catch {
      /* ignore */
    }
    log.requests.push({
      url: req.url(),
      method: req.method(),
      type: req.resourceType(),
      status,
      failed: failed ? req.failure()?.errorText ?? 'failed' : undefined,
      ms,
    })
  }
  page.on('requestfinished', (r) => done(r, false))
  page.on('requestfailed', (r) => done(r, true))
  return { ctx, page, log }
}

/**
 * Wait until no tracked request has been in flight for `quiet` ms.
 * (Dash's DashShare interval is disabled/max_intervals=1, so this terminates;
 * still bounded by `timeout`.)
 */
export async function settle(log, { quiet = TIMEOUTS.settleQuiet, timeout = TIMEOUTS.plot } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (log.inflight === 0 && Date.now() - log.lastActivity >= quiet) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

/** Wait until a Plotly graph under `sel` has at least one trace. */
export async function waitForPlot(page, sel, timeout = TIMEOUTS.plot) {
  await page.waitForFunction(
    (s) => {
      const gd = document.querySelector(`${s} .js-plotly-plot`) ?? document.querySelector(`${s}.js-plotly-plot`)
      return !!(gd && gd.data && gd.data.length && gd._fullLayout)
    },
    sel,
    { timeout, polling: 250 },
  )
}

/** Remember the current gd.data object for `sel` so we can detect a re-render. */
export async function markPlot(page, sel) {
  await page.evaluate((s) => {
    const gd = document.querySelector(`${s} .js-plotly-plot`)
    window.__fidPrev = window.__fidPrev ?? {}
    window.__fidPrev[s] = gd ? gd.data : null
  }, sel)
}

export async function waitPlotChanged(page, sel, timeout = TIMEOUTS.plot) {
  await page.waitForFunction(
    (s) => {
      const gd = document.querySelector(`${s} .js-plotly-plot`)
      return !!(gd && gd.data && gd.data.length && gd.data !== (window.__fidPrev ?? {})[s])
    },
    sel,
    { timeout, polling: 250 },
  )
}

/**
 * In-page extractor. Serializes every `.js-plotly-plot` (gd.data + the
 * layout bits we compare), visible tables, and card text for given selectors.
 * Runs inside the browser; keep it dependency-free.
 */
export async function extract(page, { cardSelectors = {} } = {}) {
  return page.evaluate((cardSelectors) => {
    const arr = (v) => {
      if (v == null) return v
      if (ArrayBuffer.isView(v)) return Array.from(v)
      if (Array.isArray(v)) return v.map((x) => (ArrayBuffer.isView(x) ? Array.from(x) : x))
      if (typeof v === 'object' && v.bdata) return { bdata: true, dtype: v.dtype } // shouldn't happen post-render
      return v
    }
    const txt = (t) => (t == null ? null : typeof t === 'string' ? t : t.text ?? null)
    const strip = (s) => (s == null ? null : String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    const describeHost = (gd) => {
      const ids = []
      let el = gd
      while (el && el !== document.body && ids.length < 4) {
        if (el.id) ids.push(el.id)
        if (el.dataset?.testid) ids.push(`testid:${el.dataset.testid}`)
        el = el.parentElement
      }
      return ids
    }
    const plots = [...document.querySelectorAll('.js-plotly-plot')]
      .filter((gd) => gd.data)
      .map((gd, i) => {
        const L = gd._fullLayout ?? gd.layout ?? {}
        const axes = {}
        for (const k of Object.keys(L)) {
          if (!/^[xy]axis\d*$/.test(k) && !/^polar\d*$/.test(k)) continue
          const a = L[k]
          axes[k] = {
            title: strip(txt(a.title)),
            domain: a.domain,
            type: a.type,
            range: a.range ? a.range.map(String) : undefined,
            visible: a.visible,
          }
        }
        const annotations = (L.annotations ?? []).map((a) => ({
          text: strip(a.text),
          x: a.x,
          y: a.y,
          xref: a.xref,
          yref: a.yref,
        }))
        const shapes = (L.shapes ?? []).map((s) => ({
          type: s.type,
          x0: String(s.x0),
          x1: String(s.x1),
          y0: s.y0,
          y1: s.y1,
          xref: s.xref,
          yref: s.yref,
          fillcolor: s.fillcolor,
          opacity: s.opacity,
        }))
        const traces = gd.data.map((t, ti) => ({
          index: ti,
          type: t.type ?? 'scatter',
          name: strip(t.name) ?? '',
          mode: t.mode,
          xaxis: t.xaxis ?? 'x',
          yaxis: t.yaxis ?? 'y',
          visible: t.visible,
          showlegend: t.showlegend,
          legendgroup: t.legendgroup,
          x: arr(t.x),
          y: arr(t.y),
          z: arr(t.z),
          r: arr(t.r),
          theta: arr(t.theta),
          text: Array.isArray(t.text) ? t.text.slice(0, 5) : t.text,
          hovertemplate: t.hovertemplate,
          color: t.marker?.color && typeof t.marker.color === 'string' ? t.marker.color : t.line?.color,
        }))
        const rect = gd.getBoundingClientRect()
        return {
          i,
          host: describeHost(gd),
          visibleOnScreen: rect.width > 0 && rect.height > 0,
          title: strip(txt(L.title)),
          axes,
          annotations,
          shapes,
          traces,
        }
      })
    const tables = [...document.querySelectorAll('table')]
      .filter((t) => t.getBoundingClientRect().height > 0)
      .map((t) => [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.innerText.trim())))
    const cards = {}
    for (const [k, sel] of Object.entries(cardSelectors)) {
      const el = document.querySelector(sel)
      cards[k] = el
        ? {
            text: el.innerText.replace(/\s+\n/g, '\n').trim().slice(0, 4000),
            images: [...el.querySelectorAll('img')].map((im) => ({ src: im.src, ok: im.complete && im.naturalWidth > 0 })),
            iframes: [...el.querySelectorAll('iframe')].map((f) => f.src),
          }
        : null
    }
    return {
      url: location.href,
      title: document.title,
      plots,
      tables,
      cards,
      bodyText: document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 20000),
    }
  }, cardSelectors)
}
