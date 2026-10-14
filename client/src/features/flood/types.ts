export type Provenance = "synthetic" | "imported" | "computed";

export interface RasterMeta {
  width: number;
  height: number;
  bands: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY] in WGS84
  pixelSize: [number, number];            // [xRes, yRes] in degrees or meters
  crs: string;                           // e.g. "EPSG:4326" or "EPSG:32643"
  noData: number | null;
  acquired?: string;
  source: string;
  provenance: Provenance;
}

export interface Community {
  id: string;
  name: string;
  geometry: GeoJSON.Point;
  population?: number;
  urgency?: 1 | 2 | 3 | 4 | 5;
  provenance: Provenance;
}

export interface Facility {
  id: string;
  name: string;
  kind: "hospital" | "shelter";
  geometry: GeoJSON.Point;
  provenance?: Provenance;
}

export interface RoadSegment {
  id: string;
  geometry: GeoJSON.LineString;
  highway?: string;
  lengthM: number;
  provenance?: Provenance;
}

export interface AnalysisParams {
  thresholdDb: number;          // default -3.0 dB
  band: "VV" | "VH";            // default "VV"
  waterCeilingDb: number;       // default -15.0 dB (VV)
  minOverlapFraction: number;   // default 0.30 (30% of segment length)
  snapToleranceM: number;       // default 50 m
  speckleFilter: boolean;       // default false (3x3 median)
  weights: {
    population: number;         // default 0.5
    urgency: number;            // default 0.3
    distance: number;           // default 0.2
  };
  isolationBonus: number;       // default 1.0 (so isolated communities outrank reachable)
}

export interface CommunityImpact {
  communityId: string;
  communityName: string;
  isolated: boolean;
  preFloodIsolated?: boolean;   // true if never connected even in dry conditions
  nearestFacilityId?: string;
  nearestFacilityName?: string;
  routeLengthM?: number | null;
  populationAtRisk: number;
  urgency: number;
  score: number;
  rank: number;
  reasons: string[];
  coordinates: [number, number]; // [lng, lat]
}

export interface FloodMask {
  width: number;
  height: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  data: Uint8Array;                      // 1 = flood, 0 = dry/nodata
  floodedFraction: number;
  floodedPixelCount: number;
}

export interface AnalysisResult {
  mask: FloodMask;
  impassableRoadIds: string[];
  impacts: CommunityImpact[];
  warnings: string[];
  params: AnalysisParams;
  generatedAt: string;
  provenance: Provenance;
}

export interface RawRasterBuffer {
  width: number;
  height: number;
  bbox: [number, number, number, number];
  crs: string;
  data: Float32Array; // dB values
  noData: number | null;
  provenance: Provenance;
}

export interface VectorDatasets {
  roads: RoadSegment[];
  communities: Community[];
  facilities: Facility[];
  provenance: Provenance;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  file: string;
  featureIndex?: number;
  message: string;
  fix: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}
