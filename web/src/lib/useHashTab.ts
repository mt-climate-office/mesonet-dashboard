import { useCallback, useEffect, useState } from 'react'

export const TAB_HASHES = ['latest', 'ag', 'downloader', 'satellite'] as const
export type TabHash = (typeof TAB_HASHES)[number]
export const DEFAULT_TAB: TabHash = 'latest'

const isTabHash = (v: string): v is TabHash =>
  (TAB_HASHES as readonly string[]).includes(v)

const readHash = (): TabHash => {
  if (typeof window === 'undefined') return DEFAULT_TAB
  const raw = window.location.hash.replace(/^#/, '').trim()
  return isTabHash(raw) ? raw : DEFAULT_TAB
}

/**
 * Hash-based tab routing. Returns the current tab and a setter that updates
 * window.location.hash without reloading. Listens to popstate + hashchange so
 * back/forward buttons and direct hash edits stay in sync.
 */
export function useHashTab(): [TabHash, (next: TabHash) => void] {
  const [tab, setTab] = useState<TabHash>(readHash)

  useEffect(() => {
    const sync = () => setTab(readHash())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const set = useCallback((next: TabHash) => {
    if (window.location.hash === `#${next}`) return
    window.location.hash = next
  }, [])

  return [tab, set]
}
