// Order-stable set operations on selected values, shared by multiselect.ts and
// chips.ts. Results always follow the option order, so emitted arrays (and the
// URLs built from them) don't depend on click order. No DOM.

/** `selected` sorted by position in `order`, duplicates dropped; values not in `order` go last. */
export function inOrder(selected: readonly string[], order: readonly string[]): string[] {
  const rank = new Map(order.map((v, i) => [v, i] as const))
  const at = (v: string) => rank.get(v) ?? Number.MAX_SAFE_INTEGER
  return [...new Set(selected)].sort((a, b) => at(a) - at(b))
}

/** `selected` with `value` added if absent or removed if present, in `order`. */
export function toggleIn(selected: readonly string[], value: string, order: readonly string[]): string[] {
  const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
  return inOrder(next, order)
}

/** `selected` with every one of `values` added (`on`) or removed, in `order`. */
export function setIn(
  selected: readonly string[],
  values: readonly string[],
  on: boolean,
  order: readonly string[],
): string[] {
  const drop = new Set(values)
  const next = on ? [...selected, ...values] : selected.filter((v) => !drop.has(v))
  return inOrder(next, order)
}
