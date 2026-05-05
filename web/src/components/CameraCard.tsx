import { useMemo, useState } from 'react'
import {
  Box,
  Center,
  Group,
  Image,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import dayjs from 'dayjs'
import { API_URL } from '../lib/config'
import { usePhotoCatalog } from '../hooks/usePhotoCatalog'
import { useStationParam } from '../lib/url-state'
import type { PhotoDirection } from '../lib/api'

const MORNING = '09:00:00'
const AFTERNOON = '15:00:00'

// Compute "now" in America/Denver as a YYYY-MM-DD string + HHmm string,
// without pulling in dayjs's timezone plugin. The Intl API does the work.
const DENVER_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const DENVER_HHMM_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Denver',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function denverNow(): { ymd: string; hhmm: string } {
  const now = new Date()
  return {
    ymd: DENVER_DATE_FMT.format(now), // "YYYY-MM-DD"
    hhmm: DENVER_HHMM_FMT.format(now).replace(':', ''), // "HHMM"
  }
}

interface PhotoSlot {
  /** ISO local-time value for the API's `dt` param, e.g. `2026-05-05T15:00:00`. */
  value: string
  /** User-facing label for the dropdown. */
  label: string
}

function buildPhotoOptions(startDate: string): PhotoSlot[] {
  const { ymd: lastDay, hhmm } = denverNow()
  const start = dayjs(startDate)
  if (!start.isValid()) return []

  const dropToday = hhmm < '0930'
  const morningOnlyToday = hhmm >= '0930' && hhmm < '1530'

  const out: PhotoSlot[] = []
  let cursor = start.startOf('day')
  const stop = dayjs(lastDay).startOf('day')
  // Cap to 2 years back so the dropdown stays usable for old stations.
  const earliest = stop.subtract(2, 'year')
  if (cursor.isBefore(earliest)) cursor = earliest

  while (!cursor.isAfter(stop)) {
    const ymd = cursor.format('YYYY-MM-DD')
    const isToday = ymd === lastDay
    const includeAfternoon = !isToday || (!dropToday && !morningOnlyToday)
    const includeMorning = !isToday || !dropToday
    if (includeMorning) {
      out.push({ value: `${ymd}T${MORNING}`, label: `${ymd} Morning` })
    }
    if (includeAfternoon) {
      out.push({ value: `${ymd}T${AFTERNOON}`, label: `${ymd} Afternoon` })
    }
    cursor = cursor.add(1, 'day')
  }
  return out.reverse()
}

function defaultDirection(directions: PhotoDirection[]): string {
  // Match legacy behavior: prefer N if available.
  const pref = directions.find((d) => d.value.toLowerCase() === 'n')
  return pref?.value ?? directions[0]?.value ?? 'n'
}

