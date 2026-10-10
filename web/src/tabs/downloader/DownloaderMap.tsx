/**
 * Downloader station map, styled after legacy `plotting.plot_station`:
 * USGS shaded-relief raster tiles, Montana county outlines, one marker per
 * location (co-located stations merged), hover "Station(s): …", click selects
 * the group's first station. Kept separate from `components/StationMap.tsx`
 * (shared with Latest Data), which has its own network legend/markers.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Layer, Map, NavigationControl, Popup, Source } from 'react-map-gl/maplibre'
import type {
  MapLayerMouseEvent,
  MapRef,
  StyleSpecification,
  ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import { Box, Group, Paper, Text } from '@mantine/core'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../../lib/maplibreWorker'
import type { Station } from '../../lib/api'
import { DL_MARKER_COLORS, groupStations } from './stationGroups'

const USGS_RELIEF =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}'

const RELIEF_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    relief: {
      type: 'raster',
      tiles: [USGS_RELIEF],
      tileSize: 256,
      maxzoom: 16,
      attribution: 'USGS Map Tiles',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } },
    { id: 'relief', type: 'raster', source: 'relief' },
  ],
}

/** Montana extent; fit at any container width (legacy: center −109.5/47, zoom 5). */
const MT_BOUNDS: [[number, number], [number, number]] = [
  [-116.1, 44.3],
  [-103.9, 49.1],
]

/** Extra top padding keeps the legend (top-left) clear of the northern border. */
const FIT_PADDING = { top: 36, bottom: 10, left: 10, right: 10 }

const STATIONS_LAYER = 'dl-stations'

interface DownloaderMapProps {
  stations: Station[]
  selected: string | null
  onSelect: (station: string) => void
}

interface Hover {
  longitude: number
  latitude: number
  names: string[]
}

export function DownloaderMap({ stations, selected, onSelect }: DownloaderMapProps) {
  const [hover, setHover] = useState<Hover | null>(null)
  const mapRef = useRef<MapRef | null>(null)
  // Re-fit Montana when the container settles/resizes, until the user pans
  // or zooms (the tab lays out after the lazy map mounts).
  const userMoved = useRef(false)
  const fitMontana = useCallback(() => {
    if (userMoved.current) return
    mapRef.current?.fitBounds(MT_BOUNDS, { padding: FIT_PADDING, duration: 0 })
  }, [])
  const onMoveStart = useCallback((e: ViewStateChangeEvent) => {
    if (e.originalEvent) userMoved.current = true
  }, [])
  const countiesUrl = `${import.meta.env.BASE_URL ?? '/'}mt_counties.geojson`

  const geojson = useMemo(() => {
    const groups = groupStations(stations, selected)
    return {
      type: 'FeatureCollection' as const,
      features: groups.map((g) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [g.longitude, g.latitude] },
        properties: {
          color: g.color,
          // Selected on top (legacy sorted traces by colour; gold drew last).
          sort: g.selected ? 1 : 0,
          codes: g.codes.join(','),
          names: JSON.stringify(g.longNames),
        },
      })),
    }
  }, [stations, selected])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') {
      setHover(null)
      return
    }
    const [longitude, latitude] = f.geometry.coordinates as [number, number]
    let names: string[] = []
    try {
      names = JSON.parse(String(f.properties?.names ?? '[]')) as string[]
    } catch {
      names = []
    }
    setHover((h) =>
      h && h.longitude === longitude && h.latitude === latitude
        ? h
        : { longitude, latitude, names },
    )
  }, [])

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const codes = String(e.features?.[0]?.properties?.codes ?? '')
      const first = codes.split(',')[0]
      if (first) onSelect(first)
    },
    [onSelect],
  )

  return (
    <Box style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Map
        ref={mapRef}
        onLoad={fitMontana}
        onResize={fitMontana}
        onMoveStart={onMoveStart}
        mapStyle={RELIEF_STYLE}
        initialViewState={{ bounds: MT_BOUNDS, fitBoundsOptions: { padding: FIT_PADDING } }}
        attributionControl={{ compact: true }}
        style={{ height: '100%', width: '100%' }}
        interactiveLayerIds={[STATIONS_LAYER]}
        cursor={hover ? 'pointer' : 'grab'}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="dl-counties" type="geojson" data={countiesUrl}>
          <Layer
            id="dl-counties-line"
            type="line"
            paint={{ 'line-color': '#555555', 'line-width': 0.5, 'line-opacity': 0.6 }}
          />
        </Source>
        <Source id="dl-stations-src" type="geojson" data={geojson}>
          <Layer
            id={STATIONS_LAYER}
            type="circle"
            layout={{ 'circle-sort-key': ['get', 'sort'] }}
            paint={{
              'circle-radius': 5,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 0.5,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
        {hover && (
          <Popup
            longitude={hover.longitude}
            latitude={hover.latitude}
            anchor="bottom"
            offset={8}
            closeButton={false}
            closeOnClick={false}
            style={{ pointerEvents: 'none' }}
          >
            <Text size="xs" data-testid="dl-map-hover">
              <b>Station(s)</b>:{' '}
              {hover.names.map((n, i) => (
                <span key={n}>
                  {i > 0 && (
                    <>
                      ,<br />
                    </>
                  )}
                  {n}
                </span>
              ))}
            </Text>
          </Popup>
        )}
      </Map>

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
          {(
            [
              ['AgriMet', DL_MARKER_COLORS.AgriMet],
              ['HydroMet', DL_MARKER_COLORS.HydroMet],
              ['Co-located', DL_MARKER_COLORS.coLocated],
            ] as const
          ).map(([label, color]) => (
            <Group key={label} gap={4} wrap="nowrap">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <Text size="xs" c="dark">
                {label}
              </Text>
            </Group>
          ))}
        </Group>
      </Paper>
    </Box>
  )
}
