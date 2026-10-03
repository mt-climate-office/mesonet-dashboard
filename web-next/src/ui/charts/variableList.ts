/**
 * `x-data="variableList"`: Charts' landing list (partials/charts/list.html).
 * The station's variables grouped (core/variables), each row with its current
 * value and a 48 h sparkline, linking to its variable page; plus Compare.
 * Values come from `/latest` (shared with Now); sparklines from one 72 h
 * hourly request (core/variables `listRequest`).
 */
import Alpine from 'alpinejs'
import { listRequest, variableGroups, variableRows, type VariableGroup, type VariableRow } from '../../core/variables'
import { latestObs } from '../latest/cards/resources'
import { component } from '../component'
import { navigate } from '../shell/navigate'
import { chartVariables, elementsResource, recordResource, stationElements } from './resources'

type State = 'none' | 'loading' | 'error' | 'ready'

/** A plain left click (others open a new tab through the real href). */
const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export function variableList() {
  return component({
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
    compareHref(): string {
      return Alpine.store('url').hrefFor('charts', { v: null, cmp: true })
    },
    /** A row: push its variable page; the row's name morphs into the page heading. */
    open(e: MouseEvent, id: string): void {
      if (!plain(e)) return
      e.preventDefault()
      const morph = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-vt-source]')
      void navigate('charts', { patch: { v: id, view: 'recent', cmp: false }, drillDown: true, morph })
    },
    openCompare(e: MouseEvent): void {
      if (!plain(e)) return
      e.preventDefault()
      void navigate('charts', { patch: { v: null, cmp: true }, drillDown: true })
    },
  })
}
