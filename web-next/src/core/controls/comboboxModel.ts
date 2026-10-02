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

/** Match rank of `item` for an already lower-cased, trimmed query: 0 exact,
 *  1 label prefix, 2 id/keyword prefix, 3 label substring, 4 id/keyword
 *  substring, Infinity no match. An empty query ranks everything 0. */
export function matchRank(item: ComboboxItem, query: string): number {
  if (query === '') return 0
  const label = item.label.toLowerCase()
  const codes = [item.id, ...(item.keywords ?? [])].map((c) => c.toLowerCase())
  if (label === query || codes.includes(query)) return 0
  if (label.startsWith(query)) return 1
  if (codes.some((c) => c.startsWith(query))) return 2
  if (label.includes(query)) return 3
  if (codes.some((c) => c.includes(query))) return 4
  return Infinity
}

/** Case-insensitive substring filter over label, id and keywords. Groups keep
 *  their first-appearance order in `items` (so the list doesn't jump while
 *  typing); within a group, better rank first, then input order. `best` points
 *  at the top-ranked match wherever its group sits. Keeps at most `limit` items. */
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
    .sort((a, b) => a.group - b.group || a.rank - b.rank || a.index - b.index)

  const kept = matches.slice(0, Math.max(0, limit))
  const flat = kept.map((m) => m.item)
  let best = kept.length > 0 ? 0 : -1
  kept.forEach((m, i) => {
    if (m.rank < kept[best].rank) best = i
  })
  const groups: ComboboxGroup[] = []
  for (const item of flat) {
    const name = item.group ?? null
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
