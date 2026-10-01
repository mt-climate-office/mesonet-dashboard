import { useMemo } from 'react'
import { Center, Divider, Loader, ScrollArea, Stack, Table, Text } from '@mantine/core'
import { useStationLatest } from '../hooks/useStationLatest'
import { usePptSummary } from '../hooks/usePptSummary'
import { useStations } from '../hooks/useStations'
import { currentConditionsRows } from './currentConditions'
import { useResolvedStation } from './useResolvedStation'

export function CurrentConditionsCard() {
  const station = useResolvedStation()
  const { data: stations } = useStations()
  const { data, isLoading, isError, error } = useStationLatest(station)
  const network = useMemo(
    () => stations?.find((s) => s.station === station)?.sub_network ?? null,
    [stations, station],
  )
  // Legacy requests the precipitation summary for HydroMet stations only
  // (derived/ppt 422s for AgriMet).
  const ppt = usePptSummary(network === 'HydroMet' ? station : null)

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [] as Array<readonly [string, string]>
    return currentConditionsRows(data[0] as Record<string, unknown>)
  }, [data])

  const pptRows = useMemo(() => {
    if (!ppt.data || ppt.data.length === 0) return [] as Array<readonly [string, string]>
    const summary = ppt.data[0] as Record<string, unknown>
    const out: Array<readonly [string, string]> = []
    for (const [k, v] of Object.entries(summary)) {
      if (k === 'station') continue
      if (v === null || v === undefined || v === '') continue
      const num = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(num)) continue
      out.push([k, `${num.toFixed(2)} in`] as const)
    }
    // Legacy reverses (newest first)
    out.reverse()
    return out
  }, [ppt.data])

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to see current conditions.
        </Text>
      </Center>
    )
  }
  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }
  if (isError) {
    // Details to the console; legacy's no-data text for the user.
    console.error('Latest observation request failed:', error)
    return (
      <Center h="100%" px="md">
        <Text fw={700} size="sm" ta="center">
          No data available for selected dates.
        </Text>
      </Center>
    )
  }
  if (rows.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          No recent observations.
        </Text>
      </Center>
    )
  }

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap={4} p="xs">
        <Text fw={700} size="sm" ta="center">
          Latest Data Summary
        </Text>
        <Table
          withRowBorders={false}
          striped="odd"
          stripedColor="rgb(220,220,220)"
          verticalSpacing={2}
          fz="xs"
        >
          <Table.Tbody>
            {rows.map(([name, value]) => (
              <Table.Tr key={name}>
                <Table.Td>{name}</Table.Td>
                <Table.Td fw={500}>
                  {value}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {network === 'HydroMet' && pptRows.length > 0 && (
          <>
            <Divider my={4} />
            <Text fw={700} size="sm" ta="center">
              Precipitation Summary
            </Text>
            <Table
          withRowBorders={false}
          striped="odd"
          stripedColor="rgb(220,220,220)"
          verticalSpacing={2}
          fz="xs"
        >
              <Table.Tbody>
                {pptRows.map(([name, value]) => (
                  <Table.Tr key={name}>
                    <Table.Td>{name}</Table.Td>
                    <Table.Td fw={500}>
                      {value}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Stack>
    </ScrollArea>
  )
}
