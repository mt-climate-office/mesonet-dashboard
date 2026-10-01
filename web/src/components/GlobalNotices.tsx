import { useEffect, useState } from 'react'
import { Anchor, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { parseAsString, useQueryState } from 'nuqs'
import { OutageModal } from './OutageModal'
import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'
import { resolveStationId } from '../lib/stations'
import { LEGACY_STATE_PARAM, legacyStateHash, legacyStateUrl } from '../lib/legacyLinks'
import { LEGACY_DASHBOARD_URL } from '../lib/config'

/**
 * `?s=` may carry an NWSLI id (legacy `/dash/<NWSLI>` links, translated by
 * main.tsx / 404.html) or a mis-cased station id. Once the catalog loads,
 * swap it for the canonical station id in place (replaceState).
 */
function StationParamResolver() {
  const [station, setStation] = useStationParam()
  const { data: stations } = useStations()

  useEffect(() => {
    if (!station || !stations) return
    const resolved = resolveStationId(station, stations)
    if (resolved && resolved !== station) {
      void setStation(resolved, { history: 'replace' })
    }
  }, [station, stations, setStation])

  return null
}

/**
 * Legacy `?state=<hash>` share links point at layouts the old server saved
 * to disk, which this client can't read. Drop the param (other params stay)
 * and say so, with a link that opens the saved layout on the old dashboard.
 */
function LegacyStateNotice() {
  const [param, setParam] = useQueryState(LEGACY_STATE_PARAM, parseAsString)
  // Capture the hash on first render; the effects below clear it from the URL.
  const [initialHash] = useState(() => legacyStateHash(window.location.search))

  useEffect(() => {
    if (param !== null) void setParam(null, { history: 'replace' })
  }, [param, setParam])

  useEffect(() => {
    if (initialHash === null) return
    const legacyUrl = legacyStateUrl(LEGACY_DASHBOARD_URL, initialHash)
    notifications.show({
      id: 'legacy-state-link',
      title: 'Opened from an older shared link',
      color: 'yellow',
      autoClose: false,
      withCloseButton: true,
      message: (
        <Text size="sm">
          This shared link was created with the previous dashboard and can&apos;t be
          restored exactly. We&apos;ve kept what we could (such as the station). To see
          the saved layout, open it in the{' '}
          <Anchor href={legacyUrl} target="_blank" rel="noopener noreferrer" size="sm">
            previous dashboard
          </Anchor>
          .
        </Text>
      ),
    })
  }, [initialHash])

  return null
}

const SATELLITE_HASH = '#satellite'

/** Legacy dashboard view that replaces the hidden Satellite tab. */
const legacySatelliteUrl = () => `${LEGACY_DASHBOARD_URL}${SATELLITE_HASH}`

/**
 * The Satellite tab is hidden (app/tabs.ts), so `#satellite` links land on
 * Latest. Say so once, with a link to the legacy satellite view, and swap the
 * hash for `#latest` so the address bar matches what is shown.
 */
function SatelliteHiddenNotice() {
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== SATELLITE_HASH) return
      const { pathname, search } = window.location
      window.history.replaceState(window.history.state, '', `${pathname}${search}#latest`)
      notifications.show({
        id: 'satellite-hidden',
        title: 'Satellite indicators moved',
        color: 'blue',
        autoClose: false,
        withCloseButton: true,
        message: (
          <Text size="sm">
            Satellite indicators aren&apos;t available in this dashboard yet. Open them in the{' '}
            <Anchor href={legacySatelliteUrl()} target="_blank" rel="noopener noreferrer" size="sm">
              previous dashboard
            </Anchor>
            .
          </Text>
        ),
      })
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  return null
}

/** App-wide, tab-independent notices and URL fix-ups. Mounted once in App. */
export function GlobalNotices() {
  return (
    <>
      <OutageModal />
      <LegacyStateNotice />
      <SatelliteHiddenNotice />
      <StationParamResolver />
    </>
  )
}
