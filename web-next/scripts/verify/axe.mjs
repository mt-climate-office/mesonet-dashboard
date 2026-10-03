/**
 * Axe matrix (HOUSE-STYLE §5, MIGRATING.md verification): every scenario below
 * × 3 themes × 1440/390 px. Fails on any serious/critical WCAG 2.1 AA violation,
 * console error or CSP violation. Run via `npm run verify` (needs dist/).
 */
import { AxeBuilder } from '@axe-core/playwright'
import { DL_QUERY, THEMES, VIEWPORTS, animationsDone, check, dlReady, finish, open, runDownload, start } from './lib.mjs'

/** Help, opened from the header ⋯ menu over a rendered Compare chart: the dialog's own contrast and names. */
const openHelp = async (page) => {
  await page.getByTestId('header-menu-button').click()
  await page.getByTestId('menu-help').click()
  await page.waitForFunction(() => document.getElementById('help-modal')?.open)
  await animationsDone(page)
}
/** The header ⋯ menu, open. */
const openMenu = async (page) => {
  await page.getByTestId('header-menu-button').click()
  await page.waitForFunction(() => !document.getElementById('header-menu')?.hidden)
}
/** "Browse on the map" in an open picker: the network chips and the map, drawn. */
const browseMap = async (page) => {
  await page.getByTestId('picker-browse').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="picker-map"] tbody')?.children.length > 0, null, { timeout: 30000 })
  await animationsDone(page)
}
/** The picker opened from the station button (with a station: recents show), then its map. */
const openPicker = async (page) => {
  await page.getByTestId('station-switcher').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="recent-list"]')?.offsetParent !== null, null, { timeout: 30000 })
  await browseMap(page)
}
/** The Now photo dialog with its pickers, once its frame is in and its open transition has ended. */
const openPhoto = async (page) => {
  await page.getByTestId('now-photo-open').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="photo-modal-image"]')?.complete
    && document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 30000 })
}
/** A chart page's ⋯ menu (`testid` of its button), open. */
const chartMenu = (testid) => async (page) => {
  await page.getByTestId(testid).click()
  await page.waitForFunction(() => [...document.querySelectorAll('.chart-head .dash-menu-panel')].some((p) => !p.hidden))
}
/** An Ag option chip's popover, open. */
const optionPopover = (id) => async (page) => {
  await page.getByTestId(`ag-opt-${id}`).click()
  await page.waitForFunction((id) => !document.getElementById(`ag-opt-${id}-panel`).hidden, id)
}
/** The Custom dates sheet, from the variable page's ⋯ menu. */
const datesSheet = async (page) => {
  await chartMenu('var-menu-button')(page)
  await page.getByTestId('var-menu-dates').click()
  await page.waitForFunction(() => !!document.querySelector('[data-testid="custom-dates"]'))
  await animationsDone(page)
}
/** An About row's sheet, opened, once its content (`filled`) is in and the slide has ended. */
const aboutSheet = (row, filled) => async (page) => {
  await page.getByTestId(row).click()
  await page.waitForFunction((sel) => document.querySelector(sel)?.children.length > 0, filled, { timeout: 30000 })
  // The slide starts two frames after opening: wait until the panel is fully opaque, then for it to settle.
  await page.waitForFunction(() => [...document.querySelectorAll('.about-sheet:not([hidden])')].every((s) => !s.classList.contains('enter') && getComputedStyle(s).opacity === '1'), null, { timeout: 10000 })
  await animationsDone(page)
}
/** The Download sheet with its Variables row expanded and the checklist open (no variables yet: the button's reason shows). */
const dlVariables = async (page) => {
  await page.locator('#dl-row-vars-btn').click()
  await page.getByTestId('dl-elements').locator('.ctl-disclosure').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="dl-elements"] .ctl-check').length > 3, null, { timeout: 30000 })
}
/** The Download sheet with its Dates row expanded. */
const dlDates = async (page) => {
  await page.locator('#dl-row-dates-btn').click()
  await page.getByTestId('dl-dates').waitFor({ state: 'visible' })
}

const ABOUT = { filled: ['[data-testid="about-details"] .about-dl', '[data-testid="about-map"] tbody'] }

