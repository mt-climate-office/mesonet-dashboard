// Playwright (web-next's dev dependency), the instrumented page (console errors, request
// log, quiet-period settle) and screenshots.
import { join } from 'node:path'
import { chromium } from 'playwright'
import { TIMEOUTS } from '../config.mjs'
import { ensureDir, slug, sleep } from './util.mjs'

/** Installed Chrome (channel 'chrome'); FIDELITY_CHROMIUM=/path overrides. */
export async function launch({ headless = true } = {}) {
  if (process.env.FIDELITY_CHROMIUM) return chromium.launch({ headless, executablePath: process.env.FIDELITY_CHROMIUM })
  return chromium.launch({ headless, channel: 'chrome' })
}

/** New 1440 px light-scheme page. Returns { ctx, page, log }; `log` tracks console errors and xhr/fetch. */
export async function openPage(browser, { width = 1440, height = 1000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'light', acceptDownloads: true, timezoneId: 'America/Denver' })
  const page = await ctx.newPage()
  const log = { console: [], pageErrors: [], requests: [], inflight: 0, lastActivity: Date.now() }
  const live = new Set()
  const tracked = (r) => ['xhr', 'fetch', 'document'].includes(r.resourceType())
  page.on('console', (m) => {
    if (m.type() === 'error') log.console.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => log.pageErrors.push(String(e?.message ?? e).slice(0, 300)))
  page.on('request', (r) => {
    if (!tracked(r)) return
    live.add(r)
    log.inflight = live.size
    log.lastActivity = Date.now()
  })
  const done = async (r, failed) => {
    if (!live.has(r)) return
    live.delete(r)
    log.inflight = live.size
    log.lastActivity = Date.now()
    let status = 0
    try {
      status = failed ? 0 : (await r.response())?.status() ?? 0
    } catch {
      /* gone */
    }
    log.requests.push({ url: r.url(), status, failed: failed ? r.failure()?.errorText ?? 'failed' : undefined })
  }
  page.on('requestfinished', (r) => done(r, false))
  page.on('requestfailed', (r) => done(r, true))
  return { ctx, page, log }
}

/** Wait until no xhr/fetch has been in flight for `quiet` ms (bounded by `max`). */
export async function settle(log, { quiet = TIMEOUTS.settleQuiet, max = TIMEOUTS.settleMax } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < max) {
    if (log.inflight === 0 && Date.now() - log.lastActivity >= quiet) return true
    await sleep(200)
  }
  return false
}

export async function shoot(page, dir, name) {
  await ensureDir(dir)
  const p = join(dir, `${slug(name)}.png`)
  try {
    await page.screenshot({ path: p, fullPage: true, timeout: 30_000 })
    return p
  } catch {
    return null
  }
}

/** Compact request log: API calls and anything non-2xx. */
export function summarizeLog(log) {
  const api = log.requests.filter((r) => r.status >= 400 || r.failed || /_api\/|\/api\/|data2\.climate|weather\.gov|githubusercontent/.test(r.url))
  return {
    consoleErrors: log.console,
    pageErrors: log.pageErrors,
    requests: api.length,
    bad: api.filter((r) => r.status >= 400 || r.failed).map((r) => `${r.status || r.failed} ${r.url}`),
  }
}
