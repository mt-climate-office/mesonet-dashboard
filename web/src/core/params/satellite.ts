/* -------------------------------------------------------------------------- */
/* Satellite constants — ported from params.py for the (currently-disabled)   */
/* satellite tab. Kept here so the UI shell can render even though we have    */
/* no live data source.                                                      */
/* -------------------------------------------------------------------------- */

export const SATELLITE_VARS = ['ET', 'EVI', 'Fpar', 'GPP', 'LAI', 'NDVI', 'PET'] as const
export type SatelliteVar = (typeof SATELLITE_VARS)[number]

export const SATELLITE_VAR_LABELS: Record<SatelliteVar, string> = {
  ET: 'ET',
  EVI: 'EVI',
  Fpar: 'FPAR',
  GPP: 'GPP',
  LAI: 'LAI',
  NDVI: 'NDVI',
  PET: 'PET',
}

export const SAT_AXIS_MAPPER: Record<string, string> = {
  GPP: 'GPP (g C m⁻²)',
  ET: 'ET (mm day⁻¹)',
  PET: 'PET (mm day⁻¹)',
  Fpar: 'FPAR',
  NDVI: 'NDVI',
  EVI: 'EVI',
  LAI: 'LAI',
}

/** Compare dropdown — keys are display labels, values match legacy `compare1` opts. */
export const SAT_COMPARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ET-MYD16A2.061', label: 'ET (MODIS Aqua)' },
  { value: 'ET-MOD16A2.061', label: 'ET (MODIS Terra)' },
  { value: 'PET-MYD16A2.061', label: 'PET (MODIS Aqua)' },
  { value: 'PET-MOD16A2.061', label: 'PET (MODIS Terra)' },
  { value: 'GPP-MYD17A2H.061', label: 'GPP (MODIS Aqua)' },
  { value: 'GPP-MOD17A2H.061', label: 'GPP (MODIS Terra)' },
  { value: 'GPP-SPL4CMDL.006', label: 'GPP (SMAP L4C)' },
  { value: 'Fpar-MYD15A2H.061', label: 'FPAR (MODIS Aqua)' },
  { value: 'Fpar-MOD15A2H.061', label: 'FPAR (MODIS Terra)' },
  { value: 'NDVI-MYD13A1.061', label: 'NDVI (MODIS Aqua)' },
  { value: 'NDVI-MOD13A1.061', label: 'NDVI (MODIS Terra)' },
  { value: 'NDVI-VNP13A1.001', label: 'NDVI (VIIRS)' },
  { value: 'EVI-MYD13A1.061', label: 'EVI (MODIS Aqua)' },
  { value: 'EVI-MOD13A1.061', label: 'EVI (MODIS Terra)' },
  { value: 'EVI-VNP13A1.001', label: 'EVI (VIIRS)' },
  { value: 'LAI-MYD15A2H.061', label: 'LAI (MODIS Aqua)' },
  { value: 'LAI-MOD15A2H.061', label: 'LAI (MODIS Terra)' },
]
