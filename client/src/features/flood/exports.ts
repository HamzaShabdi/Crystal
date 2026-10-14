import Papa from 'papaparse';
import { AnalysisResult, RoadSegment, Facility } from './types';

// Prevent formula injection in Excel/Calc: cells starting with =, +, -, @ get prefixed with '
export function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function generateQueueCsvString(result: AnalysisResult): string {
  const { impacts, params, generatedAt, provenance } = result;

  const rows = impacts.map((imp) => ({
    rank: imp.rank,
    community_id: sanitizeCsvValue(imp.communityId),
    name: sanitizeCsvValue(imp.communityName),
    isolated: imp.isolated ? 'YES' : 'NO',
    population: imp.populationAtRisk,
    urgency: imp.urgency,
    nearest_facility: sanitizeCsvValue(imp.nearestFacilityName ?? 'None'),
    route_length_m: imp.routeLengthM ?? 'UNREACHABLE',
    score: imp.score,
    reasons: sanitizeCsvValue(imp.reasons.join(' | ')),
    threshold_db: params.thresholdDb,
    band: params.band,
    generated_at: generatedAt,
    provenance: provenance.toUpperCase(),
  }));

  return Papa.unparse(rows, {
    quotes: true,
  });
}

export function exportQueueToCsv(result: AnalysisResult): void {
  const { provenance } = result;
  const csvString = generateQueueCsvString(result);
  const isSynthetic = provenance === 'synthetic';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `floodone_queue_${timestamp}${isSynthetic ? '_SYNTHETIC' : ''}.csv`;

  downloadBlob(csvString, 'text/csv;charset=utf-8;', filename);
}

export function generateResultsGeoJsonObject(
  result: AnalysisResult,
  roads: RoadSegment[],
  facilities: Facility[]
) {
  const { impacts, mask, impassableRoadIds, params, generatedAt, provenance } = result;
  const impassableSet = new Set(impassableRoadIds);

  const features: GeoJSON.Feature[] = [];

  // 1. Community points
  for (const imp of impacts) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: imp.coordinates,
      },
      properties: {
        featureType: 'community',
        rank: imp.rank,
        communityId: imp.communityId,
        name: imp.communityName,
        isolated: imp.isolated,
        population: imp.populationAtRisk,
        urgency: imp.urgency,
        score: imp.score,
        routeLengthM: imp.routeLengthM,
        reasons: imp.reasons,
        provenance,
      },
    });
  }

  // 2. Road segments with passability flag
  for (const road of roads) {
    const isCut = impassableSet.has(road.id);
    features.push({
      type: 'Feature',
      geometry: road.geometry,
      properties: {
        featureType: 'road',
        roadId: road.id,
        highway: road.highway ?? 'road',
        lengthM: road.lengthM,
        status: isCut ? 'impassable' : 'passable',
        cutByFlood: isCut,
      },
    });
  }

  // 3. Facilities
  for (const fac of facilities) {
    features.push({
      type: 'Feature',
      geometry: fac.geometry,
      properties: {
        featureType: 'facility',
        facilityId: fac.id,
        name: fac.name,
        kind: fac.kind,
      },
    });
  }

  return {
    type: 'FeatureCollection' as const,
    metadata: {
      generatedBy: 'FloodOne v1.0',
      generatedAt,
      provenance,
      disclaimer: 'Exploratory screening signal. Verify before deployment.',
      parameters: params,
      floodedFraction: mask.floodedFraction,
      floodedPixelCount: mask.floodedPixelCount,
      impassableRoadCount: impassableRoadIds.length,
    },
    features,
  };
}

export function exportResultsToGeoJSON(
  result: AnalysisResult,
  roads: RoadSegment[],
  facilities: Facility[]
): void {
  const { provenance } = result;
  const geoJsonData = generateResultsGeoJsonObject(result, roads, facilities);
  const jsonString = JSON.stringify(geoJsonData, null, 2);
  const isSynthetic = provenance === 'synthetic';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `floodone_analysis_${timestamp}${isSynthetic ? '_SYNTHETIC' : ''}.geojson`;

  downloadBlob(jsonString, 'application/geo+json;charset=utf-8;', filename);
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  // Sanitize filename to prevent directory traversal or invalid characters (C-XSS-5)
  const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
