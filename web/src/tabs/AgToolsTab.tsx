import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
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
import { notifications } from '@mantine/notifications'
import { IconCalendar, IconInfoCircle } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useStations } from '../hooks/useStations'
import { useStationElements } from '../hooks/useStationElements'
import { useResolvedStation } from '../components/useResolvedStation'
import { useAgToolsState } from '../lib/url-state'
import { stationHasSwp, stationsWithSwp } from '../lib/stations'
import { DERIVED_VAR_OPTIONS, GDD_CROPS, SOIL_VAR_OPTIONS } from '../lib/params'
import type { AgVariable } from '../features/ag/ui/AgVariableView'
import type { GddCrop } from '../features/ag/contract'
import type { SoilProfileVar } from '../features/ag/figures/soil'
// Small, dependency-free modules: safe to import eagerly. Everything heavy
// (compute, data, figures, Plotly) sits behind the lazy AgVariableView.
import { GDD_CUTOFFS_F } from '../features/ag/compute/gdd'
import { learnMoreUrl } from '../features/ag/ui/learnMore'
import { PROJECTION_OPTIONS } from '../features/ag/ui/projection'

const AgVariableView = lazy(() => import('../features/ag/ui/AgVariableView'))

const DATE_FMT = 'YYYY-MM-DD'
const today = () => dayjs().startOf('day')
const oneYearAgo = () => dayjs().startOf('day').subtract(365, 'day')

const AG_VARIABLES = new Set<string>(DERIVED_VAR_OPTIONS.map((o) => o.value))
const SWP_ONLY = new Set(['swp', 'percent_saturation'])
const TIME_AGG_VARS = new Set(['etr', 'feels_like', 'cci', 'swp', 'percent_saturation'])
const CROPS = new Set(GDD_CROPS.map((c) => c.value))
const SLIDER_MIN = 30
const SLIDER_MAX = 100

const SuspenseFallback = (
  <Center h="100%">
    <Loader size="sm" />
  </Center>
)

/** Slider position for a cutoff: open-ended caps (∞) sit at the right end. */
const clampSlider = (f: number) => Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, f))
const fmtCutoff = (f: number) => (Number.isFinite(f) ? `${f} °F` : 'no upper cutoff')

