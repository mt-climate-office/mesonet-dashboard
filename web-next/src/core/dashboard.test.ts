import { describe, expect, it } from 'vitest'
import { buildTimeseriesModel } from './models/timeseries'
import { CELL_MIN, DASHBOARD_MIN_HEIGHT, DASHBOARD_MIN_WIDTH, DASHBOARD_RANGES, dashboardGrid, pageFor, panelOf, showsDashboard } from './dashboard'

describe('showsDashboard', () => {
  it('needs the width beside the drawer and the height', () => {
    expect(showsDashboard(DASHBOARD_MIN_WIDTH, DASHBOARD_MIN_HEIGHT)).toBe(true)
    expect(showsDashboard(DASHBOARD_MIN_WIDTH - 1, 1440)).toBe(false)
    expect(showsDashboard(2560, DASHBOARD_MIN_HEIGHT - 1)).toBe(false)
  })
})

describe('pageFor', () => {
  const none = { cmp: false, v: null }
  it('without room: the section itself', () => {
    for (const s of ['now', 'charts', 'about'] as const) expect(pageFor(s, none, false)).toBe(s)
    expect(pageFor('charts', { cmp: false, v: 'air_temp' }, false)).toBe('charts')
  })
  it('with room: Now, About and the Charts list are the dashboard; a chart keeps its page', () => {
    expect(pageFor('now', none, true)).toBe('dashboard')
    expect(pageFor('about', none, true)).toBe('dashboard')
    expect(pageFor('charts', none, true)).toBe('dashboard')
    expect(pageFor('charts', { cmp: false, v: 'air_temp' }, true)).toBe('charts')
    expect(pageFor('charts', { cmp: false, v: 'gdd' }, true)).toBe('charts')
    expect(pageFor('charts', { cmp: true, v: null }, true)).toBe('charts')
    // A Now URL that still carries v (left by a chart page) is the dashboard.
    expect(pageFor('now', { cmp: false, v: 'air_temp' }, true)).toBe('dashboard')
  })
})

describe('DASHBOARD_RANGES', () => {
  it('the presets up to 30 days', () => {
    expect(DASHBOARD_RANGES.map((r) => r.id)).toEqual(['24h', '7d', '14d', '30d'])
  })
})

describe('dashboardGrid', () => {
  it('14 charts at 1080p (≈ 1000 × 950 centre): rows fill the height, cells near the target shape', () => {
    const g = dashboardGrid(14, 1000, 950)
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(14)
    expect(g.rowHeight).not.toBeNull()
    expect(g.rowHeight!).toBeGreaterThanOrEqual(CELL_MIN.height)
    expect([3, 4]).toContain(g.cols)
  })
  it('14 charts at 1440p (≈ 1650 × 1300): more columns, taller cells', () => {
    const g = dashboardGrid(14, 1650, 1300)
    expect(g.cols).toBeGreaterThanOrEqual(3)
    expect(g.rowHeight!).toBeGreaterThan(dashboardGrid(14, 1000, 950).rowHeight!)
  })
  it('rearranges with the box: a wider box takes more columns', () => {
    expect(dashboardGrid(12, 2400, 800).cols).toBeGreaterThan(dashboardGrid(12, 900, 1200).cols)
  })
  it('few charts: no more columns than charts', () => {
    expect(dashboardGrid(2, 2000, 1000).cols).toBeLessThanOrEqual(2)
  })
  it('too many to fit: the most columns at the minimum width, rows at the minimum height (the grid scrolls)', () => {
    const g = dashboardGrid(40, 1000, 600)
    expect(g.rowHeight).toBeNull()
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(14)
  })
  it('empty or unmeasured', () => {
    expect(dashboardGrid(0, 1000, 1000)).toEqual({ cols: 1, rows: 0, rowHeight: null })
    expect(dashboardGrid(5, 0, 0).rowHeight).toBeNull()
  })
})

describe('panelOf', () => {
  const rows = [{ station: 'x', datetime: '2026-10-01 00:00:00-06:00', 'Air Temperature @ 2 m [°F]': 50, 'Relative Humidity [%]': 40 }]
  const ts = buildTimeseriesModel({ rows, vars: ['Air Temperature', 'Relative Humidity'], period: 'hourly' })!
  const m = { ts, period: 'hourly' as const, view: [0, 1] as [number, number] }
  it("one variable's panel of the shared model, the rest of the model kept", () => {
    const one = panelOf(m, 'Relative Humidity')!
    expect(one.ts.panels.map((p) => p.variable)).toEqual(['Relative Humidity'])
    expect(one.ts.x).toBe(ts.x)
    expect(one.view).toBe(m.view)
  })
  it('null without the model or the panel', () => {
    expect(panelOf(null, 'Air Temperature')).toBeNull()
    expect(panelOf(m, 'Soil VWC')).toBeNull()
  })
})
