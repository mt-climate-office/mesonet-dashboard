/**
 * A tiny, safe Markdown subset for remote text (the outage notice): paragraphs,
 * **bold** / __bold__, *italic* / _italic_, [links](https://…) and
 * <https://…> autolinks. Output is an HTML string for `x-html`; every byte of
 * input text is escaped, so raw HTML in the source shows as text.
 */

/** Link schemes that may become an `href`; anything else renders as plain text. */
const SAFE_HREF = /^(https?:\/\/|mailto:)/i

/** Characters a backslash may escape (CommonMark's punctuation we use). */
const ESCAPABLE = /[\\`*_[\]()<>#!~-]/

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The href to emit for a link target, or null when it is not an allowed
 * scheme. Control characters and whitespace are stripped first because
 * browsers ignore them inside a scheme (`java\tscript:`).
 */
export function safeHref(raw: string): string | null {
  const url = raw.replace(/[\u0000- \u007f]/g, '')
  return SAFE_HREF.test(url) ? url : null
}

const link = (href: string, inner: string) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)

/** Index of the closing single `delim` after `from`, skipping doubled delimiters. */
function closingSingle(s: string, delim: string, from: number): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue }
    if (s[j] !== delim) continue
    if (s[j + 1] === delim) { j++; continue }
    if (delim === '_' && isWordChar(s[j + 1])) continue // snake_case stays literal
    return j
  }
  return -1
}

/** Render inline Markdown (no block structure) to safe HTML; `links: false` inside link text. */
export function renderInline(s: string, links = true): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]

    if (c === '\\' && i + 1 < s.length && ESCAPABLE.test(s[i + 1])) {
      out += escapeHtml(s[i + 1])
      i += 2
      continue
    }

    // [text](url) — text may hold emphasis; url has no spaces or parentheses.
    if (c === '[' && links) {
      const m = /^\[([^\]]*)\]\(\s*([^\s()]*)\s*\)/.exec(s.slice(i))
      if (m) {
        const href = safeHref(m[2])
        out += href ? link(href, renderInline(m[1], false)) : renderInline(m[1], false)
        i += m[0].length
        continue
      }
    }

    // <https://…> autolink; any other <…> falls through and is escaped.
    if (c === '<' && links) {
      const m = /^<([^\s<>]+)>/.exec(s.slice(i))
      const href = m && safeHref(m[1])
      if (m && href) {
        out += link(href, escapeHtml(m[1]))
        i += m[0].length
        continue
      }
    }

    if ((c === '*' || c === '_') && s[i + 1] === c && !(c === '_' && isWordChar(s[i - 1]))) {
      let end = s.indexOf(c + c, i + 2)
      // `__` closes only at a word edge, so `window.__x__y` stays literal.
      while (c === '_' && end !== -1 && isWordChar(s[end + 2])) end = s.indexOf(c + c, end + 1)
      if (end > i + 2) {
        out += `<strong>${renderInline(s.slice(i + 2, end), links)}</strong>`
        i = end + 2
        continue
      }
    }

    if ((c === '*' || c === '_') && s[i + 1] !== c && s[i + 1] !== ' ' && !(c === '_' && isWordChar(s[i - 1]))) {
      const end = closingSingle(s, c, i + 1)
      if (end > i + 1) {
        out += `<em>${renderInline(s.slice(i + 1, end), links)}</em>`
        i = end + 1
        continue
      }
    }

    out += escapeHtml(c)
    i++
  }
  return out
}

/**
 * Render `src` to safe HTML: blank lines separate `<p>` paragraphs; a single
 * newline stays a soft break (renders as a space). Empty input → ''.
 */
export function renderMarkdown(src: string): string {
  return src
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => `<p>${renderInline(p)}</p>`)
    .join('')
}
