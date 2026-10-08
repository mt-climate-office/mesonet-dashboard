// UX audit sweep (not committed): every view × Chrome/WebKit × 1440/390 × themes, screenshots + in-page checks.
import { chromium, webkit } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = process.env.OUT
const BASE = process.env.BASE ?? 'http://localhost:5175/mesonet-dashboard/next/'
mkdirSync(OUT, { recursive: true })

const wait = (p, ms = 600) => p.waitForTimeout(ms)
const click = async (p, sel) => { await p.locator(sel).first().click({ timeout: 8000 }); await wait(p) }
const pop = (id) => async (p) => click(p, `[data-testid=ag-opt-${id}]`)
const menu = (id) => async (p) => click(p, `[data-testid=${id}]`)

const S = [
  ['now', '?s=acebozem'],
  ['now-scrolled', '?s=acebozem', async (p) => { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await wait(p) }],
  ['now-provisional-tip', '?s=acebozem', async (p) => click(p, '[data-testid=now-provisional] button')],
  ['header-menu', '?s=acebozem', menu('header-menu-button')],
  ['picker', '?s=acebozem', async (p) => { await click(p, '[data-testid=station-switcher]'); await wait(p, 800) }],
  ['picker-search', '?s=acebozem', async (p) => { await click(p, '[data-testid=station-switcher]'); await p.keyboard.type('mis'); await wait(p, 800) }],
  ['picker-map', '?s=acebozem', async (p) => { await click(p, '[data-testid=station-switcher]'); await click(p, '[data-testid=picker-browse]'); await wait(p, 2000) }],
  ['photo-dialog', '?s=acebozem', async (p) => { await click(p, '[data-testid=now-photo-open]'); await wait(p, 2000) }],
  ['about', '?s=acebozem#about'],
  ['about-readings', '?s=acebozem#about', async (p) => { await click(p, '[data-testid=about-readings-row]'); await wait(p, 1200) }],
  ['about-history', '?s=acebozem#about', async (p) => { await click(p, '[data-testid=about-history-row]'); await wait(p, 1200) }],
  ['help', '?s=acebozem', async (p) => { await click(p, '[data-testid=header-menu-button]'); await click(p, '[data-testid=menu-help]'); await wait(p, 800) }],
  ['charts-list', '?s=acebozem#charts'],
  ['charts-search', '?s=acebozem#charts', async (p) => { await p.locator('.charts-search input').fill('soil'); await wait(p) }],
  ['variable', '?s=acebozem&v=air_temp#charts'],
  ['variable-menu', '?s=acebozem&v=air_temp#charts', menu('var-menu-button')],
  ['variable-daily', '?s=acebozem&v=air_temp&agg=daily#charts'],
  ['variable-history', '?s=acebozem&v=air_temp&view=history#charts'],
  ['variable-table', '?s=acebozem&v=air_temp&tbl=1#charts'],
  ['variable-precip', '?s=acebozem&v=ppt#charts'],
  ['variable-soil', '?s=acebozem&v=soil_vwc#charts'],
  ['variable-wind-dir', '?s=acebozem&v=wind_dir#charts'],
  ['dates-sheet', '?s=acebozem&v=air_temp#charts', async (p) => { await menu('var-menu-button')(p); await click(p, '[data-testid=var-menu-dates]'); await wait(p, 900) }],
  ['compare', '?s=acebozem&cmp=1#charts'],
  ['ag-gdd', '?s=acebozem&v=gdd#charts'],
  ['ag-gdd-crop', '?s=acebozem&v=gdd#charts', pop('crop')],
  ['ag-gdd-cutoffs', '?s=acebozem&v=gdd#charts', pop('cutoffs')],
  ['ag-gdd-dates', '?s=acebozem&v=gdd#charts', pop('dates')],
  ['ag-gdd-projection', '?s=acebozem&v=gdd#charts', pop('projection')],
  ['ag-gdd-notes', '?s=acebozem&v=gdd#charts', async (p) => click(p, '[data-testid=ag-notes-button]')],
  ['ag-feels', '?s=acebozem&v=feels_like#charts'],
  ['ag-feels-hourly', '?s=acebozem&v=feels_like&ag_time=hourly&ag_from=2026-01-01&ag_to=2026-01-31#charts'],
  ['ag-cci', '?s=acebozem&v=cci#charts'],
  ['ag-cci-livestock', '?s=acebozem&v=cci#charts', pop('livestock')],
  ['ag-cci-interval', '?s=acebozem&v=cci#charts', pop('interval')],
  ['ag-etr', '?s=acebozem&v=etr#charts'],
  ['ag-etr-menu', '?s=acebozem&v=etr#charts', menu('ag-menu-button')],
  ['ag-soil-profile', '?s=acebozem&v=soil_temp,soil_ec_blk#charts'],
  ['ag-soil-chip', '?s=acebozem&v=soil_temp,soil_ec_blk#charts', pop('soil')],
  ['ag-swp', '?s=acebozem&v=swp#charts'],
  ['ag-saturation', '?s=acebozem&v=percent_saturation#charts'],
  ['ag-annual', '?s=acebozem&v=annual#charts'],
  ['ag-swp-not-here', '?s=acealbio&v=swp#charts'],
  ['ag-swp-crow', '?s=acecrowa&v=swp#charts'],
  ['ag-gdd-today', '?s=acebozem&v=gdd&ag_from=2026-04-15&ag_to=2026-10-08#charts'],
  ['download', '?s=acebozem&dl=1#charts'],
  ['download-vars', '?s=acebozem&dl=1#charts', async (p) => click(p, '#dl-row-vars-btn')],
  ['download-dates', '?s=acebozem&dl=1#charts', async (p) => click(p, '#dl-row-dates-btn')],
  ['download-interval', '?s=acebozem&v=cci&dl=1&period=daily&els=cci#charts', async (p) => click(p, '#dl-row-interval-btn')],
  ['no-station', ''],
]

