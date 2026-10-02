// Scenario drivers: open one tab of web/ (kind 'web') or web-next (kind 'next') from a deep link,
// wait for render evidence (never networkidle), and return a capture:
//   { url, figures[], cards{}, map, palette, messages[], download, log, shot, loadMs, error }
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { appUrl, TIMEOUTS } from '../config.mjs'
import { openPage, settle, shoot, summarizeLog } from './browser.mjs'
import { extractPlotly, extractECharts, extractCards, extractMap, paletteColors } from './extract.mjs'
import { ensureDir, sha256, slug } from './util.mjs'

/** Figure role from what it is, so the two apps pair without shared ids. */
function role(fig, tab) {
  if (fig.traces.some((t) => t.panel === 'polar')) return 'windrose'
  if (tab === 'downloader') return 'preview'
  if (tab === 'ag') return 'ag'
  return 'timeseries'
}

async function figures(page, target, tab) {
  const figs = target.kind === 'web' ? await extractPlotly(page) : await extractECharts(page)
  return figs.map((f) => ({ ...f, role: role(f, tab) }))
}

/** web/ cards: the Mantine Paper around the switcher with this label (web/ has no test ids). */
async function tagWebCards(page) {
  return page.evaluate(() => {
    const out = {}
    for (const [k, label] of [
      ['top', 'Wind Rose'],
      ['bottom', 'Locator Map'],
    ]) {
      const lab = [...document.querySelectorAll('.mantine-SegmentedControl-label')].find((l) => l.innerText.trim() === label)
      const host = lab?.closest('.mantine-Paper-root')
      if (host) host.setAttribute('data-fid-card', k)
      out[k] = host ? `[data-fid-card="${k}"]` : '#__none__'
    }
    return out
  })
}

const NEXT_CARDS = { top: '[data-testid="top-card"] .lc-body', bottom: '[data-testid="bottom-card"] .lc-body' }

/** True once nothing on the page says it is loading (both apps). */
const quietUi = (kind) =>
  kind === 'web'
    ? () => !document.querySelector('.mantine-Loader-root, .mantine-Skeleton-root[data-visible="true"]')
    : () =>
        ![...document.querySelectorAll('[role="status"], [data-testid="ag-loading"], .latest-refreshing')].some(
          (e) => e.offsetParent !== null && /Loading|Updating/.test(e.textContent ?? ''),
        )

/** FIDELITY_DEBUG=1 prints each wait step with its elapsed time. */
const dbg = (...m) => process.env.FIDELITY_DEBUG && console.log(new Date().toISOString().slice(11, 19), ...m)

async function waitQuiet(page, log, kind) {
  dbg(kind, 'settle 1')
  await settle(log)
  dbg(kind, 'quiet ui')
  await page.waitForFunction(quietUi(kind), null, { timeout: TIMEOUTS.render, polling: 300 }).catch(() => dbg(kind, 'quiet ui timed out'))
  dbg(kind, 'settle 2')
  await settle(log)
}

async function messages(page, kind) {
  return page.evaluate((kind) => {
    const sel = kind === 'web' ? '.mantine-Alert-root, .mantine-Notification-root' : '[data-testid="ag-notes"] li, [data-testid="ag-empty"], [data-testid="ag-error"], .dl-msg, [data-testid="notices"]'
    return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean)
  }, kind)
}

async function withPage(browser, target, url, shotDir, shotName, body) {
  const { ctx, page, log } = await openPage(browser)
  const res = { target: target.label, url }
  const t0 = Date.now()
  try {
    dbg(target.kind, 'goto', url)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav })
    await body(page, log, res)
    dbg(target.kind, 'extracted')
    res.loadMs = Date.now() - t0
    res.messages = await messages(page, target.kind)
    if (target.kind === 'next') res.palette = await paletteColors(page, target.base)
    res.shot = await shoot(page, shotDir, shotName)
  } catch (e) {
    res.error = String(e?.message ?? e).split('\n')[0]
    res.shot = await shoot(page, shotDir, `${shotName}-ERROR`)
  }
  res.log = summarizeLog(log)
  await ctx.close()
  return res
}

/* ---------------------------------------------------------------- Latest */

const webLatestReady = () =>
  [...document.querySelectorAll('.js-plotly-plot')].some((g) => g.data?.length) ||
  /No data available|Select Station|No variables selected|Station not found/.test(document.querySelector('main')?.innerText ?? '')

const nextLatestReady = () => {
  const host = document.querySelector('[data-testid="latest-timeseries"]')
  const status = document.querySelector('[data-testid="timeseries-status"]')
  const chart = host?.querySelector('.chart')
  return !!(chart?.dataset.zoom || (status && status.offsetParent !== null && !/Loading/.test(status.textContent)))
}

