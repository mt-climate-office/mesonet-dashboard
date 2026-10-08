/**
 * Keyboard and assistive-tech walkthroughs (HOUSE-STYLE §5): skip link, one-row header
 * tab order + focus ring, the ⋯ menu (arrows, Esc, focus return), Help from the menu,
 * the Theme item, the picker's combobox (closing on a pick, Recent after it, ×, the Esc order), the Now Provisional
 * toggletip, tile → variable heading, "All readings" → About's readings sheet and the photo
 * dialog, the Charts drill-down and Back, views mounting only while
 * open (no cross-view requests), legacy links (#ag, #downloader), the Download sheet
 * (focus, Esc, inert, dl key), its form (rows, reason, Preview → Download CSV), About's readings and
 * sensor-change sheets (focus in and back), the picker drawer and sheet (focus, Esc, inert), the tab
 * bar and history, the variable page (⋯ Show as table, Previous / Next, range and interval chips,
 * Custom dates), focus after Charts drill-downs (variables and Ag tools), Ag option chips and their
 * popovers, Download prefilled from a chart's ⋯, chart table twins, map sr-table selection, reduced motion.
 * Run via `npm run verify`.
 */
import { DL_QUERY, VIEWPORTS, VISIBLE_SCOPES, animationsDone, check, dlReady, finish, open, runDownload, start } from './lib.mjs'

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

