import { Anchor, Center, Paper, Stack, Text, Title } from '@mantine/core'
import { LEGACY_DASHBOARD_URL } from '../lib/config'

export function PlaceholderTab({ name }: { name: string }) {
  return (
    <Center style={{ flex: 1, padding: '32px' }}>
      <Paper p="xl" maw={520} w="100%" withBorder>
        <Stack gap="md">
          <Title order={3}>{name} — coming back in v2</Title>
          <Text c="dimmed">
            This tab is being rebuilt as part of the migration to a fully
            client-side dashboard. In the meantime, you can use the legacy
            dashboard, which has full functionality.
          </Text>
          <Anchor
            href={LEGACY_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            fw={500}
          >
            Open legacy dashboard ↗
          </Anchor>
        </Stack>
      </Paper>
    </Center>
  )
}
