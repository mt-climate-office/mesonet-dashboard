import { lazy, Suspense } from 'react'
import { AppShell, Center, Loader, Tabs } from '@mantine/core'
import { Banner } from './components/Banner'
import { HelpModal } from './components/HelpModal'
import { LatestDataTab } from './tabs/LatestDataTab'
import { useHashTab } from './lib/useHashTab'

const AgToolsTab = lazy(() =>
  import('./tabs/AgToolsTab').then((m) => ({ default: m.AgToolsTab })),
)
const DownloaderTab = lazy(() =>
  import('./tabs/DownloaderTab').then((m) => ({ default: m.DownloaderTab })),
)
const SatelliteTab = lazy(() =>
  import('./tabs/SatelliteTab').then((m) => ({ default: m.SatelliteTab })),
)

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
            <Tabs.Tab value="latest">Latest Data</Tabs.Tab>
            <Tabs.Tab value="ag">Ag Tools</Tabs.Tab>
            <Tabs.Tab value="downloader">Data Downloader</Tabs.Tab>
            <Tabs.Tab value="satellite">Satellite Indicators</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="latest">
            <LatestDataTab />
          </Tabs.Panel>
          <Tabs.Panel value="ag">
            <Suspense fallback={TabFallback}>
              <AgToolsTab />
            </Suspense>
          </Tabs.Panel>
          <Tabs.Panel value="downloader">
            <Suspense fallback={TabFallback}>
              <DownloaderTab />
            </Suspense>
          </Tabs.Panel>
          <Tabs.Panel value="satellite">
            <Suspense fallback={TabFallback}>
              <SatelliteTab />
            </Suspense>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>
    </AppShell>
  )
}
