import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconAlertCircle,
  IconCalendar,
  IconDownload,
  IconPlayerPlay,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { useStations } from '../hooks/useStations'
import { useStationElements } from '../hooks/useStationElements'
import { useDownloaderState } from '../lib/url-state'
import { getStationRecord, type ObservationRow } from '../lib/api'

const DownloaderPreviewChart = lazy(() =>
  import('../components/charts/DownloaderPreviewChart').then((m) => ({
    default: m.DownloaderPreviewChart,
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

const DATE_FMT = 'YYYY-MM-DD'
const today = () => dayjs().startOf('day')

const DERIVED_ELEMENTS = new Set(['feels_like', 'etr', 'swp', 'percent_saturation', 'cci'])

export function DownloaderTab() {
  const state = useDownloaderState()
  const stations = useStations()
  const stationElements = useStationElements(state.station)

  const [data, setData] = useState<ObservationRow[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    return stations.data
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data])

  // Filter element list against the showUncommon toggle. The legacy app passed
  // `public=!showUncommon` so when "Show Uncommon" is OFF we only get common
  // public elements; when ON we get the full list. Our /elements endpoint
  // already returns the full list, so we filter client-side by checking if
  // the description starts with the element-style label.
  const elementOptions = useMemo(() => {
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

  const startDate =
    state.from ??
    today()
      .subtract(state.period === 'hourly' ? 14 : 365, 'day')
      .format(DATE_FMT)
  const endDate = state.to ?? today().format(DATE_FMT)

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      state.setFrom(from && from.length > 0 ? from : null)
      state.setTo(to && to.length > 0 ? to : null)
    },
    [state],
  )

  const handleRun = useCallback(async () => {
    if (!state.station || state.elements.length === 0) {
      setHint('Please select a station and at least one variable first!')
      return
    }
    setHint(null)
    setIsLoading(true)
    setError(null)
    try {
      const stdElems = state.elements.filter((e) => !DERIVED_ELEMENTS.has(e))
      const derivedElems = state.elements.filter((e) => DERIVED_ELEMENTS.has(e))
      const out = await getStationRecord({
        station: state.station,
        start: startDate,
        end: endDate,
        period: state.period,
        elements: stdElems.join(','),
        hasEtr: false,
        derivedElems: derivedElems.length > 0 ? derivedElems : undefined,
        rmNa: state.removeFlagged,
        naInfo: true,
        publicOnly: !state.showUncommon,
      })
      setData(out)
    } catch (err) {
      setError(err as Error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [state, startDate, endDate])

  const handleDownload = useCallback(() => {
    if (!data || data.length === 0) {
      setHint('Run a request first before attempting to download.')
      return
    }
    setHint(null)
    const csv = Papa.unparse(data as unknown as Record<string, unknown>[])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeStart = startDate.replace(/-/g, '')
    const safeEnd = endDate.replace(/-/g, '')
    a.href = url
    a.download = `${state.station ?? 'mesonet'}_${state.period}_${safeStart}_to_${safeEnd}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [data, startDate, endDate, state.station, state.period])

  return (
    <Box p="sm" w="100%" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Group align="stretch" wrap="wrap" gap="sm" style={{ flex: 1, minHeight: 0 }}>
        {/* Left: controls + map */}
        <Stack
          gap="sm"
          style={{ flex: '0 0 380px', minWidth: 320, maxWidth: '100%' }}
        >
          <Card withBorder p="md">
            <Stack gap="sm">
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
                  nothingFoundMessage={stations.isError ? 'Failed to load' : 'No matches'}
                  leftSection={stations.isLoading ? <Loader size="xs" /> : null}
                />
              </Stack>

              <Stack gap={4}>
                <Text fw={600} size="sm">
                  Variables
                </Text>
                <MultiSelect
                  placeholder={
                    !state.station
                      ? 'Pick a station first'
                      : stationElements.isLoading
                        ? 'Loading…'
                        : 'Select one or more variables'
                  }
                  value={state.elements}
                  onChange={(v) => state.setElements(v)}
                  data={elementOptions}
                  searchable
                  clearable
                  hidePickedOptions
                  nothingFoundMessage="No matching elements"
                />
              </Stack>

              <Group gap="md" grow>
                <Switch
                  label="Show uncommon variables"
                  size="sm"
                  checked={state.showUncommon}
                  onChange={(e) => state.setShowUncommon(e.currentTarget.checked)}
                />
                <Switch
                  label="Remove flagged data"
                  size="sm"
                  checked={state.removeFlagged}
                  onChange={(e) => state.setRemoveFlagged(e.currentTarget.checked)}
                />
              </Group>

              <Stack gap={4}>
                <Text fw={600} size="sm">
                  Time aggregation
                </Text>
                <SegmentedControl
                  size="xs"
                  fullWidth
                  value={state.period}
                  onChange={(v) => state.setPeriod(v as never)}
                  data={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'hourly', label: 'Hourly' },
                  ]}
                />
              </Stack>

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

              <Group gap="xs">
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={isLoading}
                  onClick={handleRun}
                  variant="filled"
                  flex={1}
                >
                  Run Request
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleDownload}
                  variant="light"
                  flex={1}
                  disabled={!data || data.length === 0}
                >
                  Download CSV
                </Button>
              </Group>

              {hint && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {hint}
                </Alert>
              )}
              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  variant="light"
                >
                  {error.message}
                </Alert>
              )}
            </Stack>
          </Card>

          <Paper withBorder style={{ overflow: 'hidden', minHeight: 280, flex: 1 }}>
            {stations.data ? (
              <Suspense fallback={SuspenseFallback}>
                <StationMap
                  stations={stations.data}
                  selected={state.station}
                  onSelect={state.setStation}
                />
              </Suspense>
            ) : (
              SuspenseFallback
            )}
          </Paper>
        </Stack>

        {/* Right: preview chart */}
        <Card
          withBorder
          p="xs"
          style={{ flex: 1, minWidth: 320, minHeight: 480, display: 'flex' }}
        >
          <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Suspense fallback={SuspenseFallback}>
              <DownloaderPreviewChart
                data={data ?? undefined}
                isLoading={isLoading}
                isError={!!error}
                error={error}
              />
            </Suspense>
          </Box>
        </Card>
      </Group>
    </Box>
  )
}
