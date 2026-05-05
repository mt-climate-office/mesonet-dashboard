import { useState } from 'react'
import {
  Box,
  Center,
  Image,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { API_URL } from '../lib/config'
import { useStationParam } from '../lib/url-state'

const ALL_DIRECTIONS = [
  { value: 'n', label: 'N' },
  { value: 'e', label: 'E' },
  { value: 's', label: 'S' },
  { value: 'w', label: 'W' },
] as const

export function CameraCard() {
  const [station] = useStationParam()
  const [direction, setDirection] = useState<string>('n')
  // Set of directions that have failed for the current station — used to
  // hide them from the picker so the user only sees options that work.
  const [errored, setErrored] = useState<Record<string, Set<string>>>({})
  // Reset the picker every time station changes, sans an effect.
  const [stationKey, setStationKey] = useState<string | null>(station)
  if (station !== stationKey) {
    setStationKey(station)
    setDirection('n')
  }

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to view its camera.
        </Text>
      </Center>
    )
  }

  const erroredHere = errored[station] ?? new Set<string>()
  const available = ALL_DIRECTIONS.filter((d) => !erroredHere.has(d.value))

  if (available.length === 0) {
    return (
      <Center h="100%" px="md">
        <Text c="dimmed" size="xs" ta="center">
          No camera images are available for this station.
        </Text>
      </Center>
    )
  }

  // If the currently-picked direction errored, fall back to the first available.
  const activeDir = erroredHere.has(direction) ? available[0].value : direction

  const src = `${API_URL}photos/${station}/${activeDir}?force=True`
  return (
    <Stack gap={4} h="100%" p="xs">
      {available.length > 1 && (
        <SegmentedControl
          size="xs"
          fullWidth
          value={activeDir}
          onChange={setDirection}
          data={available as unknown as Array<{ value: string; label: string }>}
        />
      )}
      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Image
          key={`${station}/${activeDir}`}
          src={src}
          alt={`${station} ${activeDir.toUpperCase()} camera`}
          fit="contain"
          h="100%"
          w="100%"
          onError={() =>
            setErrored((prev) => {
              const set = new Set(prev[station] ?? [])
              set.add(activeDir)
              return { ...prev, [station]: set }
            })
          }
        />
      </Box>
    </Stack>
  )
}
