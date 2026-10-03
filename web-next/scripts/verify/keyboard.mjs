/**
 * Keyboard and assistive-tech walkthroughs (HOUSE-STYLE §5): skip link, one-row navbar
 * tab order + focus ring, station combobox, Help dialog, theme toggle, the
 * Charts drill-down and Back, tabs mounting only while open (no cross-tab requests), chart
 * table twins, map sr-table selection, reduced motion. Run via `npm run verify`.
 */
import { DL_QUERY, check, finish, open, runDownload, start } from './lib.mjs'

const env = await start()

/** Describe the focused element: accessible name or text, for readable tab-order asserts. */
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return 'body'
    return (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().replace(/\s+/g, ' ')
  })
/** The focused element shows a ring: an outline or a box-shadow from the kit's :focus-visible. */
const ringVisible = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el || !el.matches(':focus-visible')) return false
    const cs = getComputedStyle(el)
    return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'
  })
const urlParam = (page, k) => page.evaluate((k) => new URLSearchParams(location.search).get(k), k)

/* ── Skip link, navbar order, focus ring, Help dialog, theme toggle ─────── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=dark#latest')
  await rendered({ charts: 1 })

  // Fresh load: walk the navbar from the top of the document.
  // One-row navbar (DESIGN.md): logo, station switcher, Share, theme, Help; sections are below it.
  const want = ['Skip to main content', 'Montana Climate Office', 'Station: Bozeman. Change station', 'Copy a link to this view']
  const got = []
  const rings = []
  for (let i = 0; i < want.length + 2; i++) {
    await page.keyboard.press('Tab')
    got.push(await focused(page))
    rings.push(await ringVisible(page))
  }
  const theme = got[want.length]
  const help = got[want.length + 1]
  check('navbar Tab order: skip, logo, station switcher, share, theme, help',
    want.every((w, i) => got[i] === w) && /theme/i.test(theme) && help === 'About this dashboard', got.join(' → '))
  check('every navbar stop shows the focus ring', rings.every(Boolean), got.filter((_, i) => !rings[i]).join(', '))

  // Skip link: back to it (Shift+Tab past the navbar), Enter moves focus into <main>.
  for (let i = 0; i < want.length + 1; i++) await page.keyboard.press('Shift+Tab')
  check('Shift+Tab returns to the skip link', (await focused(page)) === 'Skip to main content')
  await page.keyboard.press('Enter')
  check('skip link moves focus to <main id="main">', await page.evaluate(() => document.activeElement?.id === 'main'))

  // Help dialog: opens from the keyboard, Esc closes, focus returns to "?".
  await page.locator('#btn-help').focus()
  await page.keyboard.press('Enter')
  const openState = await page.evaluate(() => {
    const d = document.getElementById('help-modal')
    return { open: d?.open, inside: d?.contains(document.activeElement), labelled: !!d?.getAttribute('aria-labelledby') }
  })
  check('Help opens with Enter, focus inside, aria-labelledby set', openState.open && openState.inside && openState.labelled, JSON.stringify(openState))
  await page.keyboard.press('Escape')
  // Read after the kit's close transition: focus must still be on the opener then, not just at keydown.
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => ({ open: document.getElementById('help-modal')?.open, id: document.activeElement?.id }))
  check('Help closes on Esc and focus returns to #btn-help', !after.open && after.id === 'btn-help', JSON.stringify(after))

  // Theme toggle: Enter and Space both cycle dark → light → high-contrast, label + storage follow.
  const themeState = () => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    label: document.getElementById('btn-theme')?.getAttribute('aria-label'),
    saved: localStorage.getItem('mco-theme'),
  }))
  const t0 = await themeState()
  await page.locator('#btn-theme').focus()
  const pressAndWait = async (key, from) => {
    await page.keyboard.press(key)
    await page.waitForFunction((from) => document.documentElement.dataset.theme !== from, from, { timeout: 5000 }).catch(() => {})
    return themeState()
  }
  const t1 = await pressAndWait('Enter', t0.theme)
  const t2 = await pressAndWait('Space', t1.theme)
  check('theme toggle: Enter then Space cycle dark → light → high-contrast',
    t0.theme === 'dark' && t1.theme === 'light' && t2.theme === 'high-contrast', `${t0.theme} → ${t1.theme} → ${t2.theme}`)
  check('theme toggle: aria-label changes and mco-theme is saved', t0.label !== t1.label && t1.label !== t2.label && t2.saved === 'high-contrast',
    JSON.stringify([t0, t1, t2]))

  const p = await problems()
  check('keyboard walk: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Station combobox by keyboard (the picker's search; first visit opens the picker) ── */
{
  const { page, problems, close } = await open(env, '?theme=light')
  const input = page.getByTestId('picker-search').getByRole('combobox')
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-search"] input')?.getAttribute('placeholder')?.length > 0)
  await input.focus()
  await page.keyboard.type('acebozem')
  await page.keyboard.press('ArrowDown')
  const active = await page.evaluate(() => {
    const id = document.querySelector('[data-testid="picker-search"] input')?.getAttribute('aria-activedescendant')
    return id ? document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() : null
  })
  check('combobox: typing + ArrowDown sets aria-activedescendant on the match', /acebozem/.test(active ?? ''), String(active))
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('s') === 'acebozem', null, { timeout: 10000 }).catch(() => {})
  check('combobox: Enter selects the station (?s=acebozem)', (await urlParam(page, 's')) === 'acebozem')
  check('combobox: popup closes, focus stays on the input',
    await input.evaluate((el) => el.getAttribute('aria-expanded') === 'false' && document.activeElement === el))
  await page.keyboard.press('Escape')
  const p = await problems()
  check('combobox: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Charts drill-down: a Now tile opens its variable page (push), Back returns ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light')
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('tile-rh').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-testid="variable-title"]')?.textContent === 'Relative Humidity', null, { timeout: 10000 }).catch(() => {})
  const opened = await page.evaluate(() => ({ hash: location.hash, v: new URLSearchParams(location.search).get('v') }))
  check('charts: Enter on a Now tile opens its variable page (#charts&v=rh)', opened.hash === '#charts' && opened.v === 'rh', JSON.stringify(opened))
  await rendered({ charts: 1 })
  await page.getByTestId('view-table').focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('.var-table-grid tbody tr', { timeout: 15000 }).catch(() => {})
  check('charts: the Table view shows the chart\'s rows', (await page.locator('.var-table-grid tbody tr').count()) > 0)
  await page.goBack()
  await page.goBack()
  await page.waitForSelector('[data-testid="now-tiles"]', { timeout: 10000 }).catch(() => {})
  const back = await page.evaluate(() => ({ hash: location.hash, v: new URLSearchParams(location.search).get('v') }))
  check('charts: Back twice returns from the table to the variable, then to Now', back.hash === '' && back.v === null, JSON.stringify(back))
  const p = await problems()
  check('charts drill-down: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Tabs mount only while open: no Latest requests from #ag / #downloader ─ */
for (const [name, query, charts] of [['ag', '?s=acebozem&var=gdd#ag', 1], ['downloader', '?s=acebozem#downloader', 0]]) {
  const { page, close, rendered } = await open(env, query)
  await rendered({ charts })
  const latest = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name)
    // Latest-only endpoints (hourly record + derived ETr, latest obs, ppt summary, sensor config, camera schedule).
    .filter((u) => /observations\/(hourly|raw)|derived\/hourly|\/latest\b|derived\/ppt|\/config\/|photos\/schedule/.test(u)))
  check(`[${name}] first load makes no Latest-tab requests`, latest.length === 0, latest.slice(0, 4).join(' | '))
  await close()
}

