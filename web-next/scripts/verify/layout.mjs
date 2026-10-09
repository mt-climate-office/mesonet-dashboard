/**
 * Layout and motion checks (DESIGN.md "Charts on touch", "Layout ladder", "Motion"):
 * at 390 px with touch, a vertical swipe over a chart or the About map scrolls the page and a
 * sideways swipe on a variable page walks the list; no
 * view scrolls sideways; the Now hero through its strip is above the fold at 390×844; the header is one
 * row at 390 and 1440 (sections in it only from tablet up); the phone tab bar has three items
 * on a solid surface; the Download sheet fits the screen; the picker sheet's map is in view after
 * "Browse on the map" and a short handle drag never closes it; the no-station landing fills the screen
 * with its map (no picker over it) on every section; with reduced motion a section change
 * starts no view transition; Now's chart wall shows only with room for it (2560, 1920 without the
 * station drawer; not 1440), in three columns at 2560, and a card opens its chart on the 7 d window. Run via `npm run verify`.
 */
import { DL_QUERY, VIEWPORTS, WIDE, check, finish, open, start } from './lib.mjs'

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
  ['variable-rose', '?s=acebozem&v=wind_dir&wd=rose#charts', { charts: 1, filled: ['[data-testid="rose-stats"] dl'] }],
  ['variable-rose-table', '?s=acebozem&v=wind_dir&wd=rose&tbl=1#charts', { filled: ['.var-table-grid tbody'] }],
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
  if (name === 'variable-rose') {
    // Large on a phone: the canvas spans the card and is taller than wide (the key under the rose).
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="rose-chart"] .chart-canvas').getBoundingClientRect()
      const card = document.querySelector('[data-testid="variable-rose"]').getBoundingClientRect()
      return { w: Math.round(c.width), h: Math.round(c.height), card: Math.round(card.width) }
    })
    check('[variable-rose 390] the rose spans the card and leaves room for its key under it', r.w >= r.card - 16 && r.h > r.w, JSON.stringify(r))
  }
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

