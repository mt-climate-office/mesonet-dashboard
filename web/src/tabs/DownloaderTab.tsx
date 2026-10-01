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
import { useStations } from '../hooks/useStations'
import { useStationElements } from '../hooks/useStationElements'
import { useDownloaderState } from '../lib/url-state'
import { toCsv } from '../lib/csv'
import {
  DEFAULT_QC_LEVEL,
  DERIVED_CODES,
  DERIVED_OPTIONS,
  downloadFilename,
  fetchDownload,
  QC_LEVEL_OPTIONS,
  type DownloadQuery,
  type DownloadResult,
  type QcLevel,
} from './downloader/request'
import { elementLabel } from './downloader/labels'

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
const todayStr = () => dayjs().format(DATE_FMT)

export function DownloaderTab() {
  const state = useDownloaderState()
  const stations = useStations()
  // "Show uncommon" OFF → public=true (common elements only); ON → the full
  // list (public=false), as legacy `get_station_elements(public=not checked)`.
  const stationElements = useStationElements(state.station, !state.showUncommon)

  const [result, setResult] = useState<{ query: DownloadQuery; data: DownloadResult } | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  // QC level: explicit `qc`, else legacy `rmna=true` → fully QC'd, else the
  // tier the Latest tab uses.
  const qcLevel: QcLevel = state.qcLevel ?? (state.removeFlagged ? 2 : DEFAULT_QC_LEVEL)
  const qcInfo = QC_LEVEL_OPTIONS.find((o) => o.value === qcLevel)!

  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    return stations.data
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data])

  const installDate = useMemo(() => {
    const st = stations.data?.find((s) => s.station === state.station)
    const d = st?.date_installed
    return d ? String(d).slice(0, 10) : null
  }, [stations.data, state.station])

  const standardOptions = useMemo(() => {
    if (!stationElements.data) return []
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const e of stationElements.data) {
      if (seen.has(e.element) || DERIVED_CODES.has(e.element)) continue
      seen.add(e.element)
      out.push({ value: e.element, label: elementLabel(e.description_short) })
    }
    return out.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
    )
  }, [stationElements.data])

  const elementData = useMemo(
    () => [
      { group: 'Standard elements', items: standardOptions },
      { group: 'Derived variables', items: DERIVED_OPTIONS.map((o) => ({ ...o })) },
    ],
    [standardOptions],
  )

  // Drop selections the current station / uncommon filter doesn't offer
  // (legacy did the same). Until the list loads, keep the URL selection.
  const selectedElements = useMemo(() => {
    if (!stationElements.data) return state.elements
    const valid = new Set(standardOptions.map((o) => o.value))
    return state.elements.filter((e) => DERIVED_CODES.has(e) || valid.has(e))
  }, [state.elements, standardOptions, stationElements.data])

  const today = todayStr()
  const startDate = state.from ?? installDate ?? dayjs().subtract(365, 'day').format(DATE_FMT)
  const endDate = state.to ?? today
  const dateError =
    startDate > endDate
      ? 'Start date must be on or before the end date.'
      : installDate && startDate < installDate
        ? `Start date is before this station was installed (${installDate}).`
        : null

  const selectStation = useCallback(
    (v: string | null) => {
      state.setStation(v)
      // Legacy resets the start to the new station's install date.
      state.setFrom(null)
    },
    [state],
  )

  const handleRun = useCallback(async () => {
    if (!state.station || selectedElements.length === 0) {
      setHint('Please select a station and at least one variable first!')
      return
    }
    if (dateError) {
      setHint(dateError)
      return
    }
    setHint(null)
    setIsLoading(true)
    setError(null)
    const query: DownloadQuery = {
      station: state.station,
      start: startDate,
      end: endDate,
      period: state.period,
      elements: selectedElements,
      level: qcLevel,
    }
    try {
      const data = await fetchDownload(query)
      setResult({ query, data })
    } catch (err) {
      setError(err as Error)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }, [state.station, state.period, selectedElements, startDate, endDate, qcLevel, dateError])

  const handleDownload = useCallback(() => {
    if (!result || result.data.rows.length === 0) {
      setHint("Please 'Run Request' before attempting to download.")
      return
    }
    setHint(null)
    const { query, data } = result
    const csv = toCsv(data.rows, data.columns)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadFilename(query.station, query.period, query.start, query.end)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [result])

  const rows = result?.data.rows

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
              <Select
                label="Station"
                placeholder={
                  stations.isLoading ? 'Loading stations…' : 'Pick a station'
                }
                value={state.station}
                onChange={selectStation}
                data={stationOptions}
                searchable
                clearable
                nothingFoundMessage={stations.isError ? 'Failed to load' : 'No matches'}
                leftSection={stations.isLoading ? <Loader size="xs" /> : null}
              />

              <MultiSelect
                label="Variables"
                placeholder={
                  !state.station
                    ? 'Pick a station first'
                    : stationElements.isLoading
                      ? 'Loading…'
                      : 'Select one or more variables'
                }
                value={selectedElements}
                onChange={(v) => state.setElements(v)}
                data={state.station ? elementData : []}
                searchable
                clearable
                hidePickedOptions
                nothingFoundMessage="No matching elements"
              />

              <Switch
                label="Show uncommon variables"
                size="sm"
                checked={state.showUncommon}
                onChange={(e) => state.setShowUncommon(e.currentTarget.checked)}
              />

              <Stack gap={4}>
                <Text fw={500} size="sm">
                  Quality control
                </Text>
                <SegmentedControl
                  size="xs"
                  fullWidth
                  value={String(qcLevel)}
                  onChange={(v) => state.setQcLevel(Number(v) as QcLevel)}
                  data={QC_LEVEL_OPTIONS.map((o) => ({
                    value: String(o.value),
                    label: o.label,
                  }))}
                />
                <Text size="xs" c="dimmed">
                  {qcInfo.description}
                </Text>
              </Stack>

              <Stack gap={4}>
                <Text fw={500} size="sm">
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
                {state.period === 'monthly' && (
                  <Text size="xs" c="dimmed">
                    Monthly values are computed from daily data: precipitation and
                    Reference ET are summed, other variables averaged. "Days With
                    Data" shows how many days each month includes.
                  </Text>
                )}
              </Stack>

              <Group grow gap="xs" align="flex-start">
                <DatePickerInput
                  label="Start date"
                  value={startDate}
                  onChange={(v) => state.setFrom(v ? String(v).slice(0, 10) : null)}
                  valueFormat="MMM D, YYYY"
                  leftSection={<IconCalendar size={16} />}
                  minDate={installDate ?? undefined}
                  maxDate={today}
                  error={dateError ? true : undefined}
                />
                <DatePickerInput
                  label="End date"
                  value={endDate}
                  onChange={(v) => state.setTo(v ? String(v).slice(0, 10) : null)}
                  valueFormat="MMM D, YYYY"
                  leftSection={<IconCalendar size={16} />}
                  minDate={installDate ?? undefined}
                  maxDate={today}
                  error={dateError ? true : undefined}
                />
              </Group>
              {dateError && (
                <Text size="xs" c="red" mt={-6} role="alert">
                  {dateError}
                </Text>
              )}

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
                  disabled={!rows || rows.length === 0}
                >
                  Download CSV
                </Button>
              </Group>

              {hint && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {hint}
                </Alert>
              )}
              {result?.data.warnings.map((w) => (
                <Alert key={w} icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                  {w}
                </Alert>
              ))}
            </Stack>
          </Card>

          <Paper withBorder style={{ overflow: 'hidden', minHeight: 280, flex: 1 }}>
            {stations.data ? (
              <Suspense fallback={SuspenseFallback}>
                <StationMap
                  stations={stations.data}
                  selected={state.station}
                  onSelect={selectStation}
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
          <Box style={{ flex: 1, minHeight: 0, width: '100%', overflowY: 'auto' }}>
            <Suspense fallback={SuspenseFallback}>
              <DownloaderPreviewChart
                data={rows}
                period={result?.query.period ?? state.period}
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
