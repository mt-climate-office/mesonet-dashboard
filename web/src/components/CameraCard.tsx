import { useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Center,
  Chip,
  Group,
  Image,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconCalendar, IconDownload } from '@tabler/icons-react'
import {
  addDays,
  basename,
  directionLabel,
  formatLocal,
  framesFor,
  localToUtcMs,
  localToday,
  localYmd,
  tokensOf,
  useLatestFrames,
  usePastDayFrames,
  usePhotoSchedule,
  viewsBetween,
  type PhotoFrame,
} from '../lib/photos'
import { useResolvedStation } from './useResolvedStation'

/**
 * Station camera card. Everything comes from the data2 photo archive:
 * the schedule says which views the camera shoots; the newest two days come
 * from live bucket listings, older days from the station's monthly manifest.
 */
export function CameraCard() {
  const station = useResolvedStation()
  const schedule = usePhotoSchedule()
  const cam = station ? schedule.data?.stations.get(station) : undefined
  const latest = useLatestFrames(station)

  // Reset picks when the station changes — without a useEffect.
  const [stationKey, setStationKey] = useState<string | null>(station)
  const [dateSel, setDateSel] = useState<string | null>(null)
  const [direction, setDirection] = useState<string | null>(null)
  const [slotSel, setSlotSel] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  if (station !== stationKey) {
    setStationKey(station)
    setDateSel(null)
    setDirection(null)
    setSlotSel(null)
  }

  const today = localToday()
  const yesterday = addDays(today, -1)
  const newestLatest = useMemo(
    () => (latest.data ?? []).reduce<number | null>((m, f) => (m == null || f.slotUtcMs > m ? f.slotUtcMs : m), null),
    [latest.data],
  )
  const date = dateSel ?? (newestLatest != null ? localYmd(newestLatest) : today)
  // Today and yesterday come from the latest listings (three UTC days, which
  // span both local days at any hour); older days from the manifest.
  const recent = date >= yesterday
  const past = usePastDayFrames(cam ? station : null, recent ? null : date)
  const source = recent ? latest : past

  const dayFrames = useMemo(() => framesFor(source.data ?? [], date), [source.data, date])
  // Chips: the directions that have frames that day; with none (still
  // loading, or an empty day), the views the schedule had on that day.
  const tokens = useMemo(() => {
    if (!cam) return []
    if (dayFrames.length) return tokensOf(dayFrames)
    return recent
      ? cam.currentViews.map((v) => v.token)
      : viewsBetween(cam, localToUtcMs(date), localToUtcMs(addDays(date, 1))).map((v) => v.token)
  }, [cam, recent, date, dayFrames])

  if (!station) {
    return (
      <Box p="xs">
        <Alert color="orange" variant="light" title="Photo unavailable">
          No station selected.
        </Alert>
      </Box>
    )
  }
  if (schedule.isPending) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    )
  }
  if (schedule.isError) {
    return <Message>Camera schedule unavailable.</Message>
  }
  if (!cam || (cam.currentViews.length === 0 && cam.periods.length === 0)) {
    return <Message>No camera images are available for this station.</Message>
  }

  const labelOf = (t: string) => cam.allLabels[t] ?? directionLabel(t)
  const activeDir =
    direction && tokens.includes(direction) ? direction : tokens.includes('N') ? 'N' : (tokens[0] ?? 'N')
  const dirFrames = dayFrames.filter((f) => f.token === activeDir)
  const active: PhotoFrame | undefined = dirFrames.find((f) => f.slotUtcMs === slotSel) ?? dirFrames[0]
  const label = labelOf(activeDir)
  const stamp = active ? formatLocal(active.slotUtcMs) : ''
  const alt = `${station} ${label} camera ${stamp}`
  const minDate = cam.firstMonth ? `${cam.firstMonth}-01` : undefined

  const download = async () => {
    if (!active) return
    try {
      const r = await fetch(active.webpUrl)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const objectUrl = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = basename(active.webpUrl)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000)
    } catch {
      window.open(active.webpUrl, '_blank', 'noreferrer')
    }
  }

  return (
    <Stack gap={6} h="100%" p="xs">
      <Chip.Group multiple={false} value={activeDir} onChange={(v) => setDirection(v as string)}>
        <Group gap={4} justify="center">
          {tokens.map((t) => (
            <Chip key={t} value={t} size="xs" variant="filled">
              {labelOf(t)}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      <Group gap={6} wrap="nowrap" align="center" justify="center">
        <DatePickerInput
          size="xs"
          value={date}
          onChange={(v) => {
            setDateSel(v ? String(v) : null)
            setSlotSel(null)
          }}
          minDate={minDate}
          maxDate={today}
          valueFormat="MMM D, YYYY"
          leftSection={<IconCalendar size={14} />}
          aria-label="Photo date"
          popoverProps={{ withinPortal: true }}
          styles={{ root: { flex: '0 0 auto', width: 140 } }}
        />
        {dirFrames.length > 0 ? (
          <Select
            size="xs"
            aria-label="Photo time"
            value={active ? String(active.slotUtcMs) : null}
            onChange={(v) => setSlotSel(v ? Number(v) : null)}
            data={dirFrames.map((f) => ({ value: String(f.slotUtcMs), label: formatLocal(f.slotUtcMs) }))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            styles={{ root: { flex: 1, minWidth: 0 } }}
          />
        ) : (
          <Box style={{ flex: 1 }} />
        )}
      </Group>
      {source.isPending && !source.data ? (
        <Center style={{ flex: 1 }}>
          <Loader size="sm" />
        </Center>
      ) : !active ? (
        <Message>
          {source.isError
            ? 'Camera images could not be loaded.'
            : `No camera images are available for ${label} on this date.`}
        </Message>
      ) : (
        <Tooltip label="Click to enlarge" withinPortal openDelay={400}>
          <Box
            role="button"
            tabIndex={0}
            aria-label={`Enlarge ${label} photo for ${station}`}
            onClick={() => setModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setModalOpen(true)
              }
            }}
            style={{ flex: 1, minHeight: 0, overflow: 'hidden', cursor: 'pointer' }}
          >
            <Image key={active.webpUrl} src={active.webpUrl} alt={alt} fit="contain" h="100%" w="100%" fallbackSrc="" />
          </Box>
        </Tooltip>
      )}
      {/* Legacy photo-modal: centered, 92vw, image up to 86vh. */}
      <Modal
        opened={modalOpen && !!active}
        onClose={() => setModalOpen(false)}
        centered
        size="92vw"
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        title={`${station} · ${label}${stamp ? ` · ${stamp}` : ''}`}
      >
        {active && (
          <Stack gap="sm" align="center">
            <Image src={active.webpUrl} alt={alt} fit="contain" radius="md" mah="86vh" w="100%" fallbackSrc="" />
            <Button variant="light" size="xs" leftSection={<IconDownload size={14} />} onClick={download}>
              Download original
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <Center h="100%" px="md" style={{ flex: 1 }}>
      <Text c="dimmed" size="xs" ta="center">
        {children}
      </Text>
    </Center>
  )
}
