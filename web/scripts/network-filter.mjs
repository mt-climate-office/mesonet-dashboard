// Verify the network filter applies to BOTH the dropdown and the map.
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

await page.goto('http://localhost:5173/mesonet-dashboard/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, 'filter-both.png') })

// Click HydroMet chip off → only AgriMet remain.
await page.locator('label.mantine-Chip-label:has-text("HydroMet")').click()
await page.waitForTimeout(700)
await page.screenshot({ path: join(OUT, 'filter-agrimet-only.png') })
console.log('Final URL after dropping HydroMet:', page.url())

await browser.close()
