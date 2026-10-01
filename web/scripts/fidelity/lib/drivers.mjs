// Target drivers: load a scenario on the legacy Dash app or the new React app
// and return a normalized capture { url, plots, cards, tables, log, shots, ... }.
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { legacyUrl, newAppUrl, TIMEOUTS } from '../config.mjs'
import { openPage, settle, waitForPlot, extract } from './browser.mjs'
import { ensureDir, slug } from './util.mjs'

/* ----------------------------------------------------------------------------
 * Plot roles: classify by content so legacy and new can be matched without
 * relying on DOM ids (the new app has none).
 * -------------------------------------------------------------------------- */
export function plotRole(p) {
  const types = new Set(p.traces.map((t) => t.type))
  if (types.has('barpolar') || Object.keys(p.axes).some((k) => k.startsWith('polar'))) return 'windrose'
  if ([...types].some((t) => /map|geo/.test(t))) return 'map'
  if (p.host.includes('station-data')) return 'timeseries'
  if (p.host.includes('dl-plots')) return 'downloader-preview'
  if (p.host.includes('derived-plot')) return 'ag'
  if (p.host.includes('download-map') || p.host.includes('station-fig')) return 'map'
  return 'timeseries'
}

const LEGACY_CARDS = { top: '#ul-content', bottom: '#bl-content', sidebar: '#sidebar-content' }
// New app: Paper containing the SegmentedControl with a given label.
const NEW_CARDS = {
  top: { segLabel: 'Wind', closest: '.mantine-Paper-root' },
  bottom: { segLabel: 'Map', closest: '.mantine-Paper-root' },
}

/** Resolve object-style card selectors inside the page into temp data attrs. */
async function tagCards(page, cards) {
  const css = {}
  for (const [k, sel] of Object.entries(cards)) {
    if (typeof sel === 'string') {
      css[k] = sel
      continue
    }
    const ok = await page.evaluate(
      ({ k, sel }) => {
        const lab = [...document.querySelectorAll('.mantine-SegmentedControl-label, label')].find(
          (l) => l.innerText.trim() === sel.segLabel,
        )
        const host = lab?.closest(sel.closest)
        if (host) host.setAttribute('data-fid-card', k)
        return !!host
      },
      { k, sel },
    )
    css[k] = ok ? `[data-fid-card="${k}"]` : '#__none__'
  }
  return css
}

async function shoot(page, outDir, name) {
  await ensureDir(outDir)
  const p = join(outDir, `${slug(name)}.png`)
  try {
    await page.screenshot({ path: p, fullPage: true, timeout: 30_000 })
    return p
  } catch {
    return null
  }
}

/* ----------------------------------------------------------------------------
 * Legacy (Dash) helpers
 * -------------------------------------------------------------------------- */

/**
 * Set props on a Dash component the way the renderer does (via the React
 * fiber's setProps). Used for dmc DatePickers / dropdowns that are painful to
 * drive by clicking. Returns false if the component isn't mounted.
 */
export async function dashSetProps(page, id, props) {
  return page.evaluate(
    ({ id, props }) => {
      const el = document.getElementById(id)
      if (!el) return false
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
      let f = key ? el[key] : null
      while (f) {
        const p = f.memoizedProps
        if (p && typeof p.setProps === 'function' && p.id === id) {
          p.setProps(props)
          return true
        }
        f = f.return
      }
      return false
    },
    { id, props },
  )
}

/** Read a Dash component's current props (value/data/checked) via the fiber. */
export async function dashGetProps(page, id) {
  return page.evaluate((id) => {
    const el = document.getElementById(id)
    if (!el) return null
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
    let f = key ? el[key] : null
    while (f) {
      const p = f.memoizedProps
      if (p && typeof p.setProps === 'function' && p.id === id) {
        const pick = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
        return { value: pick(p.value), data: pick(p.data), checked: pick(p.checked) }
      }
      f = f.return
    }
    return null
  }, id)
}

async function waitProps(page, id, pred, timeout = 60_000) {
  const t0 = Date.now()
  let last = null
  while (Date.now() - t0 < timeout) {
    last = await dashGetProps(page, id)
    if (last && pred(last)) return last
    await page.waitForTimeout(300)
  }
  return last
}

/** Signature of the parts of the page a step can change (to wait for a re-render). */
async function signature(page) {
  return page.evaluate(() => {
    const gds = [...document.querySelectorAll('.js-plotly-plot')]
    window.__fidSig = (window.__fidSig ?? 0) + 1
    gds.forEach((g) => {
      if (g.data && !g.data.__fid) Object.defineProperty(g.data, '__fid', { value: window.__fidSig, enumerable: false })
    })
    const html = ['#ul-content', '#bl-content', '#dl-plots', '#derived-plot']
      .map((s) => document.querySelector(s)?.innerHTML.length ?? -1)
      .join(',')
    return { html, tags: gds.map((g) => g.data?.__fid ?? 0).join(',') }
  })
}