// `before` runs once the page loads, `after` once the evidence is in; `only` limits the viewports.
const SCENARIOS = [
  // The Now overview (default section), with the header ⋯ menu open, and a first visit (no station: the picker is open).
  { name: 'now', query: '?s=acebozem', evidence: { charts: 1, filled: ['[data-testid="now-tiles"]', '[data-testid="tile-wind"] .dash-spark svg'] } },
  { name: 'header-menu', query: '?s=acebozem', evidence: { filled: ['[data-testid="now-tiles"]'] }, after: openMenu },
  // About: details, locator map, the two rows, data notes; then each row's sheet.
  { name: 'about', query: '?s=acebozem#about', evidence: ABOUT },
  { name: 'about-readings', query: '?s=acebozem#about', evidence: ABOUT, after: aboutSheet('about-readings-row', '[data-testid="about-readings-table"] tbody') },
  { name: 'about-history', query: '?s=acebozem#about', evidence: ABOUT, after: aboutSheet('about-history-row', '[data-testid="about-history"] .about-days') },
  { name: 'picker', query: '', evidence: {}, after: browseMap },
  { name: 'picker-open', query: '?s=acebozem', evidence: { filled: ['[data-testid="now-tiles"]'] }, after: openPicker },
  // Charts: the variable list (with the Ag tools group), a variable page, and Compare (a legacy #latest link lands there).
  { name: 'charts-list', query: '?s=acebozem#charts', evidence: { filled: ['[data-testid="var-air_temp"] .dash-spark svg', '[data-testid="charts-ag-tools"] ul'] } },
  // The variable page: its ⋯ menu, All years, the table, the Daily interval's band, the Custom dates sheet.
  { name: 'variable', query: '?s=acebozem&v=air_temp#charts', evidence: { charts: 1 } },
  { name: 'variable-menu', query: '?s=acebozem&v=air_temp#charts', evidence: { charts: 1 }, after: chartMenu('var-menu-button') },
  { name: 'variable-history', query: '?s=acebozem&v=air_temp&view=history#charts', evidence: { charts: 1 } },
  { name: 'variable-table', query: '?s=acebozem&v=air_temp&tbl=1#charts', evidence: { filled: ['.var-table-grid tbody'] } },
  { name: 'variable-daily', query: '?s=acebozem&v=air_temp&agg=daily#charts', evidence: { charts: 1, filled: ['[data-testid="variable-stats"] dl'] } },
  { name: 'dates-sheet', query: '?s=acebozem&v=air_temp#charts', evidence: { charts: 1 }, after: datesSheet },
  { name: 'compare', query: '?s=acebozem#latest', evidence: { charts: 1 } },
  // Ag tools inside Charts (v = an Ag tool id); a bare legacy #ag lands on the list's Ag tools group.
  { name: 'legacy-ag', query: '?s=acebozem#ag', evidence: { filled: ['[data-testid="charts-ag-tools"] ul'] } },
  { name: 'ag-gdd', query: '?s=acebozem&v=gdd#charts', evidence: { charts: 1 } },
  { name: 'ag-gdd-crop', query: '?s=acebozem&v=gdd#charts', evidence: { charts: 1 }, after: optionPopover('crop') },
  { name: 'ag-gdd-cutoffs', query: '?s=acebozem&v=gdd#charts', evidence: { charts: 1 }, after: optionPopover('cutoffs') },
  { name: 'ag-etr-menu', query: '?s=acebozem&v=etr#charts', evidence: { charts: 1 }, after: chartMenu('ag-menu-button') },
  { name: 'ag-soil-profile', query: '?s=acebozem&v=soil_temp,soil_ec_blk#charts', evidence: { charts: 1 } },
  { name: 'ag-etr', query: '?s=acebozem&v=etr#charts', evidence: { charts: 1 } },
  { name: 'ag-annual', query: '?s=acebozem&v=annual#charts', evidence: { charts: 1 } },
  // The Download sheet (dl=1): the Variables row open with its checklist, the Dates row open, and a preview.
  { name: 'download-variables', query: '?s=acebozem&dl=1#charts', before: dlReady, evidence: {}, after: dlVariables },
  { name: 'download-dates', query: DL_QUERY, before: dlReady, evidence: {}, after: dlDates },
  { name: 'downloader', query: DL_QUERY, before: runDownload, evidence: { charts: 1 } },
  { name: 'photo-dialog', query: '?s=acebozem', evidence: { filled: ['[data-testid="now-tiles"]'] }, after: openPhoto },
  { name: 'help-dialog', query: '?s=acebozem#latest', evidence: { charts: 1 }, after: openHelp },
]

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function one(env, s, theme, vp) {
  const label = `[${s.name} ${theme} ${vp.name}]`
  const sep = s.query.includes('?') ? '&' : '?'
  const [q, hash = ''] = s.query.split('#')
  const { page, problems, close, rendered, smallTargets } = await open(env, `${q}${sep}theme=${theme}${hash ? '#' + hash : ''}`, { viewport: vp })
  try {
    await s.before?.(page)
    await rendered(s.evidence)
    await s.after?.(page)
  } catch (e) {
    check(`${label} rendered`, false, e.message.split('\n')[0])
    await close()
    return
  }
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  check(`${label} axe 0 serious/critical (${r.violations.length - bad.length} minor)`, bad.length === 0,
    bad.map((v) => `${v.id}(${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`).join(' | '))
  if (vp.touch) {
    const small = await smallTargets()
    check(`${label} touch targets ≥ 40 px (hover: none)`, small.length === 0, `${small.length}: ${small.slice(0, 6).join(' | ')}`)
  }
  const p = await problems()
  check(`${label} console + CSP clean`, p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}

const env = await start()
const jobs = SCENARIOS.flatMap((s) => THEMES.flatMap((t) => VIEWPORTS.filter((vp) => !s.only || s.only.includes(vp.name)).map((vp) => () => one(env, s, t, vp))))
// A small pool: each page waits mostly on rendering, so 4 at once roughly quarters the run.
const pool = Array.from({ length: Number(process.env.VERIFY_JOBS ?? 4) }, async () => {
  while (jobs.length) await jobs.shift()()
})
await Promise.all(pool)
await env.close()
finish('axe')
