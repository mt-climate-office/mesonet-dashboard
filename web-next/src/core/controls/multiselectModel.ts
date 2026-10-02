// Pure helpers for the grouped multiselect (multiselect.ts): option filtering,
// per-group select-all state and labels. Ordering lives in selectionModel.ts.

export interface MultiselectOption {
  value: string
  label: string
}

export interface MultiselectGroup {
  /** Stable key for x-for. */
  id: string
  /** Fieldset legend, e.g. "Standard elements". */
  label: string
  options: MultiselectOption[]
}

/** Select-all checkbox state for a set of option values. */
export type GroupState = 'none' | 'some' | 'all'

/** Groups keeping only options whose label or value contains `query` (case-
 *  insensitive); groups left empty are dropped. Empty query returns all groups. */
export function filterGroups(groups: readonly MultiselectGroup[], query: string): MultiselectGroup[] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...groups]
  return groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)),
    }))
    .filter((g) => g.options.length > 0)
}

/** 'all' when every value is selected, 'none' when none are (or `values` is empty), else 'some'. */
export function groupState(values: readonly string[], selected: readonly string[]): GroupState {
  const set = new Set(selected)
  const n = values.filter((v) => set.has(v)).length
  if (n === 0) return 'none'
  return n === values.length ? 'all' : 'some'
}

/** Every option value across `groups`, in display order. */
export function optionValues(groups: readonly MultiselectGroup[]): string[] {
  return groups.flatMap((g) => g.options.map((o) => o.value))
}

/** Label for `value` across `groups`, falling back to the value itself. */
export function labelFor(value: string, groups: readonly MultiselectGroup[]): string {
  for (const g of groups) for (const o of g.options) if (o.value === value) return o.label
  return value
}
