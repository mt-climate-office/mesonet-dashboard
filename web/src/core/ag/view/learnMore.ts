/**
 * "Learn More" links, as production legacy `update_derived_learn_link`
 * (app.py ~686-717): gdd → gdds (+ `#{crop}-growing-degree-days`), soil
 * profile → soil_profile, cci → risk, everything else passes through. The
 * Annual comparison (legacy value "") produced `…/ag_tools//`; here it links
 * the base Ag Tools page.
 */
export const LEARN_MORE_BASE = 'https://climate.umt.edu/mesonet/ag_tools/'

const SLUGS: Record<string, string> = {
  gdd: 'gdds',
  'soil_temp,soil_ec_blk': 'soil_profile',
  cci: 'risk',
}

export function learnMoreUrl(variable: string, crop: string | null | undefined): string {
  if (!variable || variable === 'annual') return LEARN_MORE_BASE
  const slug = SLUGS[variable] ?? variable
  const url = `${LEARN_MORE_BASE}${slug}/`
  return slug === 'gdds' && crop ? `${url}#${crop}-growing-degree-days` : url
}
