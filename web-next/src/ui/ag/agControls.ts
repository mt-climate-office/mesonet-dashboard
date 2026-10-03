/**
 * `x-data="agControls"`: the Ag "Options" disclosure (partials/ag/controls.html).
 * Reads and writes only `$store.url`; also applies the one-off URL fix-ups
 * and clears a station without SWP sensors for the SWP variables (with a toast).
 */
import Alpine from 'alpinejs'
import type { RangeValue } from '../../core/controls/rangeModel'
import { DERIVED_VAR_OPTIONS, GDD_CROPS } from '../../core/params/ag'
import { learnMoreUrl } from '../../core/ag/view/learnMore'
import { PROJECTION_OPTIONS } from '../../core/ag/view/projection'
import { SLIDER_MAX, SLIDER_MIN } from '../../core/ag/view/gddCutoffs'
import { denverToday } from '../../core/ag/data/parse'
import { optionsSummary } from '../../core/ag/view/summary'
import {
  annualElement,
  annualOptions,
  cropPatch,
  cutoffSummary,
  pickOne,
  sliderPatch,
  sliderValue,
  stationItems,
  swpClearedMessage,
  urlFixups,
  variablePatch,
} from '../../core/ag/view/tab'
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

export function agControls() {
  let fx: ReturnType<typeof Alpine.effect> | null = null
  return component({
    variables: DERIVED_VAR_OPTIONS,
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
      // Open on desktop; on phones collapsed, unless there is no station yet (its picker is inside).
      const details = this.$el as HTMLDetailsElement
      details.open = !MCO.viewport.isCompact() || !Alpine.store('url').state.s
      fx = Alpine.effect(() => {
        const t = currentTab()
        const url = Alpine.store('url').state
        const station = Alpine.store('station').current
        if (t.swpOnly && station && !t.hasSwp) {
          MCO.showToast(swpClearedMessage(station.name), 10_000)
          Alpine.store('station').select(null)
          return
        }
        const patch = urlFixups(t, url, !!station, elementOptions())
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
    stations() {
      return stationItems(Alpine.store('station').list, this.tab.swpOnly)
    },
    stationPlaceholder(): string {
      if (Alpine.store('station').catalog?.status === 'loading') return 'Loading stations…'
      return this.tab.swpOnly ? 'Pick a station with soil water potential' : 'Pick a station'
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
    /** The disclosure's one-line summary, e.g. "Wheat · 32–70 °F · to Oct 31". */
    summary(): string {
      const options = elementOptions()
      const annv = annualElement(this.tab.annualVar, options)
      return optionsSummary(this.tab, options?.find((o) => o.value === annv)?.label ?? null)
    },
    learnHref(): string {
      return learnMoreUrl(this.tab.variable, this.tab.crop)
    },
    cutoffText(): string {
      return cutoffSummary(this.tab)
    },
    sliderValue(): RangeValue {
      return sliderValue(this.tab)
    },

    setStation: (id: string | null) => Alpine.store('station').select(id),
    /** A new tool is a variable change: pushed, so Back returns to the previous tool. */
    setVariable(v: string) {
      if (v !== this.tab.variable) Alpine.store('url').go('charts', variablePatch(v), true)
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
