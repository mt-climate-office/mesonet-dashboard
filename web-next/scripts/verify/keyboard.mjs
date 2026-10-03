/**
 * Keyboard and assistive-tech walkthroughs (HOUSE-STYLE §5): skip link, one-row navbar
 * tab order + focus ring, the picker's combobox and closing on a pick, Help dialog,
 * theme toggle, the Now Provisional toggletip, the Charts drill-down and Back,
 * tabs mounting only while open (no cross-tab requests), the Download stepper,
 * the picker drawer and sheet (focus, Esc, inert), the tab bar and history, the
 * variable page's view switch and chips, focus after Charts drill-downs, the Ag
 * Options disclosure, chart table twins, map sr-table selection, reduced motion.
 * Run via `npm run verify`.
 */
import { DL_QUERY, VIEWPORTS, check, finish, known, open, runDownload, start } from './lib.mjs'

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

/* ── Station picker: a pick closes the desktop drawer ───────────────────── */
{
  // First visit (no station): the in-flow drawer is open at 1440 px.
  const { page, problems, close } = await open(env, '?theme=light#now')
  const input = page.getByTestId('picker-search').getByRole('combobox')
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-search"] input')?.getAttribute('placeholder') === 'Search by name or ID')
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
  const picked = await page.evaluate(() => ({
    drawer: document.getElementById('station-picker')?.classList.contains('is-open'),
    saved: localStorage.getItem('mco-dashboard-drawer'),
    focus: document.activeElement?.id,
  }))
  check('picker: a pick closes the desktop drawer (saved closed), focus moves to <main>',
    picked.drawer === false && picked.saved === 'closed' && picked.focus === 'main', JSON.stringify(picked))
  const p = await problems()
  check('picker: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Now: the Provisional toggletip ─────────────────────────────────────── */
{
  const { page, problems, close } = await open(env, '?s=acebozem&theme=dark#now')
  const btn = page.getByTestId('now-provisional').getByRole('button')
  await btn.waitFor({ timeout: 10000 })
  const state = () => page.evaluate(() => ({
    expanded: document.querySelector('[data-testid="now-provisional"] button')?.getAttribute('aria-expanded'),
    shown: !document.getElementById('now-provisional-tip')?.hidden,
  }))
  await btn.focus()
  await page.keyboard.press('Enter')
  const s1 = await state()
  await page.keyboard.press('Escape')
  const s2 = await state()
  await btn.click()
  await page.locator('.now-updated').click()
  const s3 = await state()
  check('Provisional toggletip: Enter opens (aria-expanded), Esc and a click outside close',
    s1.expanded === 'true' && s1.shown && s2.expanded === 'false' && !s2.shown && s3.expanded === 'false' && !s3.shown, JSON.stringify([s1, s2, s3]))
  const p = await problems()
  check('Provisional toggletip: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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

/* ── Download stepper (390 px): Next validates, focus + announcement follow ─ */
{
  const { page, close } = await open(env, '?s=acebozem#download', { viewport: VIEWPORTS[1] })
  const progress = () => page.getByTestId('dl-progress').innerText()
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.dl-step')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.testid))
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-next"]')?.disabled === false, null, { timeout: 30000 })
  check('stepper: Step 1 of 3, only Elements shown', (await progress()).includes('Step 1 of 3') && JSON.stringify(await shown()) === '["dl-step-elements"]', JSON.stringify(await shown()))
  await page.getByTestId('dl-next').click()
  // Wait for the hint rather than a fixed delay (a 200 ms sleep was flaky under load).
  await page.getByTestId('dl-step-hint').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  check('stepper: Next without elements stays and says why', (await progress()).includes('Step 1 of 3') && (await page.getByTestId('dl-step-hint').isVisible()))
  await close()
}
{
  const { page, problems, close } = await open(env, DL_QUERY, { viewport: VIEWPORTS[1] })
  const focused = () => page.evaluate(() => document.activeElement?.id)
  const live = () => page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent).join(' '))
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-next"]')?.disabled === false, null, { timeout: 30000 })
  await page.getByTestId('dl-next').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  check('stepper: Enter on Next → step 2, focus on its heading, announced',
    (await focused()) === 'dl-step-1' && (await live()).includes('Step 2 of 3: Dates & period'), `${await focused()} | ${await live()}`)
  await page.getByTestId('dl-next').click()
  await page.waitForTimeout(300)
  check('stepper: step 3 shows Run and the preview', (await focused()) === 'dl-step-2' && (await page.getByTestId('dl-run').isVisible()) && (await page.getByTestId('dl-preview').isVisible()))
  await page.getByTestId('dl-run').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="dl-download"]')?.disabled, null, { timeout: 30000 })
  await page.waitForTimeout(300)
  check('stepper: after Run, focus on the result heading and the row count announced',
    (await focused()) === 'dl-preview-title' && /Request finished: [\d,]+ rows/.test(await live()), `${await focused()} | ${await live()}`)
  const p = await problems()
  check('stepper: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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

/* ── Picker drawer (1440) and sheet (390): focus in, Esc, focus back, inert, tab order ── */
for (const vp of VIEWPORTS) {
  const label = vp.touch ? 'picker sheet (390)' : 'picker drawer (1440)'
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=dark', { viewport: vp })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  // Shown = rendered and visible (a closed sheet is `hidden`, a closed drawer `visibility: hidden`).
  const state = () => page.evaluate(() => {
    const p = document.getElementById('station-picker')
    return {
      shown: !p.hidden && getComputedStyle(p).visibility === 'visible',
      inside: p.contains(document.activeElement),
      focus: document.activeElement?.dataset.testid ?? document.activeElement?.id,
      inert: [...document.querySelectorAll('.mco-navbar, .dash-content, .dash-tabbar')].map((e) => e.inert),
    }
  })
  const shown = (want) => page.waitForFunction((want) => {
    const p = document.getElementById('station-picker')
    return (!p.hidden && getComputedStyle(p).visibility === 'visible') === want
  }, want, { timeout: 5000 }).catch(() => {})
  const s0 = await state()
  await page.getByTestId('station-switcher').focus()
  await page.keyboard.press('Enter')
  await shown(true)
  const s1 = await state()
  await page.keyboard.press('Escape')
  await shown(false)
  const s2 = await state()
  check(`${label}: Enter on the switcher opens it, focus moves in`, !s0.shown && s1.shown && s1.inside, JSON.stringify([s0, s1]))
  check(`${label}: Esc closes it, focus returns to the switcher`, !s2.shown && s2.focus === 'station-switcher', JSON.stringify(s2))
  if (vp.touch) {
    check(`${label}: navbar, content and tab bar inert while open, not after`, s1.inert.every(Boolean) && !s2.inert.some(Boolean), JSON.stringify([s1.inert, s2.inert]))
  } else {
    check(`${label}: the inline drawer is not modal (nothing inert)`, !s1.inert.some(Boolean), JSON.stringify(s1.inert))
    // Closed = visibility:hidden, so Tab from the last navbar button skips it.
    await page.locator('#btn-help').focus()
    await page.keyboard.press('Tab')
    const inPicker = await page.evaluate(() => document.getElementById('station-picker').contains(document.activeElement))
    check(`${label}: a closed drawer is out of the tab order`, !inPicker)
  }
  const p = await problems()
  check(`${label}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Tab bar (390): keyboard reachable, aria-current, Back/Forward restore sections ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light', { viewport: VIEWPORTS[1] })
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  const current = () => page.evaluate(() => ({
    section: location.hash || '#now',
    tab: document.querySelector('.dash-tabbar a[aria-current="page"]')?.dataset.section ?? null,
  }))
  // Shift+Tab from the top wraps to the end of the document: the tab bar is the last stop there.
  await page.evaluate(() => document.activeElement?.blur())
  let reached = false
  for (let i = 0; i < 10 && !reached; i++) {
    await page.keyboard.press('Shift+Tab')
    reached = await page.evaluate(() => !!document.activeElement?.closest('.dash-tabbar'))
  }
  check('tab bar: reachable with the keyboard', reached)
  check('tab bar: aria-current="page" on Now at load', (await current()).tab === 'now', JSON.stringify(await current()))
  await page.locator('.dash-tabbar a[data-section="about"]').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.hash === '#about', null, { timeout: 5000 }).catch(() => {})
  const a = await current()
  await page.goBack()
  await page.waitForFunction(() => location.hash !== '#about', null, { timeout: 5000 }).catch(() => {})
  const b = await current()
  await page.goForward()
  await page.waitForFunction(() => location.hash === '#about', null, { timeout: 5000 }).catch(() => {})
  const c = await current()
  check('tab bar: Enter on About opens it, Back restores Now, Forward restores About (aria-current follows)',
    a.section === '#about' && a.tab === 'about' && b.tab === 'now' && c.section === '#about' && c.tab === 'about', JSON.stringify([a, b, c]))
  const p = await problems()
  check('tab bar: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Variable page: the view switch and prev/next chips work from the keyboard ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&v=air_temp&theme=dark#charts')
  await rendered({ charts: 1 })
  const at = () => page.evaluate(() => ({ v: new URLSearchParams(location.search).get('v'), view: new URLSearchParams(location.search).get('view') }))
  await page.getByTestId('view-history').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'history', null, { timeout: 5000 }).catch(() => {})
  const h = await at()
  const current = await page.evaluate(() => document.querySelector('.var-views [aria-current="page"]')?.textContent?.trim())
  check('variable: Enter on History switches the view (aria-current follows)', h.view === 'history' && current === 'History', JSON.stringify({ ...h, current }))
  await page.getByTestId('var-next').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') !== 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const n = await at()
  await page.getByTestId('var-prev').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') === 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const pr = await at()
  check('variable: Enter on the next chip, then the previous chip, walks the list', n.v && n.v !== 'air_temp' && pr.v === 'air_temp', JSON.stringify([n, pr]))
  const p = await problems()
  check('variable keyboard: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Charts drill-downs: focus lands inside the new view, not on <body> ─── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light#charts')
  await rendered({ filled: ['[data-testid="var-air_temp"] .dash-spark svg'] })
  /** Press Enter on `from`, wait for `view` to show, then report where focus is. */
  const step = async (from, view) => {
    await page.locator(from).first().focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector(view, { timeout: 10000 }).catch(() => {})
    // Focus is moved after the view mounts (a tick, or after the view transition).
    await page.waitForFunction((view) => document.querySelector(view)?.contains(document.activeElement), view, { timeout: 2000 }).catch(() => {})
    return page.evaluate((view) => ({
      tag: document.activeElement?.tagName.toLowerCase(),
      inside: !!document.querySelector(view)?.contains(document.activeElement),
    }), view)
  }
  const steps = {
    'a list row': await step('[data-testid="var-air_temp"]', '[data-testid="variable-title"]'),
    'the next chip': await step('[data-testid="var-next"]', '[data-testid="variable-page"]'),
    'the previous chip': await step('[data-testid="var-prev"]', '[data-testid="variable-page"]'),
    '"‹ All variables"': await step('.var-back', '[data-testid="charts-list"]'),
    'the Compare entry': await step('[data-testid="charts-compare-link"]', '[data-testid="compare"]'),
  }
  for (const [name, f] of Object.entries(steps)) {
    known(`charts: Enter on ${name} leaves focus inside the new view, not on <body>`, f.tag !== 'body' && f.inside, 'ux/p3-review-fixes focuses the Charts headings', JSON.stringify(f))
  }
  const p = await problems()
  check('charts drill-down focus: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Ag Options disclosure (390, collapsed): Enter and Space toggle it ──── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&var=gdd&theme=light#ag', { viewport: VIEWPORTS[1] })
  await rendered({ charts: 1 })
  const isOpen = () => page.evaluate(() => document.querySelector('[data-testid="ag-controls"]').open)
  const o0 = await isOpen()
  await page.locator('[data-testid="ag-controls"] > summary').focus()
  await page.keyboard.press('Enter')
  const o1 = await isOpen()
  await page.keyboard.press('Space')
  const o2 = await isOpen()
  check('Ag Options: collapsed on phones, Enter opens, Space closes', !o0 && o1 && !o2, JSON.stringify([o0, o1, o2]))
  const p = await problems()
  check('Ag Options: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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