/* ── Skip link, header order, focus ring, the ⋯ menu, Help dialog, theme ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=dark#latest')
  await rendered({ charts: 1 })

  // Fresh load: walk the header from the top of the document.
  // One-row header (DESIGN.md): logo, station button, the three sections (desktop), the ⋯ menu.
  const want = ['Skip to main content', 'Montana Climate Office', 'Station: Bozeman. Change station', 'Now', 'Charts', 'About', 'More']
  const got = []
  const rings = []
  for (let i = 0; i < want.length; i++) {
    await page.keyboard.press('Tab')
    got.push(await focused(page))
    rings.push(await ringVisible(page))
  }
  check('header Tab order: skip, logo, station button, Now, Charts, About, More', want.every((w, i) => got[i] === w), got.join(' → '))
  check('every header stop shows the focus ring', rings.every(Boolean), got.filter((_, i) => !rings[i]).join(', '))

  // Skip link: back to it (Shift+Tab past the header), Enter moves focus into <main>.
  for (let i = 0; i < want.length - 1; i++) await page.keyboard.press('Shift+Tab')
  check('Shift+Tab returns to the skip link', (await focused(page)) === 'Skip to main content')
  await page.keyboard.press('Enter')
  check('skip link moves focus to <main id="main">', await page.evaluate(() => document.activeElement?.id === 'main'))

  // The ⋯ menu (WAI-ARIA menu button): Enter opens on the first item, arrows move, End/Home jump,
  // Esc closes and returns focus; ArrowUp on the button opens on the last item.
  const menuState = () => page.evaluate(() => ({
    open: !document.getElementById('header-menu').hidden,
    expanded: document.querySelector('[data-testid="header-menu-button"]').getAttribute('aria-expanded'),
    focus: document.activeElement?.dataset.testid ?? null,
  }))
  const menuBtn = page.getByTestId('header-menu-button')
  await menuBtn.focus()
  await page.keyboard.press('Enter')
  const m1 = await menuState()
  await page.keyboard.press('ArrowDown')
  const m2 = await menuState()
  await page.keyboard.press('End')
  const m3 = await menuState()
  await page.keyboard.press('ArrowDown')
  const m4 = await menuState()
  check('menu: Enter opens it on the first item (aria-expanded), ArrowDown and End move, the last wraps to the first',
    m1.open && m1.expanded === 'true' && m1.focus === 'menu-share' && m2.focus === 'menu-theme' && m3.focus === 'menu-feedback' && m4.focus === 'menu-share',
    JSON.stringify([m1, m2, m3, m4]))
  await page.keyboard.press('Escape')
  const m5 = await menuState()
  check('menu: Esc closes it and focus returns to the ⋯ button', !m5.open && m5.expanded === 'false' && m5.focus === 'header-menu-button', JSON.stringify(m5))
  await page.keyboard.press('ArrowUp')
  const m6 = await menuState()
  await page.keyboard.press('Tab')
  const m7 = await menuState()
  check('menu: ArrowUp on the button opens it on the last item; Tab closes it', m6.open && m6.focus === 'menu-feedback' && !m7.open, JSON.stringify([m6, m7]))

  // Help: from the menu with the keyboard; Esc closes the dialog and focus returns to the ⋯ button.
  await menuBtn.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.getElementById('help-modal')?.open, null, { timeout: 5000 }).catch(() => {})
  const openState = await page.evaluate(() => {
    const d = document.getElementById('help-modal')
    return { open: d?.open, inside: d?.contains(document.activeElement), labelled: !!d?.getAttribute('aria-labelledby'), menu: !document.getElementById('header-menu').hidden }
  })
  check('Help opens from the menu, the menu closes, focus inside, aria-labelledby set', openState.open && openState.inside && openState.labelled && !openState.menu, JSON.stringify(openState))
  await page.keyboard.press('Escape')
  // Read after the kit's close transition: focus must still be on the opener then, not just at keydown.
  await page.waitForFunction(() => !document.getElementById('help-modal')?.open, null, { timeout: 5000 }).catch(() => {})
  await animationsDone(page)
  const after = await page.evaluate(() => ({ open: document.getElementById('help-modal')?.open, focus: document.activeElement?.dataset.testid }))
  check('Help closes on Esc and focus returns to the ⋯ button', !after.open && after.focus === 'header-menu-button', JSON.stringify(after))

  // Theme: the menu item cycles dark → light → high-contrast with Enter and Space and stays open;
  // its state text, its accessible name and the saved theme follow.
  const themeState = () => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    label: document.querySelector('[data-testid="menu-theme"]')?.getAttribute('aria-label'),
    state: document.querySelector('[data-testid="menu-theme"] .dash-menu-state')?.textContent,
    saved: localStorage.getItem('mco-theme'),
    open: !document.getElementById('header-menu').hidden,
  }))
  await menuBtn.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  const t0 = await themeState()
  const pressAndWait = async (key, from) => {
    await page.keyboard.press(key)
    await page.waitForFunction((from) => document.documentElement.dataset.theme !== from, from, { timeout: 5000 }).catch(() => {})
    return themeState()
  }
  const t1 = await pressAndWait('Enter', t0.theme)
  const t2 = await pressAndWait('Space', t1.theme)
  check('theme item: Enter then Space cycle dark → light → high-contrast, the menu stays open',
    t0.theme === 'dark' && t1.theme === 'light' && t2.theme === 'high-contrast' && t1.open && t2.open, `${t0.theme} → ${t1.theme} → ${t2.theme}`)
  check('theme item: state text and name follow, mco-theme is saved',
    t0.state === 'Dark' && t1.state === 'Light' && t2.state === 'High contrast' && t0.label !== t1.label && t2.saved === 'high-contrast', JSON.stringify([t0, t1, t2]))
  await page.keyboard.press('Escape')

  const p = await problems()
  check('keyboard walk: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Landing search (first visit): a place lists its stations (core/places) ── */
{
  const { page, problems, close } = await open(env, '?theme=light#now')
  const SEARCH = '[data-testid="landing"] [data-testid="picker-search"]'
  const input = page.locator(SEARCH).getByRole('combobox')
  await page.waitForFunction((sel) => document.querySelector(`${sel} input`)?.getAttribute('placeholder') === 'Station, town, county or ZIP', SEARCH)
  await input.focus()
  // The places load when the list opens.
  await page.keyboard.type('bozeman')
  await page.waitForFunction((sel) => document.querySelectorAll(`${sel} .ctl-combobox-group`).length > 0, SEARCH, { timeout: 10000 }).catch(() => {})
  const heads = await page.locator(`${SEARCH} .ctl-combobox-group:visible`).allInnerTexts()
  check('place search: stations and places under their own headings', heads.join('|').toLowerCase() === 'stations|places', JSON.stringify(heads))
  await page.keyboard.press('Escape') // clears the text
  await page.keyboard.type('gallatin')
  // The county's exact keyword becomes the active option.
  await page.waitForFunction((sel) => {
    const id = document.querySelector(`${sel} input`)?.getAttribute('aria-activedescendant')
    return id && /Gallatin County/.test(document.getElementById(id)?.textContent ?? '')
  }, SEARCH, { timeout: 5000 }).catch(() => {})
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="landing"] [data-testid="near-list"] .picker-row').length > 0, null, { timeout: 5000 }).catch(() => {})
  const near = await page.evaluate(() => {
    const group = document.querySelector('[data-testid="landing"] [data-testid="near-results"]')
    const title = group?.querySelector('h3')
    return {
      title: title?.textContent,
      labelled: !!title?.id && group.getAttribute('aria-labelledby') === title.id,
      rows: group?.querySelectorAll('.picker-row').length,
      s: new URLSearchParams(location.search).get('s'),
    }
  })
  check('place search: Enter on a county lists its stations under its name, picks none',
    near.title === 'Gallatin County' && near.labelled && near.rows > 1 && near.s === null, JSON.stringify(near))
  const p = await problems()
  check('place search: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── First visit: the landing, not the picker; its search picks; the picker then closes on a pick ── */
{
  const { page, problems, close } = await open(env, '?theme=light#now')
  // One earlier station in Recent, so the pick below should make two rows without a reload.
  await page.evaluate(() => localStorage.setItem('mco-dashboard-recent', 'mdaglasw'))
  await page.reload({ waitUntil: 'load' })
  const SEARCH = '[data-testid="landing"] [data-testid="picker-search"]'
  const input = page.locator(SEARCH).getByRole('combobox')
  await page.waitForFunction((sel) => document.querySelector(`${sel} input`)?.getAttribute('placeholder') === 'Station, town, county or ZIP', SEARCH)
  const first = await page.evaluate(() => ({
    drawer: document.getElementById('station-picker')?.classList.contains('is-open'),
    sections: getComputedStyle(document.querySelector('.dash-section-host')).display,
    heading: document.getElementById('landing-title')?.textContent,
  }))
  check('first visit: the landing shows in place of the sections; the picker drawer stays closed',
    first.drawer === false && first.sections === 'none' && first.heading === 'Choose a station', JSON.stringify(first))
  await input.focus()
  await page.keyboard.type('acebozem')
  await page.keyboard.press('ArrowDown')
  const active = await page.evaluate((sel) => {
    const id = document.querySelector(`${sel} input`)?.getAttribute('aria-activedescendant')
    return id ? document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() : null
  }, SEARCH)
  // The option shows the station's name and network ("Bozeman HydroMet"), as the Recent rows do.
  check('combobox: typing + ArrowDown sets aria-activedescendant on the match', /^Bozeman\b/.test(active ?? ''), String(active))
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('s') === 'acebozem', null, { timeout: 10000 }).catch(() => {})
  check('combobox: Enter selects the station (?s=acebozem)', (await urlParam(page, 's')) === 'acebozem')
  const picked = await page.evaluate(() => ({
    landing: !!document.querySelector('[data-testid="landing"]'),
    now: !!document.querySelector('[data-testid="now"]') && getComputedStyle(document.querySelector('.dash-section-host')).display !== 'none',
    focus: document.activeElement?.id,
  }))
  check('landing: a pick shows the section, focus moves to <main>', !picked.landing && picked.now && picked.focus === 'main', JSON.stringify(picked))
  // Recent follows the pick at once (it used to need a reload); a pick in the drawer closes it.
  await page.getByTestId('station-switcher').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="recent-list"] .picker-row').length === 2, null, { timeout: 5000 }).catch(() => {})
  const recent = await page.locator('[data-testid="recent-list"] .picker-row').allInnerTexts()
  check('picker: after a pick, opening it shows 2 Recent rows (new first)', recent.length === 2 && /Bozeman/.test(recent[0]), JSON.stringify(recent))
  // Bozeman again (the fixtures hold only its data): a pick closes the drawer even when the station stays.
  await page.locator('[data-testid="recent-list"] .picker-row').first().click()
  await page.waitForFunction(() => !document.getElementById('station-picker')?.classList.contains('is-open'), null, { timeout: 5000 }).catch(() => {})
  const closed = await page.evaluate(() => ({
    drawer: document.getElementById('station-picker')?.classList.contains('is-open'),
    saved: localStorage.getItem('mco-dashboard-drawer'),
    focus: document.activeElement?.id,
  }))
  check('picker: a pick closes the desktop drawer (saved closed), focus moves to <main>',
    closed.drawer === false && closed.saved === 'closed' && closed.focus === 'main', JSON.stringify(closed))
  const p = await problems()
  check('landing + picker: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Station picker search: starts empty; × clears, keeps focus, shows the full list; Esc order ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light#now')
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('station-switcher').click()
  const search = page.getByTestId('picker-search')
  const input = search.getByRole('combobox')
  await input.waitFor({ state: 'visible' })
  // Read after two frames, so Alpine has applied the last key or click.
  const view = () => page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const el = document.querySelector('[data-testid="picker-search"] input')
    const popup = document.querySelector('[data-testid="picker-search"] .ctl-combobox-popup')
    return {
      value: el.value,
      focused: document.activeElement === el,
      list: !!popup && getComputedStyle(popup).display !== 'none',
      options: document.querySelectorAll('[data-testid="picker-search"] [role="option"]').length,
      clear: getComputedStyle(document.querySelector('[data-testid="picker-search"] .ctl-clear')).display !== 'none',
      picker: document.getElementById('station-picker').classList.contains('is-open'),
    }
  })
  const v0 = await view()
  check('picker search: starts empty with no ×', v0.value === '' && !v0.clear, JSON.stringify(v0))
  await input.fill('bo')
  const v1 = await view()
  await search.locator('.ctl-clear').click()
  const v2 = await view()
  check('picker search: × shows with text; it clears the text, keeps focus and shows the full list',
    v1.clear && v2.value === '' && v2.focused && v2.list && v2.options > v1.options && !v2.clear, JSON.stringify([v1, v2]))
  await input.fill('gl')
  await page.keyboard.press('Escape')
  const e1 = await view()
  await page.keyboard.press('Escape')
  const e2 = await view()
  await page.keyboard.press('Escape')
  const e3 = await view()
  check('picker search: Esc clears the text, then closes the list, then closes the picker',
    e1.value === '' && e1.list && e1.picker && !e2.list && e2.picker && !e3.picker, JSON.stringify([e1, e2, e3]))
  const p = await problems()
  check('picker search: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
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

/* ── Now: a tile focuses its variable's heading; "All readings" opens About's readings sheet ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=dark')
  await rendered({ charts: 1, filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('tile-rh').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.id === 'var-title', null, { timeout: 10000 }).catch(() => {})
  const tile = await page.evaluate(() => ({ hash: location.hash, v: new URLSearchParams(location.search).get('v'), focus: document.activeElement?.id }))
  check('Now: Enter on a tile opens its variable page and focuses its heading', tile.hash === '#charts' && tile.v === 'rh' && tile.focus === 'var-title', JSON.stringify(tile))
  await page.goBack()
  await page.waitForSelector('[data-testid="now-all-readings"]', { timeout: 10000 })
  await page.getByTestId('now-all-readings').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.getElementById('sheet-about-readings')?.contains(document.activeElement), null, { timeout: 10000 }).catch(() => {})
  const rows = await page.evaluate(() => ({ hash: location.hash, open: !document.getElementById('sheet-about-readings').hidden, inside: document.getElementById('sheet-about-readings').contains(document.activeElement) }))
  check('Now: Enter on "All readings" opens About with its readings sheet open, focus inside', rows.hash === '#about' && rows.open && rows.inside, JSON.stringify(rows))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.getElementById('sheet-about-readings').hidden, null, { timeout: 5000 }).catch(() => {})
  const back = await page.evaluate(() => document.activeElement?.id)
  check('Now: Esc closes the readings sheet and focus returns to its row (#about-readings)', back === 'about-readings', back)
  const p = await problems()
  check('Now tiles and rows: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Now: the photo dialog (direction / day / time pickers) ─────────────── */
{
  const { page, problems, close } = await open(env, '?s=acebozem&theme=dark#now')
  const tile = page.getByTestId('now-photo-open')
  await tile.waitFor({ timeout: 10000 })
  const tileSrc = await page.getByTestId('now-photo-image').getAttribute('src')
  await tile.focus()
  await page.keyboard.press('Enter')
  const img = page.getByTestId('photo-modal-image')
  await img.waitFor({ timeout: 10000 })
  const src0 = await img.getAttribute('src')
  check('photo dialog: Enter on the tile opens it on the tile\'s frame', src0 === tileSrc, `${src0} vs ${tileSrc}`)
  // Arrow keys move the checked direction radio (a native radio group) and so the frame.
  await page.locator('[data-testid="photo-directions"] input:checked').focus()
  await page.keyboard.press('ArrowRight')
  const changed = await page.waitForFunction((s) => {
    const src = document.querySelector('[data-testid="photo-modal-image"]')?.getAttribute('src')
    return src && src !== s ? src : null
  }, src0, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => null)
  check('photo dialog: ArrowRight on the direction changes the image src', !!changed, String(changed))
  // A modal <dialog> makes the page inert: Tab cycles its controls and the browser chrome (body), never the page.
  const stops = []
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    stops.push(await page.evaluate(() => {
      const el = document.activeElement
      return !el || el === document.body ? 'chrome' : el.closest('[data-testid="photo-modal"]') ? 'in' : 'page'
    }))
  }
  check('photo dialog: Tab never leaves it for the page', !stops.includes('page') && stops.lastIndexOf('in') > stops.indexOf('chrome'), stops.join(' '))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[data-testid="photo-modal"]')?.open, null, { timeout: 5000 }).catch(() => {})
  const after = await page.evaluate(() => ({
    open: !!document.querySelector('[data-testid="photo-modal"]')?.open,
    focus: document.activeElement?.getAttribute('data-testid'),
    tile: document.querySelector('[data-testid="now-photo-image"]')?.getAttribute('src'),
  }))
  check('photo dialog: Esc closes, focus returns to the tile, the tile still shows the latest frame',
    !after.open && after.focus === 'now-photo-open' && after.tile === tileSrc, JSON.stringify(after))
  const p = await problems()
  check('photo dialog: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Charts drill-down: a Now tile opens its variable page (push), Back returns ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light')
  await rendered({ filled: ['[data-testid="now-tiles"]'] })
  await page.getByTestId('tile-rh').focus()
  await page.keyboard.press('Enter')
  // The plain name (core/variables/labels); a timeout fails the check below instead of passing quietly.
  await page.waitForFunction(() => document.querySelector('[data-testid="variable-title"]')?.textContent === 'Humidity', null, { timeout: 10000 }).catch(() => {})
  const opened = await page.evaluate(() => ({ hash: location.hash, v: new URLSearchParams(location.search).get('v'), title: document.querySelector('[data-testid="variable-title"]')?.textContent }))
  check('charts: Enter on a Now tile opens its variable page (#charts&v=rh, "Humidity")', opened.hash === '#charts' && opened.v === 'rh' && opened.title === 'Humidity', JSON.stringify(opened))
  await rendered({ charts: 1 })
  // ⋯ → Show as table from the keyboard: Enter opens the menu on its first item, ArrowDown, Enter.
  await page.getByTestId('var-menu-button').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForSelector('.var-table-grid tbody tr', { timeout: 15000 }).catch(() => {})
  check('charts: ⋯ → Show as table replaces the chart with its rows (tbl=1)', (await page.locator('.var-table-grid tbody tr').count()) > 0 && (await urlParam(page, 'tbl')) === '1')
  // The table's own Show as chart button: back to the chart, focus on the heading (its button unmounts).
  await page.getByTestId('table-show-chart').focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="variable-chart"]', { timeout: 10000 }).catch(() => {})
  const shown = await page.evaluate(() => ({ tbl: new URLSearchParams(location.search).get('tbl'), focus: document.activeElement?.id }))
  check('charts: the table’s Show as chart button returns to the chart and focuses the heading', shown.tbl === null && shown.focus === 'var-title', JSON.stringify(shown))
  await page.goBack()
  await page.goBack()
  await page.goBack()
  await page.waitForSelector('[data-testid="now-tiles"]', { timeout: 10000 }).catch(() => {})
  const back = await page.evaluate(() => ({ hash: location.hash, v: new URLSearchParams(location.search).get('v') }))
  check('charts: Back returns through the table to the variable, then to Now', back.hash === '' && back.v === null, JSON.stringify(back))
  const p = await problems()
  check('charts drill-down: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Views mount only while open: no Now/list requests from an Ag tool; no downloader while dl is off ─ */
{
  const { page, close, rendered } = await open(env, '?s=acebozem#charts')
  await rendered({ filled: ['[data-testid="var-air_temp"] .dash-spark svg'] })
  check('[charts list] the Download sheet is closed and its form not mounted', await page.evaluate(() =>
    document.getElementById('sheet-download').hidden && !document.querySelector('[data-testid="downloader"]')))
  await close()
}
for (const [name, query, charts] of [['ag', '?s=acebozem&v=gdd#charts', 1]]) {
  const { page, close, rendered } = await open(env, query)
  await rendered({ charts })
  const latest = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name)
    // Latest-only endpoints (hourly record + derived ETr, latest obs, ppt summary, sensor config, camera schedule).
    .filter((u) => /observations\/(hourly|raw)|derived\/hourly|\/latest\b|derived\/ppt|\/config\/|photos\/schedule/.test(u)))
  check(`[${name}] first load makes no Latest-tab requests`, latest.length === 0, latest.slice(0, 4).join(' | '))
  await close()
}

