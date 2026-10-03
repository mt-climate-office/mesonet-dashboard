/**
 * `x-data="agTab"` on an open Ag tool inside Charts (partials/ag/index.html,
 * mounted while `v` is an Ag tool id): the variable-page frame for a tool:
 * back (to the list), the title, the ⋯ menu (Download data, Show as table /
 * chart, Share this chart, About this tool), the option chips (agOptions),
 * the chart card's state and, for Reference ET, All years (`view=history`)
 * and Previous / Next (it is in the variable list; also a sideways swipe).
 * Each chart card fetches for itself. The station comes from the header picker.
 */
import Alpine from 'alpinejs'
import { learnMoreUrl } from '../../core/ag/view/learnMore'
import { chartState, hasAllYears, notHereMessage, variableGroup } from '../../core/ag/view/tab'
import { agToolElements, fromChart } from '../../core/downloader/fromChart'
import { POR_FALLBACK_START, installDate, todayIso } from '../../core/latest'
import { LABELS, neighbors, plainName, type Variable } from '../../core/variables'
import { chartVariables, stationElements } from '../charts/resources'
import { component } from '../component'
import { initSwipe } from '../layout/swipe'
import { togglePicker } from '../picker/stationPicker'
import { stepChart } from '../shell/navigate'
import { shareView } from '../shell/share'
import { openSheet } from '../shell/sheet'
import { currentTab } from './shared'

const url = () => Alpine.store('url')
const stations = () => Alpine.store('station')

export function agTab() {
  let stopSwipe = () => {}
  return component({
    init() {
      stopSwipe = initSwipe({ el: this.$el as HTMLElement, onStep: (s) => this.step(s) })
    },
    destroy() {
      stopSwipe()
    },

    /** 'chart' | 'loading-stations' | 'no-station' | 'not-here' (an SWP tool at a station without SWP sensors). */
    state(): ReturnType<typeof chartState> {
      const station = stations()
      return chartState(currentTab(), url().state.s, station.id, station.catalog?.status !== 'loading')
    },
    /** The card for the current tool, when a chart can be drawn (not All years). */
    show(group: ReturnType<typeof variableGroup>): boolean {
      return this.state() === 'chart' && !this.history() && variableGroup(currentTab().variable) === group
    },
    title(): string {
      const v = currentTab().variable
      return LABELS[v]?.name ?? currentTab().variableLabel
    },
    /** Under the title: the station, and All years when it shows. */
    subline(): string {
      const name = stations().current?.name ?? ''
      return this.history() ? [name, 'All years'].filter(Boolean).join(' · ') : name
    },
    notHere(): string {
      return notHereMessage(stations().current?.name ?? 'This station')
    },
    pickStation(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },

    /* Reference ET: All years and its place in the variable list */
    hasHistory(): boolean {
      return hasAllYears(currentTab().variable)
    },
    history(): boolean {
      return this.hasHistory() && url().state.view === 'history'
    },
    toggleHistory(): void {
      url().set({ view: this.history() ? 'recent' : 'history' })
    },
    /** Reference ET's neighbours in the variable list (the other tools are not in it). */
    get near(): { prev: Variable | null; next: Variable | null } {
      if (!this.hasHistory()) return { prev: null, next: null }
      return neighbors(chartVariables(stations().id) ?? [], currentTab().variable)
    },
    nameOf: (v: Variable | null): string => (v ? plainName(v.id, v.name) : ''),
    /** Previous (−1) or next (1) variable in list order (ui/shell/navigate `stepChart`). */
    step(dir: -1 | 1): void {
      stepChart(this.near, dir)
    },

    /* ⋯ menu */
    tableMode(): boolean {
      return url().state.tbl
    },
    toggleTable(): void {
      url().go('charts', { tbl: !this.tableMode() }, true)
    },
    share: () => shareView(),
    learnHref(): string {
      const t = currentTab()
      return learnMoreUrl(t.variable, t.crop)
    },
    /** Download data: the sheet prefilled with the tool's elements, dates and interval (core/downloader/fromChart). */
    download(): void {
      const t = currentTab()
      const id = stations().id
      if (!id) return
      const whole = t.variable === 'annual' || this.history()
      const start = whole ? (installDate(stations().current) ?? POR_FALLBACK_START) : t.start
      const elements = agToolElements(t.variable, { soilVar: t.soilVar, annualVar: url().state.annv }, stationElements(id) ?? [])
      url().set(fromChart({ elements, start, end: whole ? todayIso() : t.end, interval: whole ? 'daily' : t.period }))
      openSheet('download')
    },
  })
}
