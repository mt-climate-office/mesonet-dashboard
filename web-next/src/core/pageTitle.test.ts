import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_TITLE, pageTitle } from './pageTitle'

describe('pageTitle', () => {
  it('puts the station name first', () => {
    expect(pageTitle('Bozeman')).toBe('Bozeman · Dashboard · MT Mesonet')
  })
  it('falls back to the base title without a station', () => {
    for (const n of [null, undefined, '', '  ']) expect(pageTitle(n)).toBe(BASE_TITLE)
  })
  it('matches the static <title> in index.html', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`<title>${BASE_TITLE}</title>`)
  })
})
