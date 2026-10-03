/**
 * Phone layout and motion checks (DESIGN.md "Charts on touch", "Layout ladder", "Motion"):
 * at 390 px with touch, a vertical swipe over a chart or the About map scrolls the page; no
 * section scrolls sideways; the first Now tile is above the fold at 390×844; with reduced
 * motion a section change starts no view transition. Run via `npm run verify`.
 */
import { VIEWPORTS, check, finish, open, start } from './lib.mjs'

const PHONE = VIEWPORTS[1]
const env = await start()

/* ── Touch: a vertical swipe over a chart scrolls the page ──────────────── */
for (const [name, query, evidence, target] of [
  ['variable chart', '?s=acebozem&v=air_temp#charts', { charts: 1 }, '[data-testid="variable-chart"] canvas'],
  ['Compare', '?s=acebozem#latest', { charts: 1 }, '.cmp-chart canvas'],
  ['Ag chart', '?s=acebozem&var=gdd#ag', { charts: 1 }, '[data-testid="ag-chart-gdd"] canvas'],
  ['About locator map', '?s=acebozem#about', { filled: ['[data-testid="about-map"] tbody'] }, '[data-testid="about-map"] canvas'],
]) {
  const { page, problems, close, rendered } = await open(env, query, { viewport: PHONE })
  await rendered(evidence)
  // Centre the target, then swipe 200 px over its middle with real touch events: up when the
  // page has room below (it scrolls down), else down (a short page is already at its bottom).
  await page.locator(target).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = await page.locator(target).first().boundingBox()
  const { y0, room } = await page.evaluate(() => ({ y0: scrollY, room: document.documentElement.scrollHeight - innerHeight - scrollY }))
  const dir = room >= 100 ? -1 : 1
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2 - (dir * 100)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', y)
  for (let i = 1; i <= 10; i++) await touch('touchMove', y + dir * i * 20)
  await touch('touchEnd')
  const moved = (y0) => Math.abs(scrollY - y0) > 50
  await page.waitForFunction(moved, y0, { timeout: 3000 }).catch(() => {})
  const y1 = await page.evaluate(() => scrollY)
  check(`touch: a vertical swipe over the ${name} scrolls the page`, Math.abs(y1 - y0) > 50, `scrollY ${y0} → ${y1} (room below ${room})`)
  const p = await problems()
  check(`touch ${name}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── No horizontal overflow at 390 px; the first Now tile above the fold ── */
for (const [name, query, evidence] of [
  ['now', '?s=acebozem', { filled: ['[data-testid="now-tiles"]'] }],
  ['charts-list', '?s=acebozem#charts', { filled: ['[data-testid="var-air_temp"] .dash-spark svg'] }],
  ['variable', '?s=acebozem&v=air_temp#charts', { charts: 1 }],
  ['variable-history', '?s=acebozem&v=air_temp&view=history#charts', { charts: 1 }],
  ['variable-table', '?s=acebozem&v=air_temp&view=table#charts', { filled: ['.var-table-grid tbody'] }],
  ['compare', '?s=acebozem#latest', { charts: 1 }],
  ['ag-tools', '?s=acebozem#ag', { filled: ['[data-testid="ag-tools"] ul'] }],
  ['ag-gdd', '?s=acebozem&var=gdd#ag', { charts: 1 }],
  ['download', '?s=acebozem#download', { filled: ['[data-testid="dl-step-elements"]'] }],
  ['about', '?s=acebozem#about', { filled: ['[data-testid="about-readings-table"] tbody'] }],
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
      const tile = document.querySelector('[data-testid="now-tiles"] .now-tile').getBoundingClientRect()
      const bar = document.querySelector('.dash-tabbar').getBoundingClientRect()
      return { tileBottom: Math.round(tile.bottom), foldAt: Math.round(Math.min(innerHeight, bar.top)) }
    })
    check('[now 390×844] the first tile is above the fold (above the tab bar)', fold.tileBottom <= fold.foldAt, JSON.stringify(fold))
  }
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
