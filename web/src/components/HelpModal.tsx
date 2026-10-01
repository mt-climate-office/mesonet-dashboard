import { useEffect, useState, type ReactNode } from 'react'
import { Anchor, List, Modal, Text, Title } from '@mantine/core'
import { API_DOCS_URL, FEEDBACK_URL, LEGACY_DASHBOARD_URL } from '../lib/config'

const HELP_EVENT = 'open-help-modal'

const GITHUB_URL = 'https://github.com/mt-climate-office/mesonet-dashboard'

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <Anchor href={href} target="_blank" rel="noreferrer">
    {children}
  </Anchor>
)

/**
 * "Learn More" modal. Content follows legacy layout.generate_modal (welcome,
 * contacts, Background, Source Code), with stale bits updated: the API docs
 * point at mesonet2, and the Satellite Indicators tab is no longer here (it
 * stays on the legacy dashboard).
 */
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
      size="xl"
      centered
    >
      <Text size="sm">
        Welcome to the Montana Mesonet Dashboard! This dashboard visualizes
        historical data from all stations that are a part of the Montana
        Mesonet. To visualize data from a station, either select a station from
        the dropdown on the top left, click a station on the locator map, or add
        a station name to the URL path (e.g.{' '}
        <Ext href="https://mesonet.climate.umt.edu/dash/crowagen">
          https://mesonet.climate.umt.edu/dash/crowagen
        </Ext>
        ). The station data is aggregated on demand from the{' '}
        <Ext href={API_DOCS_URL}>Montana Mesonet API</Ext>.
      </Text>

      <Text size="sm" mt="sm">
        The <b>Ag Tools</b> tab computes agricultural indicators (Reference ET,
        growing degree days, soil profiles, livestock risk and more), and the{' '}
        <b>Data Downloader</b> tab exports station observations as CSV. The
        Satellite Indicators view is available on the{' '}
        <Ext href={`${LEGACY_DASHBOARD_URL}#satellite`}>legacy dashboard</Ext>.
        The URL keeps the dashboard state, so copying it (or using{' '}
        <b>Share</b>) shares the current view.
      </Text>

      <Text size="sm" mt="sm">
        If you encounter any bugs, would like to request a new feature, or have
        a question regarding the dashboard, please:
      </Text>
      <List size="sm" spacing={2} mt={4} withPadding>
        <List.Item>
          Email{' '}
          <Ext href="mailto:james.seielstad@mso.umt.edu">james.seielstad@mso.umt.edu</Ext>,
        </List.Item>
        <List.Item>
          Fill out our <Ext href={FEEDBACK_URL}>feedback form</Ext>,
        </List.Item>
        <List.Item>
          Or open an issue on <Ext href={`${GITHUB_URL}/issues`}>our GitHub</Ext>.
        </List.Item>
      </List>
      <Text size="sm" mt="sm">
        For questions or issues related to current Mesonet stations, please
        contact our Mesonet Manager (Kevin Hyde) at{' '}
        <Ext href="mailto:kevin.hyde@umontana.edu">kevin.hyde@umontana.edu</Ext>.
        For general questions about the Mesonet and its development, please
        contact the state climatologist (Kelsey Jencso) at{' '}
        <Ext href="mailto:kelsey.jencso@umontana.edu">kelsey.jencso@umontana.edu</Ext>.
      </Text>

      <Title order={5} mt="md">
        Montana Mesonet Background
      </Title>
      <Text size="sm" mt={4}>
        The Montana Climate Office (MCO) installed 6 weather and soil moisture
        monitoring stations in 2016 as part of the Montana Research and Economic
        Development Initiative (MREDI). The Mesonet was designed to support
        decision-making for statewide drought assessments, precision
        agriculture and rangeland and forested watershed management. Since 2016
        the network has grown to 94 stations through support from private
        landowners, watershed groups, tribes, state agencies and grants from
        federal entities. In 2020 the MCO was awarded a contract from the U.S.
        Army Corps to add 205 additional stations. The new stations will be
        installed every 500 square miles in central and eastern Montana to
        improve drought assessments and flood forecasting - in the protection of
        lives and property.
      </Text>

      <Title order={5} mt="md">
        Source Code
      </Title>
      <Text size="sm" mt={4}>
        See how we built this application at our{' '}
        <Ext href={`${GITHUB_URL}/tree/main`}>GitHub repository</Ext>.
      </Text>
    </Modal>
  )
}
