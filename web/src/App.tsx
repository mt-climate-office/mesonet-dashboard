import { Suspense } from 'react'
import { AppShell, Center, Loader, Tabs } from '@mantine/core'
import { Banner } from './components/Banner'
import { HelpModal } from './components/HelpModal'
import { GlobalNotices } from './components/GlobalNotices'
import { VISIBLE_TABS } from './app/tabs'
import { useHashTab } from './lib/useHashTab'
import { migrateLegacyUrlState } from './lib/url-state'

// Rename pre-namespacing query keys before nuqs reads the URL. This module is
// evaluated before main.tsx calls createRoot().render().
migrateLegacyUrlState()

const TabFallback = (
  <Center style={{ flex: 1, height: '100%' }}>
    <Loader size="sm" />
  </Center>
)

export function App() {
  const [tab, setTab] = useHashTab()

  return (
    <AppShell header={{ height: 64 }} padding={0}>
      <AppShell.Header>
        <Banner />
      </AppShell.Header>
      <HelpModal />
      <GlobalNotices />
      <AppShell.Main
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs
          value={tab}
          onChange={(v) => v && setTab(v as never)}
          keepMounted={false}
          styles={{
            root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
            panel: { flex: 1, minHeight: 0, display: 'flex' },
          }}
        >
          <Tabs.List px="md">
            {VISIBLE_TABS.map((t) => (
              <Tabs.Tab key={t.hash} value={t.hash}>
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {VISIBLE_TABS.map(({ hash, component: Component, eager }) => (
            <Tabs.Panel key={hash} value={hash}>
              {eager ? (
                <Component />
              ) : (
                <Suspense fallback={TabFallback}>
                  <Component />
                </Suspense>
              )}
            </Tabs.Panel>
          ))}
        </Tabs>
      </AppShell.Main>
    </AppShell>
  )
}
