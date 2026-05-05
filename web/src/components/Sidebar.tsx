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
import { DEFAULT_VARS, ELEM_MAP, SELECTED_VARS } from '../lib/params'
import { useLatestTabState } from '../lib/url-state'

const DATE_FMT = 'YYYY-MM-DD'

const today = () => dayjs().startOf('day')
const twoWeeksAgo = () => dayjs().startOf('day').subtract(14, 'day')

export function Sidebar() {
  const stations = useStations()
  const state = useLatestTabState()
  const stationElements = useStationElements(state.station)

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

  const availableVars = useMemo(() => {
    if (!stationElements.data) return [...DEFAULT_VARS]
    const present = new Set<string>()
    for (const row of stationElements.data) {
      for (const [displayVar, prefixes] of Object.entries(ELEM_MAP)) {
        if (prefixes.some((p) => row.element.startsWith(p))) {
          present.add(displayVar)
        }
      }
    }
    present.add('Reference ET')
    return [...DEFAULT_VARS].filter((v) => present.has(v))
  }, [stationElements.data])

  // Mantine v8 DatePickerInput speaks YYYY-MM-DD strings natively, so we keep
  // the round-trip in string form and avoid the Date-zone footguns.
  const startDate: string = state.from ?? twoWeeksAgo().format(DATE_FMT)
  const endDate: string = state.to ?? today().format(DATE_FMT)

  const setDateRange = (from: string | null, to: string | null) => {
    state.setFrom(from && from.length > 0 ? from : null)
    state.setTo(to && to.length > 0 ? to : null)
  }

  const setStation = (val: string | null) => {
    state.setStation(val)
  }

  // Use the actual station install date for the period-of-record button.
  const periodOfRecord = () => {
    const s = stations.data?.find((row) => row.station === state.station)
    const installed =
      s?.date_installed && /^\d{4}-\d{2}-\d{2}/.test(s.date_installed)
        ? s.date_installed.slice(0, 10)
        : '2017-01-01'
    setDateRange(installed, today().format(DATE_FMT))
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
              stations.isLoading ? 'Loading stations…' : 'Pick a station'
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
            onClick={periodOfRecord}
            disabled={!state.station}
          >
            Period of record
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
          <Tooltip
            label="GridMET 30-year normals are only available on daily aggregation."
            withinPortal
          >
            <Switch
              size="xs"
              label="GridMET normals overlay"
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
          <Text size="xs" c="dimmed">
            Pick the variables you want plotted. Defaults reflect what the
            station reports.
          </Text>
          <Chip.Group
            multiple
            value={
              state.vars.length > 0 ? state.vars : [...SELECTED_VARS]
            }
            onChange={(v) => state.setVars(v as string[])}
          >
            <Group gap={6}>
              {availableVars.map((v) => (
                <Chip key={v} value={v} size="xs" variant="filled">
                  {v}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>

        <Divider />

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Data is served on demand from the{' '}
            <Anchor
              href="https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com/docs"
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
