import type { ReactNode } from 'react'
import { Alert, Box, Center, Loader, Stack, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { Plot } from '../../../lib/plotly'
import { PLOT_CONFIG } from '../../../lib/plotConfig'
import { type Figure, figureKey } from '../figures'

export interface AgChartProps {
  loading?: boolean
  /** Shown instead of the chart. */
  error?: unknown
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: string | null
  figure?: Figure | null
  /** Small notes above the chart (missing sensors, projection basis, …). */
  notes?: ReactNode[]
}

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Failed to load data for this selection.'
}

/** Loading / error / empty / chart states for one Ag Tools variable. */
export function AgChart({ loading, error, empty, figure, notes }: AgChartProps) {
  let body: ReactNode
  if (loading) {
    body = (
      <Center h="100%">
        <Loader />
      </Center>
    )
  } else if (error) {
    body = (
      <Center h="100%" px="md">
        <Text c="red" size="sm">
          {errorText(error)}
        </Text>
      </Center>
    )
  } else if (empty || !figure || figure.data.length === 0) {
    body = (
      <Center h="100%" px="md">
        <Text c="dimmed" size="sm" ta="center">
          {empty ?? 'No data for the current selection.'}
        </Text>
      </Center>
    )
  } else {
    body = (
      <Plot
        data={figure.data}
        layout={figure.layout}
        config={PLOT_CONFIG}
        revision={figureKey(figure)}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }
  const shown = (notes ?? []).filter(Boolean)
  return (
    <Stack gap={6} h="100%" style={{ minHeight: 0 }}>
      {shown.length > 0 && (
        <Stack gap={4}>
          {shown.map((n, i) => (
            <Alert key={i} variant="light" color="gray" p={6} icon={<IconInfoCircle size={16} />}>
              <Text size="xs">{n}</Text>
            </Alert>
          ))}
        </Stack>
      )}
      <Box style={{ flex: 1, minHeight: 0 }} data-testid="ag-chart">
        {body}
      </Box>
    </Stack>
  )
}
