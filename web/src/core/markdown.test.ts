import { describe, expect, it } from 'vitest'
import { escapeHtml, renderInline, renderMarkdown, safeHref } from './markdown'

const A = (href: string, text: string) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`

describe('renderMarkdown blocks', () => {
  it('splits paragraphs on blank lines and keeps soft breaks', () => {
    expect(renderMarkdown('One\nline.\n\nTwo.')).toBe('<p>One\nline.</p><p>Two.</p>')
    expect(renderMarkdown('a\r\n\r\nb')).toBe('<p>a</p><p>b</p>')
    expect(renderMarkdown('a\n   \n\n\nb')).toBe('<p>a</p><p>b</p>')
  })
  it('returns empty for blank input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('  \n\n ')).toBe('')
  })
  it('renders the live outage.json message', () => {
    const msg =
      "We're currently experiencing a partial outage (August 13).\n\nWe apologize for any inconvenience."
    expect(renderMarkdown(msg)).toBe(
      '<p>We&#39;re currently experiencing a partial outage (August 13).</p><p>We apologize for any inconvenience.</p>',
    )
  })
})

describe('renderInline emphasis', () => {
  it('bold and italic', () => {
    expect(renderInline('**b** and __b__')).toBe('<strong>b</strong> and <strong>b</strong>')
    expect(renderInline('*i* and _i_')).toBe('<em>i</em> and <em>i</em>')
    expect(renderInline('**bold *it* x**')).toBe('<strong>bold <em>it</em> x</strong>')
  })
  it('leaves unmatched or intraword markers literal', () => {
    expect(renderInline('a * b')).toBe('a * b')
    expect(renderInline('**open')).toBe('**open')
    expect(renderInline('air_temp_max')).toBe('air_temp_max')
    expect(renderInline('2 * 3 * 4')).toBe('2 * 3 * 4')
    expect(renderInline('x__y__z and a__b')).toBe('x__y__z and a__b')
    expect(renderInline('window.__p=1 then window.__p')).toBe('window.__p=1 then window.__p')
    expect(renderInline('__bold__.')).toBe('<strong>bold</strong>.')
  })
  it('honours backslash escapes', () => {
    expect(renderInline('\\*not\\* italic')).toBe('*not* italic')
    expect(renderInline('\\[x](https://a.b)')).toBe('[x](https://a.b)')
  })
})

describe('renderInline links', () => {
  it('renders allowed links with noopener and a new tab', () => {
    expect(renderInline('[docs](https://climate.umt.edu/x?a=1&b=2)')).toBe(
      A('https://climate.umt.edu/x?a=1&amp;b=2', 'docs'),
    )
    expect(renderInline('[mail](mailto:a@b.edu)')).toBe(A('mailto:a@b.edu', 'mail'))
    expect(renderInline('see <https://a.b/c>')).toBe(`see ${A('https://a.b/c', 'https://a.b/c')}`)
    expect(renderInline('[**big**](http://a.b)')).toBe(A('http://a.b', '<strong>big</strong>'))
  })
  it('drops disallowed schemes to plain text', () => {
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('<a')
    expect(renderInline('[x](javascript:alert)')).toBe('x')
    expect(renderInline('[x](JaVaScRiPt:alert)')).toBe('x')
    expect(renderInline('[x](java\tscript:alert)')).toBe('[x](java\tscript:alert)')
    expect(renderInline('[x](data:text/html,hi)')).toBe('x')
    expect(renderInline('[x](vbscript:msgbox)')).toBe('x')
    expect(renderInline('[x](/relative)')).toBe('x')
    expect(renderInline('<javascript:alert(1)>')).toBe('&lt;javascript:alert(1)&gt;')
  })
  it('does not nest links', () => {
    expect(renderInline('[<https://a.b>](https://c.d)')).toBe(A('https://c.d', '&lt;https://a.b&gt;'))
  })
})

describe('injection', () => {
  it('escapes raw HTML', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>')
    expect(renderMarkdown('**<b>x</b>**')).toBe('<p><strong>&lt;b&gt;x&lt;/b&gt;</strong></p>')
  })
  it('cannot break out of an href attribute', () => {
    const out = renderInline('[x](https://a.b/"onmouseover="alert(1))')
    expect(out).not.toMatch(/"onmouseover/)
    const q = renderInline('[x](https://a.b/"><script>)')
    expect(q).not.toContain('<script>')
    expect(renderInline("[x](https://a.b/'x)")).toBe(A('https://a.b/&#39;x', 'x'))
  })
  it('entity-encoded schemes stay inert', () => {
    expect(renderInline('[x](java&#115;cript:alert)')).toBe('x')
    expect(renderInline('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;')
  })
})

describe('helpers', () => {
  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
  it('safeHref strips control characters before checking the scheme', () => {
    expect(safeHref(' https://a.b ')).toBe('https://a.b')
    expect(safeHref('\u0000javascript:x')).toBeNull()
    expect(safeHref('MAILTO:x@y.z')).toBe('MAILTO:x@y.z')
    expect(safeHref('ftp://a.b')).toBeNull()
  })
})