/* ── Download form (390 touch): rows expand one at a time, the button says why it cannot run ── */
{
  const { page, problems, close } = await open(env, '?s=acebozem&dl=1#charts', { viewport: VIEWPORTS[1] })
  await dlReady(page)
  const rows = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dl-row-btn')].map((b) => [b.id, b.getAttribute('aria-expanded')])))
  const station = await page.getByTestId('dl-station').innerText()
  check('download form: four rows, all closed, the station a fixed line "Bozeman (acebozem)"',
    JSON.stringify(Object.values(await rows())) === '["false","false","false","false"]' && /Bozeman \(acebozem\)/.test(station), JSON.stringify([await rows(), station]))
  const run = page.getByTestId('dl-run')
  check('download form: no variables → the button is aria-disabled with a one-line reason',
    (await run.getAttribute('aria-disabled')) === 'true' && (await page.getByTestId('dl-hint').innerText()) === 'Pick at least one variable.' &&
      (await run.getAttribute('aria-describedby')) === 'dl-reason', await page.getByTestId('dl-hint').innerText())
  await page.locator('#dl-row-vars-btn').click()
  const r1 = await rows()
  await page.locator('#dl-row-dates-btn').focus()
  await page.keyboard.press('Enter')
  const r2 = await rows()
  const datesShown = await page.getByTestId('dl-dates').waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)
  const varsHidden = await page.locator('#dl-row-vars-panel').waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false)
  check('download form: a row expands in place; opening another closes it (Enter works)',
    r1['dl-row-vars-btn'] === 'true' && r2['dl-row-vars-btn'] === 'false' && r2['dl-row-dates-btn'] === 'true' && datesShown && varsHidden, JSON.stringify([r1, r2, datesShown, varsHidden]))
  await page.locator('#dl-row-vars-btn').click()
  const firstCheck = page.getByTestId('dl-elements').locator('.ctl-check:not(.ctl-check-all)').first()
  check('download form: the Variables row opens straight to the checklist (no second disclosure)',
    (await page.getByTestId('dl-elements').locator('.ctl-disclosure').count()) === 0 &&
      (await firstCheck.waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false)))
  await page.getByTestId('dl-elements').locator('.ctl-check:not(.ctl-check-all)').first().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-run"]')?.getAttribute('aria-disabled') === 'false', null, { timeout: 5000 }).catch(() => {})
  check('download form: picking a variable enables Preview and clears the reason',
    (await run.getAttribute('aria-disabled')) === 'false' && !(await page.getByTestId('dl-hint').isVisible()) && !!(await urlParam(page, 'els')))
  const filter = page.getByTestId('dl-elements').locator('.ctl-multiselect-panel input[type="search"]')
  await filter.fill('air')
  await page.keyboard.press('Escape')
  const cleared = { value: await filter.inputValue(), panel: await filter.isVisible(), focused: await filter.evaluate((el) => el === document.activeElement) }
  check('download form: the first Esc in the checklist clears the filter text and keeps it open',
    cleared.value === '' && cleared.panel && cleared.focused, JSON.stringify(cleared))
  await page.keyboard.press('Escape')
  await page.locator('#sheet-download').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  check('download form: the next Esc (empty filter) goes on to close the sheet',
    await page.evaluate(() => document.getElementById('sheet-download').hidden))
  const p = await problems()
  check('download form: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}
/* ── Download run (390 touch): Preview → "Download CSV · N rows" on the same focused button, announced; Esc returns focus ── */
{
  const { page, problems, close } = await open(env, DL_QUERY, { viewport: VIEWPORTS[1] })
  const live = () => page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent).join(' '))
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-run"]')?.getAttribute('aria-disabled') === 'false', null, { timeout: 30000 })
  await page.getByTestId('dl-run').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-download"]')?.getAttribute('aria-disabled') === 'false', null, { timeout: 30000 })
  const label = await page.getByTestId('dl-download').innerText()
  check('download run: Enter on Preview → "Download CSV · N rows", focus kept on the button, the row count announced',
    /^Download CSV · [\d,]+ rows$/.test(label.trim()) && (await page.evaluate(() => document.activeElement?.dataset.testid)) === 'dl-download' &&
      /Request finished: [\d,]+ rows/.test(await live()), `${label} | ${await live()}`)
  const chart = await page.getByTestId('dl-preview').locator('.chart-canvas canvas').waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)
  check('download run: the preview chart shows', chart)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.keyboard.press('Enter')])
  check('download run: Enter on Download CSV saves the CSV', dl.suggestedFilename() === 'acebozem_daily_20260901_to_20260930.csv', dl.suggestedFilename())
  await page.locator('#dl-row-interval-btn').click()
  await page.getByTestId('dl-period').locator('input[value="monthly"]').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-run"]')?.textContent.trim() === 'Preview', null, { timeout: 5000 }).catch(() => {})
  const hidden = await page.getByTestId('dl-preview').waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false)
  const back = { label: (await page.locator('.dl-btn-primary').innerText()).trim(), preview: !hidden, period: await urlParam(page, 'period') }
  check('download run: changing an input turns the button back into Preview',
    back.label === 'Preview' && !back.preview && back.period === 'monthly', JSON.stringify(back))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.getElementById('sheet-download').hidden, null, { timeout: 5000 }).catch(() => {})
  check('download run: Esc closes the sheet, clears dl, focus returns to <main> (the URL opened it)',
    (await urlParam(page, 'dl')) === null && (await page.evaluate(() => document.activeElement?.id)) === 'main')
  const p = await problems()
  check('download run: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Map sr-only table: keyboard selection ──────────────────────────────── */
// On the landing's map (a first visit): a pick sets ?s=.
{
  const { page, problems, close } = await open(env, '?theme=dark')
  const table = page.getByTestId('landing-map').locator('.sr-only table')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="landing-map"] .sr-only tbody button').length > 10, null, { timeout: 30000 })
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
  // The landing gives way to Now; the picker's map (opened from the header) marks the selection.
  check('map sr table: the pick replaces the landing with Now', await page.evaluate(() => !document.querySelector('[data-testid="landing"]') && !!document.querySelector('[data-testid="now"]')))
  await page.getByTestId('station-switcher').click()
  await page.getByTestId('picker-browse').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-map"] .sr-only button[aria-current="true"]')?.dataset.id === 'acebozem', null, { timeout: 30000 }).catch(() => {})
  check('map sr table: aria-current marks the selection',
    await page.evaluate(() => document.querySelector('[data-testid="picker-map"] .sr-only button[aria-current="true"]')?.dataset.id === 'acebozem'))
  const p = await problems()
  check('map sr table: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Chart table twins: one per rendered chart, on every tab ────────────── */
for (const [name, query, charts, before] of [
  ['now-strip', '?s=acebozem', 1],
  ['compare', '?s=acebozem#latest', 1],
  ['variable', '?s=acebozem&v=air_temp#charts', 1],
  ['ag-soil-profile', '?s=acebozem&v=soil_temp,soil_ec_blk#charts', 1],
  ['downloader', DL_QUERY, 1, runDownload],
]) {
  const { page, close, rendered } = await open(env, query)
  await before?.(page)
  await rendered({ charts })
  const twins = await page.evaluate((scopes) => {
    const panels = [...document.querySelectorAll(scopes)].filter((p) => !p.hidden && p.getClientRects().length > 0)
    return panels.flatMap((p) => [...p.querySelectorAll('.chart-canvas')]).filter((c) => c.offsetParent !== null && c.querySelector('canvas')).map((c) => {
      const t = c.parentElement.querySelector('.chart-table table')
      return {
        label: c.getAttribute('role') === 'img' && !!c.getAttribute('aria-label'),
        caption: !!t?.caption?.textContent?.trim(),
        scoped: !!t && [...t.querySelectorAll('thead th')].every((th) => th.scope === 'col'),
        rows: t?.tBodies[0]?.rows.length ?? 0,
        hidden: !!t?.closest('.sr-only'),
      }
    })
  }, VISIBLE_SCOPES)
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
    // Closed = visibility:hidden, so Tab from the last header button skips it.
    await page.getByTestId('header-menu-button').focus()
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

/* ── Variable page: ⋯ Previous / Next, range and interval chips, Custom dates, from the keyboard ── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&v=air_temp&theme=dark#charts')
  await rendered({ charts: 1 })
  const at = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
  /** Open the ⋯ menu from the keyboard and choose the item with `testid`. */
  const choose = async (testid) => {
    await page.getByTestId('var-menu-button').focus()
    await page.keyboard.press('Enter')
    for (let i = 0; i < 8 && (await page.evaluate(() => document.activeElement?.dataset.testid)) !== testid; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
  }
  // Next/Previous before All years: a press in All years can fetch the next variable's history (unfixtured).
  await choose('var-next')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') !== 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const n = await at()
  await rendered({ charts: 1 })
  await choose('var-prev')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('v') === 'air_temp', null, { timeout: 5000 }).catch(() => {})
  const pr = await at()
  check('variable: ⋯ → Next, then ⋯ → Previous, walk the list from the keyboard', n.v && n.v !== 'air_temp' && pr.v === 'air_temp', JSON.stringify([n.v, pr.v]))
  await rendered({ charts: 1 })
  await page.getByTestId('range-7d').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !!new URLSearchParams(location.search).get('from'), null, { timeout: 5000 }).catch(() => {})
  const pressed = await page.evaluate(() => document.querySelector('[data-testid="range-7d"]')?.getAttribute('aria-pressed'))
  check('variable: Enter on the 7 d chip sets the window and presses it', !!(await at()).from && pressed === 'true', JSON.stringify({ ...(await at()), pressed }))
  await rendered({ charts: 1 })
  await page.getByTestId('interval-daily').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('agg') === 'daily', null, { timeout: 5000 }).catch(() => {})
  const raw = await page.evaluate(() => document.querySelector('[data-testid="interval-raw"]')?.disabled)
  check('variable: Enter on Daily sets agg=daily; 5-min is offered for 7 d', (await at()).agg === 'daily' && raw === false, JSON.stringify({ ...(await at()), raw }))
  await rendered({ charts: 1 })
  const auto = await page.evaluate(() => document.querySelector('[data-testid="interval-auto"]')?.textContent?.trim())
  check('variable: the Auto chip names what it picks', auto === 'Auto (hourly)', auto)
  // Custom dates…: a modal sheet, focus inside, Esc closes, focus back on ⋯.
  await choose('var-menu-dates')
  await page.waitForFunction(() => !document.getElementById('sheet-dates').hidden, null, { timeout: 5000 }).catch(() => {})
  await animationsDone(page)
  const inside = await page.evaluate(() => document.getElementById('sheet-dates').contains(document.activeElement) && !!document.querySelector('[data-testid="custom-dates"]'))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.getElementById('sheet-dates').hidden, null, { timeout: 5000 }).catch(() => {})
  const back = await page.evaluate(() => document.activeElement?.dataset.testid)
  check('variable: ⋯ → Custom dates… opens its sheet (focus inside); Esc returns focus to ⋯', inside && back === 'var-menu-button', JSON.stringify({ inside, back }))
  const p = await problems()
  check('variable keyboard: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Charts drill-downs: focus moves to the new view's heading ─────────── */
{
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=light#charts')
  await rendered({ filled: ['[data-testid="var-air_temp"] .dash-spark svg'] })
  /** Enter on `from`; then wait (the focus follows the view transition) for the URL to change and `#heading` to hold focus. */
  const lands = async (name, from, heading) => {
    const before = page.url()
    await page.locator(from).first().focus()
    await page.keyboard.press('Enter')
    const ok = await page.waitForFunction(({ before, heading }) => location.href !== before && document.activeElement?.id === heading,
      { before, heading }, { timeout: 10000 }).then(() => true, () => false)
    const at = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName.toLowerCase())
    check(`charts: Enter on ${name} moves focus to #${heading}`, ok, `focus on ${at}`)
  }
  /** ⋯ → `testid` (Previous / Next) from the keyboard, then as `lands`. */
  const viaMenu = async (name, testid) => {
    await page.getByTestId('var-menu-button').focus()
    await page.keyboard.press('Enter')
    for (let i = 0; i < 8 && (await page.evaluate(() => document.activeElement?.dataset.testid)) !== testid; i++) await page.keyboard.press('ArrowDown')
    await lands(name, `[data-testid="${testid}"]`, 'var-title')
  }
  await lands('a list row', '[data-testid="var-air_temp"]', 'var-title')
  await viaMenu('⋯ → Next', 'var-next')
  await viaMenu('⋯ → Previous', 'var-prev')
  await lands('the back button', '[data-testid="var-back"]', 'charts-list-title')
  await lands('an Ag tools row', '[data-testid="ag-tool-gdd"]', 'ag-chart-title')
  await lands('the Ag back button', '[data-testid="ag-back"]', 'charts-list-title')
  await lands('the Compare entry', '[data-testid="charts-compare-link"]', 'charts-compare-title')
  const p = await problems()
  check('charts drill-down focus: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Ag option chips: a popover per chip; Enter opens (focus in), a change applies, Esc returns focus ── */
for (const vp of VIEWPORTS) {
  const label = `Ag option chips (${vp.name})`
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&v=gdd&theme=light#charts', { viewport: vp })
  await rendered({ charts: 1 })
  const state = (id) => page.evaluate((id) => ({
    open: !document.getElementById(`ag-opt-${id}-panel`).hidden,
    expanded: document.querySelector(`[data-testid="ag-opt-${id}"]`).getAttribute('aria-expanded'),
    inside: document.getElementById(`ag-opt-${id}-panel`).contains(document.activeElement),
    focus: document.activeElement?.dataset.testid ?? null,
    text: document.querySelector(`[data-testid="ag-opt-${id}"]`).textContent.trim(),
  }), id)
  await page.getByTestId('ag-opt-crop').focus()
  await page.keyboard.press('Enter')
  const s1 = await state('crop')
  check(`${label}: Enter on the crop chip opens its popover, focus inside`, s1.open && s1.expanded === 'true' && s1.inside, JSON.stringify(s1))
  // Focus starts on the first crop (Wheat); Tab to Barley, Enter picks it and closes.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('crop') === 'barley', null, { timeout: 5000 }).catch(() => {})
  const s2 = await state('crop')
  check(`${label}: choosing a crop applies it (crop=barley), closes, focus back on the chip, its text follows`,
    !s2.open && s2.focus === 'ag-opt-crop' && s2.text === 'Barley' && (await urlParam(page, 'crop')) === 'barley', JSON.stringify(s2))
  await page.getByTestId('ag-opt-projection').focus()
  await page.keyboard.press('Enter')
  const s3 = await state('projection')
  await page.keyboard.press('Escape')
  const s4 = await state('projection')
  check(`${label}: the projection popover opens with focus inside; Esc closes it and returns focus to its chip`,
    s3.open && s3.inside && !s4.open && s4.focus === 'ag-opt-projection' && s4.expanded === 'false', JSON.stringify([s3, s4]))
  const p = await problems()
  check(`${label}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Download sheet (1440 centred, 390 bottom): ⋯ → Download data, prefilled; focus in, inert, Esc, dl ── */
for (const vp of VIEWPORTS) {
  const label = `Download sheet (${vp.name})`
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&v=air_temp&theme=dark#charts', { viewport: vp })
  await rendered({ charts: 1 })
  const state = () => page.evaluate(() => {
    const s = document.getElementById('sheet-download')
    return {
      shown: !s.hidden && s.getClientRects().length > 0,
      inside: s.contains(document.activeElement),
      focus: document.activeElement?.dataset.testid ?? document.activeElement?.id,
      dl: new URLSearchParams(location.search).get('dl'),
      inert: [...document.querySelectorAll('.mco-navbar, .dash-shell, .dash-tabbar')].map((e) => e.inert),
      form: !!s.querySelector('[data-testid="downloader"]'),
    }
  })
  await page.getByTestId('var-menu-button').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter') // the first item: Download data
  await page.waitForFunction(() => new URLSearchParams(location.search).get('dl') === '1' && !document.getElementById('sheet-download').hidden, null, { timeout: 5000 }).catch(() => {})
  await animationsDone(page)
  const s1 = await state()
  const keys = await page.evaluate(() => Object.fromEntries(['els', 'dl_from', 'dl_to', 'period'].map((k) => [k, new URLSearchParams(location.search).get(k)])))
  check(`${label}: ⋯ → Download data opens it (dl=1), focus inside, the form mounted`, s1.shown && s1.inside && s1.dl === '1' && s1.form, JSON.stringify(s1))
  check(`${label}: prefilled from the chart (els = its elements, the 14 d window, hourly)`,
    keys.els === 'air_temp_0200' && !!keys.dl_from && !!keys.dl_to && keys.period === 'hourly', JSON.stringify(keys))
  check(`${label}: header, content and tab bar inert while open`, s1.inert.every(Boolean), JSON.stringify(s1.inert))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.getElementById('sheet-download').hidden, null, { timeout: 5000 }).catch(() => {})
  const s2 = await state()
  check(`${label}: Esc closes it, clears dl, unmounts the form, focus returns to ⋯`,
    !s2.shown && s2.dl === null && !s2.form && s2.focus === 'var-menu-button' && !s2.inert.some(Boolean), JSON.stringify(s2))
  const p = await problems()
  check(`${label}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── About sheets (1440 centred, 390 bottom): a row opens its sheet, focus in, Esc / × close, focus back;
      Now's "All readings" (navigate target #about-readings) opens the readings sheet ── */
for (const vp of VIEWPORTS) {
  const label = `About sheets (${vp.name})`
  const { page, problems, close, rendered } = await open(env, '?s=acebozem&theme=dark#about', { viewport: vp })
  await rendered({ filled: ['[data-testid="about-details"] .about-dl'] })
  const state = (id) => page.evaluate((id) => {
    const s = document.getElementById(`sheet-${id}`)
    return {
      shown: !s.hidden && s.getClientRects().length > 0,
      inside: s.contains(document.activeElement),
      focus: document.activeElement?.dataset.testid ?? document.activeElement?.id,
      inert: [...document.querySelectorAll('.mco-navbar, .dash-shell, .dash-tabbar')].map((e) => e.inert),
      region: !!s.querySelector('.about-scroll[role="region"][tabindex="0"]'),
    }
  }, id)
  const shut = (id) => page.waitForFunction((id) => document.getElementById(`sheet-${id}`).hidden, id, { timeout: 5000 }).catch(() => {})
  await page.getByTestId('about-readings-row').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-testid="about-readings-table"] tbody')?.children.length > 0, null, { timeout: 10000 }).catch(() => {})
  await animationsDone(page)
  const r1 = await state('about-readings')
  check(`${label}: Enter on "All current readings" opens its sheet, focus inside, page inert, the table in a focusable region`,
    r1.shown && r1.inside && r1.inert.every(Boolean) && r1.region, JSON.stringify(r1))
  await page.keyboard.press('Escape')
  await shut('about-readings')
  const r2 = await state('about-readings')
  check(`${label}: Esc closes it, focus returns to the row`, !r2.shown && r2.focus === 'about-readings-row' && !r2.inert.some(Boolean), JSON.stringify(r2))
  await page.getByTestId('about-history-row').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-testid="about-history"] .about-days')?.children.length > 0, null, { timeout: 10000 }).catch(() => {})
  await animationsDone(page)
  const h1 = await state('about-history')
  check(`${label}: Enter on "Sensor changes" opens its sheet, focus inside`, h1.shown && h1.inside && h1.region, JSON.stringify(h1))
  await page.getByTestId('sheet-about-history-close').click()
  await shut('about-history')
  const h2 = await state('about-history')
  check(`${label}: × closes it, focus returns to the row`, !h2.shown && h2.focus === 'about-history-row', JSON.stringify(h2))
  // Now's "All readings" link: About with the readings sheet open; closing it leaves focus on the row.
  await page.locator(vp.touch ? '.dash-tabbar a[data-section="now"]' : 'a.dash-section-link[data-section="now"]').click()
  await page.waitForFunction(() => location.hash === '#now' && document.querySelector('[data-testid="now-all-readings"]'), null, { timeout: 10000 }).catch(() => {})
  await page.getByTestId('now-all-readings').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !document.getElementById('sheet-about-readings').hidden, null, { timeout: 10000 }).catch(() => {})
  await animationsDone(page)
  const n1 = await state('about-readings')
  const hash = await page.evaluate(() => location.hash)
  check(`${label}: Now's "All readings" lands on About with the readings sheet open, focus inside`, hash === '#about' && n1.shown && n1.inside, JSON.stringify({ hash, ...n1 }))
  await page.keyboard.press('Escape')
  await shut('about-readings')
  const n2 = await state('about-readings')
  check(`${label}: closing it leaves focus on the readings row`, !n2.shown && n2.focus === 'about-readings-row', JSON.stringify(n2))
  const p = await problems()
  check(`${label}: console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

/* ── Legacy links land somewhere sensible (DESIGN.md "Information architecture") ── */
{
  const at = (page) => page.evaluate(() => ({ hash: location.hash, q: Object.fromEntries(new URLSearchParams(location.search)) }))
  {
    // An old GDD link: Ag keys but no `var` → GDD with its crop kept.
    const { page, problems, close, rendered } = await open(env, '?s=acebozem&crop=corn#ag')
    await rendered({ charts: 1 })
    const u = await at(page)
    const head = await page.evaluate(() => ({ title: document.getElementById('ag-chart-title')?.textContent, crop: document.querySelector('[data-testid="ag-opt-crop"]')?.textContent?.trim() }))
    check('legacy ?crop=corn#ag → #charts&v=gdd with corn', u.hash === '#charts' && u.q.v === 'gdd' && u.q.crop === 'corn' && /^Growing degree days/.test(head.title ?? '') && head.crop === 'Corn', JSON.stringify({ ...u, ...head }))
    const p = await problems()
    check('legacy #ag link: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
    await close()
  }
  {
    // A bare #ag: the Charts list with its Ag tools group in view.
    const { page, close, rendered } = await open(env, '?s=acebozem#ag')
    await rendered({ filled: ['[data-testid="charts-ag-tools"] ul'] })
    await page.waitForFunction(() => {
      const r = document.getElementById('charts-ag-tools').getBoundingClientRect()
      return r.top >= 0 && r.top < innerHeight
    }, null, { timeout: 5000 }).catch(() => {})
    const u = await at(page)
    const top = await page.evaluate(() => Math.round(document.getElementById('charts-ag-tools').getBoundingClientRect().top))
    check('legacy bare #ag → #charts, the Ag tools group in view', u.hash === '#charts' && top >= 0 && top < 900, JSON.stringify({ ...u, top }))
    await close()
  }
  {
    // An old Downloader link: the sheet over Charts, its keys renamed and kept.
    const { page, close } = await open(env, '?s=acebozem&els=air_temp,ppt&period=daily&from=2026-09-01&to=2026-09-30#downloader')
    await page.waitForFunction(() => !document.getElementById('sheet-download').hidden && document.querySelector('[data-testid="dl-run"]'), null, { timeout: 10000 }).catch(() => {})
    const u = await at(page)
    check('legacy #downloader → #charts&dl=1 with the sheet open and dl_from/dl_to kept',
      u.hash === '#charts' && u.q.dl === '1' && u.q.dl_from === '2026-09-01' && u.q.dl_to === '2026-09-30' && u.q.els === 'air_temp,ppt' &&
        (await page.evaluate(() => !document.getElementById('sheet-download').hidden)), JSON.stringify(u))
    await close()
  }
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
