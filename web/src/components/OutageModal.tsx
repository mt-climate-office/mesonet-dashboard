import { useEffect, useState } from 'react'
import { Alert, Anchor, Button, Group, Image, Modal, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import Markdown from 'react-markdown'
import {
  fetchOutageConfig,
  outageMantineColor,
  outageStorageKey,
} from './outageConfig'

function readFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function writeFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Private mode / blocked storage: the notice just shows again next load.
  }
}

/**
 * Site-wide outage notice from `outage.json` (port of the legacy outage
 * modal). Shown once per browser tab per notice `id`: the sessionStorage flag
 * is set when the modal opens, so a new tab sees it again and a new `id`
 * re-shows it to everyone.
 */
export function OutageModal() {
  const { data: config } = useQuery({
    queryKey: ['outage-config'],
    queryFn: () => fetchOutageConfig(),
    // Legacy re-checks GitHub every 60 s; one fetch per page load is enough
    // here because the modal only opens on load.
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Decide once per notice id whether to open (derive-state-during-render).
  const [decision, setDecision] = useState<{ id: string; open: boolean } | null>(null)
  if (config?.active && decision?.id !== config.id) {
    setDecision({ id: config.id, open: !readFlag(outageStorageKey(config.id)) })
  }

  useEffect(() => {
    if (decision?.open) writeFlag(outageStorageKey(decision.id))
  }, [decision])

  if (!config?.active) return null
  const opened = !!decision?.open && decision.id === config.id
  const close = () => setDecision({ id: config.id, open: false })

  return (
    <Modal
      opened={opened}
      onClose={close}
      centered
      size="md"
      title={
        <Image
          src={`${import.meta.env.BASE_URL}MCO_logo.svg`}
          h={40}
          w="auto"
          alt="MCO Logo"
        />
      }
    >
      <Alert color={outageMantineColor(config.color)} variant="light">
        <Title order={5} mb="xs">
          {config.title}
        </Title>
        <Markdown
          components={{
            p: ({ children }) => (
              <Text size="sm" mb="xs">
                {children}
              </Text>
            ),
            a: ({ href, children }) => (
              <Anchor href={href} target="_blank" rel="noopener noreferrer" size="sm">
                {children}
              </Anchor>
            ),
          }}
        >
          {config.message}
        </Markdown>
      </Alert>
      <Group justify="flex-end" mt="md">
        <Button onClick={close}>{config.button_text}</Button>
      </Group>
    </Modal>
  )
}