export function CameraCard() {
  const [station] = useStationParam()
  const catalog = usePhotoCatalog()
  const meta = useMemo(
    () =>
      catalog.data?.find(
        (m) => m.station.toLowerCase() === (station ?? '').toLowerCase(),
      ) ?? null,
    [catalog.data, station],
  )

  // Reset direction & photo-time when station changes — without a useEffect.
  const [stationKey, setStationKey] = useState<string | null>(station)
  const [direction, setDirection] = useState<string>('n')
  const [photoTime, setPhotoTime] = useState<string | null>(null)

  if (station !== stationKey) {
    setStationKey(station)
    setDirection(meta ? defaultDirection(meta.directions) : 'n')
    setPhotoTime(null)
  }

  const options = useMemo(
    () => (meta ? buildPhotoOptions(meta.startDate) : []),
    [meta],
  )

  const activeTime = photoTime ?? options[0]?.value ?? null

  // ----- Empty / no-station state -----
  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to view its camera.
        </Text>
      </Center>
    )
  }

  // The /photos/ catalog 503s on cold-start (AirTable Lambda warm-up). Don't
  // block the image on it — show the latest N photo immediately and progressively
  // enhance the picker + time-dropdown when the catalog arrives.
  const usingFallback = !meta
  // Default to four cardinal directions until the metadata clarifies what
  // this station actually has.
  const fallbackDirections: PhotoDirection[] = [
    { value: 'n', label: 'North' },
    { value: 'e', label: 'East' },
    { value: 's', label: 'South' },
    { value: 'w', label: 'West' },
  ]
  const directions = meta?.directions.length ? meta.directions : fallbackDirections

  // If the catalog is loaded and the station has no camera, surface that.
  if (catalog.data && !meta) {
    return (
      <Center h="100%" px="md">
        <Text c="dimmed" size="xs" ta="center">
          No camera images are available for this station.
        </Text>
      </Center>
    )
  }

  // Effective direction — fall back if the URL state has a stale value.
  const activeDir = directions.some((d) => d.value === direction)
    ? direction
    : defaultDirection(directions)

  // The path enum on the new API is strict-lowercase. The catalog returns
  // direction values capitalized ("N", "SNOW") for display; lowercase before
  // building the URL.
  const dirSlug = activeDir.toLowerCase()
  const dtParam = activeTime ? `&dt=${encodeURIComponent(activeTime)}` : ''
  const displaySrc = `${API_URL}photos/${station}/${dirSlug}/?force=True&web=true${dtParam}`
  const originalSrc = `${API_URL}photos/${station}/${dirSlug}/?force=True${dtParam}`

  // Single-row direction picker; for stations with many directions
  // (e.g. five with SNOW), use the SegmentedControl in compact mode.
  const directionData = directions.map((d) => ({
    value: d.value,
    label: d.value.toUpperCase(),
  }))

  const downloadOriginal = async () => {
    try {
      const r = await fetch(originalSrc)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob = await r.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      // Prefer the API's own filename (it carries the actual capture
      // timestamp, e.g. `aceloman_2026-05-05T090000_N.jpg`) when the server
      // exposes Content-Disposition. Fall back to a synthesized name.
      a.download = pickFilename(r.headers, station, dirSlug, activeTime, blob.type)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
    } catch {
      // CORS unset upstream → open in a new tab so the user can save manually.
      window.open(originalSrc, '_blank', 'noreferrer')
    }
  }

  return (
    <Stack gap={6} h="100%" p="xs">
      <Group gap={6} wrap="nowrap" align="center" justify="space-between">
        <SegmentedControl
          size="xs"
          value={activeDir}
          onChange={setDirection}
          data={directionData}
          style={{ flexShrink: 0 }}
        />
        {options.length > 0 ? (
          <Select
            size="xs"
            value={activeTime}
            onChange={(v) => setPhotoTime(v)}
            data={options}
            placeholder="Select photo time"
            allowDeselect={false}
            searchable
            comboboxProps={{ withinPortal: true }}
            styles={{ root: { flex: 1, minWidth: 0 } }}
          />
        ) : usingFallback && catalog.isFetching ? (
          <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Loader size="xs" />
            <Text size="xs" c="dimmed" truncate>
              Loading photo times…
            </Text>
          </Group>
        ) : null}
      </Group>
      <Tooltip label="Click to download original" withinPortal openDelay={400}>
        <Box
          role="button"
          tabIndex={0}
          aria-label={`Download original ${activeDir.toUpperCase()} photo for ${station}`}
          onClick={downloadOriginal}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              downloadOriginal()
            }
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <Image
            key={`${station}/${activeDir}/${activeTime ?? 'latest'}`}
            src={displaySrc}
            alt={`${station} ${activeDir.toUpperCase()} camera ${activeTime ?? ''}`}
            fit="contain"
            h="100%"
            w="100%"
            fallbackSrc=""
          />
        </Box>
      </Tooltip>
    </Stack>
  )
}

/**
 * Decide what filename to write to disk.
 *
 * 1. If the server exposed Content-Disposition with a filename, honor it —
 *    that filename already carries the capture timestamp.
 * 2. Otherwise synthesize one from station + direction + selected dt + a
 *    sensible extension based on the response Content-Type.
 */
function pickFilename(
  headers: Headers,
  station: string,
  direction: string,
  dt: string | null,
  blobType: string,
): string {
  const cd = headers.get('content-disposition') ?? ''
  const m = cd.match(/filename\*?=(?:UTF-8''|"|')?([^"';]+)/i)
  if (m && m[1]) {
    return decodeURIComponent(m[1].trim())
  }
  const ct = (headers.get('content-type') ?? blobType ?? '').toLowerCase()
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
  const stamp = dt
    ? dt.replace(/[:T-]/g, '').slice(0, 14)
    : dayjs().format('YYYYMMDDHHmmss')
  return `${station}_${stamp}_${direction.toUpperCase()}.${ext}`
}