export function AgToolsTab() {
  const state = useAgToolsState()
  const stations = useStations()
  // `?s=` may briefly hold an NWSLI / mis-cased id; only query a real station.
  const station = useResolvedStation()
  const stationElements = useStationElements(state.variable === 'annual' ? station : null)
  const stationInfo = useMemo(
    () => stations.data?.find((s) => s.station === station),
    [stations.data, station],
  )

  const variable = (AG_VARIABLES.has(state.variable) ? state.variable : 'etr') as AgVariable
  const crop = (CROPS.has(state.crop ?? '') ? state.crop : 'wheat') as GddCrop
  const cropLabel = GDD_CROPS.find((c) => c.value === crop)?.label ?? crop
  const swpOnly = SWP_ONLY.has(variable)
  const hasSwp = stationHasSwp(stationInfo)

  // Station picker: SWP / percent saturation list only has_swp stations
  // (legacy filter_to_only_swp_stations).
  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    const list = swpOnly ? stationsWithSwp(stations.data) : stations.data
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data, swpOnly])

  // An ineligible station for SWP / saturation is cleared, with a notice
  // (legacy filter_to_only_swp_stations clears it silently).
  useEffect(() => {
    if (!swpOnly || !stationInfo || hasSwp) return
    notifications.show({
      id: 'ag-swp-station-cleared',
      color: 'yellow',
      title: 'Station cleared',
      message: `${stationInfo.name} has no soil water potential sensors. Pick a station with soil water potential to see this variable.`,
      autoClose: 10000,
    })
    void state.setStation(null)
  }, [swpOnly, stationInfo, hasSwp, state])

  // Soil profile: SWP / saturation sub-variables only at has_swp stations.
  const soilOptions = useMemo(
    () => SOIL_VAR_OPTIONS.filter((o) => hasSwp || !SWP_ONLY.has(o.value)),
    [hasSwp],
  )
  const soilVar = (
    soilOptions.some((o) => o.value === state.soilVar) ? state.soilVar : 'soil_vwc'
  ) as SoilProfileVar
  useEffect(() => {
    if (variable !== 'soil_temp,soil_ec_blk' || !stationInfo) return
    if (state.soilVar !== soilVar) void state.setSoilVar(soilVar)
  }, [variable, stationInfo, state, soilVar])

  // Annual comparison options from the station's element catalog; default to
  // the first (legacy update_annual_station_elements).
  const annualOptions = useMemo(() => {
    if (!stationElements.data) return []
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const e of stationElements.data) {
      if (seen.has(e.element)) continue
      seen.add(e.element)
      out.push({ value: e.element, label: e.description_short })
    }
    return out.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
    )
  }, [stationElements.data])
  useEffect(() => {
    if (variable !== 'annual' || annualOptions.length === 0) return
    if (!annualOptions.some((o) => o.value === state.annualVar)) {
      void state.setAnnualVar(annualOptions[0].value, { history: 'replace' })
    }
  }, [variable, annualOptions, state])

  const startDate = state.from ?? oneYearAgo().format(DATE_FMT)
  const endDate = state.to ?? today().format(DATE_FMT)

  // GDD cutoffs: none in the URL → the crop's (compute GDD_CUTOFFS_F, which
  // match the API); moving the slider writes custom cutoffs.
  const cropCutoffs = GDD_CUTOFFS_F[crop]
  const gddLoF = state.gddLo != null && state.gddLo !== '' ? Number(state.gddLo) : null
  const gddHiF = state.gddHi != null && state.gddHi !== '' ? Number(state.gddHi) : null
  const custom = gddLoF != null || gddHiF != null
  const sliderValue: [number, number] = [
    clampSlider(gddLoF ?? cropCutoffs[0]),
    clampSlider(gddHiF ?? cropCutoffs[1]),
  ]
  const [drag, setDrag] = useState<[number, number] | null>(null)

  const setVariable = (v: string | null) => {
    if (!v) return
    if (v !== 'gdd') {
      void state.setGddLo(null)
      void state.setGddHi(null)
    }
    void state.setVariable(v)
  }
  const setDateRange = (from: string | null, to: string | null) => {
    void state.setFrom(from && from.length > 0 ? from : null)
    void state.setTo(to && to.length > 0 ? to : null)
  }

  const showGdd = variable === 'gdd'
  const showSoilSubvar = variable === 'soil_temp,soil_ec_blk'
  const showLivestock = variable === 'cci'
  const showTimeAgg = TIME_AGG_VARS.has(variable)
  const showAnnual = variable === 'annual'
  const learnHref = learnMoreUrl(variable, crop)
  const ndawn = crop === 'wheat' || crop === 'barley'

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
                  stations.isLoading
                    ? 'Loading stations…'
                    : swpOnly
                      ? 'Pick a station with soil water potential'
                      : 'Pick a station'
                }
                value={state.station}
                onChange={(v) => void state.setStation(v)}
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
                    value={variable}
                    onChange={setVariable}
                    data={DERIVED_VAR_OPTIONS}
                    allowDeselect={false}
                  />
                </Stack>
                <Button
                  component="a"
                  href={learnHref}
                  target="_blank"
                  rel="noreferrer"
                  variant="light"
                  size="sm"
                  leftSection={<IconInfoCircle size={16} />}
                >
                  Learn More
                </Button>
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
                  const arr = (Array.isArray(v) ? v : [null, null]) as [string | null, string | null]
                  setDateRange(arr[0], arr[1])
                }}
                valueFormat="MMM D, YYYY"
                leftSection={<IconCalendar size={16} />}
                maxDate={today().format(DATE_FMT)}
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
                    onChange={(v) => void state.setTime(v as never)}
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
                    onChange={(v) => void state.setLivestock(v as never)}
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
                    value={crop}
                    onChange={(v) => {
                      void state.setCrop(v as string)
                      // A new crop starts from its own cutoffs.
                      void state.setGddLo(null)
                      void state.setGddHi(null)
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
                  <Group justify="space-between" mt="xs" gap="xs">
                    <Text fw={600} size="sm">
                      Temperature cutoffs
                    </Text>
                    {custom && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => {
                          void state.setGddLo(null)
                          void state.setGddHi(null)
                        }}
                      >
                        Reset to {cropLabel.toLowerCase()} cutoffs
                      </Button>
                    )}
                  </Group>
                  <RangeSlider
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    step={1}
                    minRange={1}
                    value={drag ?? sliderValue}
                    onChange={setDrag}
                    onChangeEnd={(val) => {
                      setDrag(null)
                      void state.setGddLo(String(val[0]))
                      void state.setGddHi(String(val[1]))
                    }}
                    label={(v) => `${v}°F`}
                    marks={[
                      { value: 30, label: '30°F' },
                      { value: 50, label: '50°F' },
                      { value: 70, label: '70°F' },
                      { value: 90, label: '90°F' },
                    ]}
                    mb="md"
                    aria-label="GDD temperature cutoffs"
                  />
                  <Text size="xs" c="dimmed" data-testid="gdd-cutoff-mode">
                    {custom
                      ? `Custom cutoffs ${gddLoF ?? cropCutoffs[0]}–${gddHiF ?? fmtCutoff(cropCutoffs[1])} °F: growth-stage labels are not shown.`
                      : `${cropLabel} cutoffs: ${cropCutoffs[0]} °F to ${fmtCutoff(cropCutoffs[1])}` +
                        (ndawn
                          ? `, switching to ${GDD_CUTOFFS_F[`${crop as 'wheat' | 'barley'}2`][1]} °F at Haun stage 2 (NDAWN).`
                          : '.') +
                        ' Move the slider for custom cutoffs.'}
                  </Text>
                  <Text fw={600} size="sm">
                    Projection
                  </Text>
                  <Select
                    size="xs"
                    value={state.gddProj}
                    onChange={(v) => v && void state.setGddProj(v as never)}
                    data={PROJECTION_OPTIONS}
                    allowDeselect={false}
                    aria-label="GDD projection horizon"
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
                    value={soilVar}
                    onChange={(v) => void state.setSoilVar(v as string)}
                  >
                    <Group gap={4}>
                      {soilOptions.map((s) => (
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
                        : !station
                          ? 'Pick a station first'
                          : 'Select a variable'
                    }
                    value={state.annualVar}
                    onChange={(v) => void state.setAnnualVar(v)}
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

      <Card withBorder p="xs" style={{ flex: 1, minHeight: 540, display: 'flex' }}>
        <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
          {!station || (swpOnly && stationInfo && !hasSwp) ? (
            <Center h="100%">
              <Text c="dimmed" size="sm">
                {state.station && !stations.data ? 'Loading stations…' : 'Pick a station to begin.'}
              </Text>
            </Center>
          ) : (
            <Suspense fallback={SuspenseFallback}>
              <AgVariableView
                variable={variable}
                station={station}
                stationInfo={stationInfo}
                start={startDate <= endDate ? startDate : endDate}
                end={endDate}
                period={showTimeAgg ? state.time : 'daily'}
                livestock={state.livestock}
                crop={crop}
                cropLabel={cropLabel}
                gddLoF={gddLoF}
                gddHiF={gddHiF}
                gddProj={state.gddProj}
                soilVar={soilVar}
                annualVar={state.annualVar}
              />
            </Suspense>
          )}
        </Box>
      </Card>
    </Box>
  )
}
