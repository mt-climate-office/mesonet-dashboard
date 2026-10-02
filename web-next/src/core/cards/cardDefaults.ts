/**
 * Which Latest card shows (legacy select_default_tab / update_br_card, as in
 * web/src/tabs/LatestDataTab.tsx). An explicit `card`/`info` URL value wins;
 * absent = auto. Picking a station clears both (url-schema selectStationPatch).
 */
import type { BottomCard, TopCard } from '../url-schema'

export interface TopCardInput {
  /** `?card=` (null = auto). */
  explicit: TopCard | null
  /** Confirmed station id, or null. */
  station: string | null
  /** The data2 schedule has a current camera period for the station. */
  hasCamera: boolean
  /** Photo schedule fetch status (null before it starts). */
  schedule: 'loading' | 'success' | 'error' | null
}

export interface TopCardChoice {
  card: TopCard
  /** Latest Photo is selectable: a camera, or an unknown answer (schedule failed) so the card can say so. */
  photoEnabled: boolean
  /**
   * Auto choice still waiting on the schedule (it decides Photo vs Wind Rose):
   * show a loading state instead of drawing the Wind Rose and then swapping it out.
   */
  pending: boolean
}

/**
 * Auto = Photo for a station with a camera, else Wind Rose. A Photo choice
 * that is not available falls back to Wind Rose once the schedule answered.
 */
export function chooseTopCard(i: TopCardInput): TopCardChoice {
  const photoEnabled = !!i.station && (i.hasCamera || i.schedule === 'error')
  let card: TopCard = i.explicit ?? (i.hasCamera ? 'photo' : 'wind')
  if (card === 'photo' && !photoEnabled && (!i.station || i.schedule !== 'loading')) card = 'wind'
  const pending = i.explicit === null && !!i.station && (i.schedule === 'loading' || i.schedule === null)
  return { card, photoEnabled, pending }
}

export interface BottomCardInput {
  /** `?info=` (null = auto). */
  explicit: BottomCard | null
  /** A station is named in the URL (`?s=`, confirmed or not yet). */
  hasStation: boolean
  /** The latest-observation request failed with nothing to show. */
  latestFailed: boolean
}

/**
 * Auto = Current Conditions with a station, the map without. Current
 * Conditions with no station shows the map; an auto Current Conditions whose
 * request failed moves to Station Metadata (legacy app.py:401).
 */
export function chooseBottomCard(i: BottomCardInput): BottomCard {
  let card: BottomCard = i.explicit ?? (i.hasStation ? 'current' : 'map')
  if (card === 'current' && !i.hasStation) card = 'map'
  if (card === 'current' && i.explicit === null && i.latestFailed) card = 'metadata'
  return card
}

/** Switcher labels, legacy order (layout.py:375-385, 431-441). */
export const TOP_CARD_LABELS: Record<TopCard, string> = {
  wind: 'Wind Rose',
  forecast: 'Weather Forecast',
  photo: 'Latest Photo',
}
export const BOTTOM_CARD_LABELS: Record<BottomCard, string> = {
  map: 'Locator Map',
  metadata: 'Station Metadata',
  current: 'Current Conditions',
}