/* ── Now's chart wall: only with room beside Now; three columns at 2560; a card opens its 7 d chart ── */
{
  const wall = (page) => page.evaluate(() => {
    const cards = [...document.querySelectorAll('.now-wall-card')].map((c) => c.getBoundingClientRect())
    const hero = document.querySelector('[data-testid="now-hero"]')?.getBoundingClientRect()
    return {
      cards: cards.length,
      columns: new Set(cards.map((r) => Math.round(r.left))).size,
      topAligned: !!hero && cards.length > 0 && Math.abs(cards[0].top - hero.top) < 2,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  {
    const { page, problems, close, rendered } = await open(env, '?s=acebozem', { viewport: WIDE })
    await rendered({ charts: 7, filled: ['[data-testid="now-tiles"]'] })
    const w = await wall(page)
    check('[wall 2560] six charts in three columns, level with the hero; no sideways scroll', w.cards === 6 && w.columns === 3 && w.topAligned && w.overflow <= 0, JSON.stringify(w))
    await page.locator('[data-testid="wall-air_temp"] .now-wall-head').click()
    await page.waitForFunction(() => document.activeElement?.id === 'var-title', null, { timeout: 10000 }).catch(() => {})
    const opened = await page.evaluate(() => {
      const q = new URLSearchParams(location.search)
      return { hash: location.hash, v: q.get('v'), days: (Date.parse(q.get('to')) - Date.parse(q.get('from'))) / 864e5, focus: document.activeElement?.id, chip: document.querySelector('.chart-chips [aria-pressed="true"]')?.textContent.trim() }
    })
    check('[wall 2560] a card opens its variable on the 7 d window, the heading focused', opened.hash === '#charts' && opened.v === 'air_temp' && opened.days === 7 && opened.focus === 'var-title' && opened.chip === '7 d', JSON.stringify(opened))
    await page.goBack()
    await page.waitForFunction(() => document.querySelectorAll('.now-wall-card').length === 6, null, { timeout: 10000 }).catch(() => {})
    check('[wall 2560] Back returns to Now with its wall', (await wall(page)).cards === 6)
    const p = await problems()
    check('[wall 2560] console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
    await close()
  }
  {
    const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: { name: '1920', width: 1920, height: 1080 } })
    await rendered({ charts: 7, filled: ['[data-testid="now-tiles"]'] })
    const before = await wall(page)
    await page.getByTestId('station-switcher').click()
    await page.waitForFunction(() => document.getElementById('station-picker')?.classList.contains('is-open'), null, { timeout: 5000 }).catch(() => {})
    await page.waitForFunction(() => !document.querySelector('.now-wall'), null, { timeout: 5000 }).catch(() => {})
    const after = await wall(page)
    check('[wall 1920] the wall shows in two columns, and gives way to the open station drawer', before.cards === 6 && before.columns === 2 && after.cards === 0 && after.overflow <= 0, JSON.stringify({ before, after }))
    await close()
  }
  {
    const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: VIEWPORTS[0] })
    await rendered({ charts: 1, filled: ['[data-testid="now-tiles"]'] })
    check('[wall 1440] no wall at 1440', (await wall(page)).cards === 0)
    await close()
  }
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

/* ── No-station landing: search on top, the map down to the tab bar, the picker closed ── */
for (const vp of VIEWPORTS) {
  for (const hash of ['#now', '#charts', '#about']) {
    const { page, problems, close, rendered } = await open(env, hash, { viewport: vp })
    await rendered({ filled: ['[data-testid="landing-map"] tbody'] })
    const r = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel)?.getBoundingClientRect()
      const map = box('[data-testid="landing-map"]')
      const search = box('[data-testid="landing"] [data-testid="picker-search"]')
      const bar = box('.dash-tabbar')
      const p = document.getElementById('station-picker')
      return {
        mapTop: Math.round(map.top), mapBottom: Math.round(map.bottom), mapH: Math.round(map.height), searchBottom: Math.round(search.bottom),
        floor: Math.round(bar && bar.height ? bar.top : innerHeight), vh: innerHeight,
        picker: !p.hidden && getComputedStyle(p).visibility === 'visible',
        sideways: document.documentElement.scrollWidth > innerWidth,
      }
    })
    check(`[landing ${vp.name} ${hash}] search above the map; the map fills the screen to the tab bar (≥ half its height); no picker; no sideways scroll`,
      r.searchBottom <= r.mapTop && r.mapBottom <= r.floor && r.floor - r.mapBottom <= 24 && r.mapH >= r.vh / 2 && !r.picker && !r.sideways, JSON.stringify(r))
    const p = await problems()
    check(`[landing ${vp.name} ${hash}] console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
    await close()
  }
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

/* ── Picker sheet (390): "Browse on the map" opens the sheet full with the map in view ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem', { viewport: PHONE })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('station-switcher').tap()
  await page.getByTestId('picker-browse').tap()
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-map"] canvas'), null, { timeout: 30000 })
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10000 })
  const m = await page.evaluate(() => {
    const sheet = document.getElementById('station-picker')
    const body = sheet.querySelector('.dash-panel-body').getBoundingClientRect()
    const map = sheet.querySelector('[data-testid="picker-map"]').getBoundingClientRect()
    const bar = document.querySelector('.dash-tabbar').getBoundingClientRect()
    return { state: sheet.dataset.state, top: Math.round(map.top), bottom: Math.round(map.bottom), h: Math.round(map.height), bodyTop: Math.round(body.top), bodyBottom: Math.round(body.bottom), barTop: Math.round(bar.top) }
  })
  check('[picker sheet 390] after "Browse on the map": sheet full, map ≥ 240 px tall and wholly in view above the tab bar',
    m.state === 'full' && m.h >= 240 && m.top >= m.bodyTop && m.bottom <= m.bodyBottom + 1 && m.bottom <= m.barTop, JSON.stringify(m))
  const p = await problems()
  check('[picker sheet 390] console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Picker sheet (390): a short upward drag on the handle that ends above the sheet keeps it open ── */
// The touch click after the drag lands on the scrim; the sheet ignores it (ui/layout/sheet.ts).
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem', { viewport: PHONE })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('station-switcher').tap()
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10000 })
  const top = await page.evaluate(() => document.getElementById('station-picker').getBoundingClientRect().top)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 135, y }] })
  await touch('touchStart', top + 12)
  for (let i = 1; i <= 10; i++) await touch('touchMove', top + 12 - i * 1.4)
  await touch('touchEnd')
  await page.waitForTimeout(500)
  const open_ = await page.evaluate(() => !document.getElementById('station-picker').hidden)
  check('[picker sheet 390] a short upward handle drag ending above the sheet keeps it open', open_, `top ${Math.round(top)}`)
  const p = await problems()
  check('[picker sheet drag] console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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
