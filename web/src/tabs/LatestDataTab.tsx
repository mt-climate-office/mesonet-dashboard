import { lazy, Suspense, useMemo } from 'react'
import { Box, Center, Grid, Loader, Paper, SegmentedControl, Stack } from '@mantine/core'
import { Sidebar } from '../components/Sidebar'
import { CurrentConditionsCard } from '../components/CurrentConditionsCard'
import { StationMetadataCard } from '../components/StationMetadataCard'
import { WindRoseCard } from '../components/WindRoseCard'
import { CameraCard } from '../components/CameraCard'
import { ForecastCard } from '../components/ForecastCard'
import { useLatestTabState } from '../lib/url-state'
import { useStations } from '../hooks/useStations'

// Heavy deps — keep the initial bundle slim.
const StationTimeseriesChart = lazy(() =>
  import('../components/charts/StationTimeseriesChart').then((m) => ({
    default: m.StationTimeseriesChart,
  })),
)
const StationMap = lazy(() =>
  import('../components/StationMap').then((m) => ({ default: m.StationMap })),
)

const SuspenseFallback = (
  <Center h="100%">
    <Loader size="sm" />
  </Center>
)

export function LatestDataTab() {
  const state = useLatestTabState()
  const stations = useStations()

  // Apply the sidebar's network filter to the map too. Always include the
  // currently-selected station so it stays visible/centered even if the user
  // dropped its network from the filter.
  const filteredStations = useMemo(() => {
    if (!stations.data) return undefined
    if (state.nets.length === 0) return stations.data
    return stations.data.filter(
      (s) => state.nets.includes(s.sub_network) || s.station === state.station,
    )
  }, [stations.data, state.nets, state.station])

  return (
    <Grid gutter="sm" m={0} w="100%" style={{ flex: 1, minHeight: 0 }}>
      <Grid.Col
        span={{ base: 12, md: 4, lg: 3 }}
        style={{ borderRight: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Sidebar />
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 8, lg: 6 }}>
        <Box p="sm" h="100%" mih={{ base: 480, md: 0 }}>
          <Suspense fallback={SuspenseFallback}>
            <StationTimeseriesChart />
          </Suspense>
        </Box>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 12, lg: 3 }}>
        <Stack gap="sm" p="sm" h="100%">
          <Paper p={0} withBorder style={{ overflow: 'hidden' }}>
            <Box p="xs">
              <SegmentedControl
                fullWidth
                size="xs"
                value={state.topCard}
                onChange={(v) => state.setTopCard(v as never)}
                data={[
                  { value: 'wind', label: 'Wind' },
                  { value: 'forecast', label: 'Forecast' },
                  { value: 'photo', label: 'Photo' },
                ]}
              />
            </Box>
            <Box style={{ height: 280 }}>
              {state.topCard === 'wind' && <WindRoseCard />}
              {state.topCard === 'forecast' && (
                <ForecastCard
                  station={
                    stations.data?.find((s) => s.station === state.station) ?? null
                  }
                />
              )}
              {state.topCard === 'photo' && <CameraCard />}
            </Box>
          </Paper>

          <Paper
            p={0}
            withBorder
            style={{
              overflow: 'hidden',
              flex: 1,
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box p="xs">
              <SegmentedControl
                fullWidth
                size="xs"
                value={state.bottomCard}
                onChange={(v) => state.setBottomCard(v as never)}
                data={[
                  { value: 'map', label: 'Map' },
                  { value: 'metadata', label: 'Station' },
                  { value: 'current', label: 'Current' },
                ]}
              />
            </Box>
            <Box style={{ flex: 1, minHeight: 0 }}>
              {state.bottomCard === 'map' &&
                (filteredStations ? (
                  <Suspense fallback={SuspenseFallback}>
                    <StationMap
                      stations={filteredStations}
                      selected={state.station}
                      onSelect={state.setStation}
                    />
                  </Suspense>
                ) : (
                  <Center h="100%">
                    {stations.isError ? (
                      <Box px="md" ta="center">
                        Failed to load station catalog.
                      </Box>
                    ) : (
                      <Loader size="sm" />
                    )}
                  </Center>
                ))}
              {state.bottomCard === 'metadata' && <StationMetadataCard />}
              {state.bottomCard === 'current' && <CurrentConditionsCard />}
            </Box>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
