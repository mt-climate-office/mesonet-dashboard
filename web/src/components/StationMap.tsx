import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, Marker, NavigationControl, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { Box, Group, Paper, Text } from '@mantine/core'
import 'maplibre-gl/dist/maplibre-gl.css'
import { positronStyle } from '../lib/mapStyle'
import type { Station } from '../lib/api'
import { NETWORK_COLORS, SELECTED_RING } from '../lib/networks'

const DEFAULT_VIEW = {
  longitude: -109.5,
  latitude: 47.0,
  zoom: 5.4,
}

interface StationMapProps {
  stations: Station[]
  selected: string | null
  onSelect: (station: string | null) => void
  height?: number | string
  /** When true, fly to selected station on mount/change. */
  flyTo?: boolean
}

export function StationMap({
  stations,
  selected,
  onSelect,
  height = '100%',
  flyTo = true,
}: StationMapProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [hover, setHover] = useState<Station | null>(null)

  const selectedStation = useMemo(
    () => stations.find((s) => s.station === selected) ?? null,
    [stations, selected],
  )

  // Networks present in the data so the legend matches reality.
  const presentNetworks = useMemo(() => {
    const set = new Set<string>()
    for (const s of stations) set.add(s.sub_network)
    return [...set].sort()
  }, [stations])

  useEffect(() => {
    if (!flyTo || !selectedStation || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selectedStation.longitude, selectedStation.latitude],
      zoom: 9,
      duration: 700,
    })
  }, [selectedStation, flyTo])

  return (
    <Box style={{ height, width: '100%', position: 'relative' }}>
      <Map
        ref={mapRef}
        mapStyle={positronStyle}
        initialViewState={DEFAULT_VIEW}
        attributionControl={{ compact: true }}
        style={{ height: '100%', width: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {stations.map((s) => {
          const color = NETWORK_COLORS[s.sub_network] ?? '#666'
          const isSelected = s.station === selected
          return (
            <Marker
              key={s.station}
              longitude={s.longitude}
              latitude={s.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onSelect(s.station)
              }}
            >
              <div
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() =>
                  setHover((h) => (h?.station === s.station ? null : h))
                }
                style={{
                  width: isSelected ? 16 : 10,
                  height: isSelected ? 16 : 10,
                  borderRadius: '50%',
                  background: color,
                  border: isSelected
                    ? `3px solid ${SELECTED_RING}`
                    : '1.5px solid #fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                }}
                aria-label={s.name}
              />
            </Marker>
          )
        })}
        {hover && hover.station !== selected && (
          <Popup
            longitude={hover.longitude}
            latitude={hover.latitude}
            anchor="top"
            offset={12}
            closeButton={false}
            closeOnClick={false}
          >
            <Text size="xs" fw={600}>
              {hover.name}
            </Text>
            <Text size="xs" c="dimmed">
              {hover.sub_network} · {hover.elevation.toFixed(0)} m
            </Text>
          </Popup>
        )}
        {selectedStation && (
          <Popup
            longitude={selectedStation.longitude}
            latitude={selectedStation.latitude}
            anchor="top"
            offset={14}
            closeButton={false}
            closeOnClick={false}
          >
            <Text size="xs" fw={600}>
              {selectedStation.name}
            </Text>
            <Text size="xs" c="dimmed">
              {selectedStation.sub_network} · {selectedStation.elevation.toFixed(0)} m
            </Text>
          </Popup>
        )}
      </Map>

      {/* Network legend — anchor in the top-left so the OSM attribution
          along the bottom edge can't overlap or clip the labels. */}
      <Paper
        withBorder
        shadow="xs"
        p={6}
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          background: 'rgba(255,255,255,0.92)',
          pointerEvents: 'none',
        }}
      >
        <Group gap={10} wrap="wrap">
          {presentNetworks.map((n) => (
            <Group key={n} gap={4} wrap="nowrap">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: NETWORK_COLORS[n] ?? '#666',
                  border: '1px solid #fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                  flexShrink: 0,
                }}
              />
              <Text size="xs">{n}</Text>
            </Group>
          ))}
        </Group>
      </Paper>
    </Box>
  )
}
