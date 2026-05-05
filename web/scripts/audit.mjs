// Tiny audit harness — drives the dev server through the Phase-1 acceptance
// gate and screenshots key states for human review. Run via:
//   node scripts/audit.mjs [station=acebozem]
//
// Outputs go to ./scripts/audit-screens/.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'audit-screens')

const STATION = process.argv[2] ?? 'acebozem'
const URL_BASE = process.env.AUDIT_URL ?? 'http://localhost:5173/mesonet-dashboard/'

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE-ERROR: ${msg.text()}`)
})

const requests = []
page.on('requestfinished', async (req) => {
  if (req.url().includes('execute-api') || req.url().includes('_api/')) {
    const r = await req.response()
    requests.push({ status: r?.status() ?? 0, url: req.url() })
  }
})

console.log('== Phase-1 audit ==')
console.log('URL:', URL_BASE)
console.log('Station:', STATION)
console.log()

console.log('1. Loading home page')
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.screenshot({ path: join(OUT_DIR, '01-home.png'), fullPage: false })

console.log('2. Selecting station via URL')
await page.goto(`${URL_BASE}?s=${STATION}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500) // allow data + chart to render
await page.screenshot({ path: join(OUT_DIR, '02-station.png'), fullPage: false })

// Check for any plotly graph div
const plotCount = await page.locator('.js-plotly-plot').count()
console.log(`   Plotly nodes rendered: ${plotCount}`)

const trace = (lbl) => console.log(`   url=${page.url()}`)

// Mantine SegmentedControl emits an outer label with the option text — use
// exact matches so we don't accidentally hit a variable chip like "Wind Speed".
const seg = (text) =>
  page.locator(`.mantine-SegmentedControl-label:has-text(\"${text}\")`).first()

console.log('3. Wind tab')
await seg('Wind').click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT_DIR, '03-wind.png') })
trace()

console.log('4. Photo tab')
await seg('Photo').click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT_DIR, '04-photo.png') })
trace()

console.log('5. Forecast tab')
await seg('Forecast').click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT_DIR, '05-forecast.png') })
trace()

console.log('6. Map shown')
await seg('Wind').click()
await seg('Map').click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT_DIR, '06-map.png') })
trace()

console.log('7. Current conditions table')
await seg('Current').click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT_DIR, '07-current.png') })
trace()

console.log('8. Daily aggregation + GridMET overlay')
await seg('Daily').click()
await page.waitForTimeout(1500)
const gridmet = page.locator('label:has-text("GridMET")').locator('input')
if (await gridmet.count()) {
  await gridmet.first().click({ force: true })
  await page.waitForTimeout(2500) // fetch + render
  await page.screenshot({ path: join(OUT_DIR, '08-gridmet.png') })
}

console.log('9. URL state')
console.log('   Final URL:', page.url())

await writeFile(
  join(OUT_DIR, 'console-errors.txt'),
  errors.length ? errors.join('\n') : 'no errors',
)
await writeFile(
  join(OUT_DIR, 'api-requests.txt'),
  requests.map((r) => `${r.status} ${r.url}`).join('\n'),
)

console.log()
console.log(`== Done. Console errors: ${errors.length} ==`)
if (errors.length) {
  console.log(errors.join('\n').slice(0, 4000))
}
console.log(`API calls: ${requests.length}`)

await browser.close()
