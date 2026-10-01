#!/usr/bin/env node
// Mobile/responsive check (MOB-*, ES-005): screenshots of the new app (and
// legacy for reference) at 375 and 768 px, plus a horizontal-overflow probe.
//   NEW_URL=... node scripts/fidelity/mobile.mjs [--out DIR] [--station acebozem] [--no-legacy]
import { join } from 'node:path'
import { DEFAULT_OUT, TARGETS, newAppUrl, legacyUrl } from './config.mjs'
import { launch, openPage, settle } from './lib/browser.mjs'
import { writeJson, ensureDir } from './lib/util.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const OUT = join(arg('out', DEFAULT_OUT), 'mobile')
const station = arg('station', 'acebozem')
const withLegacy = !argv.includes('--no-legacy')
await ensureDir(OUT)

const pages = [
  { id: 'latest', url: newAppUrl(TARGETS.newApp, station) },
  { id: 'latest-current', url: newAppUrl(TARGETS.newApp, station, { params: { info: 'current' } }) },
  { id: 'ag-gdd', url: newAppUrl(TARGETS.newApp, station, { tab: 'ag', params: { var: 'gdd' } }) },
  { id: 'downloader', url: newAppUrl(TARGETS.newApp, station, { tab: 'downloader', params: { els: ['air_temp_0200', 'ppt'] } }) },
  // ES-005: malformed dates must give the no-data state, not a crash/request storm
  { id: 'es005-bad-dates', url: newAppUrl(TARGETS.newApp, station, { params: { from: 'not-a-date', to: '2026-13-45' } }) },
]
if (withLegacy) pages.push({ id: 'legacy-latest', url: legacyUrl(TARGETS.localLegacy, station), legacy: true })

const browser = await launch()
const results = []
for (const width of [375, 768]) {
  for (const p of pages) {
    const { ctx, page, log } = await openPage(browser, { viewport: { width, height: 900 } })
    const r = { id: p.id, width, url: p.url }
    try {
      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      if (p.legacy) await page.waitForSelector('#station-data .js-plotly-plot', { timeout: 150_000 }).catch(() => {})
      await settle(log)
      await page.waitForTimeout(1500)
      Object.assign(
        r,
        await page.evaluate(() => {
          const de = document.documentElement
          const offenders = [...document.querySelectorAll('body *')]
            .filter((el) => {
              const b = el.getBoundingClientRect()
              return b.width > 0 && b.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed'
            })
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(el.getBoundingClientRect().right)}`)
          return {
            scrollWidth: de.scrollWidth,
            innerWidth: window.innerWidth,
            horizontalOverflow: de.scrollWidth > window.innerWidth + 1,
            offenders,
            plots: [...document.querySelectorAll('.js-plotly-plot')].map((g) => Math.round(g.getBoundingClientRect().width)),
            alerts: [...document.querySelectorAll('.mantine-Alert-root,[role=alert]')].map((a) => a.innerText.trim()).filter(Boolean),
            text: document.body.innerText.slice(0, 400),
          }
        }),
      )
      r.shot = join(OUT, `${p.id}-${width}.png`)
      await page.screenshot({ path: r.shot, fullPage: true })
    } catch (e) {
      r.error = String(e.message).split('\n')[0]
    }
    r.bad = log.requests.filter((q) => q.status >= 400).map((q) => `${q.status} ${q.url}`)
    r.pageErrors = log.pageErrors
    results.push(r)
    console.log(`[mobile] ${p.id} @${width}: overflow=${r.horizontalOverflow} plots=${JSON.stringify(r.plots)} ${r.error ?? ''}`)
    await ctx.close()
  }
}
await browser.close()
await writeJson(join(OUT, 'results.json'), results)
console.log(`mobile results: ${join(OUT, 'results.json')}`)
