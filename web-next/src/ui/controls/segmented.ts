// Single-choice segmented control: a native radio fieldset styled as the kit's
// .seg-btns/.seg-btn, so arrow keys, Tab and screen readers behave natively.
// The pressed look keys off :checked (controls.css).
//
// Markup (register with Alpine.data('segmented', segmented)):
//
//   <fieldset class="ctl-seg" x-data="segmented({ options: () => …, value: () => …,
//             onChange: (v) => …, label: 'Units' })">
//     <legend class="ctl-legend" x-text="label"></legend>
//     <div class="seg-btns">
//       <template x-for="opt in options()" :key="opt.value">
//         <label class="nav-btn seg-btn">
//           <input type="radio" :name="name" :value="opt.value" :checked="isChecked(opt.value)"
//                  :disabled="opt.disabled ?? false" @change="select(opt.value)">
//           <span x-text="opt.label"></span>
//         </label>
//       </template>
//     </div>
//   </fieldset>

import { defineControl, uniqueId } from './define'

export interface SegmentedOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SegmentedOptions {
  options: () => SegmentedOption[]
  value: () => string
  /** Called with the newly checked value. The caller updates `value`. */
  onChange: (value: string) => void
  /** Fieldset legend; add .sr-only to the legend to hide it visually. */
  label: string
}

/** Alpine.data factory for the segmented control; see the markup in the file header. */
export function segmented(opts: SegmentedOptions) {
  return defineControl({
    label: opts.label,
    /** Radio group name, unique per instance. */
    name: uniqueId('segmented'),

    options(): SegmentedOption[] {
      return opts.options()
    },
    isChecked(value: string): boolean {
      return opts.value() === value
    },
    select(value: string): void {
      if (value !== opts.value()) opts.onChange(value)
    },
  })
}
