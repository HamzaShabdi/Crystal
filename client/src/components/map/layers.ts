/**
 * Map layer specifications, symbology tokens, and source definitions
 * for FloodOne MapLibre GL engine.
 */

export const MAP_SOURCES = {
  BASEMAP: 'carto-basemap',
  FLOOD_MASK: 'flood-mask-source',
  ROADS: 'roads-source',
  COMMUNITIES: 'communities-source',
  FACILITIES: 'facilities-source',
} as const;

export const MAP_LAYERS = {
  BASEMAP_TILES: 'basemap-tiles',
  FLOOD_MASK: 'flood-mask-layer',
  ROADS_PASSABLE: 'roads-passable-layer',
  ROADS_CUT: 'roads-cut-layer',
  COMMUNITIES_HALO: 'communities-halo-layer',
  COMMUNITIES: 'communities-layer',
  COMMUNITIES_LABELS: 'communities-labels',
  FACILITIES: 'facilities-layer',
  FACILITIES_LABELS: 'facilities-labels',
} as const;

export const SYMBOLOGY = {
  FLOOD_WATER: '#22D3EE',
  ROADS_PASSABLE: '#64748b',
  ROADS_CUT: '#E5484D',
  COMMUNITY_ISOLATED: '#E5484D',
  COMMUNITY_ACCESSIBLE: '#22D3EE',
  FACILITY_STROKE: '#3FB68B',
  FACILITY_FILL: '#16242F',
  TEXT_PAPER: '#F5F1EA',
  TEXT_HALO_DARK: '#0F1A24',
} as const;
