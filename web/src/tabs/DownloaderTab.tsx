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
import { useResolvedStation } from '../components/useResolvedStation'
import { useStationElements } from '../hooks/useStationElements'
import { useDownloaderState } from '../lib/url-state'
import { toCsv } from '../lib/csv'
import {
  DEFAULT_QC_LEVEL,
  DERIVED_CODES,
  DERIVED_OPTIONS,
  daySpan,
  derivedOptionsFor,
  downloadFilename,
  HOURLY_CONFIRM_DAYS,
  HOURLY_DEFAULT_DAYS,
  clampStart,
  SWP_CODES,
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
const DownloaderMap = lazy(() =>
  import('./downloader/DownloaderMap').then((m) => ({ default: m.DownloaderMap })),
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
  // `?s=` may briefly hold an NWSLI / mis-cased id; query only a real station.
  const station = useResolvedStation()
  const stationElements = useStationElements(station, !state.showUncommon)

  const [result, setResult] = useState<{ query: DownloadQuery; data: DownloadResult } | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  // QC level: explicit `qc`, else legacy `rmna=true` → fully QC'd (2), else
  // the dashboard default (also 2).
  const qcLevel: QcLevel = state.qcLevel ?? (state.removeFlagged ? 2 : DEFAULT_QC_LEVEL)
  const qcInfo = QC_LEVEL_OPTIONS.find((o) => o.value === qcLevel)!

  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    return stations.data
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data])

  const stationMeta = useMemo(
    () => stations.data?.find((s) => s.station === station) ?? null,
    [stations.data, station],
  )
  const installDate = stationMeta?.date_installed
    ? String(stationMeta.date_installed).slice(0, 10)
    : null
  // has_swp is a real boolean since parseCsv types True/False.
  const hasSwp = stationMeta?.has_swp === true

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
      {
        group: 'Derived variables',
        items: derivedOptionsFor(hasSwp).map((o) => ({ value: o.value, label: o.label })),
      },
    ],
    [standardOptions, hasSwp],
  )

  // Drop selections the current station / uncommon filter doesn't offer
  // (legacy did the same). Until the lists load, keep the URL selection.
  // SWP-only derived variables at a non-SWP station are dropped with a
  // visible notice (old `els=swp,…` links).
  const { selectedElements, droppedSwp } = useMemo(() => {
    let els = state.elements
    let dropped: string[] = []
    if (stationMeta && !hasSwp) {
      dropped = els.filter((e) => SWP_CODES.has(e))
      els = els.filter((e) => !SWP_CODES.has(e))
    }
    if (stationElements.data) {
      const valid = new Set(standardOptions.map((o) => o.value))
      els = els.filter((e) => DERIVED_CODES.has(e) || valid.has(e))
    }
    return { selectedElements: els, droppedSwp: dropped }
  }, [state.elements, standardOptions, stationElements.data, stationMeta, hasSwp])

  const today = todayStr()
  // Daily/monthly default to the install date (legacy). Hourly defaults to
  // the last 30 days instead — years of hourly rows is rarely intended.
  const hourlyDefault = dayjs().subtract(HOURLY_DEFAULT_DAYS - 1, 'day').format(DATE_FMT)
  const defaultStart =
    state.period === 'hourly'
      ? installDate && installDate > hourlyDefault
        ? installDate
        : hourlyDefault
      : (installDate ?? dayjs().subtract(365, 'day').format(DATE_FMT))
  // A start before the install date (old links, typed dates) is clamped to
  // the install date, as legacy's DatePicker minDate did, with a small note.
  const { start: startDate, clamped: startClamped } = clampStart(
    state.from ?? defaultStart,
    installDate,
  )
  const endDate = state.to ?? today
  const dateError =
    startDate > endDate ? 'Start date must be on or before the end date.' : null
  const span = dateError ? 0 : daySpan(startDate, endDate)
  const largeHourly = state.period === 'hourly' && span > HOURLY_CONFIRM_DAYS
  const runKey = `${station}|${startDate}|${endDate}|${state.period}`
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null)
  const needsConfirm = largeHourly && confirmedKey !== runKey

  const selectStation = useCallback(
    (v: string | null) => {
      state.setStation(v)
      // Legacy resets the start to the new station's install date.
      state.setFrom(null)
    },
    [state],
  )

  const handleRun = useCallback(async () => {
    if (!station || selectedElements.length === 0) {
      setHint('Please select a station and at least one variable first!')
      return
    }
    if (dateError) {
      setHint(dateError)
      return
    }
    if (needsConfirm) {
      // First click on a >1-year hourly range arms it; the second runs it.
      setConfirmedKey(runKey)
      return
    }
    setHint(null)
    setIsLoading(true)
    setError(null)
    const query: DownloadQuery = {
      station,
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
  }, [
    station,
    state.period,
    selectedElements,
    startDate,
    endDate,
    qcLevel,
    dateError,
    needsConfirm,
    runKey,
  ])

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
                    Data" shows how many days each month includes. Totals are left
                    blank for any month missing a day (including months only partly
                    inside the date range).
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
              {startClamped && !dateError && (
                <Text size="xs" c="dimmed" mt={-6} data-testid="dl-start-clamped">
                  Start date moved to {installDate}, when this station was installed.
                </Text>
              )}
              {largeHourly && (
                <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light" p="xs">
                  <Text size="xs">
                    This hourly request spans {span.toLocaleString()} days (about{' '}
                    {(span * 24).toLocaleString()} rows per variable) and may be slow.{' '}
                    {needsConfirm
                      ? 'Run Request will ask you to confirm; or shorten the range.'
                      : 'Click "Confirm large request" to fetch it.'}
                  </Text>
                </Alert>
              )}
              {droppedSwp.length > 0 && (
                <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light" p="xs">
                  <Text size="xs">
                    {droppedSwp
                      .map((c) => DERIVED_OPTIONS.find((o) => o.value === c)?.label ?? c)
                      .join(' and ')}{' '}
                    {droppedSwp.length > 1 ? 'are' : 'is'} not available at{' '}
                    {stationMeta?.name ?? state.station} (no soil water potential
                    parameters), so {droppedSwp.length > 1 ? 'they were' : 'it was'} removed
                    from the request.
                  </Text>
                </Alert>
              )}

              <Group gap="xs">
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={isLoading}
                  onClick={handleRun}
                  variant="filled"
                  flex={1}
                >
                  {largeHourly && !needsConfirm ? 'Confirm large request' : 'Run Request'}
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
                <DownloaderMap
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
      {/* Funder attribution (legacy dmc.Footer: 40px, #129dff, bold). Rendered
          in the tab flow rather than position:fixed so it never covers the
          controls or preview on small screens. */}
      <Box
        component="footer"
        mt="sm"
        px="sm"
        py={6}
        data-testid="dl-funding-footer"
        style={{
          minHeight: 40,
          background: '#129dff',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 4,
        }}
      >
        <Text fw={800} size="sm" c="#000">
          Supported by Bureau of Land Management (RM-CESU Award L16AC00359)
        </Text>
      </Box>
    </Box>
  )
}
