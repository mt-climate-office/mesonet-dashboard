// Smoke test against the production preview server.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'audit-screens')
await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
})

// Production calls API_URL directly (no /_api proxy), so we'll see real
// network requests against api gateway.
await page.goto('http://localhost:4173/mesonet-dashboard/?s=acebozem', {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(4000)
const plotCount = await page.locator('.js-plotly-plot').count()
console.log(`Production preview: ${plotCount} plotly nodes`)
await page.screenshot({ path: join(OUT_DIR, 'preview.png') })

console.log(`Errors: ${errors.length}`)
errors.forEach((e) => console.log('  ' + e))

await browser.close()
