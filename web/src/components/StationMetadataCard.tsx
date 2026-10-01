import type { ReactNode } from 'react'
import { Anchor, Center, Loader, ScrollArea, Table, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'
import { fetchOnePagers, findOnePager, ONE_PAGERS_STALE_MS } from './onePagers'

/** Legacy `make_metadata_table`: elevation is shown in feet, round(m × 3.281). */
const metersToFeet = (m: number) => Math.round(m * 3.281)

export function StationMetadataCard() {
  const [station] = useStationParam()
  const { data, isLoading } = useStations()
  const onePagers = useQuery({
    queryKey: ['one-pagers'],
    queryFn: fetchOnePagers,
    // Airtable links expire every ~1.5–3 h; keep this short and in memory only.
    staleTime: ONE_PAGERS_STALE_MS,
    gcTime: ONE_PAGERS_STALE_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  })

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

  const pager = findOnePager(onePagers.data, s.station)

  // Legacy field order and labels (utils/tables.py), with the one-pager
  // inserted after Long Name as legacy app.py does. County and NWSLI ID are
  // extras the legacy table didn't show.
  const rows: Array<[string, ReactNode]> = [
    ['Station Name', s.station],
    ['Long Name', s.name],
    ...(pager
      ? ([
          [
            'Station One-Pager',
            <Anchor href={pager} target="_blank" rel="noopener noreferrer" size="xs">
              Click to View
            </Anchor>,
          ],
        ] as Array<[string, ReactNode]>)
      : []),
    ['Date Installed', s.date_installed ?? '—'],
    ['Sub Network', s.sub_network],
    ['Longitude', String(s.longitude)],
    ['Latitude', String(s.latitude)],
    ['Elevation (ft)', Number.isFinite(s.elevation) ? String(metersToFeet(s.elevation)) : '—'],
    ['County', s.county || '—'],
    ['NWSLI ID', s.nwsli_id || '—'],
  ]

  return (
    <ScrollArea h="100%" type="auto">
      {/* Legacy TABLE_STYLING: no header row, left aligned, grey odd rows. */}
      <Table
        withRowBorders={false}
        striped="odd"
        stripedColor="rgb(220,220,220)"
        verticalSpacing={4}
        fz="xs"
      >
        <Table.Tbody>
          {rows.map(([k, v]) => (
            <Table.Tr key={k}>
              <Table.Td>{k}</Table.Td>
              <Table.Td fw={500}>
                {v}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
