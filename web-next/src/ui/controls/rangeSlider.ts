// Low/high threshold pair (GDD base and cap, °F): two native range inputs, the
// high one with an optional "none" stop meaning no upper cutoff. Emits
// {low, high|null} on change; snapping and ordering in rangeModel.ts.
//
// Markup (register with Alpine.data('rangeSlider', rangeSlider)):
//
//   <fieldset class="ctl-fieldset ctl-range" x-data="rangeSlider({ min: 32, max: 100,
//             step: 1, allowNone: true, unit: '°F', value: () => …,
//             onChange: (v) => …, label: 'GDD thresholds' })">
//     <legend class="ctl-legend" x-text="label"></legend>
//     <div class="ctl-range-row">
//       <label class="ctl-label" :for="ids.low" x-text="lowLabel"></label>
//       <span class="ctl-range-value" aria-hidden="true" x-text="lowText()"></span>
//       <input type="range" :id="ids.low" :min="cfg.min" :max="cfg.max" :step="cfg.step"
//              :value="draft.low" :aria-valuetext="lowText()"
//              @input="onLow($event)" @change="commit()">
//     </div>
//     <div class="ctl-range-row">
//       <label class="ctl-label" :for="ids.high" x-text="highLabel"></label>
//       <span class="ctl-range-value" aria-hidden="true" x-text="highText()"></span>
//       <input type="range" :id="ids.high" :min="cfg.min" :max="highMax()" :step="cfg.step"
//              :value="highPosition()" :aria-valuetext="highText()"
//              @input="onHigh($event)" @change="commit()">
//     </div>
//   </fieldset>

import { defineControl, uniqueId } from './define'
import {
  highSliderMax,
  highToSlider,
  normalizeRange,
  valueText,
  withHigh,
  withLow,
  type RangeConfig,
  type RangeValue,
} from './rangeModel'

export type { RangeValue } from './rangeModel'

export interface RangeSliderOptions extends RangeConfig {
  value: () => RangeValue
  /** Called on release / key commit with the new value. The caller updates `value`. */
  onChange: (value: RangeValue) => void
  /** Fieldset legend. */
  label: string
  /** Unit appended to values, e.g. "°F"; '' for none. */
  unit: string
  lowLabel?: string
  highLabel?: string
}

/** Alpine.data factory for the threshold sliders; see the markup in the file header. */
export function rangeSlider(opts: RangeSliderOptions) {
  const base = uniqueId('range')
  const cfg: RangeConfig = { min: opts.min, max: opts.max, step: opts.step, allowNone: opts.allowNone }
  return defineControl({
    label: opts.label,
    lowLabel: opts.lowLabel ?? 'Low threshold',
    highLabel: opts.highLabel ?? 'High threshold',
    cfg,
    ids: { low: `${base}-low`, high: `${base}-high` },
    /** Live value while dragging; emitted on change. */
    draft: normalizeRange(opts.value(), cfg),

    init(): void {
      this.$watch(opts.value, (v) => {
        this.draft = normalizeRange(v, cfg)
      })
    },
    highMax(): number {
      return highSliderMax(cfg)
    },
    highPosition(): number {
      return highToSlider(this.draft.high, cfg)
    },
    lowText(): string {
      return valueText(this.draft.low, opts.unit)
    },
    highText(): string {
      return valueText(this.draft.high, opts.unit)
    },

    onLow(event: Event): void {
      const input = event.target as HTMLInputElement
      this.draft = withLow(this.draft, Number(input.value), cfg)
      // Pin the thumb when clamped; the bound value may not change, so Alpine wouldn't.
      input.value = String(this.draft.low)
    },
    onHigh(event: Event): void {
      const input = event.target as HTMLInputElement
      this.draft = withHigh(this.draft, Number(input.value), cfg)
      input.value = String(this.highPosition())
    },
    commit(): void {
      const current = opts.value()
      if (current.low !== this.draft.low || current.high !== this.draft.high) opts.onChange({ ...this.draft })
    },
  })
}
