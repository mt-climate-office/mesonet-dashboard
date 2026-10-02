// Native <select> over caller-provided options (e.g. the photo picker's frame
// times). Disabled with a placeholder row when there are no options.
//
// Markup (register with Alpine.data('timeSelect', timeSelect)):
//
//   <div class="ctl-field" x-data="timeSelect({ options: () => …, value: () => …,
//        onChange: (v) => …, label: 'Time' })">
//     <label class="ctl-label" :for="ids.select" x-text="label"></label>
//     <select class="ctl-input ctl-select" :id="ids.select" :disabled="isEmpty()"
//             @change="set($event)">
//       <template x-if="isEmpty()"><option value="" x-text="emptyText"></option></template>
//       <template x-for="opt in options()" :key="opt.value">
//         <option :value="opt.value" :selected="isSelected(opt.value)" x-text="opt.label"></option>
//       </template>
//     </select>
//   </div>

import { defineControl, uniqueId } from './define'

export interface SelectOption {
  value: string
  label: string
}

export interface TimeSelectOptions {
  options: () => SelectOption[]
  value: () => string
  /** Called with the chosen option value. The caller updates `value`. */
  onChange: (value: string) => void
  label: string
  /** Placeholder shown while `options` is empty (default "No times available"). */
  emptyText?: string
}

/** Alpine.data factory for the select; see the markup in the file header. */
export function timeSelect(opts: TimeSelectOptions) {
  return defineControl({
    label: opts.label,
    emptyText: opts.emptyText ?? 'No times available',
    ids: { select: uniqueId('time-select') },

    options(): SelectOption[] {
      return opts.options()
    },
    isSelected(value: string): boolean {
      return opts.value() === value
    },
    isEmpty(): boolean {
      return opts.options().length === 0
    },
    set(event: Event): void {
      opts.onChange((event.target as HTMLSelectElement).value)
    },
  })
}
