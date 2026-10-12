/**
 * Layout and motion checks (DESIGN.md "Charts on touch", "Layout ladder", "Motion"):
 * at 390 px with touch, a vertical swipe over a chart or the About map scrolls the page and a
 * sideways swipe on a variable page walks the list; no
 * view scrolls sideways; the Now hero through its strip is above the fold at 390×844; the header is one
 * row at 390 and 1440 (sections in it only from tablet up); the phone tab bar has three items
 * on a solid surface; the Download sheet fits the screen; the picker's map fills the screen after
 * "Browse on the map" (× and Esc return to the picker, a pick closes both) and a short handle drag never closes the sheet; the no-station landing fills the screen
 * with its map (no picker over it) on every section; with reduced motion a section change
 * starts no view transition; the big-screen dashboard shows only with room for it (2560 × 1440, 1920 × 1080
 * without the station drawer; not 1920 × 900 or 1440), fills the screen without scrolling, its two stacks'
 * rows aligned (also after a resize), and a panel's name opens its chart on the same window and interval (Back returns). Run via `npm run verify`.
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

/* ── Big-screen dashboard: room for it, fits the screen, rearranges, a card opens its chart ── */
{
  const dash = (page) => page.evaluate(() => {
    const el = document.querySelector('[data-testid="dashboard"]')
    const stacks = [...document.querySelectorAll('.dash-stack')].filter((x) => x.getClientRects().length)
    const plots = stacks.map((x) => x.querySelector('.dash-stack-plot').getBoundingClientRect())
    const links = stacks.map((x) => [...x.querySelectorAll('.dash-stack-links li')].map((li) => Math.round(li.getBoundingClientRect().top)))
    return {
      shown: !!el,
      tabs: !!document.querySelector('[data-testid="section-row"]')?.getClientRects().length,
      stacks: stacks.length,
      drawn: stacks.filter((x) => x.querySelector('canvas')).length,
      panels: links.flat().length,
      // Rows line up across the stacks (link tops equal row for row) and both stacks' plots share a box height and left inset.
      rowsAligned: links.length === 2 && links[1].every((t, i) => Math.abs(t - links[0][i]) <= 1),
      plotsLevel: plots.length === 2 && Math.abs(plots[0].bottom - plots[1].bottom) <= 1 && Math.abs(plots[0].height - plots[1].height) <= 1,
      rose: !!document.querySelector('[data-testid="dash-rose"] canvas'),
      bottom: el ? Math.round(el.getBoundingClientRect().bottom - innerHeight) : null,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      // Per stack (for a failure): plot box height / panel links / ECharts canvases / chart label.
      each: stacks.map((x) => `${x.querySelector('.dash-stack-plot').clientHeight}/${x.querySelectorAll('.dash-stack-links li').length}/${x.querySelectorAll('canvas').length}/${x.querySelector('.chart-canvas')?.getAttribute('aria-label')?.slice(0, 40)}`),
    }
  })
  const ready = (page) => page.waitForFunction(() => {
    // Every shown stack has its links and its canvas (on a slow runner the second stack can lag the first).
    const stacks = [...document.querySelectorAll('.dash-stack')].filter((x) => x.getClientRects().length)
    return stacks.length > 0 && stacks.every((x) => x.querySelector('.dash-stack-links li') && x.querySelector('canvas'))
      && document.querySelectorAll('.dash-stack .chart-table tbody tr').length > 0 && !document.querySelector('.dash-stacks[aria-busy="true"]')
  }, null, { timeout: 30000 }).catch((e) => console.log(`  (dashboard not ready: ${e.message.split('\n')[0]})`))
  {
    const { page, problems, close } = await open(env, '?s=acebozem', { viewport: WIDE })
    await ready(page)
    const d = await dash(page)
    check('[dashboard 2560] in place of the tabs: two stacks (every variable but wind direction) and the rose, fits the screen, no scroll', d.shown && !d.tabs && d.stacks === 2 && d.drawn === 2 && d.panels >= 10 && d.rose && d.bottom <= 0 && d.overflowX <= 0, JSON.stringify(d))
    check('[dashboard 2560] the stacks\' rows line up and their time axes end level', d.rowsAligned && d.plotsLevel, JSON.stringify(d))
    // Narrower and shorter (still room): the stacks shrink to fit, rows still aligned.
    await page.setViewportSize({ width: 1900, height: 1100 })
    await page.waitForTimeout(800)
    const small = await dash(page)
    check('[dashboard] a resize refits the stacks; rows still aligned, still no scroll', small.shown && small.rowsAligned && small.plotsLevel && small.bottom <= 0 && small.overflowX <= 0, JSON.stringify(small))
    await page.setViewportSize({ width: WIDE.width, height: WIDE.height })
    await page.waitForTimeout(500)
    const before = await page.evaluate(() => location.search)
    await page.getByTestId('dash-range-7d').click()
    await page.waitForFunction(() => new URLSearchParams(location.search).get('from'), null, { timeout: 5000 }).catch(() => {})
    await page.getByTestId('dash-interval-hourly').click()
    await page.getByTestId('dash-air_temp').click()
    await page.waitForFunction(() => document.activeElement?.id === 'var-title', null, { timeout: 10000 }).catch(() => {})
    const opened = await page.evaluate(() => {
      const q = new URLSearchParams(location.search)
      return { hash: location.hash, v: q.get('v'), days: (Date.parse(q.get('to')) - Date.parse(q.get('from'))) / 864e5, focus: document.activeElement?.id,
        chip: document.querySelector('.chart-chips [aria-pressed="true"]')?.textContent.trim(), agg: q.get('agg'), back: document.querySelector('[data-testid="var-back"]')?.getAttribute('aria-label') }
    })
    check('[dashboard 2560] the 7 d chip and Hourly, then a panel\'s name: its chart on that window and interval, the heading focused, the back link to the dashboard', opened.hash === '#charts' && opened.v === 'air_temp' && opened.days === 7 && opened.agg === 'hourly' && opened.focus === 'var-title' && opened.chip === '7 d' && opened.back === 'Dashboard', JSON.stringify({ before, opened }))
    await page.goBack()
    await page.waitForFunction(() => !!document.querySelector('[data-testid="dashboard"]'), null, { timeout: 10000 }).catch(() => {})
    check('[dashboard 2560] Back returns to the dashboard', (await dash(page)).shown)
    const p = await problems()
    check('[dashboard 2560] console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
    await close()
  }
  for (const hash of ['#about', '#charts']) {
    const { page, close } = await open(env, `?s=acebozem${hash}`, { viewport: WIDE })
    await page.waitForFunction(() => !!document.querySelector('[data-testid="dashboard"]'), null, { timeout: 10000 }).catch(() => {})
    check(`[dashboard 2560] ${hash} is the dashboard too`, (await dash(page)).shown)
    await close()
  }
  {
    const { page, close } = await open(env, '?s=acebozem', { viewport: { name: '1920', width: 1920, height: 1080 } })
    await ready(page)
    const before = await dash(page)
    await page.getByTestId('station-switcher').click()
    await page.waitForFunction(() => document.getElementById('station-picker')?.classList.contains('is-open'), null, { timeout: 5000 }).catch(() => {})
    // The drawer slides open; the dashboard gives way once the column is narrower, then the tabs show.
    await page.waitForFunction(() => !document.querySelector('[data-testid="dashboard"]') && !!document.querySelector('[data-testid="section-row"]')?.getClientRects().length, null, { timeout: 5000 }).catch(() => {})
    const after = await dash(page)
    check('[dashboard 1920] fits 1920 × 1080, and gives way to the open station drawer (the tabs return)', before.shown && before.bottom <= 0 && !after.shown && after.tabs, JSON.stringify({ before, after }))
    await close()
  }
  for (const vp of [{ name: '1920×900', width: 1920, height: 900 }, VIEWPORTS[0]]) {
    const { page, close, rendered } = await open(env, '?s=acebozem', { viewport: vp })
    await rendered({ charts: 1, filled: ['[data-testid="now-tiles"]'] })
    const d = await dash(page)
    check(`[dashboard ${vp.name}] not enough room: the tabs and Now as before`, !d.shown && d.tabs, JSON.stringify(d))
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

/* ── Picker map (390): "Browse on the map" fills the screen; × and Esc return to the picker; a pick closes both ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem', { viewport: PHONE })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('station-switcher').tap()
  await page.getByTestId('picker-browse').tap()
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-map"] canvas'), null, { timeout: 30000 })
  const m = await page.evaluate(() => {
    const d = document.getElementById('picker-map-modal').getBoundingClientRect()
    const map = document.querySelector('[data-testid="picker-map"]').getBoundingClientRect()
    return { open: document.getElementById('picker-map-modal').open, w: Math.round(d.width), h: Math.round(d.height), vw: innerWidth, vh: innerHeight,
      mapH: Math.round(map.height), mapBottom: Math.round(map.bottom), focus: document.activeElement?.id }
  })
  check('[picker map 390] "Browse on the map" opens the map full screen (≥ 70% of the height), focus on its title',
    m.open && m.w === m.vw && m.h === m.vh && m.mapH >= 0.7 * m.vh && m.mapBottom <= m.vh && m.focus === 'picker-map-title', JSON.stringify(m))
  const pickerOpen = () => page.evaluate(() => { const e = document.getElementById('station-picker'); return !e.hidden && getComputedStyle(e).visibility === 'visible' })
  const state = async () => ({ map: await page.evaluate(() => document.getElementById('picker-map-modal').open), picker: await pickerOpen(), focus: await page.evaluate(() => document.activeElement?.dataset.testid) })
  await page.keyboard.press('Escape')
  const esc = await state()
  check('[picker map 390] Esc closes the map, not the picker; focus back on "Browse on the map"', !esc.map && esc.picker && esc.focus === 'picker-browse', JSON.stringify(esc))
  await page.getByTestId('picker-browse').tap()
  await page.getByTestId('picker-map-close').tap()
  const x = await state()
  check('[picker map 390] × closes the map, not the picker; focus back on "Browse on the map"', !x.map && x.picker && x.focus === 'picker-browse', JSON.stringify(x))
  await page.getByTestId('picker-browse').tap()
  // The fixtured station (another would need its data recorded); a pick closes everything all the same.
  await page.locator('[data-testid="picker-map"] .sr-only button[data-id="acebozem"]').evaluate((b) => b.click())
  await page.waitForFunction(() => document.getElementById('station-picker').hidden, null, { timeout: 5000 }).catch(() => {})
  const pick = { ...(await state()), s: await page.evaluate(() => new URLSearchParams(location.search).get('s')), main: await page.evaluate(() => document.activeElement?.id === 'main') }
  check('[picker map 390] a pick on the map selects it and closes the map and the picker; focus to <main>', pick.s === 'acebozem' && !pick.map && !pick.picker && pick.main, JSON.stringify(pick))
  const p = await problems()
  check('[picker map 390] console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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
