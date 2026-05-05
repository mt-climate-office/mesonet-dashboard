import { Center, Loader, ScrollArea, Table, Text } from '@mantine/core'
import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'

export function StationMetadataCard() {
  const [station] = useStationParam()
  const { data, isLoading } = useStations()

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station for its metadata.
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

  const s = data?.find((row) => row.station === station)
  if (!s) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Station not found.
        </Text>
      </Center>
    )
  }

  const rows: Array<[string, string]> = [
    ['Name', s.name],
    ['Network', s.sub_network],
    ['County', s.county],
    ['Lat', s.latitude.toFixed(4)],
    ['Lon', s.longitude.toFixed(4)],
    ['Elevation', `${s.elevation.toFixed(0)} m`],
    ['Installed', s.date_installed ?? '—'],
    ['NWS LI', s.nwsli_id ?? '—'],
    ['Funded', s.funded ? 'Yes' : 'No'],
  ]

  return (
    <ScrollArea h="100%" type="auto">
      <Table withRowBorders={false} striped="even" verticalSpacing={4} fz="xs">
        <Table.Tbody>
          {rows.map(([k, v]) => (
            <Table.Tr key={k}>
              <Table.Td>{k}</Table.Td>
              <Table.Td ta="right" fw={500}>
                {v}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
