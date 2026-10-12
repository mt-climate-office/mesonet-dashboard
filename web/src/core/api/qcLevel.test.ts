import { afterEach, describe, expect, it } from 'vitest'
import { parseQcLevel, qcLevel, qcOverride, setQcOverride } from './qcLevel'

describe('the ?level= QC override', () => {
  afterEach(() => setQcOverride(null))
  it('parses 0, 1 and 2 only', () => {
    expect(['0', '1', '2'].map(parseQcLevel)).toEqual([0, 1, 2])
    expect([null, '', '3', 'raw', '1.5'].map(parseQcLevel)).toEqual([null, null, null, null, null])
  })
  it('is level 2 without an override', () => {
    expect([qcLevel(), qcOverride()]).toEqual([2, null])
    setQcOverride(1)
    expect([qcLevel(), qcOverride()]).toEqual([1, 1])
  })
})
