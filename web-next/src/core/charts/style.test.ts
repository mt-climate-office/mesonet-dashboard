import { describe, expect, it } from 'vitest'
import {
  DAY,
  SLIDER,
  ZOOM_TRACE_ID,
  animates,
  axisFamily,
  bottomLayout,
  extentOf,
  niceStep,
  plotExtent,
  points,
  runningTotal,
  showsSlider,
  stepMs,
  timeZoom,
  yBounds,
  zoomTrace,
} from './style'
import { testCtx } from './testing'

const H = 3_600_000
const M = 60_000

describe('gaps from the known interval', () => {
  it('expected steps: hourly 1 h, daily 1 day, 5-min the station cadence (median, ≥ 5 min)', () => {
    expect(stepMs('hourly')).toBe(H)
    expect(stepMs('daily')).toBe(DAY)
    expect(stepMs('doy')).toBe(1)
    expect(stepMs('raw', [0, 5, 10, 15, 60].map((m) => m * M))).toBe(5 * M)
    expect(stepMs('raw', [0, 15, 30, 45, 60, 300].map((m) => m * M))).toBe(15 * M)
    expect(stepMs('raw', [])).toBe(5 * M)
  })

  it('a step over 1.5 × the interval gets a null midway; 1.5 × or less does not', () => {
    const p = points([0, 1, 2, 4, 5].map((h) => h * H), [1, 2, 3, 4, 5], H)
    expect(p.map((q) => q[1])).toEqual([1, 2, 3, null, 4, 5])
    expect(p[3][0]).toBe(3 * H)
    expect(points([0, 1.5 * H], [1, 2], H).map((q) => q[1])).toEqual([1, 2])
  })

  it('uses the known interval, not the data: a mostly-gappy hourly series still breaks at every gap', () => {
    // Every other hour missing: a median rule would call 2 h the cadence and connect them.
    const xs = [0, 2, 4, 6, 7].map((h) => h * H)
    expect(points(xs, [1, 2, 3, 4, 5], H).filter((q) => q[1] === null)).toHaveLength(3)
  })

  it('keeps notes and existing nulls', () => {
    expect(points([0, 1, 2], [1, null, 3], 1, ['a', 'b', 'c'])).toEqual([[0, 1, 'a'], [1, null, 'b'], [2, 3, 'c']])
  })

  it('running total for an accumulation trace keeps gaps as gaps', () => {
    expect(runningTotal([0.1, 0, null, 0.2])).toEqual([0.1, 0.1, null, expect.closeTo(0.3, 9)])
  })
})

describe('y-axis rule per variable family', () => {
  it('families', () => {
    for (const v of ['Precipitation', 'Reference ET', 'Wind Speed', 'Gust Speed', 'Solar Radiation', 'Snow Depth']) expect(axisFamily(v)).toBe('zero')
    for (const v of ['Relative Humidity', 'Wind Direction']) expect(axisFamily(v)).toBe('fixed')
    for (const v of ['Air Temperature', 'Atmospheric Pressure', 'Soil VWC', 'Soil Temperature', 'VPD']) expect(axisFamily(v)).toBe('free')
  })

  it('zero-based: 0 to the padded max, rounded up to a nice step, never under the family minimum', () => {
    expect(yBounds('Precipitation', 0, 0.42)).toEqual({ min: 0, max: 0.5, interval: 0.1 })
    expect(yBounds('Precipitation', 0, 0)).toEqual({ min: 0, max: 0.05, interval: 0.01 })
    // Hourly ETr (peaks near 0.03 in) fills its axis rather than sitting under a 0.05 floor.
    expect(yBounds('Reference ET', 0, 0.026)).toEqual({ min: 0, max: 0.03, interval: 0.005 })
    expect(yBounds('Wind Speed', 0, 23)).toEqual({ min: 0, max: 25, interval: 5 })
    expect(yBounds('Snow Depth', 0, 0.2)).toEqual({ min: 0, max: 1, interval: 0.2 })
    expect(yBounds('Solar Radiation', 0, 870)).toEqual({ min: 0, max: 1000, interval: 200 })
  })

  it('fixed scales ignore the data', () => {
    expect(yBounds('Relative Humidity', 30, 60)).toEqual({ min: 0, max: 100, interval: 25 })
    expect(yBounds('Wind Direction', null, null)).toEqual({ min: 0, max: 360, interval: 90 })
  })

  it('free: the data plus 2 % padding each side, rounded out to whole steps (not to zero)', () => {
    const b = yBounds('Air Temperature', 35, 81)!
    expect(b).toEqual({ min: 30, max: 90, interval: 10 })
    expect(b.min).toBeLessThan(35 - 0.02 * 46 + 1e-9)
    expect(b.max).toBeGreaterThan(81 + 0.02 * 46 - 1e-9)
    // Pressure: never pulled to 0.
    expect(yBounds('Atmospheric Pressure', 842.1, 851.7)).toEqual({ min: 840, max: 852, interval: 2 })
    // Flat data still gets a span.
    expect(yBounds('Soil VWC', 12, 12)!.max).toBeGreaterThan(12)
  })

  it('picks the step with 4–8 intervals and the least padding, never a coarse jump', () => {
    // acebozem, last year, daily: band lows to −15.3 °F, highs to 100.2 °F (normals inside): −20–120 by 20, not −50–150 by 50.
    expect(yBounds('Air Temperature', -15.34, 100.166)).toEqual({ min: -20, max: 120, interval: 20 })
    // A year of livestock risk (−24…113 °F): −40–120 by 20, not −50–125 by 25 (a 7-step cap wasted a fifth of the axis).
    expect(yBounds('Air Temperature', -24, 113)).toEqual({ min: -40, max: 120, interval: 20 })
    for (const [lo, hi] of [[-15.34, 100.166], [0, 95], [35, 81], [-31, 104], [842.1, 851.7], [0.3, 0.9]]) {
      const b = yBounds('Air Temperature', lo, hi)!
      const n = Math.round((b.max - b.min) / b.interval)
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(8)
      expect(b.min).toBeLessThanOrEqual(lo)
      expect(b.max).toBeGreaterThanOrEqual(hi)
    }
  })

  it('never-negative free variables stop at 0 when their data does; temperature does not', () => {
    expect(yBounds('Soil VWC', 0.4, 33)).toEqual({ min: 0, max: 35, interval: 5 })
    expect(yBounds('Soil VWC', 0.4, 33)!.min).toBe(0)
    expect(yBounds('Bulk EC', 0.01, 0.4)!.min).toBe(0)
    expect(yBounds('Air Temperature', 0.4, 33)!.min).toBeLessThan(0)
  })

  it('the same data gives the same axis whatever the range (no jumping)', () => {
    expect(yBounds('Air Temperature', 35, 81)).toEqual(yBounds('Air Temperature', 35, 81))
    expect(yBounds('Air Temperature', null, 3)).toBeNull()
  })

  it('niceStep and extentOf', () => {
    expect([0.3, 1, 1.1, 2.2, 3, 7, 12].map(niceStep)).toEqual([0.5, 1, 2, 2.5, 5, 10, 20])
    expect(extentOf([1, null, 5], undefined, [-2])).toEqual([-2, 5])
    expect(extentOf([null])).toEqual([null, null])
  })
})

