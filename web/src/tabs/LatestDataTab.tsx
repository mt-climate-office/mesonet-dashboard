import { lazy, Suspense, useMemo } from 'react'
import { Box, Center, Grid, Loader, Paper, SegmentedControl, Stack } from '@mantine/core'
import { Sidebar } from '../components/Sidebar'
import { CurrentConditionsCard } from '../components/CurrentConditionsCard'
import { StationMetadataCard } from '../components/StationMetadataCard'
import { WindRoseCard } from '../components/WindRoseCard'
import { CameraCard } from '../components/CameraCard'
import { ForecastCard } from '../components/ForecastCard'
import { useLatestTabState, type BottomCard, type TopCard } from '../lib/url-state'
import { useStations } from '../hooks/useStations'
import { hasCamera, usePhotoSchedule } from '../lib/photos'
import { useStationLatest } from '../hooks/useStationLatest'
import { useResolvedStation } from '../components/useResolvedStation'

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
  const resolved = useResolvedStation()
  const stationRow = stations.data?.find((s) => s.station === resolved) ?? null
  // Latest Photo is enabled when the data2 camera schedule has a current
  // period with views for the station (legacy keyed it to HydroMet). If the
  // schedule can't load, the card stays reachable and says so.
  const schedule = usePhotoSchedule()
  const camera = hasCamera(schedule.data, resolved)
  const photoEnabled = !!resolved && (camera || schedule.isError)

  // Card defaults (legacy select_default_tab / update_br_card): with no
  // explicit `card`/`info` in the URL, the top card is the photo when the
  // station has a camera and the wind rose otherwise; the bottom card is
  // Current Conditions with a station, the map without one. A disabled photo
  // choice falls back to the wind rose (once the schedule has answered).
  const autoTop: TopCard = camera ? 'photo' : 'wind'
  let topCard: TopCard = state.topCard ?? autoTop
  if (topCard === 'photo' && !photoEnabled && (!resolved || !schedule.isPending)) topCard = 'wind'

  // Current Conditions with no station falls back to the map; when the latest
  // request fails, the auto default falls back to the metadata card (legacy
  // app.py:401 switches to meta-tab).
  const latest = useStationLatest(resolved)
  let bottomCard: BottomCard = state.bottomCard ?? (resolved ? 'current' : 'map')
  if (bottomCard === 'current' && !state.station) bottomCard = 'map'
  // Only when there's nothing to show: a failed background refetch keeps the
  // previous data, and shouldn't move the user off Current Conditions.
  if (bottomCard === 'current' && state.bottomCard === null && latest.isError && !latest.data) {
    bottomCard = 'metadata'
  }

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
    // `overflow-x: clip` trims the Grid gutter's negative margins (6 px of
    // sideways scroll on phones) without creating a scroll container.
    <Grid gutter="sm" m={0} w="100%" style={{ flex: 1, minHeight: 0, overflowX: 'clip' }}>
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
        {/* On wide screens the card column is viewport-tall (legacy 88vh
            columns) so a long Current Conditions table scrolls inside its
            card instead of stretching the whole row and the plot. */}
        <Stack
          gap="sm"
          p="sm"
          h={{ base: 'auto', lg: 'calc(100dvh - 116px)' }}
          style={{ overflowY: 'auto' }}
        >
          <Paper p={0} withBorder style={{ overflow: 'hidden', flexShrink: 0 }}>
            <Box p="xs">
              <SegmentedControl
                fullWidth
                size="xs"
                value={topCard}
                onChange={(v) => void state.setTopCard(v as TopCard)}
                data={[
                  { value: 'wind', label: 'Wind Rose' },
                  { value: 'forecast', label: 'Weather Forecast' },
                  { value: 'photo', label: 'Latest Photo', disabled: !photoEnabled },
                ]}
              />
            </Box>
            <Box style={{ height: 'max(300px, 40vh)' }}>
              {topCard === 'wind' && <WindRoseCard />}
              {topCard === 'forecast' && <ForecastCard station={stationRow} />}
              {topCard === 'photo' && <CameraCard />}
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
                value={bottomCard}
                onChange={(v) => void state.setBottomCard(v as BottomCard)}
                data={[
                  { value: 'map', label: 'Locator Map' },
                  { value: 'metadata', label: 'Station Metadata' },
                  { value: 'current', label: 'Current Conditions' },
                ]}
              />
            </Box>
            <Box style={{ flex: 1, minHeight: 0 }}>
              {bottomCard === 'map' &&
                (filteredStations ? (
                  <Suspense fallback={SuspenseFallback}>
                    <StationMap
                      stations={filteredStations}
                      selected={state.station}
                      onSelect={state.selectStation}
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
              {bottomCard === 'metadata' && <StationMetadataCard />}
              {bottomCard === 'current' && <CurrentConditionsCard />}
            </Box>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
