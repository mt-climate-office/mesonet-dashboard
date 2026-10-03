/**
 * Axe matrix (HOUSE-STYLE §5, MIGRATING.md verification): every scenario below
 * × 3 themes × 1440/390 px. Fails on any serious/critical WCAG 2.1 AA violation,
 * console error or CSP violation. Run via `npm run verify` (needs dist/).
 */
import { AxeBuilder } from '@axe-core/playwright'
import { DL_QUERY, THEMES, VIEWPORTS, check, finish, open, runDownload, start } from './lib.mjs'

/** Opened over a rendered Compare chart: the dialog's own contrast and names. */
const openHelp = async (page) => {
  await page.locator('#btn-help').click()
  await page.waitForFunction(() => document.getElementById('help-modal')?.open)
  await page.waitForTimeout(400) // kit open transition
}
/** The picker opened from the station switcher (with a station: recents show). */
const openPicker = async (page) => {
  await page.getByTestId('station-switcher').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="recent-list"]')?.offsetParent !== null
    && document.querySelector('[data-testid="picker-map"] tbody')?.children.length > 0, null, { timeout: 30000 })
  await page.waitForTimeout(400) // drawer/sheet slide
}
/** The Now photo dialog with its pickers, once its frame is in and its open transition has ended. */
const openPhoto = async (page) => {
  await page.getByTestId('now-photo-open').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="photo-modal-image"]')?.complete
    && document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 30000 })
}
/** Download on phones, step 1 (Elements) once the station and its elements are in. */
const dlReady = (page) => page.waitForFunction(() => document.querySelector('[data-testid="dl-next"]')?.disabled === false, null, { timeout: 30000 })

// `before` runs once the page loads, `after` once the evidence is in; `only` limits the viewports.
const SCENARIOS = [
  // The Now overview (default section) and a first visit (no station: the picker is open).
  { name: 'now', query: '?s=acebozem', evidence: { filled: ['[data-testid="now-tiles"]', '[data-testid="now-hero"] .dash-spark svg'] } },
  // About: details, locator map, all current readings, sensor changes, data notes.
  { name: 'about', query: '?s=acebozem#about', evidence: { filled: ['[data-testid="about-readings-table"] tbody', '[data-testid="about-history"] .about-days', '[data-testid="about-map"] tbody'] } },
  { name: 'picker', query: '', evidence: { filled: ['[data-testid="picker-map"] tbody'] } },
  { name: 'picker-open', query: '?s=acebozem', evidence: { filled: ['[data-testid="now-tiles"]'] }, after: openPicker },
  // Charts: the variable list, a variable page, and Compare (a legacy #latest link lands there).
  { name: 'charts-list', query: '?s=acebozem#charts', evidence: { filled: ['[data-testid="var-air_temp"] .dash-spark svg'] } },
  { name: 'variable', query: '?s=acebozem&v=air_temp#charts', evidence: { charts: 1 } },
  { name: 'variable-history', query: '?s=acebozem&v=air_temp&view=history#charts', evidence: { charts: 1 } },
  { name: 'variable-table', query: '?s=acebozem&v=air_temp&view=table#charts', evidence: { filled: ['.var-table-grid tbody'] } },
  { name: 'compare', query: '?s=acebozem#latest', evidence: { charts: 1 } },
  // Ag: the tool cards (no `var`), then four open tools.
  { name: 'ag-tools', query: '?s=acebozem#ag', evidence: { filled: ['[data-testid="ag-tools"] ul'] } },
  { name: 'ag-gdd', query: '?s=acebozem&var=gdd#ag', evidence: { charts: 1 } },
  { name: 'ag-soil-profile', query: '?s=acebozem&var=soil_temp,soil_ec_blk#ag', evidence: { charts: 1 } },
  { name: 'ag-etr', query: '?s=acebozem&var=etr#ag', evidence: { charts: 1 } },
  { name: 'ag-annual', query: '?s=acebozem&var=annual#ag', evidence: { charts: 1 } },
  { name: 'download-step1', query: '?s=acebozem#download', only: ['390'], before: dlReady, evidence: {} },
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
