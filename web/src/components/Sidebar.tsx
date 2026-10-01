import { useMemo } from 'react'
import {
  Anchor,
  Button,
  Chip,
  Divider,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconCalendar, IconHistory } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useStations } from '../hooks/useStations'
import { useStationElements } from '../hooks/useStationElements'
import { DEFAULT_VARS, latestVarsFromElements } from '../lib/params'
import { useLatestTabState } from '../lib/url-state'
import { API_DOCS_URL } from '../lib/config'
import { useResolvedStation } from './useResolvedStation'

const DATE_FMT = 'YYYY-MM-DD'

const today = () => dayjs().startOf('day')
const twoWeeksAgo = () => dayjs().startOf('day').subtract(14, 'day')

export function Sidebar() {
  const stations = useStations()
  const state = useLatestTabState()
  const stationElements = useStationElements(useResolvedStation())

  // Build network options from the live catalog rather than a hardcoded list,
  // so e.g. a future "Cooperator" sub_network shows up automatically.
  const networkOptions = useMemo(() => {
    if (!stations.data) return ['HydroMet', 'AgriMet']
    const set = new Set<string>()
    for (const s of stations.data) set.add(s.sub_network)
    return [...set].sort()
  }, [stations.data])

  const stationOptions = useMemo(() => {
    if (!stations.data) return []
    const filtered = state.nets.length
      ? stations.data.filter((s) => state.nets.includes(s.sub_network))
      : stations.data
    return filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.station, label: `${s.name} (${s.sub_network})` }))
  }, [stations.data, state.nets])

  // Legacy update_select_vars: no station → the sorted defaults; with a
  // station → its elements' description_short (text before "@"), deduped,
  // plus Reference ET, sorted. `ppt_corrected` is deliberately not offered
  // (see DIVERGENCES.md).
  const availableVars = useMemo(
    () =>
      stationElements.data
        ? latestVarsFromElements(stationElements.data)
        : [...DEFAULT_VARS].sort(),
    [stationElements.data],
  )

  // The current selection, filtered to what the station offers (legacy
  // filters on station change). An empty selection stays empty.
  const selectedVars = stationElements.data
    ? state.vars.filter((v) => availableVars.includes(v))
    : state.vars

  // Mantine v8 DatePickerInput speaks YYYY-MM-DD strings natively, so we keep
  // the round-trip in string form and avoid the Date-zone footguns.
  const startDate: string = state.from ?? twoWeeksAgo().format(DATE_FMT)
  const endDate: string = state.to ?? today().format(DATE_FMT)

  const setDateRange = (from: string | null, to: string | null) => {
    state.setFrom(from && from.length > 0 ? from : null)
    state.setTo(to && to.length > 0 ? to : null)
  }

  const setStation = (val: string | null) => {
    state.selectStation(val)
  }

  // Period-of-record toggle (legacy set_dates_to_por): "Display Period of
  // Record" → daily, install date..today, and the label flips to "Display
  // Latest 2 Weeks", which restores hourly, today−14d..today. The state is
  // read back from the URL, so a shared POR link shows the right label.
  const installed = (() => {
    const s = stations.data?.find((row) => row.station === state.station)
    return s?.date_installed && /^\d{4}-\d{2}-\d{2}/.test(s.date_installed)
      ? s.date_installed.slice(0, 10)
      : null
  })()
  const showingPor =
    installed !== null &&
    state.agg === 'daily' &&
    startDate === installed &&
    endDate === today().format(DATE_FMT)
  const togglePeriodOfRecord = () => {
    if (showingPor) {
      void state.setAgg('hourly')
      setDateRange(null, null)
    } else {
      void state.setAgg('daily')
      setDateRange(installed ?? '2017-01-01', today().format(DATE_FMT))
    }
  }

  return (
    <ScrollArea
      h="100%"
      mih={{ base: 360, md: 0 }}
      type="hover"
      px="md"
      py="sm"
    >
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600} size="sm">
            Station
          </Text>
          <Select
            placeholder={
              stations.isLoading ? 'Loading stations…' : 'Select a Mesonet Station...'
            }
            value={state.station}
            onChange={setStation}
            data={stationOptions}
            searchable
            clearable
            nothingFoundMessage={stations.isError ? 'Failed to load' : 'No matches'}
            leftSection={
              stations.isLoading ? <Loader size="xs" /> : null
            }
          />
        </Stack>

        <Stack gap={4}>
          <Text fw={600} size="sm">
            Networks
          </Text>
          <Chip.Group
            multiple
            value={state.nets}
            onChange={(v) => state.setNets(v as string[])}
          >
            <Group gap="xs">
              {networkOptions.map((n) => (
                <Chip key={n} value={n} size="xs">
                  {n}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Text size="xs" c="dimmed">
            Filter stations by network type. Leave both checked to show all
            stations.
          </Text>
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
          <Button
            variant="light"
            size="xs"
            leftSection={<IconHistory size={14} />}
            onClick={togglePeriodOfRecord}
            disabled={!state.station}
          >
            {showingPor ? 'Display Latest 2 Weeks' : 'Display Period of Record'}
          </Button>
        </Stack>

        <Stack gap={4}>
          <Text fw={600} size="sm">
            Time aggregation
          </Text>
          <SegmentedControl
            size="xs"
            value={state.agg}
            onChange={(v) => state.setAgg(v as never)}
            data={[
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
              { value: 'raw', label: 'Raw' },
            ]}
          />
          <Text size="xs" c="dimmed">
            Hourly and daily averages are pre-computed and will load faster.
            Avoid selecting periods longer than 1 year for daily, 3 months for
            hourly, or 2 weeks for raw data.
          </Text>
          <Tooltip
            label="Shows 1991-2020 gridMET climate normals. Only available on daily data."
            withinPortal
            multiline
            w={240}
          >
            <Switch
              size="xs"
              mt={4}
              label="Show gridMET Normals"
              checked={state.gridmet}
              onChange={(e) => state.setGridmet(e.currentTarget.checked)}
              disabled={state.agg !== 'daily'}
            />
          </Tooltip>
        </Stack>

        <Divider />

        <Stack gap={4}>
          <Text fw={600} size="sm">
            Variables
          </Text>
          <ScrollArea.Autosize mah={200} type="auto" offsetScrollbars>
            <Chip.Group
              multiple
              value={selectedVars}
              onChange={(v) => void state.setVars(v as string[])}
            >
              <Group gap={6}>
                {availableVars.map((v) => (
                  <Chip key={v} value={v} size="xs" variant="filled">
                    {v}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </ScrollArea.Autosize>
          <Anchor
            href="https://climate.umt.edu/mesonet/variables/"
            target="_blank"
            rel="noreferrer"
            size="xs"
          >
            About These Variables
          </Anchor>
        </Stack>

        <Divider />

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Data is served on demand from the{' '}
            <Anchor
              href={API_DOCS_URL}
              target="_blank"
              rel="noreferrer"
            >
              Montana Mesonet API
            </Anchor>
            .
          </Text>
        </Stack>
      </Stack>
    </ScrollArea>
  )
}
