import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Group,
  Image,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconExternalLink, IconHelp, IconShare3 } from '@tabler/icons-react'
import { FEEDBACK_URL } from '../lib/config'
import { useStations } from '../hooks/useStations'
import { useStationParam } from '../lib/url-state'

export function Banner() {
  const [station] = useStationParam()
  const stations = useStations()
  const stationName = stations.data?.find((s) => s.station === station)?.name ?? null

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      const { notifications } = await import('@mantine/notifications')
      notifications.show({
        title: 'Link copied',
        message: 'Share URL is on your clipboard.',
        color: 'green',
      })
    } catch {
      window.prompt('Copy this URL to share:', window.location.href)
    }
  }

  const title = stationName
    ? `Montana Mesonet Dashboard — ${stationName}`
    : 'Montana Mesonet Dashboard'

  return (
    <Group justify="space-between" h="100%" px="md" wrap="nowrap">
      <Anchor
        href="https://climate.umt.edu"
        target="_blank"
        rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        <Image
          src={`${import.meta.env.BASE_URL}MCO_logo.svg`}
          alt="Montana Climate Office"
          h={44}
          w="auto"
          fit="contain"
        />
        <Title order={4} c="dark" visibleFrom="sm" lineClamp={1}>
          {title}
        </Title>
      </Anchor>

      {/* Wider screens get full-text buttons, sm/below collapse to icons. */}
      <Box visibleFrom="sm">
        <Group gap="xs" wrap="nowrap">
          <Button
            component="a"
            href={FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            variant="light"
            size="xs"
            leftSection={<IconExternalLink size={14} />}
          >
            Give feedback
          </Button>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconHelp size={14} />}
            onClick={() => {
              const ev = new CustomEvent('open-help-modal')
              window.dispatchEvent(ev)
            }}
          >
            Learn more
          </Button>
          <Button size="xs" leftSection={<IconShare3 size={14} />} onClick={onShare}>
            Share
          </Button>
        </Group>
      </Box>
      <Box hiddenFrom="sm">
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Give feedback" withinPortal>
            <ActionIcon
              component="a"
              href={FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
              variant="light"
              size="lg"
              aria-label="Give feedback"
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Learn more" withinPortal>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => {
                const ev = new CustomEvent('open-help-modal')
                window.dispatchEvent(ev)
              }}
              aria-label="Learn more"
            >
              <IconHelp size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Share" withinPortal>
            <ActionIcon size="lg" onClick={onShare} aria-label="Share">
              <IconShare3 size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
    </Group>
  )
}
