import { useMemo } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Card,
  Center,
  Checkbox,
  Chip,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconCalendar, IconSatellite } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useStations } from '../hooks/useStations'
import { useSatelliteState } from '../lib/url-state'
import {
  SATELLITE_VAR_LABELS,
  SATELLITE_VARS,
  SAT_COMPARE_OPTIONS,
} from '../lib/params'
import { LEGACY_DASHBOARD_URL } from '../lib/config'

const DATE_FMT = 'YYYY-MM-DD'
const today = () => dayjs().startOf('day')
const oneYearAgo = () => dayjs().startOf('day').subtract(1, 'year')

/**
 * Satellite Indicators tab. The legacy app pulled MODIS/SMAP/VIIRS time
 * series from a private Neo4j box at fcfc-mesonet-db2.cfc.umt.edu over bolt:
 * which the browser cannot reach (no public bolt port forwarding, no CORS).
 * We confirmed the new RDS-backed REST API has no /satellite* endpoints
 * (verified via GET https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com/openapi.json),
 * so the data layer cannot exist client-side until that migration completes.
 *
 * The full UI shell is rendered so users can see what the tab will look like
 * and so URL state survives a hard refresh; the plot area shows a styled
 * placeholder with a link back to the legacy dashboard.
 */
export function SatelliteTab() {
  const state = useSatelliteState()
  const stations = useStations()

  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    return stations.data
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data])

  const startDate = state.from ?? oneYearAgo().format(DATE_FMT)
  const endDate = state.to ?? today().format(DATE_FMT)

  const setDateRange = (from: string | null, to: string | null) => {
    state.setFrom(from && from.length > 0 ? from : null)
    state.setTo(to && to.length > 0 ? to : null)
  }

  const isTs = state.mode === 'ts'

  return (
    <Box p="sm" w="100%" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Card withBorder p="md" mb="sm">
        <Grid gutter="md" align="flex-end">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap={4}>
              <Text fw={600} size="sm">
                Station
              </Text>
              <Select
                placeholder={
                  stations.isLoading ? 'Loading stations…' : 'Pick a station'
                }
                value={state.station}
                onChange={(v) => state.setStation(v)}
                data={stationOptions}
                searchable
                clearable
                leftSection={stations.isLoading ? <Loader size="xs" /> : null}
              />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap={4}>
              <Text fw={600} size="sm">
                Mode
              </Text>
              <Chip.Group
                multiple={false}
                value={state.mode}
                onChange={(v) => state.setMode(v as never)}
              >
                <Group gap="xs">
                  <Chip value="ts" size="xs">
                    Timeseries Plot
                  </Chip>
                  <Chip value="cmp" size="xs">
                    Comparison Plot
                  </Chip>
                </Group>
              </Chip.Group>
            </Stack>
          </Grid.Col>

          {isTs ? (
            <>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Percentiles
                  </Text>
                  <Switch
                    size="sm"
                    label={state.percentiles ? 'Showing' : 'Hidden'}
                    checked={state.percentiles}
                    onChange={(e) => state.setPercentiles(e.currentTarget.checked)}
                  />
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Indicators
                  </Text>
                  <Checkbox.Group
                    value={state.vars}
                    onChange={(v) => state.setVars(v as string[])}
                  >
                    <Group gap="md">
                      {SATELLITE_VARS.map((v) => (
                        <Checkbox
                          key={v}
                          value={v}
                          label={SATELLITE_VAR_LABELS[v]}
                        />
                      ))}
                    </Group>
                  </Checkbox.Group>
                </Stack>
              </Grid.Col>
            </>
          ) : (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Group gap="md" grow align="flex-end">
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    X-Axis
                  </Text>
                  <Select
                    placeholder="Select an X-axis…"
                    value={state.cmpX}
                    onChange={(v) => state.setCmpX(v)}
                    data={SAT_COMPARE_OPTIONS}
                    searchable
                  />
                </Stack>
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Y-Axis
                  </Text>
                  <Select
                    placeholder="Select a Y-axis…"
                    value={state.cmpY}
                    onChange={(v) => state.setCmpY(v)}
                    data={SAT_COMPARE_OPTIONS}
                    searchable
                  />
                </Stack>
              </Group>
            </Grid.Col>
          )}
        </Grid>

        {!isTs && (
          <Group gap="md" mt="md" grow>
            <Stack gap={4}>
              <Text fw={600} size="sm">
                Date range
              </Text>
              <DatePickerInput
                type="range"
                value={[startDate, endDate]}
                onChange={(v) => {
                  const arr = (Array.isArray(v) ? v : [null, null]) as [
                    string | null,
                    string | null,
                  ]
                  setDateRange(arr[0], arr[1])
                }}
                valueFormat="MMM D, YYYY"
                leftSection={<IconCalendar size={16} />}
                maxDate={today().format(DATE_FMT)}
                allowSingleDateInRange
              />
            </Stack>
          </Group>
        )}
      </Card>

      <Card
        withBorder
        p="xs"
        style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'stretch' }}
      >
        <Center style={{ flex: 1, minHeight: 0, width: '100%' }} px="md">
          <Stack gap="md" align="center" maw={620}>
            <Badge
              color="orange"
              size="lg"
              leftSection={<IconSatellite size={14} />}
            >
              Migration in progress
            </Badge>
            <Title order={3} ta="center">
              Satellite indicators are being migrated
            </Title>
            <Text ta="center" c="dimmed">
              The legacy dashboard fetches MODIS, VIIRS, and SMAP indicators
              from a private graph database that is not yet exposed through the
              new public API. Once those endpoints land, this tab will plot{' '}
              {state.station ? (
                <Text component="span" fw={600}>
                  {state.station}
                </Text>
              ) : (
                'station'
              )}{' '}
              series for the indicators selected above.
            </Text>
            <Alert
              variant="light"
              color="blue"
              title="Use the legacy dashboard for now"
              w="100%"
            >
              <Text size="sm">
                The legacy dashboard still serves the same satellite plots:{' '}
                <Anchor
                  href={`${LEGACY_DASHBOARD_URL}/#satellite`}
                  target="_blank"
                  rel="noreferrer"
                >
                  open the satellite tab in the legacy dashboard ↗
                </Anchor>
              </Text>
            </Alert>
            <Text size="xs" c="dimmed" ta="center">
              Your station and panel selections above are saved to the URL,
              so once the migration is complete you'll be able to refresh
              and see your plot.
            </Text>
          </Stack>
        </Center>
      </Card>
    </Box>
  )
}
