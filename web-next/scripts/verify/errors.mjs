/**
 * Error states (ARCHITECTURE "Errors"): a request that keeps failing shows the shared error state
 * (partials/load-error.html) with Retry, never an endless skeleton or "no data"; once the API is
 * back, Retry recovers. A fixture route answers 503 (retried twice by the cache, then an error)
 * until the check flips it back to the fixtures.
 */
import { DL_QUERY, check, finish, open, start } from './lib.mjs'

const SCENARIOS = [
  // The Charts list: its element list fails.
  { name: 'Charts list', query: '?s=acebozem#charts', fail: /\/api\/v2\/elements\/acebozem\//, ready: ['[data-testid^="var-"]', 'visible'] },
  // Compare: the element list loads, its observations fail.
  { name: 'Compare', query: '?s=acebozem&cmp=1#charts', fail: /\/api\/v2\/observations\/hourly/, ready: ['[data-testid="timeseries-status"]', 'hidden'] },
  // The Download sheet: the element list behind its variable names fails (never raw ids such as air_temp).
  { name: 'Download', query: DL_QUERY, fail: /\/api\/v2\/elements\/acebozem\/\?public=/, ready: ['[data-testid="dl-row-vars"] .dl-row-text', 'visible'] },
]
/** The Download sheet's Variables value, if shown ('' elsewhere). */
const varsText = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="dl-row-vars"] .dl-row-text')
  return el && el.offsetParent !== null ? el.textContent : ''
})

const env = await start()
for (const sc of SCENARIOS) {
  let failing = true
  const setup = (ctx) =>
    ctx.route(sc.fail, (route) => (failing ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'Service Unavailable' }) : route.fallback()))
  const { page, close } = await open(env, sc.query, { setup })
  const err = page.getByTestId('load-error')
  const shown = await err.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false)
  check(`${sc.name}: a 503 shows the error state`, shown)
  const text = shown ? await err.innerText() : ''
  check(`${sc.name}: the error says what failed, not "no data"`, /could not be loaded/.test(text) && !/No data available|does not report/.test(text), text)
  check(`${sc.name}: no skeleton beside the error`, (await page.locator('.tab-panel:not([hidden]) [aria-busy="true"]').count()) === 0)
  if (sc.name === 'Download') check('Download: no raw element ids while it fails', !/\b[a-z]+_[a-z0-9_]+\b/.test(await varsText(page)))
  failing = false
  if (shown) await page.getByTestId('load-retry').click()
  const recovered = await page.waitForSelector(sc.ready[0], { state: sc.ready[1], timeout: 20000 }).then(() => true, () => false)
  check(`${sc.name}: Retry recovers once the API answers`, recovered && (await err.count()) === 0)
  if (sc.name === 'Download') {
    const t = await varsText(page)
    check('Download: the variables read as names once loaded', /Rain/.test(t) && !/\b[a-z]+_[a-z0-9_]+\b/.test(t), t)
  }
  await close()
}
await env.close()
finish('errors')