describe('x extent', () => {
  it('lines span first to last point; bars add half a step each side so end bars are whole', () => {
    expect(plotExtent([10, 20, 30], 10, false)).toEqual([10, 30])
    expect(plotExtent([10, 20, 30], 10, true)).toEqual([5, 35])
    expect(plotExtent([], 10, true)).toBeNull()
  })
})

describe('zoom slider', () => {
  const wide = testCtx('light', 1200)
  const phone = testCtx('light', 390, true, true)

  it('shows on wide screens for more than 2 days and at least 30 points; never on phones, 24 h or short series', () => {
    expect(showsSlider(wide, [0, 7 * DAY], 168)).toBe(true)
    expect(showsSlider(wide, [0, 30 * DAY], 31)).toBe(true)
    expect(showsSlider(wide, [0, DAY], 288)).toBe(false) // 24 h of 5-min data
    expect(showsSlider(wide, [0, 2 * DAY], 48)).toBe(false)
    expect(showsSlider(wide, [0, 14 * DAY], 15)).toBe(false) // 14 daily points
    expect(showsSlider(phone, [0, 365 * DAY], 365)).toBe(false)
    expect(showsSlider(wide, null, 100)).toBe(false)
    // A category axis (heatmap) counts cells only.
    expect(showsSlider(wide, [0, 40], 41, false)).toBe(true)
  })

  it('one height and placement: under the axis labels, above any legend', () => {
    expect(bottomLayout(true)).toEqual({ grid: SLIDER.gap + SLIDER.height + 30, slider: SLIDER.gap })
    expect(bottomLayout(false)).toEqual({ grid: 30, slider: SLIDER.gap })
    const withLegend = bottomLayout(true, 28)
    expect(withLegend.slider).toBe(28 + SLIDER.gap)
    expect(withLegend.grid - withLegend.slider - SLIDER.height).toBe(30)
  })

  it('both zooms start at the whole extent; the slider only when asked', () => {
    const z = timeZoom(wide, { xAxisIndex: [0, 1], extent: [5, 50], slider: true })
    expect(z.map((x) => x.type)).toEqual(['inside', 'slider'])
    for (const x of z) expect([x.startValue, x.endValue, x.xAxisIndex]).toEqual([5, 50, [0, 1]])
    expect(z[1]).toMatchObject({ height: SLIDER.height, bottom: SLIDER.gap, showDataShadow: true, filterMode: 'none' })
    expect(timeZoom(wide, { slider: false })).toHaveLength(1)
    // Touch: the inside zoom only holds the window (a swipe scrolls the page); compact: no drag-pan.
    expect(timeZoom(phone, { slider: false })[0]).toMatchObject({ disabled: true, moveOnMouseMove: false })
  })

  it('the trace is a hidden first-series line on its own hidden y axis, spanning exactly the extent', () => {
    const t = zoomTrace([[10, 1], [20, null], [30, 3, 'note']], [0, 40], { yAxisIndex: 2 })
    expect(t.series).toMatchObject({ id: ZOOM_TRACE_ID, type: 'line', yAxisIndex: 2, xAxisIndex: 0, silent: true, lineStyle: { opacity: 0 }, tooltip: { show: false } })
    expect(t.series.data).toEqual([[0, null], [10, 1], [20, null], [30, 3], [40, null]])
    expect(t.yAxis).toMatchObject({ show: false, gridIndex: 0 })
  })
})

describe('animation', () => {
  it('first draw only, never under reduced motion', () => {
    expect(animates(true, false)).toBe(true)
    expect(animates(false, false)).toBe(false) // range, interval, data or theme change
    expect(animates(true, true)).toBe(false)
  })
})
