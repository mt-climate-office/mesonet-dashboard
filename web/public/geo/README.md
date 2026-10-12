# Vendored boundary GeoJSON

Copied unchanged from mco-web-style **v0.7.1** `map/data/` (the kit's
`data.R` builds them from TIGER via tigris + rmapshaper):

- `mt_state_simple.geojson`: Montana outline
- `mt_counties_simple.geojson`: 56 counties (`NAME`)
- `mt_reservations_simple.geojson`: tribal lands (`NAME`, read by `MCO.map.TRIBAL_LABEL_LAYOUT`)

`ui/map/map.ts` loads them from `${BASE_URL}geo/`. When you bump the kit,
copy the files again from the new tag and update the version above.
