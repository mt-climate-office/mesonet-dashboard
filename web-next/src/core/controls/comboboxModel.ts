// Pure filtering, ranking, grouping and keyboard stepping for the combobox
// (combobox.ts). No DOM; unit-tested in comboboxModel.test.ts.

/** One selectable row. `keywords` are extra codes matched like the id (e.g. NWSLI id). */
export interface ComboboxItem {
  id: string
  label: string
  group?: string
  keywords?: string[]
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

/** Match rank of `item` for an already lower-cased, trimmed query, best first:
 *  0 exact label, id or keyword; 1 the label starts with the query as a whole
 *  word ("bozeman" in "Bozeman Test"); 2 label prefix; 3 a later word of the
 *  label starts with it ("air" in "Bozeman Airport"); 4 id/keyword prefix;
 *  5 label substring; 6 id/keyword substring (a county); Infinity no match. An empty query ranks everything 0. */
export function matchRank(item: ComboboxItem, query: string): number {
  if (query === '') return 0
  const label = item.label.toLowerCase()
  const codes = [item.id, ...(item.keywords ?? [])].map((c) => c.toLowerCase())
  if (label === query || codes.includes(query)) return 0
  if (label.startsWith(query)) return /[\p{L}\p{N}]/u.test(label.charAt(query.length)) ? 2 : 1
  if (label.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(query))) return 3
  if (codes.some((c) => c.startsWith(query))) return 4
  if (label.includes(query)) return 5
  if (codes.some((c) => c.includes(query))) return 6
  return Infinity
}

/** Case-insensitive substring filter over label, id and keywords. With no query,
 *  every item in its group, groups in first-appearance order. With a query, one
 *  ungrouped list, best match first: rank (matchRank), then the shorter label,
 *  then alphabetical, then input order; so "bo" puts "Bozeman" above
 *  "Bootlegger S CG SW" and never under a whole group of weaker matches. `best`
 *  points at the top-ranked match. Keeps at most `limit` items. */
export function filterItems(
  items: readonly ComboboxItem[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): ComboboxResult {
  const q = query.trim().toLowerCase()
  const groupIndex = new Map<string | undefined, number>()
  for (const item of items) {
    if (!groupIndex.has(item.group)) groupIndex.set(item.group, groupIndex.size)
  }
  const matches = items
    .map((item, index) => ({ item, index, rank: matchRank(item, q), group: groupIndex.get(item.group) ?? 0 }))
    .filter((m) => m.rank !== Infinity)
    .sort((a, b) =>
      q === ''
        ? a.group - b.group || a.index - b.index
        : a.rank - b.rank ||
          a.item.label.length - b.item.label.length ||
          a.item.label.localeCompare(b.item.label) ||
          a.index - b.index,
    )

  const kept = matches.slice(0, Math.max(0, limit))
  const flat = kept.map((m) => m.item)
  const best = kept.length > 0 ? 0 : -1
  const groups: ComboboxGroup[] = []
  for (const item of flat) {
    const name = q === '' ? (item.group ?? null) : null
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