/* ── Map sr-only table: keyboard selection ──────────────────────────────── */
// On the Downloader map: selecting on Latest resets its cards (and so the map) by design.
{
  const { page, problems, close } = await open(env, '?theme=dark#downloader')
  const table = page.getByTestId('dl-map').locator('.sr-only table')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="dl-map"] .sr-only tbody button').length > 10, null, { timeout: 30000 })
  const shape = await table.evaluate((t) => ({
    caption: t.caption?.textContent?.trim() ?? '',
    cols: [...t.querySelectorAll('thead th')].every((th) => th.scope === 'col'),
    tabbable: t.querySelectorAll('button[tabindex="0"]').length,
  }))
  check('map sr table: caption, scoped headers, exactly one Tab stop', shape.caption.length > 0 && shape.cols && shape.tabbable === 1, JSON.stringify(shape))
  await table.locator('button[tabindex="0"]').focus()
  // Arrow down to acebozem (roving tabindex), then Enter selects it.
  for (let i = 0; i < 200; i++) {
    if ((await page.evaluate(() => document.activeElement?.dataset.id)) === 'acebozem') break
    await page.keyboard.press('ArrowDown')
  }
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('s') === 'acebozem', null, { timeout: 10000 }).catch(() => {})
  check('map sr table: ArrowDown + Enter selects acebozem', (await urlParam(page, 's')) === 'acebozem')
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-map"] .sr-only button[aria-current="true"]')?.dataset.id === 'acebozem', null, { timeout: 10000 }).catch(() => {})
  check('map sr table: aria-current marks the selection',
    await page.evaluate(() => document.querySelector('[data-testid="dl-map"] .sr-only button[aria-current="true"]')?.dataset.id === 'acebozem'))
  const p = await problems()
  check('map sr table: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Chart table twins: one per rendered chart, on every tab ────────────── */
for (const [name, query, charts, before] of [
  ['compare', '?s=acebozem#latest', 1],
  ['variable', '?s=acebozem&v=air_temp#charts', 1],
  ['ag-soil-profile', '?s=acebozem&var=soil_temp,soil_ec_blk#ag', 1],
  ['downloader', DL_QUERY, 1, runDownload],
]) {
  const { page, close, rendered } = await open(env, query)
  await before?.(page)
  await rendered({ charts })
  const twins = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('.tab-panel')].find((p) => p.offsetParent !== null)
    return [...panel.querySelectorAll('.chart-canvas')].filter((c) => c.offsetParent !== null && c.querySelector('canvas')).map((c) => {
      const t = c.parentElement.querySelector('.chart-table table')
      return {
        label: c.getAttribute('role') === 'img' && !!c.getAttribute('aria-label'),
        caption: !!t?.caption?.textContent?.trim(),
        scoped: !!t && [...t.querySelectorAll('thead th')].every((th) => th.scope === 'col'),
        rows: t?.tBodies[0]?.rows.length ?? 0,
        hidden: !!t?.closest('.sr-only'),
      }
    })
  })
  const ok = twins.length >= charts && twins.every((t) => t.label && t.caption && t.scoped && t.rows > 0 && t.hidden)
  check(`[${name}] every drawn chart: role=img + label, sr-only table with caption, scoped headers, rows`, ok, JSON.stringify(twins))
  await close()
}

