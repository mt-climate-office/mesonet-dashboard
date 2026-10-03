import { describe, expect, it } from 'vitest'
import { DATES_INVALID_HINT, LAST_STEP, nextStep, prevStep, progressText, stepAnnouncement, stepBlocker, STEPS, type StepInputs } from './stepper'
import { PICK_FIRST_HINT } from './view'

const ok: StepInputs = { station: 'acebozem', elements: ['air_temp'], dateError: null, rangeValid: true }

describe('stepBlocker', () => {
  it('Elements needs a station and at least one element', () => {
    expect(stepBlocker(0, ok)).toBeNull()
    expect(stepBlocker(0, { ...ok, station: null })).toBe(PICK_FIRST_HINT)
    expect(stepBlocker(0, { ...ok, elements: [] })).toBe(PICK_FIRST_HINT)
  })
  it('Elements ignores the dates', () => {
    expect(stepBlocker(0, { ...ok, dateError: 'bad', rangeValid: false })).toBeNull()
  })
  it('Dates & period needs a valid window and valid date inputs', () => {
    expect(stepBlocker(1, ok)).toBeNull()
    expect(stepBlocker(1, { ...ok, dateError: 'Start must be before end.' })).toBe('Start must be before end.')
    expect(stepBlocker(1, { ...ok, rangeValid: false })).toBe(DATES_INVALID_HINT)
  })
  it('Run never blocks (Run has its own guard)', () => {
    expect(stepBlocker(2, { ...ok, station: null, rangeValid: false })).toBeNull()
  })
})

describe('nextStep / prevStep', () => {
  it('walks forward when nothing blocks and stops at the last step', () => {
    expect(nextStep(0, ok)).toBe(1)
    expect(nextStep(1, ok)).toBe(2)
    expect(nextStep(LAST_STEP, ok)).toBe(LAST_STEP)
  })
  it('stays put when the step is blocked', () => {
    expect(nextStep(0, { ...ok, elements: [] })).toBe(0)
    expect(nextStep(1, { ...ok, rangeValid: false })).toBe(1)
  })
  it('walks back and stops at the first step', () => {
    expect(prevStep(2)).toBe(1)
    expect(prevStep(0)).toBe(0)
  })
})

describe('text', () => {
  it('progress and announcement', () => {
    expect(STEPS.map((s) => s.label)).toEqual(['Elements', 'Dates & period', 'Run'])
    expect(progressText(1)).toBe('Step 2 of 3')
    expect(stepAnnouncement(1)).toBe('Step 2 of 3: Dates & period')
  })
})
