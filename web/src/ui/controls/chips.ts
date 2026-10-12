// Multi-toggle chips: compact kit .nav-btn toggle buttons in a labelled group;
// `aria-pressed` carries both state and styling. Ordering in selectionModel.ts.
//
// Markup (register with Alpine.data('chips', chips)):
//
//   <div class="ctl-chips" role="group" :aria-labelledby="ids.label"
//        x-data="chips({ options: () => …, value: () => …, onChange: (vs) => …, label: 'Networks' })">
//     <span class="ctl-legend" :id="ids.label" x-text="label"></span>
//     <template x-for="opt in options()" :key="opt.value">
//       <button type="button" class="nav-btn ctl-chip" :aria-pressed="isOn(opt.value)"
//               @click="toggle(opt.value)" x-text="opt.label"></button>
//     </template>
//   </div>

import { component } from '../component'
import { uniqueId } from './ids'
import { toggleIn } from '../../core/controls/selectionModel'

export interface ChipOption {
  value: string
  label: string
}

export interface ChipsOptions {
  options: () => ChipOption[]
  /** Values currently on. */
  value: () => string[]
  /** Called with the new set, in option order. The caller updates `value`. */
  onChange: (values: string[]) => void
  /** Group label. */
  label: string
}

/** Alpine.data factory for the chip group; see the markup in the file header. */
export function chips(opts: ChipsOptions) {
  return component({
    label: opts.label,
    ids: { label: `${uniqueId('chips')}-label` },

    options(): ChipOption[] {
      return opts.options()
    },
    isOn(value: string): boolean {
      return opts.value().includes(value)
    },
    toggle(value: string): void {
      opts.onChange(toggleIn(opts.value(), value, opts.options().map((o) => o.value)))
    },
  })
}
