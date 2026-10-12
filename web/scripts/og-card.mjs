/**
 * Social card (og:image / twitter:image): a 1200 × 630 screenshot of the landing
 * ("Choose a station", the search, the statewide map) in the light theme, written to
 * public/og-card.png. Live API and basemap (unlike verify, which stubs both), so
 * re-run it by hand when the landing changes: `npm run build && npm run og-card`.
 */
import { chromium } from 'playwright'
import { preview } from 'vite'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = fileURLToPath(new URL('../public/og-card.png', import.meta.url))

const server = await preview({ root: ROOT, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1' } })
// MapLibre needs WebGL; SwiftShader gives it without a GPU (as in verify).
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await page.goto(server.resolvedUrls.local[0] + '?theme=light', { waitUntil: 'load' })
  await page.locator('[data-testid="landing"]').waitFor()
  // Stations drawn and basemap tiles in: the network goes quiet (tiles never idle for long, hence the cap).
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: OUT })
  console.log(`og-card: wrote ${OUT}`)
} finally {
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}
