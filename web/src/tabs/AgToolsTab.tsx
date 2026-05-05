import { lazy, Suspense, useEffect, useMemo } from 'react'
import {
  Anchor,
  Box,
  Button,
  Card,
  Center,
  Chip,
  Grid,
  Group,
  Loader,
  RangeSlider,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconCalendar, IconInfoCircle } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useStations } from '../hooks/useStations'
import { useStationElements } from '../hooks/useStationElements'
import { useDerived, useDerivedSoil } from '../hooks/useDerived'
import { useStationRecord } from '../hooks/useStationRecord'
import { useAgToolsState } from '../lib/url-state'
import {
  DERIVED_VAR_OPTIONS,
  GDD_CROPS,
  GDD_CROP_THRESHOLDS,
  SOIL_VAR_OPTIONS,
} from '../lib/params'

const DerivedChart = lazy(() =>
  import('../components/charts/DerivedChart').then((m) => ({
    default: m.DerivedChart,
  })),
)

const DATE_FMT = 'YYYY-MM-DD'
const today = () => dayjs().startOf('day')
const oneYearAgo = () => dayjs().startOf('day').subtract(365, 'day')

const LEARN_MORE_BASE = 'https://climate.umt.edu/mesonet/ag_tools/'
const LEARN_MORE_MAP: Record<string, string> = {
  gdd: 'gdds',
  'soil_temp,soil_ec_blk': 'soil_profile',
  cci: 'risk',
  etr: 'etr',
  feels_like: 'feels_like',
  swp: 'swp',
  percent_saturation: 'percent_saturation',
  annual: '',
}

function learnMoreUrl(variable: string, crop: string | null) {
  const slug = LEARN_MORE_MAP[variable] ?? ''
  const url = slug ? `${LEARN_MORE_BASE}${slug}/` : LEARN_MORE_BASE
  if (variable === 'gdd' && crop) return `${url}#${crop}-growing-degree-days`
  return url
}

const SuspenseFallback = (
  <Center h="100%">
    <Loader size="sm" />
  </Center>
)

