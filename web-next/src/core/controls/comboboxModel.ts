// Pure filtering, ranking, grouping and keyboard stepping for the combobox
// (combobox.ts). No DOM; unit-tested in comboboxModel.test.ts.

/** One selectable row. `keywords` are extra codes matched like the id (e.g. NWSLI id). */
export interface ComboboxItem {
  id: string
  label: string
  group?: string
  keywords?: string[]
  /** Text beside the label (default: the id). */
  meta?: string
  /** Results section while there is a query (e.g. "Stations", "Places"); sections keep their first-appearance order. */
  section?: string
  /** Only listed for a query, never in the full list (e.g. place names). */
  queryOnly?: boolean
}

/** A run of items sharing a group; `name` is null for ungrouped items. */
export interface ComboboxGroup {
  name: string | null
  items: ComboboxItem[]
}

export interface ComboboxResult {
  /** Kept items, grouped, in display order. */
  groups: ComboboxGroup[]
  /** The same kept items flattened; keyboard indices refer to this array. */
  flat: ComboboxItem[]
  /** Number of matches before truncation to `limit`. */
  total: number
  /** Index in `flat` of the best-ranked match (first on ties); -1 when empty. */
  best: number
}

/** Default cap on rendered options; the list says when more matched. */
export const DEFAULT_LIMIT = 200

/** Lower-case, accents and apostrophes dropped, so "Apsáalooke" and "Rocky Boy's" match plain typing. */
export const normalize = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/['’`]/g, '').toLowerCase()

/**
 * Optimal-string-alignment distance (insert, delete, substitute, swap two
 * neighbours), or `max + 1` as soon as it must exceed `max`.
 */
export function typoDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[b.length]
}

/**
 * A typo match: the query is within 1 edit (5+ letters) or 2 (8+) of a word
 * of the label, of the whole label, or of a keyword; from 5 letters also of
 * their beginnings (still typing). Four letters must match a whole word with
 * one edit; shorter queries, and numbers (ZIP codes, ids), never match by typo.
 */
function typoMatch(query: string, texts: string[]): boolean {
  if (query.length < 4 || /^[\d\s]+$/.test(query)) return false
  const max = query.length >= 8 ? 2 : 1
  const prefixes = query.length >= 5
  return texts.some((t) => {
    if (typoDistance(query, t, max) <= max) return true
    return prefixes && t.length > query.length && typoDistance(query, t.slice(0, query.length), max) <= max
  })
}

/** Match rank of `item` for an already `normalize`d, trimmed query, best first:
 *  0 exact label, id or keyword; 1 the label starts with the query as a whole
 *  word ("bozeman" in "Bozeman Test"); 2 label prefix; 3 a later word of the
 *  label starts with it ("air" in "Bozeman Airport"); 4 id/keyword prefix;
 *  5 label substring; 6 id/keyword substring; 7 a typo match (`typoMatch`:
 *  "bozman" → Bozeman); Infinity no match. An empty query ranks everything 0. */
export function matchRank(item: ComboboxItem, query: string): number {
  if (query === '') return 0
  const label = normalize(item.label)
  const codes = [item.id, ...(item.keywords ?? [])].map(normalize)
  if (label === query || codes.includes(query)) return 0
  if (label.startsWith(query)) return /[\p{L}\p{N}]/u.test(label.charAt(query.length)) ? 2 : 1
  const words = label.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.some((w) => w.startsWith(query))) return 3
  if (codes.some((c) => c.startsWith(query))) return 4
  if (label.includes(query)) return 5
  if (codes.some((c) => c.includes(query))) return 6
  if (typoMatch(query, [...words, label, ...codes])) return 7
  return Infinity
}

/** Case-insensitive, accent-blind filter over label, id and keywords (matchRank).
 *  With no query, every item in its group, groups in first-appearance order
 *  (`queryOnly` items left out). With a query, the matches by `section`
 *  (first-appearance order), each best match first: rank, then the shorter
 *  label, then alphabetical, then input order; so "bo" puts "Bozeman" above
 *  "Bootlegger S CG SW" and never under a whole group of weaker matches. A
 *  section is headed only when more than one has matches. `best` points at the
 *  top-ranked match (an earlier section wins a tie). Keeps at most `limit`
 *  items, and at most `sectionLimits[section]` of a section. */
export function filterItems(
  items: readonly ComboboxItem[],
  query: string,
  limit: number = DEFAULT_LIMIT,
  sectionLimits: Readonly<Record<string, number>> = {},
): ComboboxResult {
  const q = normalize(query.trim())
  const groupIndex = new Map<string | undefined, number>()
  const sectionIndex = new Map<string | undefined, number>()
  for (const item of items) {
    if (!groupIndex.has(item.group)) groupIndex.set(item.group, groupIndex.size)
    if (!sectionIndex.has(item.section)) sectionIndex.set(item.section, sectionIndex.size)
  }
  const matches = items
    .map((item, index) => ({
      item,
      index,
      rank: q === '' && item.queryOnly ? Infinity : matchRank(item, q),
      group: groupIndex.get(item.group) ?? 0,
      section: sectionIndex.get(item.section) ?? 0,
    }))
    .filter((m) => m.rank !== Infinity)
    .sort((a, b) =>
      q === ''
        ? a.group - b.group || a.index - b.index
        : a.section - b.section ||
          a.rank - b.rank ||
          a.item.label.length - b.item.label.length ||
          a.item.label.localeCompare(b.item.label) ||
          a.index - b.index,
    )

  const perSection = new Map<string | undefined, number>()
  const kept = matches
    .filter((m) => {
      const cap = m.item.section === undefined ? undefined : sectionLimits[m.item.section]
      const n = (perSection.get(m.item.section) ?? 0) + 1
      perSection.set(m.item.section, n)
      return cap === undefined || n <= cap
    })
    .slice(0, Math.max(0, limit))
  const flat = kept.map((m) => m.item)
  let best = kept.length > 0 ? 0 : -1
  kept.forEach((m, i) => {
    if (m.rank < kept[best].rank) best = i
  })
  const headed = q !== '' && new Set(kept.map((m) => m.item.section)).size > 1
  const groups: ComboboxGroup[] = []
  for (const item of flat) {
    const name = q === '' ? (item.group ?? null) : headed ? (item.section ?? null) : null
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(item)
    else groups.push({ name, items: [item] })
  }
  return { groups, flat, total: matches.length, best }
}

/** Next active index for a navigation key over `length` options (wrapping
 *  Up/Down; Home/End jump). Returns -1 when there are no options, and the
 *  current index for any other key. */
export function stepIndex(current: number, key: string, length: number): number {
  if (length <= 0) return -1
  switch (key) {
    case 'ArrowDown':
      return current < 0 || current >= length - 1 ? 0 : current + 1
    case 'ArrowUp':
      return current <= 0 ? length - 1 : current - 1
    case 'Home':
      return 0
    case 'End':
      return length - 1
    default:
      return current
  }
}

/** Screen-reader status line for a result set, e.g. "3 results" or "Showing 200 of 512 results". */
export function resultSummary(shown: number, total: number): string {
  if (total === 0) return 'No results'
  if (shown < total) return `Showing ${shown} of ${total} results; type to narrow`
  return total === 1 ? '1 result' : `${total} results`
}

/** What Esc does in the combobox: clear the text first, then close the list, then pass (the enclosing dialog closes). */
export function escapeAction(query: string, open: boolean): 'clear' | 'close' | 'pass' {
  if (query !== '') return 'clear'
  return open ? 'close' : 'pass'
}
