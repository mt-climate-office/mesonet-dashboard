// Start/end date pair: two native date inputs bounded by min/max (e.g. a
// station's period of record), an inline error, and `YYYY-MM-DD` output only
// when the range is valid. Validation in dateModel.ts. Optional `onValidity(valid)`
// reports draft validity; `showError: false` (or a getter) hides the inline message.
//
// Markup (register with Alpine.data('dateRange', dateRange)):
//
//   <fieldset class="ctl-fieldset" x-data="dateRange({ value: () => …,
//             onChange: (range) => …, min: () => …, max: () => …, label: 'Dates' })">
//     <legend class="ctl-legend" x-text="label"></legend>
//     <div class="ctl-row">
//       <div class="ctl-field">
//         <label class="ctl-label" :for="ids.start">Start</label>
//         <input type="date" class="ctl-input" :id="ids.start" :min="min()" :max="max()"
//                :value="start" :aria-invalid="invalid('start')"
//                :aria-describedby="describedBy()" @change="setStart($event)">
//       </div>
//       <div class="ctl-field">
//         <label class="ctl-label" :for="ids.end">End</label>
//         <input type="date" class="ctl-input" :id="ids.end" :min="min()" :max="max()"
//                :value="end" :aria-invalid="invalid('end')"
//                :aria-describedby="describedBy()" @change="setEnd($event)">
//       </div>
//     </div>
//     <p class="ctl-error" aria-live="polite" :id="ids.error" x-text="errorText()"></p>
//   </fieldset>

import { validateRange, type DateError, type DateRange } from '../../core/controls/dateModel'
import { component } from '../component'
import { uniqueId } from './ids'

export type { DateRange } from '../../core/controls/dateModel'

export interface DateRangeOptions {
  /** Current range as `YYYY-MM-DD` strings. */
  value: () => DateRange
  /** Called only with a valid, ordered, in-bounds range. The caller updates `value`. */
  onChange: (range: DateRange) => void
  /** Earliest allowed date (`YYYY-MM-DD`), or null for none. */
  min?: () => string | null
  /** Latest allowed date (`YYYY-MM-DD`), or null for none. */
  max?: () => string | null
  /** Fieldset legend. */
  label: string
  /** Called with the draft's validity on init and whenever it flips (e.g. to disable a submit button). */
  onValidity?: (valid: boolean) => void
  /** Show the inline error (default true). A getter lets the caller swap in its own message for some cases. */
  showError?: boolean | (() => boolean)
}

/** Alpine.data factory for the date range; see the markup in the file header. */
export function dateRange(opts: DateRangeOptions) {
  const base = uniqueId('date-range')
  return component({
    label: opts.label,
    ids: { start: `${base}-start`, end: `${base}-end`, error: `${base}-error` },
    /** Drafts: what the inputs hold, which may be invalid and so not yet emitted. */
    start: opts.value().start,
    end: opts.value().end,

    /** The value owned by the caller; watched by name so Alpine tracks it. */
    get external() {
      return opts.value()
    },

    /** Draft is emittable; watched by name so bounds changes (min/max) count too. */
    get valid(): boolean {
      return this.error() === null
    },

    init(): void {
      this.$watch('external', (v) => {
        this.start = v.start
        this.end = v.end
      })
      if (opts.onValidity) {
        opts.onValidity(this.valid)
        this.$watch('valid', (v: boolean) => opts.onValidity?.(v))
      }
    },
    /** Whether the inline error is shown (`showError` option). */
    errorShown(): boolean {
      const s = opts.showError ?? true
      return typeof s === 'function' ? s() : s
    },
    min(): string | null {
      return opts.min?.() ?? null
    },
    max(): string | null {
      return opts.max?.() ?? null
    },
    error(): DateError | null {
      return validateRange({ start: this.start, end: this.end }, this.min() ?? undefined, this.max() ?? undefined)
    },
    errorText(): string {
      return this.errorShown() ? (this.error()?.message ?? '') : ''
    },
    invalid(field: DateError['field']): 'true' | null {
      return this.error()?.field === field ? 'true' : null
    },
    describedBy(): string | null {
      return this.error() && this.errorShown() ? this.ids.error : null
    },

    setStart(event: Event): void {
      this.start = (event.target as HTMLInputElement).value
      this.emit()
    },
    setEnd(event: Event): void {
      this.end = (event.target as HTMLInputElement).value
      this.emit()
    },
    emit(): void {
      const current = opts.value()
      if (this.error() || (current.start === this.start && current.end === this.end)) return
      opts.onChange({ start: this.start, end: this.end })
    },
  })
}