// In-page checks: overflow, controls of different heights side by side, clipped text, small touch targets,
// double rings, broken images, things past the viewport.
const CHECK = (touch) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]') && !e.closest('[inert]') }
  const name = (e) => {
    const t = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${e.tagName.toLowerCase()}${e.dataset.testid ? '#' + e.dataset.testid : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${t}"`
  }
  const out = { overflowX: document.documentElement.scrollWidth - innerWidth, pastViewport: [], heightMismatch: [], clipped: [], small: [], doubleRing: [], brokenImg: [], tinyText: [] }
  const ctrls = [...document.querySelectorAll('button, input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, a.nav-btn, a.dash-chip, .seg-btn, .dash-chip, .ctl-chip')].filter(vis)
  for (const e of ctrls) {
    const r = e.getBoundingClientRect()
    if (r.right > innerWidth + 1 || r.left < -1) out.pastViewport.push(`${name(e)} [${Math.round(r.left)}–${Math.round(r.right)}]`)
  }
  // Controls on the same visual row (same top ±3 px) inside one container: heights should match.
  const containers = new Map()
  for (const e of ctrls) {
    if (e.closest('.dash-carousel-slide, .now-photo-frame, .charts-rows, .picker-list, table, .ctl-combobox-popup, .dash-menu-panel')) continue
    const c = e.parentElement?.closest('fieldset, .ctl-row, .chart-chips, .seg-btns, .lc-photo-controls, .dash-panel-head, .chart-head, .ag-opts, .dl-row-panel, .dash-popover-panel, .ctl-range-values, .dash-sheet .dash-panel-body, div') ?? document.body
    const k = c
    if (!containers.has(k)) containers.set(k, [])
    containers.get(k).push(e)
  }
  const rowsByTop = []
  for (const e of ctrls) {
    if (e.closest('.dash-carousel-slide, .charts-rows, .picker-list, table, .ctl-combobox-popup, .dash-menu-panel, .dash-carousel')) continue
    const r = e.getBoundingClientRect()
    const cx = Math.round(r.top + r.height / 2)
    let row = rowsByTop.find((x) => Math.abs(x.cy - cx) <= 4)
    if (!row) rowsByTop.push((row = { cy: cx, els: [] }))
    row.els.push(e)
  }
  for (const row of rowsByTop) {
    if (row.els.length < 2) continue
    const hs = row.els.map((e) => Math.round(e.getBoundingClientRect().height))
    if (Math.max(...hs) - Math.min(...hs) > 3) out.heightMismatch.push(row.els.map((e, i) => `${name(e)}=${hs[i]}`).join(' | '))
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.children.length > 3) continue
    const c = getComputedStyle(e)
    if ((c.textOverflow === 'ellipsis' || c.overflow === 'hidden' || c.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 2 && (e.textContent || '').trim().length > 2 && e.tagName !== 'svg' && !e.closest('svg'))
      out.clipped.push(`${name(e)} ${e.scrollWidth}>${e.clientWidth}`)
    const fs = parseFloat(c.fontSize)
    if (fs < 11 && (e.textContent || '').trim() && e.children.length === 0 && !e.closest('svg, .sr-only') && c.position !== 'absolute') out.tinyText.push(`${name(e)} ${fs}px`)
  }
  if (touch) {
    for (const e of [...document.querySelectorAll('button, a[href], input, select, [role=button], label.seg-btn, summary')].filter(vis)) {
      if (e.matches('input[type=radio], input[type=checkbox]') && e.closest('label')) continue
      if (e.closest('p, li > p, .dash-toggletip-tip, .info-section p, footer, .now-strip-foot') && e.tagName === 'A') continue
      const r = e.getBoundingClientRect()
      if (r.width < 40 || r.height < 40) out.small.push(`${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
  }
  for (const b of document.querySelectorAll('.mco-btn-info, .modal-close, .dash-icon-btn')) if (vis(b) && b.querySelector('svg circle[r="10"], svg circle[r="11"]')) out.doubleRing.push(name(b))
  for (const i of document.querySelectorAll('img')) if (vis(i) && i.complete && i.naturalWidth === 0) out.brokenImg.push(i.src.slice(-60))
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = [...new Set(out[k])].slice(0, 25)
  return out
}

const MATRIX = [
  { id: 'cr-1440-light', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 1440, height: 900 } }, theme: 'light' },
  { id: 'cr-390-light', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, theme: 'light', touch: true },
  { id: 'wk-390-light', eng: webkit, launch: {}, ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, theme: 'light', touch: true },
  { id: 'wk-1440-light', eng: webkit, launch: {}, ctx: { viewport: { width: 1440, height: 900 } }, theme: 'light' },
  { id: 'wk-390-dark', eng: webkit, launch: {}, ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, theme: 'dark', touch: true },
  { id: 'cr-1440-dark', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 1440, height: 900 } }, theme: 'dark' },
  { id: 'cr-1440-hc', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 1440, height: 900 } }, theme: 'high-contrast' },
  { id: 'cr-768-light', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 768, height: 1024 }, hasTouch: true }, theme: 'light', touch: true },
  { id: 'cr-844x390-light', eng: chromium, launch: { channel: 'chrome' }, ctx: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, theme: 'light', touch: true },
]
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const results = []
for (const m of MATRIX) {
  if (only && !only.test(m.id)) continue
  const b = await m.eng.launch(m.launch)
  const scen = process.env.SCEN ? new RegExp(process.env.SCEN) : null
  for (const [name, q, after] of S) {
    if (scen && !scen.test(name)) continue
    // Dark / HC / tablet / landscape: a representative subset.
    if (!m.id.endsWith('-light') || m.id.startsWith('cr-768') || m.id.startsWith('cr-844')) {
      if (!/^(now|picker|photo-dialog|help|charts-list|variable|variable-menu|ag-gdd|ag-gdd-cutoffs|ag-cci|ag-feels|ag-soil-profile|download|download-vars|about|about-readings|dates-sheet|compare)$/.test(name)) continue
    }
    const ctx = await b.newContext({ ...m.ctx, colorScheme: m.theme === 'dark' ? 'dark' : 'light' })
    const p = await ctx.newPage()
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    p.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text().slice(0, 200)))
    const [qs, hash = ''] = q.split('#')
    const url = `${BASE}${qs}${qs ? '&' : '?'}theme=${m.theme}${hash ? '#' + hash : ''}`
    let status = 'ok'
    try {
      await p.goto(url, { waitUntil: 'load' })
      await p.waitForTimeout(4500)
      if (after) await after(p)
      await p.waitForTimeout(700)
    } catch (e) { status = 'action-failed: ' + e.message.split('\n')[0] }
    const file = `${name}__${m.id}.png`
    await p.screenshot({ path: `${OUT}/${file}`, fullPage: !m.touch || name === 'now-scrolled' ? false : false }).catch(() => {})
    const checks = await p.evaluate(CHECK, !!m.touch).catch((e) => ({ error: e.message }))
    results.push({ scenario: name, matrix: m.id, url, status, errors: [...new Set(errors)].slice(0, 5), checks, file })
    process.stdout.write(`${m.id} ${name} ${status === 'ok' ? '' : status}\n`)
    await ctx.close()
  }
  await b.close()
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
console.log('done', results.length)
