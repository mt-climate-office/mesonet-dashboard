/**
 * `x-data="variableList"`: Charts' landing list (partials/charts/list.html).
 * A search field, then the station's variables grouped (core/variables),
 * each row a plain name over a sub-label, its current value and a 48 h
 * sparkline; then Ag tools (LIST_AG_TOOLS: name and what it is) and More
 * (Compare variables). Every row opens its page (core/variables `chartPatch`).
 * Values come from `/latest` (shared with Now); sparklines from one 72 h
 * hourly request (core/variables `listRequest`).
 */
import Alpine from 'alpinejs'
import { LABELS, LIST_AG_TOOLS, chartHeading, chartPatch, listRequest, matchesQuery, variableGroups, variableRows, type VariableRow } from '../../core/variables'
import { latestObs } from '../station/resources'
import { component } from '../component'
import { follow } from '../shell/navigate'
import { chartVariables, elementsResource, recordResource, stationElements } from './resources'

type State = 'none' | 'loading' | 'error' | 'ready'
type Row = Pick<VariableRow, 'id' | 'name' | 'note' | 'value' | 'spark' | 'sparkLabel'>
type Group = { group: string; rows: Row[] }

/** The Ag tools rows: plain name over what the tool is; no value or sparkline. */
const AG_TOOLS: Row[] = LIST_AG_TOOLS.map((id) => ({ id, name: LABELS[id]?.name ?? id, note: LABELS[id]?.sub ?? '', value: '', spark: null, sparkLabel: '' }))

export function variableList() {
  return component({
    /** The search field's text. */
    query: '',

    get state(): State {
      const id = Alpine.store('station').id
      if (!id) return Alpine.store('url').state.s ? 'loading' : 'none'
      const els = elementsResource(id)
      return els?.data ? 'ready' : els?.status === 'error' ? 'error' : 'loading'
    },
    /** The variable groups with their rows; values and sparklines fill in as `/latest` and the hourly rows arrive. */
    get groups(): Group[] {
      const id = Alpine.store('station').id
      const vars = chartVariables(id)
      if (!id || !vars) return []
      const latest = latestObs(id).data?.[0] as Record<string, unknown> | undefined
      const hourly = recordResource(listRequest(id, vars, stationElements(id) ?? []))?.data
      const rows = variableRows(vars, latest ? Alpine.raw(latest) : undefined, hourly ? Alpine.raw(hourly) : undefined)
      return variableGroups(vars).map((g) => ({ group: g.group, rows: g.items.map((v) => rows.find((r) => r.id === v.id)!) }))
    },
    /** `rows` matching the search (name, sub-label or group). */
    filter(group: string, rows: Row[]): Row[] {
      return rows.filter((r) => matchesQuery(this.query, r.name, r.note, group))
    },
    agTools(): Row[] {
      return this.filter('Ag tools', AG_TOOLS)
    },
    showCompare(): boolean {
      return matchesQuery(this.query, 'Compare variables', 'Stack several on one time axis', 'More')
    },
    /** Nothing matches the search. */
    noMatch(): boolean {
      return !!this.query.trim() && this.groups.every((g) => !this.filter(g.group, g.rows).length) && !this.agTools().length && !this.showCompare()
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
      return Alpine.store('url').hrefFor('charts', chartPatch(id))
    },
    /** A row: push its page; the row's name morphs into the page heading, which takes focus. */
    open(e: MouseEvent, id: string): void {
      const morph = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-vt-source]')
      follow(e, 'charts', { patch: chartPatch(id), drillDown: true, morph, target: chartHeading(id) })
    },
    compareHref(): string {
      return Alpine.store('url').hrefFor('charts', { v: null, cmp: true })
    },
    /** Compare variables: push Compare, focusing its heading. */
    openCompare(e: MouseEvent): void {
      follow(e, 'charts', { patch: { v: null, cmp: true }, drillDown: true, target: 'charts-compare-title' })
    },
  })
}
