// Low/high threshold pair (GDD base and cap, °F): one track with two thumbs,
// built from two native range inputs laid over each other (each keeps its own
// label, keys and screen-reader value). The high thumb has an optional "none"
// stop meaning no upper cutoff. Emits {low, high|null} on change; snapping and
// ordering in rangeModel.ts.
//
// Markup (register with Alpine.data('rangeSlider', rangeSlider)):
//
//   <fieldset class="ctl-fieldset ctl-range" x-data="rangeSlider({ min: 32, max: 100,
//             step: 1, allowNone: true, unit: '°F', value: () => …,
//             onChange: (v) => …, label: 'GDD thresholds' })">
//     <legend class="ctl-legend" x-text="label"></legend>
//     <div class="ctl-range-values">
//       <label class="ctl-label" :for="ids.low"><span x-text="lowLabel"></span>
//         <span class="ctl-range-value" aria-hidden="true" x-text="lowText()"></span></label>
//       <label class="ctl-label" :for="ids.high"><span x-text="highLabel"></span>
//         <span class="ctl-range-value" aria-hidden="true" x-text="highText()"></span></label>
//     </div>
//     <div class="ctl-range-track" :style="fill()">
//       <input type="range" :id="ids.low" :class="{ 'is-top': lowOnTop() }" :min="cfg.min"
//              :max="highMax()" :step="cfg.step" :value="draft.low" :aria-valuetext="lowText()"
//              @input="onLow($event)" @change="commit()">
//       <input type="range" :id="ids.high" :min="cfg.min" :max="highMax()" :step="cfg.step"
//              :value="highPosition()" :aria-valuetext="highText()"
//              @input="onHigh($event)" @change="commit()">
//     </div>
//   </fieldset>

import { component } from '../component'
import { uniqueId } from './ids'
import {
  highSliderMax,
  highToSlider,
  normalizeRange,
  valueText,
  withHigh,
  withLow,
  type RangeConfig,
  type RangeValue,
} from '../../core/controls/rangeModel'

export type { RangeValue } from '../../core/controls/rangeModel'

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
  return component({
    label: opts.label,
    lowLabel: opts.lowLabel ?? 'Low threshold',
    highLabel: opts.highLabel ?? 'High threshold',
    cfg,
    ids: { low: `${base}-low`, high: `${base}-high` },
    /** Live value while dragging; emitted on change. */
    draft: normalizeRange(opts.value(), cfg),

    /** The value owned by the caller; watched by name so Alpine tracks it. */
    get external() {
      return opts.value()
    },

    init(): void {
      this.$watch('external', (v) => {
        this.draft = normalizeRange(v, cfg)
      })
    },
    highMax(): number {
      return highSliderMax(cfg)
    },
    highPosition(): number {
      return highToSlider(this.draft.high, cfg)
    },
    /** The filled stretch between the thumbs, as track percentages (controls.css `.ctl-range-track`). */
    fill(): string {
      const pct = (v: number) => ((v - cfg.min) / (highSliderMax(cfg) - cfg.min)) * 100
      return `--lo: ${pct(this.draft.low)}%; --hi: ${pct(this.highPosition())}%`
    },
    /** Past the middle the low thumb sits on top, so two touching thumbs can always be pulled apart. */
    lowOnTop(): boolean {
      return this.draft.low > (cfg.min + highSliderMax(cfg)) / 2
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
