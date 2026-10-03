/**
 * The Charts variables of a station: which display variables it reports
 * (from `/elements/{s}`, core/params), their URL ids, groups and order, and
 * which section of Charts the URL asks for. The display name is the key into
 * ELEM_MAP, AXIS_MAPPER and core/models/timeseries, so a variable page plots
 * exactly what the Compare panel of the same name plots.
 */
import { ELEM_MAP, LATEST_EXCLUDED_ELEMENTS, latestVarName, latestVarsFromElements } from '../params'
import { NORMALS_VARS } from '../models/timeseries'
import type { UrlState } from '../url-schema'

type ElementRow = { element: string; description_short: string }

export const VARIABLE_GROUPS = ['Weather', 'Precipitation & ET', 'Soil', 'Well', 'Other'] as const
export type VariableGroup = (typeof VARIABLE_GROUPS)[number]

/** Known variables in list order, by group. Anything else (a new API element) goes to Other. */
const GROUPED: Record<Exclude<VariableGroup, 'Other'>, readonly string[]> = {
  Weather: ['Air Temperature', 'Relative Humidity', 'VPD', 'Wind Speed', 'Gust Speed', 'Wind Direction', 'Solar Radiation', 'Atmospheric Pressure', 'Snow Depth'],
  'Precipitation & ET': ['Precipitation', 'Max Precip Rate', 'Reference ET'],
  Soil: ['Soil Temperature', 'Soil VWC', 'Bulk EC'],
  Well: ['Well Water Level', 'Well Water Temperature', 'Well EC'],
}

/** Variables summed over time: bars, a total instead of min/max/mean, a cumulative history. */
const SUMMED = new Set(['Precipitation', 'Reference ET'])

export interface Variable {
  /** URL id (`v=`): the first ELEM_MAP element code (`air_temp`, `ppt`, `etr`), else the element's own code. */
  id: string
  /** Display variable ("Air Temperature"). */
  name: string
  group: VariableGroup
  /** Summed over time (precipitation, reference ET). */
  sum: boolean
  /** gridMET normals exist (shown on daily views). */
  normals: boolean
}

function groupOf(name: string): VariableGroup {
  for (const g of VARIABLE_GROUPS) if (g !== 'Other' && GROUPED[g].includes(name)) return g
  return 'Other'
}

/** URL id of a display variable; `elements` resolves names missing from ELEM_MAP. */
export function variableId(name: string, elements: readonly ElementRow[] = []): string {
  const known = ELEM_MAP[name]?.[0]
  if (known) return known
  const e = elements.find((r) => !LATEST_EXCLUDED_ELEMENTS.has(r.element) && latestVarName(String(r.description_short ?? '')) === name)
  return e?.element ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

const rank = (v: Variable) => {
  const g = VARIABLE_GROUPS.indexOf(v.group)
  const i = v.group === 'Other' ? 0 : GROUPED[v.group].indexOf(v.name)
  return g * 100 + i
}

/** The station's variables in list order (group, then the order above; Other alphabetical). */
export function stationVariables(elements: readonly ElementRow[]): Variable[] {
  return latestVarsFromElements(elements)
    .map((name) => ({
      id: variableId(name, elements),
      name,
      group: groupOf(name),
      sum: SUMMED.has(name),
      normals: (NORMALS_VARS as readonly string[]).includes(name),
    }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** `vars` (in list order) split into their non-empty groups. */
export function variableGroups(vars: readonly Variable[]): { group: VariableGroup; items: Variable[] }[] {
  return VARIABLE_GROUPS.map((group) => ({ group, items: vars.filter((v) => v.group === group) })).filter((g) => g.items.length > 0)
}

/** The variable with URL id `id`, or undefined. */
export const findVariable = (vars: readonly Variable[], id: string | null): Variable | undefined =>
  id === null ? undefined : vars.find((v) => v.id === id)

/** The variables before and after `id` in list order (null at the ends) for the prev/next chips. */
export function neighbors(vars: readonly Variable[], id: string): { prev: Variable | null; next: Variable | null } {
  const i = vars.findIndex((v) => v.id === id)
  if (i < 0) return { prev: null, next: null }
  return { prev: vars[i - 1] ?? null, next: vars[i + 1] ?? null }
}

/** What Charts shows for the URL: Compare (`cmp=1`), a variable page (`v=`) or the list. */
export function chartsMode(state: Pick<UrlState, 'cmp' | 'v'>): 'compare' | 'variable' | 'list' {
  return state.cmp ? 'compare' : state.v ? 'variable' : 'list'
}
