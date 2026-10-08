import { describe, expect, it } from 'vitest'
import { DIRECTION_DOT, compassTick, directionDots } from './windDirection'

describe('wind direction on a chart', () => {
  it('compass ticks at the cardinal points, degrees elsewhere', () => {
    expect([0, 90, 180, 270, 360].map(compassTick)).toEqual(['N', 'E', 'S', 'W', 'N'])
    expect(compassTick(45)).toBe('45°')
  })
  it('draws bearings as small dots, gaps dropped (no line to cross the plot at the north wrap)', () => {
    const s = directionDots('Wind direction', [[0, 350], [5, null], [10, 10]], { color: '#000', id: 'p0:wd', yAxisIndex: 2 })
    expect(s).toMatchObject({ type: 'scatter', id: 'p0:wd', yAxisIndex: 2, symbolSize: DIRECTION_DOT })
    expect(s.data).toEqual([[0, 350], [10, 10]])
    expect(directionDots('2024', [[1, 90]], { color: '#000', size: 5 }).symbolSize).toBe(5)
  })
})
