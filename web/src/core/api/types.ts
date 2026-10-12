/** Row / response shapes returned by the Mesonet v2 API. */

export interface Station {
  station: string
  name: string
  date_installed: string | null
  sub_network: string
  longitude: number
  latitude: number
  elevation: number
  county: string
  mesowest_id: string | null
  gwic_id: string | null
  nwsli_id: string | null
  has_swp: boolean
  funded: boolean
}

export interface ElementMeta {
  element: string
  description: string
  description_short: string
  base_units: string
  us_units: string
  sort_order: number
}

export interface StationElement extends ElementMeta {
  date_start?: string
  date_end?: string | null
}

export interface ObservationRow {
  station: string
  datetime: string
  [key: string]: string | number | boolean | null
}

export interface PptSummaryRow {
  station: string
  [key: string]: string | number | null
}

export interface InstrumentEntry {
  date_start: string
  date_end: string | null
  elements: string[]
  height: string
  manufacturer: string
  model: string
  serial_number: string
  type: string
}

export interface StationConfig {
  station: string
  name: string
  date_installed: string
  latitude: number
  longitude: number
  elevation: number
  sub_network: string
  status: string
  nwsli_id: string | null
  instruments?: InstrumentEntry[]
}