export function captureLatest(browser, target, station, sc, outDir) {
  const url = appUrl(target, station, { params: sc.params })
  return withPage(browser, target, url, join(outDir, 'shots'), `${station}-${sc.id}-${target.kind}`, async (page, log, res) => {
    await page.waitForFunction(target.kind === 'web' ? webLatestReady : nextLatestReady, null, { timeout: TIMEOUTS.render, polling: 300 })
    await waitQuiet(page, log, target.kind)
    res.figures = await figures(page, target, 'latest')
    const cards = target.kind === 'web' ? await tagWebCards(page) : NEXT_CARDS
    res.cards = await extractCards(page, cards)
    if (target.kind === 'next') res.map = await extractMap(page, '[data-testid="locator-map"]')
  })
}

/* ---------------------------------------------------------------- Ag Tools */

const webAgReady = () =>
  [...document.querySelectorAll('.js-plotly-plot')].some((g) => g.data?.length) ||
  !!document.querySelector('.mantine-Alert-root') ||
  /Select Station|unavailable|No data|Select a comparison/.test(document.querySelector('main')?.innerText ?? '')

const nextAgReady = () => {
  const vis = (s) => [...document.querySelectorAll(s)].some((e) => e.offsetParent !== null)
  return vis('.ag-chart-card .chart-canvas canvas') || vis('[data-testid="ag-empty"]') || vis('[data-testid="ag-error"]') || vis('[data-testid="ag-no-station"]')
}

export function captureAg(browser, target, station, sc, range, outDir) {
  const params = { ...sc.params, ...(range ? { ag_from: range.start, ag_to: range.end } : {}) }
  const url = appUrl(target, station, { tab: 'ag', params })
  return withPage(browser, target, url, join(outDir, 'shots'), `${station}-${sc.id}-${target.kind}`, async (page, log, res) => {
    await page.waitForFunction(target.kind === 'web' ? webAgReady : nextAgReady, null, { timeout: TIMEOUTS.render, polling: 300 })
    await waitQuiet(page, log, target.kind)
    res.figures = await figures(page, target, 'ag')
  })
}

/* ---------------------------------------------------------------- Downloader */

async function readDownload(dl, dir, tag) {
  await ensureDir(dir)
  const filename = dl.suggestedFilename()
  const path = join(dir, `${tag}-${slug(filename)}`)
  await dl.saveAs(path)
  const text = await readFile(path, 'utf8')
  return { filename, path, text, bytes: Buffer.byteLength(text), sha: sha256(text) }
}

export function captureDownloader(browser, target, station, sc, range, outDir) {
  const params = { els: sc.elements, period: sc.period, qc: sc.qc, dl_from: range.start, dl_to: range.end }
  const url = appUrl(target, station, { tab: 'downloader', params })
  const tag = `${station}-${sc.id}-${target.kind}`
  return withPage(browser, target, url, join(outDir, 'shots'), tag, async (page, log, res) => {
    let runBtn, dlBtn
    if (target.kind === 'web') {
      runBtn = page.getByRole('button', { name: /Run Request/i })
      dlBtn = page.getByRole('button', { name: /Download CSV/i })
      await runBtn.waitFor({ timeout: TIMEOUTS.render })
      await settle(log)
    } else {
      runBtn = page.locator('[data-testid="dl-run"]')
      dlBtn = page.locator('[data-testid="dl-download"]')
      // Run waits for the station catalog and the element list (DIVERGENCES "Run waits for the station catalog").
      await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="dl-run"]')
        return b && !b.disabled
      }, null, { timeout: TIMEOUTS.render, polling: 300 })
      await settle(log)
    }
    await runBtn.click()
    await page
      .waitForFunction(
        (k) =>
          k === 'web'
            ? [...document.querySelectorAll('.js-plotly-plot')].some((g) => g.data?.length) || !!document.querySelector('.mantine-Alert-root')
            : !document.querySelector('[data-testid="dl-download"]')?.disabled || [...document.querySelectorAll('.dl-msg, .dl-preview-status.is-error')].some((e) => e.offsetParent !== null),
        target.kind,
        { timeout: TIMEOUTS.render, polling: 300 },
      )
      .catch(() => {})
    await waitQuiet(page, log, target.kind)
    res.figures = await figures(page, target, 'downloader')
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), dlBtn.click()])
    res.download = await readDownload(dl, join(outDir, 'files'), tag)
    if (target.kind === 'next') res.map = await extractMap(page, '[data-testid="dl-map"]')
  })
}
