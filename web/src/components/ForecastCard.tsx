import {
  Anchor,
  Box,
  Center,
  Group,
  Image,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import type { Station } from '../lib/api'
import { useForecast, type ForecastPeriod } from '../hooks/useForecast'

const DETAIL_URL = (lat: number, lon: number) =>
  `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`

export function ForecastCard({ station }: { station: Station | null }) {
  const { data, isLoading, isError, error } = useForecast(
    station?.latitude ?? null,
    station?.longitude ?? null,
  )

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to load the forecast.
        </Text>
      </Center>
    )
  }

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }

  if (isError || !data || data.periods.length === 0) {
    return (
      <Center h="100%" px="md">
        <Stack gap={4} align="center">
          <Text c="dimmed" size="xs" ta="center">
            {(error as Error)?.message ?? 'Forecast unavailable.'}
          </Text>
          <Anchor
            href={DETAIL_URL(station.latitude, station.longitude)}
            target="_blank"
            rel="noreferrer"
            size="xs"
          >
            Open NWS detail page <IconExternalLink size={12} />
          </Anchor>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack gap={4} h="100%" px="xs" pt={4} pb={2}>
      <Group justify="space-between" gap={4} wrap="nowrap" px={4}>
        <Text size="xs" fw={600} truncate>
          {data.location ?? station.name} · NWS forecast
        </Text>
        <Anchor
          href={DETAIL_URL(station.latitude, station.longitude)}
          target="_blank"
          rel="noreferrer"
          size="xs"
          c="dimmed"
        >
          full <IconExternalLink size={10} />
        </Anchor>
      </Group>
      <ScrollArea
        type="auto"
        offsetScrollbars
        scrollbarSize={6}
        style={{ flex: 1 }}
      >
        <Group gap={6} wrap="nowrap" align="stretch" pb={4}>
          {data.periods.slice(0, 8).map((p) => (
            <PeriodCard key={p.number} period={p} />
          ))}
        </Group>
      </ScrollArea>
    </Stack>
  )
}

function PeriodCard({ period }: { period: ForecastPeriod }) {
  const precip = period.probabilityOfPrecipitation?.value
  return (
    <Tooltip
      label={period.detailedForecast}
      multiline
      w={260}
      withinPortal
      position="bottom"
    >
      <Paper
        p={4}
        miw={84}
        maw={84}
        withBorder
        radius="sm"
        style={{
          background: period.isDaytime
            ? 'var(--mantine-color-blue-0)'
            : 'var(--mantine-color-gray-1)',
          textAlign: 'center',
        }}
      >
        <Stack gap={2} align="center">
          <Text size="xs" fw={600} lineClamp={1}>
            {period.name}
          </Text>
          <Box style={{ width: 36, height: 36 }}>
            <Image
              src={period.icon}
              alt={period.shortForecast}
              h={36}
              w={36}
              fit="contain"
            />
          </Box>
          <Text size="sm" fw={700}>
            {period.temperature}°{period.temperatureUnit}
          </Text>
          <Text fz={10} c="dimmed" lineClamp={2}>
            {period.shortForecast}
          </Text>
          {typeof precip === 'number' && precip > 0 && (
            <Text fz={10} c="blue.7">
              💧 {precip}%
            </Text>
          )}
        </Stack>
      </Paper>
    </Tooltip>
  )
}
