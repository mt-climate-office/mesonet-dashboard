/**
 * `x-data="agTab"` on the Ag section (partials/ag/index.html): the tool
 * cards while no tool is open (`var` absent), else the open tool's chart
 * card and its heading. Opening a tool or going back to the cards pushes a
 * history entry, so Back returns. Controls live in `agControls`; each chart
 * card fetches for itself.
 */
import Alpine from 'alpinejs'
import { agCardsPatch, chartState, variableGroup, variablePatch } from '../../core/ag/view/tab'
import { DERIVED_VAR_OPTIONS } from '../../core/params/ag'
import type { UrlState } from '../../core/url-schema'
import { component } from '../component'
import { navigate } from '../shell/navigate'
import { currentTab } from './shared'

/** A plain left click (no modifier): handled in-app; anything else follows the href. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export function agTab() {
  return component({
    tools: DERIVED_VAR_OPTIONS,

    /** A tool is open; false = the tool cards. */
    isOpen: (): boolean => currentTab().open,
    /** 'chart' | 'loading-stations' | 'no-station'. */
    state(): ReturnType<typeof chartState> {
      const station = Alpine.store('station')
      return chartState(currentTab(), Alpine.store('url').state.s, station.id, station.catalog?.status !== 'loading')
    },
    /** The card for the current variable, when a chart can be drawn. */
    show(group: ReturnType<typeof variableGroup>): boolean {
      return this.state() === 'chart' && variableGroup(currentTab().variable) === group
    },
    title(): string {
      const name = Alpine.store('station').current?.name
      const label = currentTab().variableLabel
      return this.state() === 'chart' && name ? `${label}: ${name}` : label
    },

    toolHref: (v: string): string => Alpine.store('url').hrefFor('ag', variablePatch(v)),
    cardsHref: (): string => Alpine.store('url').hrefFor('ag', agCardsPatch()),
    /** Card click: open the tool (a variable change resets its options, as the select does), focus its heading. */
    openTool(e: MouseEvent, v: string): void {
      if (!plainClick(e)) return
      e.preventDefault()
      void this.go(variablePatch(v), 'ag-chart-title')
    },
    /** "All Ag tools": back to the cards (the tool's options reset too), focusing the card of the tool just left. */
    toCards(e: MouseEvent): void {
      if (!plainClick(e)) return
      e.preventDefault()
      void this.go(agCardsPatch(), `ag-tool-${currentTab().variable}`)
    },
    async go(patch: Partial<UrlState>, focusId: string): Promise<void> {
      await navigate('ag', { patch, drillDown: true })
      await Alpine.nextTick() // the cards' x-for renders a tick after their x-if
      document.getElementById(focusId)?.focus({ preventScroll: true })
    },
  })
}
