import { describe, expect, it } from 'vitest'
import { SIDEBAR_STORAGE_KEY, sidebarCollapsedFrom, sidebarStorageValue } from './layout'

describe('sidebar collapse state', () => {
  it('uses an app-prefixed key', () => {
    expect(SIDEBAR_STORAGE_KEY).toBe('mco-dashboard-sidebar')
  })
  it('collapses only for the exact stored value', () => {
    expect(sidebarCollapsedFrom('collapsed')).toBe(true)
    for (const raw of [null, undefined, '', 'open', 'COLLAPSED', 'true', '1']) expect(sidebarCollapsedFrom(raw)).toBe(false)
  })
  it('round-trips', () => {
    for (const c of [true, false]) expect(sidebarCollapsedFrom(sidebarStorageValue(c))).toBe(c)
  })
})
