// Page-unique DOM ids for ARIA references (aria-controls, aria-activedescendant, …).

let counter = 0

/** Returns a page-unique id such as `combobox-3`. */
export function uniqueId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}