async function waitChanged(page, before, timeout = 60_000) {
  try {
    await page.waitForFunction(
      (b) => {
        const gds = [...document.querySelectorAll('.js-plotly-plot')]
        const tags = gds.map((g) => g.data?.__fid ?? 0).join(',')
        const html = ['#ul-content', '#bl-content', '#dl-plots', '#derived-plot']
          .map((s) => document.querySelector(s)?.innerHTML.length ?? -1)
          .join(',')
        return tags !== b.tags || html !== b.html
      },
      before,
      { timeout, polling: 250 },
    )
    return true
  } catch {
    return false
  }
}

async function legacyStep(page, log, step) {
  const before = await signature(page)
  if (step.chip) {
    const [group, label] = step.chip
    const loc = page.locator(`#${group} label`).filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    if (await loc.count()) await loc.first().click()
    else await dashSetProps(page, group, { value: label.toLowerCase() })
  } else if (step.switch) {
    await page.waitForFunction((id) => !document.getElementById(id)?.disabled, step.switch, { timeout: 30_000 }).catch(() => {})
    const ok = await page
      .locator(`#${step.switch}`)
      .check({ force: true, timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    if (!ok) await dashSetProps(page, step.switch, { checked: true })
  } else if (step.seg) {
    const [group, label] = step.seg
    const loc = page.locator(`#${group} label`).filter({ hasText: label })
    await loc.first().click()
  } else if (step.setProps) {
    await dashSetProps(page, step.setProps[0], step.setProps[1])
  } else if (step.click) {
    await page.locator(step.click).first().click()
  }
  const changed = await waitChanged(page, before, step.waitMs ?? (step.seg ? 15_000 : 60_000))
  await settle(log)
  return changed
}

/** Load the Latest Data view for `station` on a legacy target and run `steps`. */
export async function captureLegacyLatest(browser, target, station, scenario, outDir) {
  const { ctx, page, log } = await openPage(browser)
  const t0 = Date.now()
  const res = { target: target.label, station, scenario: scenario.id, url: legacyUrl(target, station), steps: [] }
  try {
    await page.goto(res.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await waitForPlot(page, '#station-data')
    await settle(log)
    for (const step of scenario.legacy ?? []) res.steps.push({ step, changed: await legacyStep(page, log, step) })
    res.loadMs = Date.now() - t0
    const cards = await tagCards(page, LEGACY_CARDS)
    Object.assign(res, await extract(page, { cardSelectors: cards }))
    res.plots.forEach((p) => (p.role = plotRole(p)))
    res.shot = await shoot(page, outDir, `${station}-${scenario.id}-${target.kind}-${slug(target.base)}`)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
    res.shot = await shoot(page, outDir, `${station}-${scenario.id}-${target.kind}-ERROR`)
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

/* ----------------------------------------------------------------------------
 * New app helpers (URL-driven)
 * -------------------------------------------------------------------------- */
async function waitNewApp(page, log, { needPlot = true } = {}) {
  // Wait for the network to go quiet, then (optionally) for at least one plot
  // with data or an error alert, then quiet again.
  await settle(log)
  if (needPlot) {
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('.js-plotly-plot')].some((g) => g.data?.length) ||
          document.querySelector('.mantine-Alert-root'),
        null,
        { timeout: 60_000, polling: 250 },
      )
      .catch(() => {})
  }
  await settle(log)
}

export async function captureNewLatest(browser, target, station, scenario, outDir) {
  const { ctx, page, log } = await openPage(browser)
  const res = {
    target: target.label,
    station,
    scenario: scenario.id,
    url: newAppUrl(target, station, { params: scenario.newParams ?? {} }),
  }
  const t0 = Date.now()
  try {
    await page.goto(res.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await waitNewApp(page, log)
    res.loadMs = Date.now() - t0
    const cards = await tagCards(page, NEW_CARDS)
    Object.assign(res, await extract(page, { cardSelectors: cards }))
    res.plots.forEach((p) => (p.role = plotRole(p)))
    res.alerts = await alerts(page)
    res.shot = await shoot(page, outDir, `${station}-${scenario.id}-new`)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
    res.shot = await shoot(page, outDir, `${station}-${scenario.id}-new-ERROR`)
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

export async function captureNewAg(browser, target, station, scenario, range, outDir) {
  const { ctx, page, log } = await openPage(browser)
  const params = { ...(scenario.newParams ?? {}), from: range.start, to: range.end }
  const res = { target: target.label, station, scenario: scenario.id, url: newAppUrl(target, station, { tab: 'ag', params }) }
  try {
    await page.goto(res.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await waitNewApp(page, log)
    Object.assign(res, await extract(page))
    res.plots.forEach((p) => (p.role = 'ag'))
    res.alerts = await alerts(page)
    res.shot = await shoot(page, outDir, `${station}-ag-${scenario.id}-new`)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

async function alerts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.mantine-Alert-root, [role="alert"]')].map((a) => a.innerText.trim()).filter(Boolean),
  )
}

/* ----------------------------------------------------------------------------
 * Downloader
 * -------------------------------------------------------------------------- */
async function readDownload(download, outDir, tag) {
  await ensureDir(outDir)
  const name = download.suggestedFilename()
  const p = join(outDir, `${tag}-${slug(name)}`)
  await download.saveAs(p)
  return { filename: name, path: p, text: await readFile(p, 'utf8') }
}

export async function captureLegacyDownloader(browser, target, station, sc, range, outDir) {
  const { ctx, page, log } = await openPage(browser)
  const res = { target: target.label, station, scenario: sc.id, url: legacyUrl(target, station, '#downloader') }
  try {
    await page.goto(res.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await page.waitForSelector('#download-elements', { timeout: TIMEOUTS.plot })
    await page.waitForFunction(() => !!document.querySelector('#dl-start'), null, { timeout: 60_000 })
    await settle(log)
    // The downloader dropdown is NOT populated from the URL path in legacy
    // (only station-dropdown is); set it like a user would.
    await dashSetProps(page, 'station-dropdown-dl', { value: station })
    // wait for update_downloader_elements + set_downloader_start_date callbacks
    const els = await waitProps(page, 'download-elements', (p) => Array.isArray(p.data) && p.data.length > 2)
    await waitProps(page, 'dl-start', (p) => !!p.value)
    await settle(log)
    const avail = new Set((els?.data ?? []).filter((o) => !o.disabled).map((o) => o.value))
    res.elementsRequested = sc.elements
    res.elementsUsed = sc.elements.filter((e) => avail.has(e))
    res.elementsUnavailable = sc.elements.filter((e) => !avail.has(e))
    await dashSetProps(page, 'download-elements', { value: res.elementsUsed })
    await dashSetProps(page, 'dl-timeperiod', { value: sc.period })
    await dashSetProps(page, 'dl-start', { value: range.start })
    await dashSetProps(page, 'dl-end', { value: range.end })
    await settle(log)
    res.legacyProps = {
      elements: (await dashGetProps(page, 'download-elements'))?.value,
      period: (await dashGetProps(page, 'dl-timeperiod'))?.value,
      start: (await dashGetProps(page, 'dl-start'))?.value,
      end: (await dashGetProps(page, 'dl-end'))?.value,
    }
    const before = await signature(page)
    await page.locator('#run-dl-request').click()
    await waitChanged(page, before, TIMEOUTS.plot)
    await settle(log)
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: TIMEOUTS.plot }), page.locator('#dl-data-button').click()])
    res.download = await readDownload(dl, outDir, `${station}-${sc.id}-legacy`)
    Object.assign(res, await extract(page))
    res.plots.forEach((p) => (p.role = plotRole(p)))
    res.shot = await shoot(page, outDir, `${station}-${sc.id}-legacy`)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
    res.shot = await shoot(page, outDir, `${station}-${sc.id}-legacy-ERROR`)
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

export async function captureNewDownloader(browser, target, station, sc, range, outDir) {
  const { ctx, page, log } = await openPage(browser)
  const params = { els: sc.elements, period: sc.period, from: range.start, to: range.end }
  const res = { target: target.label, station, scenario: sc.id, url: newAppUrl(target, station, { tab: 'downloader', params }) }
  try {
    await page.goto(res.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await settle(log)
    await page.getByRole('button', { name: /Run Request/i }).click()
    await waitNewApp(page, log)
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Download CSV/i }).click(),
    ])
    res.download = await readDownload(dl, outDir, `${station}-${sc.id}-new`)
    Object.assign(res, await extract(page))
    res.plots.forEach((p) => (p.role = 'downloader-preview'))
    res.alerts = await alerts(page)
    res.shot = await shoot(page, outDir, `${station}-${sc.id}-new`)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
    res.shot = await shoot(page, outDir, `${station}-${sc.id}-new-ERROR`)
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

/** Keep the request log compact: API/data calls + any non-2xx anywhere. */
export function summarizeLog(log) {
  const interesting = log.requests.filter(
    (r) => r.status >= 400 || r.failed || /\/api\/|_api\/|_dash-update|execute-api|data\.climate|weather\.gov/.test(r.url),
  )
  return {
    consoleErrors: log.console.filter((c) => c.type === 'error').map((c) => c.text),
    pageErrors: log.pageErrors,
    requests: interesting.map((r) => ({ status: r.status, url: r.url, failed: r.failed, ms: r.ms })),
    bad: interesting.filter((r) => r.status >= 400 || r.failed).map((r) => `${r.status || r.failed} ${r.url}`),
  }
}
