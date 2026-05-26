// Verify URL state survives hard-refresh.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'audit-screens')
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const target =
  'http://localhost:5173/mesonet-dashboard/?s=acebozem&info=current&agg=daily&gridmet=true&card=photo&from=2026-01-01&to=2026-05-04'

// First load.
await page.goto(target, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: join(OUT, 'restore-1.png') })

// Hard refresh.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: join(OUT, 'restore-2.png') })

// Open in fresh context (paste URL into new tab).
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page2 = await ctx2.newPage()
await page2.goto(target, { waitUntil: 'networkidle' })
await page2.waitForTimeout(3000)
await page2.screenshot({ path: join(OUT, 'restore-3.png') })

console.log('URLs match across reloads:', page.url() === page2.url())
await browser.close()
