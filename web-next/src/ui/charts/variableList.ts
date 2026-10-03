/**
 * `x-data="variableList"`: Charts' landing list (partials/charts/list.html).
 * The station's variables grouped (core/variables), each row with its current
 * value and a 48 h sparkline, linking to its variable page; then the Ag tools
 * (core/variables LIST_AG_TOOLS, plain labels), each opening its tool; then
 * Compare and Download data (the Download sheet).
 * Values come from `/latest` (shared with Now); sparklines from one 72 h
 * hourly request (core/variables `listRequest`).
 */
import Alpine from 'alpinejs'
import { variablePatch } from '../../core/ag/view/tab'
import { LABELS, LIST_AG_TOOLS, listRequest, variableGroups, variableRows, type VariableGroup, type VariableRow } from '../../core/variables'
import { latestObs } from '../station/resources'
import { component } from '../component'
import { follow, plainClick } from '../shell/navigate'
import { openSheet } from '../shell/sheet'
import { chartVariables, elementsResource, recordResource, stationElements } from './resources'

type State = 'none' | 'loading' | 'error' | 'ready'

/** The Ag tools group's rows: plain name and a one-line description. */
const AG_TOOLS = LIST_AG_TOOLS.map((id) => ({ id, name: LABELS[id]?.name ?? id, sub: LABELS[id]?.sub ?? '' }))

export function variableList() {
  return component({
    agTools: AG_TOOLS,

    get state(): State {
      const id = Alpine.store('station').id
      if (!id) return Alpine.store('url').state.s ? 'loading' : 'none'
      const els = elementsResource(id)
      return els?.data ? 'ready' : els?.status === 'error' ? 'error' : 'loading'
    },
    /** The groups with their rows; values and sparklines fill in as `/latest` and the hourly rows arrive. */
    get groups(): { group: VariableGroup; rows: VariableRow[] }[] {
      const id = Alpine.store('station').id
      const vars = chartVariables(id)
      if (!id || !vars) return []
      const latest = latestObs(id).data?.[0] as Record<string, unknown> | undefined
      const hourly = recordResource(listRequest(id, vars, stationElements(id) ?? []))?.data
      const rows = variableRows(vars, latest ? Alpine.raw(latest) : undefined, hourly ? Alpine.raw(hourly) : undefined)
      return variableGroups(vars).map((g) => ({ group: g.group, rows: g.items.map((v) => rows.find((r) => r.id === v.id)!) }))
    },
    get sparkLoading(): boolean {
      const id = Alpine.store('station').id
      const vars = chartVariables(id)
      return !!id && !!vars && recordResource(listRequest(id, vars, stationElements(id) ?? []))?.status === 'loading'
    },
    retry(): void {
      elementsResource(Alpine.store('station').id)?.refresh()
    },

    href(id: string): string {
      return Alpine.store('url').hrefFor('charts', { v: id, view: 'recent', cmp: false })
    },
    /** An Ag tool opens with its options reset (core/ag/view/tab `variablePatch`), as it always did. */
    toolHref(id: string): string {
      return Alpine.store('url').hrefFor('charts', variablePatch(id))
    },
    compareHref(): string {
      return Alpine.store('url').hrefFor('charts', { v: null, cmp: true })
    },
    /** A row: push its variable page; the row's name morphs into the page heading, which takes focus. */
    open(e: MouseEvent, id: string): void {
      const morph = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-vt-source]')
      follow(e, 'charts', { patch: { v: id, view: 'recent', cmp: false }, drillDown: true, morph, target: 'var-title' })
    },
    /** An Ag tool row: push the tool, focusing its heading. */
    openTool(e: MouseEvent, id: string): void {
      follow(e, 'charts', { patch: variablePatch(id), drillDown: true, target: 'ag-chart-title' })
    },
    downloadHref(): string {
      return Alpine.store('url').hrefFor('charts', { dl: true })
    },
    /** Download data: a plain click opens the sheet (focus returns here); others follow the href. */
    openDownload(e: MouseEvent): void {
      if (!plainClick(e)) return
      e.preventDefault()
      openSheet('download', e.currentTarget as HTMLElement)
    },
    /** The Compare card: push Compare, focusing its heading. */
    openCompare(e: MouseEvent): void {
      follow(e, 'charts', { patch: { v: null, cmp: true }, drillDown: true, target: 'charts-compare-title' })
    },
  })
}
