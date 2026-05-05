import { useEffect, useState } from 'react'
import { Anchor, List, Modal, Text, Title } from '@mantine/core'

const HELP_EVENT = 'open-help-modal'

export function HelpModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(HELP_EVENT, handler)
    return () => window.removeEventListener(HELP_EVENT, handler)
  }, [])

  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      title={<Title order={4}>The Montana Mesonet Dashboard</Title>}
      size="lg"
      centered
    >
      <Text size="sm" mb="md">
        Welcome! This dashboard visualizes data from every station in the
        Montana Mesonet. Pick a station from the sidebar dropdown or click one
        on the locator map. The URL captures the entire dashboard state — copy
        and share it.
      </Text>

      <Title order={5} mt="md">
        Tabs
      </Title>
      <List size="sm" spacing={4} mt={4}>
        <List.Item>
          <b>Latest Data</b> — current conditions, wind rose, station camera,
          and the time-series plot. Optional GridMET 30-year-normals overlay
          when daily aggregation is selected.
        </List.Item>
        <List.Item>
          <b>Ag Tools</b> — agricultural metrics: Reference ET, Feels-Like,
          Growing Degree Days (with adjustable crop thresholds), Soil Profile
          heatmaps, Soil Water Potential, Percent Saturation, Annual
          Comparison, and the Livestock Comprehensive Climate Index.
        </List.Item>
        <List.Item>
          <b>Data Downloader</b> — request and download station observations
          as CSV across one or many elements and a custom date range.
        </List.Item>
        <List.Item>
          <b>Satellite Indicators</b> — NASA satellite indicators (NDVI, GPP,
          ET). Migrating to the new API; UI shell is in place.
        </List.Item>
      </List>

      <Title order={5} mt="md">
        Sharing
      </Title>
      <Text size="sm" mt={4}>
        Click <b>Share</b> in the header to copy the current URL to your
        clipboard. Anyone with that link will see the same station, date range,
        and variable selection.
      </Text>

      <Title order={5} mt="md">
        Data sources
      </Title>
      <Text size="sm" mt={4}>
        Station data is served on demand from the{' '}
        <Anchor
          href="https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com/docs"
          target="_blank"
          rel="noreferrer"
        >
          Montana Mesonet API
        </Anchor>
        . Climate normals come from{' '}
        <Anchor
          href="https://www.climatologylab.org/gridmet.html"
          target="_blank"
          rel="noreferrer"
        >
          GridMET
        </Anchor>
        .
      </Text>
    </Modal>
  )
}
