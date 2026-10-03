/**
 * Layout and motion checks (DESIGN.md "Charts on touch", "Layout ladder", "Motion"):
 * at 390 px with touch, a vertical swipe over a chart or the About map scrolls the page and a
 * sideways swipe on a variable page walks the list; no
 * view scrolls sideways; the Now hero through its strip is above the fold at 390×844; the header is one
 * row at 390 and 1440 (sections in it only from tablet up); the phone tab bar has three items
 * on a solid surface; the Download sheet fits the screen; with reduced motion a section change
 * starts no view transition. Run via `npm run verify`.
 */
import { DL_QUERY, VIEWPORTS, check, finish, open, start } from './lib.mjs'

const PHONE = VIEWPORTS[1]
const env = await start()

/* ── Touch: a vertical swipe over a chart scrolls the page ──────────────── */
for (const [name, query, evidence, target] of [
  ['variable chart', '?s=acebozem&v=air_temp#charts', { charts: 1 }, '[data-testid="variable-chart"] canvas'],
  ['Compare', '?s=acebozem#latest', { charts: 1 }, '.cmp-chart canvas'],
  ['Ag chart', '?s=acebozem&v=gdd#charts', { charts: 1 }, '[data-testid="ag-chart-gdd"] canvas'],
  ['About locator map', '?s=acebozem#about', { filled: ['[data-testid="about-map"] tbody'] }, '[data-testid="about-map"] canvas'],
]) {
  const { page, problems, close, rendered } = await open(env, query, { viewport: PHONE })
  await rendered(evidence)
  // Centre the target, then swipe 200 px over its middle with real touch events, toward the side
  // with more room to scroll; it must move the page at least `want` px.
  await page.locator(target).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = await page.locator(target).first().boundingBox()
  const { y0, room } = await page.evaluate(() => ({ y0: scrollY, room: document.documentElement.scrollHeight - innerHeight - scrollY }))
  const dir = room >= y0 ? -1 : 1
  const want = Math.min(50, Math.max(room, y0) * 0.6)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2 - (dir * 100)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', y)
  for (let i = 1; i <= 10; i++) await touch('touchMove', y + dir * i * 20)
  await touch('touchEnd')
  await page.waitForFunction(([y0, want]) => Math.abs(scrollY - y0) > want, [y0, want], { timeout: 3000 }).catch(() => {})
  const y1 = await page.evaluate(() => scrollY)
  check(`touch: a vertical swipe over the ${name} scrolls the page`, Math.abs(y1 - y0) > want, `scrollY ${y0} → ${y1} (room below ${room})`)
  const p = await problems()
  check(`touch ${name}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Touch: a sideways swipe on a variable page walks the list (core/swipe) ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&v=air_temp#charts', { viewport: PHONE })
  await rendered({ charts: 1 })
  const cdp = await page.context().newCDPSession(page)
  const box = await page.locator('[data-testid="variable-chart"] canvas').first().boundingBox()
  const y = box.y + box.height / 2
  /** A 240 px horizontal swipe over the chart, from `x0` towards `dir` (−1 left, 1 right). */
  const swipe = async (x0, dir) => {
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    await touch('touchStart', x0)
    for (let i = 1; i <= 12; i++) await touch('touchMove', x0 + dir * i * 20)
    await touch('touchEnd')
  }
  const v = () => page.evaluate(() => new URLSearchParams(location.search).get('v'))
  await swipe(330, -1)
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') !== 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const next = await v()
  await rendered({ charts: 1 })
  await swipe(60, 1)
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') === 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const prev = await v()
  check('touch: a left swipe opens the next variable, a right swipe the previous', next === 'rh' && prev === 'air_temp', JSON.stringify({ next, prev }))
  const p = await problems()
  check('touch swipe: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── No horizontal overflow at 390 px; the Now hero through its strip above the fold ── */
for (const [name, query, evidence] of [
  ['now', '?s=acebozem', { charts: 1, filled: ['[data-testid="now-tiles"]'] }],
  ['charts-list', '?s=acebozem#charts', { filled: ['[data-testid="var-air_temp"] .dash-spark svg'] }],
  ['variable', '?s=acebozem&v=air_temp#charts', { charts: 1 }],
  ['variable-history', '?s=acebozem&v=air_temp&view=history#charts', { charts: 1 }],
  ['variable-table', '?s=acebozem&v=air_temp&tbl=1#charts', { filled: ['.var-table-grid tbody'] }],
  ['compare', '?s=acebozem#latest', { charts: 1 }],
  ['legacy-ag', '?s=acebozem#ag', { filled: ['[data-testid="charts-ag-tools"] ul'] }],
  ['ag-gdd', '?s=acebozem&v=gdd#charts', { charts: 1 }],
  ['ag-etr-history', '?s=acebozem&v=etr&view=history#charts', { charts: 1 }],
  ['download', DL_QUERY, { filled: ['[data-testid="dl-station"]'] }],
  ['about', '?s=acebozem#about', { filled: ['[data-testid="about-details"] .about-dl', '[data-testid="about-map"] tbody'] }],
]) {
  const { page, close, rendered } = await open(env, query, { viewport: PHONE })
  await rendered(evidence)
  const o = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    // For the failure message only: the first elements that stick out.
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > vw + 1)
      .slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
    return { scroll: document.documentElement.scrollWidth, vw, wide }
  })
  check(`[${name} 390] no horizontal overflow`, o.scroll <= o.vw, JSON.stringify(o))
  if (name === 'now') {
    const fold = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="now-strip"]').getBoundingClientRect()
      const bar = document.querySelector('.dash-tabbar').getBoundingClientRect()
      return { stripBottom: Math.round(strip.bottom), foldAt: Math.round(Math.min(innerHeight, bar.top)) }
    })
    check('[now 390×844] the hero through its 48 h strip is above the fold (above the tab bar)', fold.stripBottom <= fold.foldAt, JSON.stringify(fold))
  }
  await close()
}

/* ── Header: one row at both widths; sections in it only from tablet up ──── */
for (const vp of VIEWPORTS) {
  const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: vp })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  const h = await page.evaluate(() => {
    const bar = document.getElementById('navbar')
    const shown = (sel) => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' }
    const r = (sel) => document.querySelector(sel).getBoundingClientRect()
    return {
      height: Math.round(bar.getBoundingClientRect().height),
      sections: shown('[data-testid="section-row"]'),
      brand: r('.mco-navbar > .brand').width > 1,
      menu: shown('[data-testid="header-menu-button"]'),
      // One row: the station button and the ⋯ button share a vertical band.
      oneRow: Math.abs(r('[data-testid="station-switcher"]').top + r('[data-testid="station-switcher"]').height / 2 - (r('[data-testid="header-menu-button"]').top + r('[data-testid="header-menu-button"]').height / 2)) < 4,
      tabbar: shown('[data-testid="tabbar"]'),
      meta: !!document.querySelector('.dash-station-meta, [data-testid="station-header"]'),
    }
  })
  const desk = !vp.touch
  check(`[header ${vp.name}] one row (≤ 64 px), ⋯ menu shown, no station meta line`, h.oneRow && h.height <= 64 && h.menu && !h.meta, JSON.stringify(h))
  check(`[header ${vp.name}] ${desk ? 'sections and brand in the header, no tab bar' : 'no sections or brand in the header; the tab bar instead'}`,
    desk ? h.sections && h.brand && !h.tabbar : !h.sections && !h.brand && h.tabbar, JSON.stringify(h))
  await close()
}

/* ── Tab bar (390): three items on a solid surface ──────────────────────── */
{
  const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: PHONE })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  const t = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="tabbar"]')
    const probe = document.createElement('div')
    probe.style.background = 'var(--bg-surface)'
    document.body.append(probe)
    const surface = getComputedStyle(probe).backgroundColor
    probe.remove()
    const cs = getComputedStyle(bar)
    return { items: bar.querySelectorAll('a[data-section]').length, bg: cs.backgroundColor, surface, blur: cs.backdropFilter, tabbarH: getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h').trim() }
  })
  check('[tab bar 390] three items, solid --bg-surface, no glass blur, --tabbar-h published', t.items === 3 && t.bg === t.surface && (t.blur === 'none' || t.blur === '') && parseFloat(t.tabbarH) >= 56, JSON.stringify(t))
  await close()
}

/* ── Download sheet: inside the screen at both widths ───────────────────── */
for (const vp of VIEWPORTS) {
  const { page, close, rendered } = await open(env, DL_QUERY, { viewport: vp })
  await rendered({ filled: ['[data-testid="dl-station"]'] })
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10000 })
  const r = await page.evaluate(() => {
    const b = document.getElementById('sheet-download').getBoundingClientRect()
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), vw: innerWidth, vh: innerHeight }
  })
  check(`[download sheet ${vp.name}] fully on screen`, r.top >= 0 && r.left >= 0 && r.right <= r.vw && r.bottom <= r.vh, JSON.stringify(r))
  await close()
}

/* ── Reduced motion: a section change starts no view transition ─────────── */
// Counts document.startViewTransition calls around a tab-bar tap; the no-preference run is the control.
async function transitions(reducedMotion) {
  const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: PHONE, reducedMotion })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.evaluate(() => {
    window.__vt = 0
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (cb) => (window.__vt++, start(cb))
  })
  await page.locator('.dash-tabbar a[data-section="about"]').click()
  await page.waitForFunction(() => location.hash === '#about' && document.querySelector('[data-testid="about-details"]'), null, { timeout: 10000 })
  const n = await page.evaluate(() => window.__vt)
  await close()
  return n
}
const control = await transitions('no-preference')
const reduced = await transitions('reduce')
check('reduced motion: control run starts a view transition on a section change', control > 0, `${control}`)
check('reduced motion: a section change starts no view transition', reduced === 0, `${reduced}`)

await env.close()
finish('layout')
