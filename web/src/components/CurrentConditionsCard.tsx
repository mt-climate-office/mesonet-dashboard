import { useMemo } from 'react'
import { Center, Divider, Loader, ScrollArea, Stack, Table, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useStationLatest } from '../hooks/useStationLatest'
import { usePptSummary } from '../hooks/usePptSummary'
import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'
import { degToCompass } from '../lib/params'

function fmtNum(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

export function CurrentConditionsCard() {
  const [station] = useStationParam()
  const { data: stations } = useStations()
  const { data, isLoading, isError, error } = useStationLatest(station)
  const ppt = usePptSummary(station)

  const network = useMemo(
    () => stations?.find((s) => s.station === station)?.sub_network ?? null,
    [stations, station],
  )

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [] as Array<readonly [string, string]>
    const latest = data[0] as Record<string, unknown>
    const ts = latest.datetime as string | undefined

    // Compute Real Feel (wind chill / heat index proxy from legacy formula).
    const airT = latest['Air Temperature [°F]']
    const windSpdKey =
      Object.keys(latest).find((k) => k.startsWith('Wind Speed')) ?? ''
    const windSpd = windSpdKey ? latest[windSpdKey] : null
    let realFeel: number | null = null
    if (typeof airT === 'number' && typeof windSpd === 'number' && windSpd > 0) {
      realFeel =
        35.74 +
        0.6215 * airT -
        35.75 * Math.pow(windSpd, 0.16) +
        0.4275 * airT * Math.pow(windSpd, 0.16)
    }

    // Display order — keep Air Temp + Real Feel + RH near the top, then wind,
    // pressure, solar, soil/precip after.
    const ordered: Array<readonly [string, string]> = []
    const seen = new Set<string>()
    const push = (k: string, v: string) => {
      if (seen.has(k)) return
      seen.add(k)
      ordered.push([k, v] as const)
    }

    const formatVal = (k: string, v: unknown): string => {
      if (k.startsWith('Wind Direction') && typeof v === 'number') {
        return `${degToCompass(v)} (${v.toFixed(0)}°)`
      }
      if (typeof v === 'number') return fmtNum(v)
      return String(v ?? '')
    }

    const priority = [
      'Air Temperature [°F]',
      // Real Feel inserted manually
      'Relative Humidity [%]',
      'Wind Speed [mi/hr]',
      'Gust Speed [mi/hr]',
      'Wind Direction [deg]',
      'Atmospheric Pressure [mbar]',
      'Solar Radiation [W/m²]',
      'Precipitation [in]',
      'Snow Depth [in]',
    ]
    for (const k of priority) {
      const v = latest[k]
      if (v === null || v === undefined || v === '') continue
      push(k, formatVal(k, v))
      if (k === 'Air Temperature [°F]' && realFeel !== null) {
        push('Real Feel [°F]', fmtNum(realFeel))
      }
    }
    // Then everything else (soil temp/vwc/ec etc.)
    for (const [k, v] of Object.entries(latest)) {
      if (k === 'station' || k === 'datetime') continue
      if (v === null || v === undefined || v === '') continue
      if (seen.has(k)) continue
      push(k, formatVal(k, v))
    }

    if (ts) {
      ordered.push(['Timestamp', dayjs(ts).format('MMM D, YYYY h:mm A')] as const)
    }
    return ordered
  }, [data])

  const pptRows = useMemo(() => {
    if (!ppt.data || ppt.data.length === 0) return [] as Array<readonly [string, string]>
    const summary = ppt.data[0] as Record<string, unknown>
    const out: Array<readonly [string, string]> = []
    for (const [k, v] of Object.entries(summary)) {
      if (k === 'station') continue
      if (v === null || v === undefined || v === '') continue
      const num = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(num)) continue
      out.push([k, `${num.toFixed(2)} in`] as const)
    }
    // Legacy reverses (newest first)
    out.reverse()
    return out
  }, [ppt.data])

  if (!station) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          Pick a station to see current conditions.
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
  if (isError) {
    return (
      <Center h="100%" px="md">
        <Text c="red" size="xs">
          {(error as Error)?.message ?? 'Failed to load latest data.'}
        </Text>
      </Center>
    )
  }
  if (rows.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          No recent observations.
        </Text>
      </Center>
    )
  }

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap={4} p="xs">
        <Text fw={700} size="sm" ta="center">
          Latest Data Summary
        </Text>
        <Table withRowBorders={false} striped="even" verticalSpacing={2} fz="xs">
          <Table.Tbody>
            {rows.map(([name, value]) => (
              <Table.Tr key={name}>
                <Table.Td>{name}</Table.Td>
                <Table.Td ta="right" fw={500}>
                  {value}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {network === 'HydroMet' && pptRows.length > 0 && (
          <>
            <Divider my={4} />
            <Text fw={700} size="sm" ta="center">
              Precipitation Summary
            </Text>
            <Table withRowBorders={false} striped="even" verticalSpacing={2} fz="xs">
              <Table.Tbody>
                {pptRows.map(([name, value]) => (
                  <Table.Tr key={name}>
                    <Table.Td>{name}</Table.Td>
                    <Table.Td ta="right" fw={500}>
                      {value}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Stack>
    </ScrollArea>
  )
}
