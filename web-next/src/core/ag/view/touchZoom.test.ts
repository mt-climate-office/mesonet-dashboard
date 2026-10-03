import { describe, expect, it } from 'vitest'
import { withoutInsideZoom } from './touchZoom'

describe('withoutInsideZoom', () => {
  it('drops inside zoom and keeps the slider and the rest of the option', () => {
    const o = withoutInsideZoom({ title: { text: 't' }, dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 36 }] })
    expect(o).toEqual({ title: { text: 't' }, dataZoom: [{ type: 'slider', bottom: 36 }] })
  })
  it('leaves an option without a dataZoom list alone', () => {
    const o = { title: { text: 't' } }
    expect(withoutInsideZoom(o)).toBe(o)
  })
})