export function AgToolsTab() {
  const state = useAgToolsState()
  const stations = useStations()
  const stationElements = useStationElements(state.station)

  // Build station options.
  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    return stations.data
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data])

  // Auto-set GDD slider when crop changes — but only if user hasn't manually
  // overridden via the slider (we detect that via the gdd_lo/gdd_hi URL keys).
  useEffect(() => {
    if (state.variable !== 'gdd') return
    if (state.gddLo != null || state.gddHi != null) return
    const thresh = GDD_CROP_THRESHOLDS[state.crop ?? 'wheat']
    if (!thresh) return
    state.setGddLo(String(thresh[0]))
    state.setGddHi(String(thresh[1]))
    // we want this to fire only when crop or variable changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.variable, state.crop])

  const startDate = state.from ?? oneYearAgo().format(DATE_FMT)
  const endDate = state.to ?? today().format(DATE_FMT)

  // ---------------- Data fetching dispatch ----------------
  // Variable controls which fetch hook is active. Hooks are always called
  // (rules of hooks); pass null to disable a query.
  const isSoilProfile = state.variable === 'soil_temp,soil_ec_blk'
  const isAnnual = state.variable === 'annual'

  const derivedQuery =
    state.station && state.variable && !isSoilProfile && !isAnnual
      ? {
          station: state.station,
          variable: state.variable,
          start: startDate,
          end: endDate,
          // GDD is a daily-only derived element on the new API; force it
          // even if the URL still has time=hourly from a previous variable.
          time: state.variable === 'gdd' ? 'daily' as const : state.time,
          crop: state.variable === 'gdd' ? (state.crop ?? 'wheat') : undefined,
        }
      : null
  const derivedQ = useDerived(derivedQuery)

  // Soil profile uses observations + derived merge. We pick variable based on
  // soilVar selection (but always fetch all soil columns so flips between
  // soil sub-variables don't refetch).
  const soilQuery =
    state.station && isSoilProfile
      ? {
          station: state.station,
          variable: 'soil_temp,soil_ec_blk,soil_vwc',
          start: startDate,
          end: endDate,
          time: state.time,
        }
      : null
  const soilQ = useDerivedSoil(soilQuery)

  // Annual comparison fetches the entire period of record for one element. We
  // use the station's actual install date when available rather than a hard-
  // coded epoch, since some stations only go back to 2018.
  const annualStart = useMemo(() => {
    if (!stations.data || !state.station) return '2017-01-01'
    const s = stations.data.find((row) => row.station === state.station)
    if (s?.date_installed && /^\d{4}-\d{2}-\d{2}/.test(s.date_installed)) {
      return s.date_installed.slice(0, 10)
    }
    return '2017-01-01'
  }, [stations.data, state.station])
  const annualQuery =
    state.station && isAnnual && state.annualVar
      ? {
          station: state.station,
          start: annualStart,
          end: today().format(DATE_FMT),
          period: 'daily' as const,
          elements: state.annualVar,
          rmNa: true,
          publicOnly: false,
        }
      : null
  const annualQ = useStationRecord(annualQuery)

  // Find the column to plot for annual comparison (first non-station/datetime).
  const annualColumn = useMemo(() => {
    if (!annualQ.data || annualQ.data.length === 0) return ''
    const sample = annualQ.data[0] as Record<string, unknown>
    return Object.keys(sample).find((k) => k !== 'station' && k !== 'datetime') ?? ''
  }, [annualQ.data])

  // Annual variable options come from the station's element catalog.
  const annualOptions = useMemo(() => {
    if (!stationElements.data) return []
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const e of stationElements.data) {
      if (seen.has(e.element)) continue
      seen.add(e.element)
      out.push({ value: e.element, label: e.description_short })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label))
  }, [stationElements.data])

  // Reset gdd_lo/hi when variable changes away from gdd.
  const setVariable = (v: string | null) => {
    if (!v) return
    if (v !== 'gdd') {
      state.setGddLo(null)
      state.setGddHi(null)
    }
    state.setVariable(v)
  }

  const setDateRange = (from: string | null, to: string | null) => {
    state.setFrom(from && from.length > 0 ? from : null)
    state.setTo(to && to.length > 0 ? to : null)
  }

  // ---------------- Layout helpers ----------------
  const showGdd = state.variable === 'gdd'
  const showSoilSubvar = isSoilProfile
  const showLivestock = state.variable === 'cci'
  // GDD is a daily-only derived element on the new API. Surface the time-
  // aggregation toggle only for variables the API supports at both cadences.
  const showTimeAgg = ['etr', 'feels_like', 'cci'].includes(state.variable)
  const showAnnual = isAnnual

  const gddLow = state.gddLo ? Number(state.gddLo) : 50
  const gddHigh = state.gddHi ? Number(state.gddHi) : 86

  const learnHref = learnMoreUrl(state.variable, state.crop)

  // ---------------- Render ----------------
  return (
    <Box p="sm" w="100%" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Card withBorder p="md" mb="sm">
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="xs">
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
                nothingFoundMessage={stations.isError ? 'Failed to load' : 'No matches'}
                leftSection={stations.isLoading ? <Loader size="xs" /> : null}
              />
              <Group align="flex-end" wrap="nowrap" gap="sm">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600} size="sm">
                    Variable
                  </Text>
                  <Select
                    value={state.variable}
                    onChange={setVariable}
                    data={DERIVED_VAR_OPTIONS}
                    allowDeselect={false}
                  />
                </Stack>
                <Anchor
                  href={learnHref}
                  target="_blank"
                  rel="noreferrer"
                  size="sm"
                >
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<IconInfoCircle size={16} />}
                  >
                    Learn More
                  </Button>
                </Anchor>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="xs">
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
                maxDate={today().add(1, 'day').format(DATE_FMT)}
                allowSingleDateInRange
              />
              {showTimeAgg && (
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Time aggregation
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={state.time}
                    onChange={(v) => state.setTime(v as never)}
                    data={[
                      { value: 'hourly', label: 'Hourly' },
                      { value: 'daily', label: 'Daily' },
                    ]}
                  />
                </Stack>
              )}
              {showLivestock && (
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Livestock type
                  </Text>
                  <Chip.Group
                    multiple={false}
                    value={state.livestock}
                    onChange={(v) => state.setLivestock(v as never)}
                  >
                    <Group gap="xs">
                      <Chip value="adult" size="xs">
                        Adult
                      </Chip>
                      <Chip value="newborn" size="xs">
                        Newborn
                      </Chip>
                    </Group>
                  </Chip.Group>
                </Stack>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="xs">
              {showGdd && (
                <>
                  <Text fw={600} size="sm">
                    GDD crop
                  </Text>
                  <Chip.Group
                    multiple={false}
                    value={state.crop ?? 'wheat'}
                    onChange={(v) => {
                      const crop = v as string
                      state.setCrop(crop)
                      // Reset slider so the threshold table is re-applied.
                      state.setGddLo(null)
                      state.setGddHi(null)
                    }}
                  >
                    <Group gap={4}>
                      {GDD_CROPS.map((c) => (
                        <Chip key={c.value} value={c.value} size="xs">
                          {c.label}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                  <Text fw={600} size="sm" mt="xs">
                    Temperature range
                  </Text>
                  <RangeSlider
                    min={30}
                    max={100}
                    step={1}
                    minRange={1}
                    value={[gddLow, gddHigh]}
                    onChange={(val) => {
                      state.setGddLo(String(val[0]))
                      state.setGddHi(String(val[1]))
                    }}
                    marks={[
                      { value: 30, label: '30°F' },
                      { value: 50, label: '50°F' },
                      { value: 70, label: '70°F' },
                      { value: 90, label: '90°F' },
                    ]}
                    mb="md"
                  />
                </>
              )}
              {showSoilSubvar && (
                <>
                  <Text fw={600} size="sm">
                    Soil variable
                  </Text>
                  <Chip.Group
                    multiple={false}
                    value={state.soilVar ?? 'soil_vwc'}
                    onChange={(v) => state.setSoilVar(v as string)}
                  >
                    <Group gap={4}>
                      {SOIL_VAR_OPTIONS.map((s) => (
                        <Chip key={s.value} value={s.value} size="xs">
                          {s.label}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </>
              )}
              {showAnnual && (
                <>
                  <Text fw={600} size="sm">
                    Comparison variable
                  </Text>
                  <Select
                    placeholder={
                      stationElements.isLoading
                        ? 'Loading…'
                        : !state.station
                          ? 'Pick a station first'
                          : 'Select a variable'
                    }
                    value={state.annualVar}
                    onChange={(v) => state.setAnnualVar(v)}
                    data={annualOptions}
                    searchable
                    nothingFoundMessage="No matching elements"
                  />
                </>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>

      <Card withBorder p="xs" style={{ flex: 1, minHeight: 320, display: 'flex' }}>
        <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
          {!state.station ? (
            <Center h="100%">
              <Stack gap="xs" align="center">
                <Text c="dimmed" size="sm">
                  Pick a station to begin.
                </Text>
              </Stack>
            </Center>
          ) : (
            <Suspense fallback={SuspenseFallback}>
              {isSoilProfile ? (
                <DerivedChart
                  variable="soil_temp,soil_ec_blk"
                  data={soilQ.data}
                  isLoading={soilQ.isLoading}
                  isError={soilQ.isError}
                  error={soilQ.error}
                  soilVar={state.soilVar ?? 'soil_vwc'}
                />
              ) : isAnnual ? (
                state.annualVar ? (
                  <DerivedChart
                    variable="annual"
                    data={annualQ.data}
                    isLoading={annualQ.isLoading}
                    isError={annualQ.isError}
                    error={annualQ.error}
                    annualColumn={annualColumn}
                  />
                ) : (
                  <Center h="100%">
                    <Text c="dimmed" size="sm">
                      Select a comparison variable to continue.
                    </Text>
                  </Center>
                )
              ) : (
                <DerivedChart
                  variable={state.variable}
                  data={derivedQ.data}
                  isLoading={derivedQ.isLoading}
                  isError={derivedQ.isError}
                  error={derivedQ.error}
                  newborn={state.livestock === 'newborn'}
                  gddLow={gddLow}
                  gddHigh={gddHigh}
                />
              )}
            </Suspense>
          )}
        </Box>
      </Card>
    </Box>
  )
}
