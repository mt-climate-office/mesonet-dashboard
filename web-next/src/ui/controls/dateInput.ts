// Single native date input bounded by min/max with an inline error; emits a
// `YYYY-MM-DD` string only when valid (e.g. the photo picker's day).
// Validation in dateModel.ts.
//
// Markup (register with Alpine.data('dateInput', dateInput)):
//
//   <div class="ctl-field" x-data="dateInput({ value: () => …, onChange: (d) => …,
//        min: () => …, max: () => …, label: 'Date' })">
//     <label class="ctl-label" :for="ids.input" x-text="label"></label>
//     <input type="date" class="ctl-input" :id="ids.input" :min="min()" :max="max()"
//            :value="draft" :aria-invalid="invalid()" :aria-describedby="describedBy()"
//            @change="set($event)">
//     <p class="ctl-error" aria-live="polite" :id="ids.error" x-text="errorText()"></p>
//   </div>

import { validateDate } from '../../core/controls/dateModel'
import { component } from '../component'
import { uniqueId } from './ids'

export interface DateInputOptions {
  /** Current date as `YYYY-MM-DD`. */
  value: () => string
  /** Called only with a valid in-bounds date. The caller updates `value`. */
  onChange: (date: string) => void
  min?: () => string | null
  max?: () => string | null
  /** Visible label; also starts error messages ("Date must be …"). */
  label: string
}

/** Alpine.data factory for a single date input; see the markup in the file header. */
export function dateInput(opts: DateInputOptions) {
  const base = uniqueId('date-input')
  return component({
    label: opts.label,
    ids: { input: `${base}-input`, error: `${base}-error` },
    /** What the input holds, which may be invalid and so not yet emitted. */
    draft: opts.value(),

    /** The value owned by the caller; watched by name so Alpine tracks it. */
    get external() {
      return opts.value()
    },

    init(): void {
      this.$watch('external', (v) => {
        this.draft = v
      })
    },
    min(): string | null {
      return opts.min?.() ?? null
    },
    max(): string | null {
      return opts.max?.() ?? null
    },
    error(): string | null {
      return validateDate(this.draft, this.label, this.min() ?? undefined, this.max() ?? undefined)
    },
    errorText(): string {
      return this.error() ?? ''
    },
    invalid(): 'true' | null {
      return this.error() ? 'true' : null
    },
    describedBy(): string | null {
      return this.error() ? this.ids.error : null
    },
    set(event: Event): void {
      this.draft = (event.target as HTMLInputElement).value
      if (!this.error() && this.draft !== opts.value()) opts.onChange(this.draft)
    },
  })
}
