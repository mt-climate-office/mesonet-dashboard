// Shared plumbing for the control factories: typing for `this` inside Alpine
// component methods, and page-unique DOM ids. No runtime Alpine import.

/** The Alpine magics the controls use; Alpine supplies them at runtime. */
export interface AlpineMagics {
  $el: HTMLElement
  $refs: Record<string, HTMLElement>
  /** Alpine accepts a getter function as well as an expression string. */
  $watch<V>(getter: () => V, callback: (value: V) => void): void
  $nextTick(callback?: () => void): Promise<void>
}

/** Identity: returns `component` unchanged, typing `this` in its methods as state + magics. */
export function defineControl<T extends object>(component: T & ThisType<T & AlpineMagics>): T {
  return component
}

let counter = 0

/** Returns a page-unique id such as `combobox-3`, for ARIA id references. */
export function uniqueId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}
