/**
 * `x-data="agOptions"`: an Ag tool's option chips (partials/ag/options.html).
 * One chip per option of the open tool (core/ag/view/summary `optionChips`:
 * its name and current value); each opens a popover (`x-data="popover"`)
 * holding the existing control: crop chips, the cutoff `rangeSlider`,
 * `dateRange`, the projection and comparison selects, the interval,
 * livestock and soil chips. Reads and writes only `$store.url`, and applies
 * the one-off URL fix-ups (core/ag/view/tab `urlFixups`). The station comes
 * from the header picker.
 */
import Alpine from 'alpinejs'
import type { RangeValue } from '../../core/controls/rangeModel'
import { GDD_CROPS } from '../../core/params/ag'
import { PROJECTION_OPTIONS } from '../../core/ag/view/projection'
import { SLIDER_MAX, SLIDER_MIN } from '../../core/ag/view/gddCutoffs'
import { denverToday } from '../../core/today'
import { optionChips, type OptionChip, type OptionId } from '../../core/ag/view/summary'
import { annualElement, annualOptions, cropPatch, cutoffSummary, pickOne, sliderPatch, sliderValue, urlFixups } from '../../core/ag/view/tab'
import type { UrlState } from '../../core/url-schema'
import { component } from '../component'
import { currentTab, elementsResource, raw } from './shared'

const set = (patch: Partial<UrlState>) => Alpine.store('url').set(patch)

/** The element-list resource while Annual is shown for a confirmed station, else null. */
function elements() {
  const id = Alpine.store('station').id
  return id && currentTab().variable === 'annual' ? elementsResource(id) : null
}

/** Annual comparison options, or null while not needed / loading / failed. */
function elementOptions(): { value: string; label: string }[] | null {
  const res = elements()
  return res?.data ? annualOptions(raw(res.data)) : null
}

export function agOptions() {
  let fx: ReturnType<typeof Alpine.effect> | null = null
  return component({
    crops: GDD_CROPS,
    projections: PROJECTION_OPTIONS,
    times: [
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
    ],
    livestock: [
      { value: 'adult', label: 'Adult' },
      { value: 'newborn', label: 'Newborn' },
    ],
    slider: { min: SLIDER_MIN, max: SLIDER_MAX, step: 1, allowNone: true, unit: '°F' },

    init() {
      fx = Alpine.effect(() => {
        const patch = urlFixups(currentTab(), Alpine.store('url').state, !!Alpine.store('station').current, elementOptions())
        if (patch) set(patch)
      })
    },
    destroy() {
      if (fx) Alpine.release(fx)
    },

    get tab() {
      return currentTab()
    },
    today: () => denverToday(),
    /** The chips for the open tool, each naming its option's value ("Wheat", "32–70 °F"). */
    chips(): OptionChip[] {
      const options = elementOptions()
      const annv = annualElement(this.tab.annualVar, options)
      return optionChips(this.tab, options?.find((o) => o.value === annv)?.label ?? null, denverToday())
    },
    has(id: OptionId): boolean {
      return this.chips().some((c) => c.id === id)
    },
    text(id: OptionId): string {
      return this.chips().find((c) => c.id === id)?.text ?? ''
    },
    /** The chip's accessible name: "Crop: Wheat". */
    label(id: OptionId): string {
      const c = this.chips().find((x) => x.id === id)
      return c ? `${c.name}: ${c.text}` : ''
    },
    annualOptions: () => elementOptions() ?? [],
    /** The element list failed (no cached data): show the error and a Retry button. */
    elementsFailed(): boolean {
      const res = elements()
      return !!res && res.status === 'error' && res.data === undefined
    },
    retryElements: () => elements()?.refresh(),
    annualEmptyText(): string {
      if (this.elementsFailed()) return 'Unavailable'
      return Alpine.store('station').id ? 'Loading…' : 'Pick a station first'
    },
    cutoffText(): string {
      return cutoffSummary(this.tab)
    },
    sliderValue(): RangeValue {
      return sliderValue(this.tab)
    },

    setDates: (r: { start: string; end: string }) => set({ ag_from: r.start, ag_to: r.end }),
    setTime: (v: string) => set({ ag_time: v as UrlState['ag_time'] }),
    setLivestock: (v: string) => set({ lt: v as UrlState['lt'] }),
    setCrop(values: string[]) {
      const crop = pickOne(values, this.tab.crop)
      if (crop !== this.tab.crop) set(cropPatch(crop))
    },
    setSlider(v: RangeValue) {
      set(sliderPatch(this.tab, v))
    },
    resetCutoffs: () => set({ gdd_lo: null, gdd_hi: null }),
    setProjection: (v: string) => set({ gdd_proj: v as UrlState['gdd_proj'] }),
    setSoil(values: string[]) {
      set({ soilv: pickOne(values, this.tab.soilVar) })
    },
    setAnnual: (v: string) => set({ annv: v }),
  })
}
