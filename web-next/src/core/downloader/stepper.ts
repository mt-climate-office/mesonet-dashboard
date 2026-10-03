/**
 * The Download stepper on phones (1 Elements → 2 Dates & period → 3 Run) as a
 * tiny state machine over a step index. ui/downloader/downloader.ts holds the
 * index; on wider screens every step shows at once and this is unused.
 */
import { runBlocker } from './view'

export const STEPS = [
  { id: 'elements', label: 'Elements' },
  { id: 'dates', label: 'Dates & period' },
  { id: 'run', label: 'Run' },
] as const

export const LAST_STEP = STEPS.length - 1

export const DATES_INVALID_HINT = 'Please fix the dates before continuing.'

/** What the steps check before Next. `rangeValid` is the date inputs' own validity (dateRange `onValidity`). */
export interface StepInputs {
  station: string | null
  elements: readonly string[]
  dateError: string | null
  rangeValid: boolean
}

/** Why Next cannot leave `step` (shown as an alert), or null. The Run step has no Next. */
export function stepBlocker(step: number, i: StepInputs): string | null {
  if (step === 0) return runBlocker(i.station, i.elements, null)
  if (step === 1) return i.dateError ?? (i.rangeValid ? null : DATES_INVALID_HINT)
  return null
}

/** The step after Next: one forward unless blocked or already last. */
export function nextStep(step: number, i: StepInputs): number {
  return step < LAST_STEP && stepBlocker(step, i) === null ? step + 1 : step
}

/** The step after Back: one back, never before the first. */
export function prevStep(step: number): number {
  return Math.max(0, step - 1)
}

/** "Step 2 of 3". */
export function progressText(step: number): string {
  return `Step ${step + 1} of ${STEPS.length}`
}

/** Live-region text on a step change: "Step 2 of 3: Dates & period". */
export function stepAnnouncement(step: number): string {
  return `${progressText(step)}: ${STEPS[step].label}`
}
