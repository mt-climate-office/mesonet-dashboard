/**
 * public/404.html (GitHub Pages serves it for any path with no file): `<root>/<station>` becomes
 * `<root>/?s=<station>`, keeping query and hash, for each root the app is served under: the Pages project
 * `/mesonet-dashboard`, the Mesonet host's `/dash` (retired Dash app links like `/dash/aceabsar`) and the old
 * proxied `/dash/next`. Runs the page's own inline script with a stub `location`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync(resolve(root, 'public/404.html'), 'utf8'))![1]

/** Where the 404 page sends a visitor who asked for `url`. */
function redirect(url: string): string {
  const u = new URL(url, 'https://example.test')
  let to = ''
  const location = { pathname: u.pathname, search: u.search, hash: u.hash, replace: (t: string) => void (to = t) }
  vm.runInNewContext(script, { window: { location } })
  return to
}

describe('404.html', () => {
  it.each(['/mesonet-dashboard', '/dash', '/dash/next'])('sends %s/<station> to %s/?s=<station>, keeping query and hash', (base) => {
    expect(redirect(`${base}/aceabsar`)).toBe(`${base}/?s=aceabsar`)
    expect(redirect(`${base}/aceabsar/`)).toBe(`${base}/?s=aceabsar`)
    expect(redirect(`${base}/aceabsar?units=si#charts`)).toBe(`${base}/?units=si&s=aceabsar#charts`)
    // An explicit ?s= wins over the path.
    expect(redirect(`${base}/aceabsar?s=acebozem`)).toBe(`${base}/?s=acebozem`)
    // Anything that is not a station id goes to the root.
    expect(redirect(`${base}/a/b`)).toBe(`${base}/`)
  })

  it('lands links to the retired /mesonet-dashboard/next/ copy on the root', () => {
    expect(redirect('/mesonet-dashboard/next/?s=aceabsar')).toBe('/mesonet-dashboard/?s=aceabsar')
    expect(redirect('/mesonet-dashboard/next/aceabsar')).toBe('/mesonet-dashboard/?s=aceabsar')
  })
})