/* ── Reduced motion: no chart entrance animation ────────────────────────── */
// Two canvas snapshots ~0.7 s apart right after the first draw: an animated
// entrance differs, a reduced-motion draw is already final. The no-preference
// run is the control that proves the probe can see animation at all.
async function firstDrawMoves(reducedMotion) {
  const { page, close } = await open(env, DL_QUERY, { reducedMotion })
  await runDownload(page)
  const sel = '[data-testid="dl-preview"] .chart-canvas canvas'
  await page.waitForFunction((sel) => {
    const c = document.querySelector(sel)
    return c && c.width > 0 && document.querySelectorAll('[data-testid="dl-preview"] .chart-table tbody tr').length > 0
  }, sel, { polling: 'raf', timeout: 30000 })
  const shot = () => page.evaluate((sel) => document.querySelector(sel).toDataURL(), sel)
  const a = await shot()
  await page.waitForTimeout(700)
  const b = await shot()
  const flag = await page.evaluate(() => MCO.reducedMotion())
  await close()
  return { moved: a !== b, flag }
}
const control = await firstDrawMoves('no-preference')
const reduced = await firstDrawMoves('reduce')
check('reduced motion: control run animates the first draw', control.moved && !control.flag, JSON.stringify(control))
check('reduced motion: prefers-reduced-motion → MCO.reducedMotion() and a static first draw', !reduced.moved && reduced.flag, JSON.stringify(reduced))

await env.close()
finish('keyboard')
