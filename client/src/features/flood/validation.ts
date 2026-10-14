import { z } from 'zod';
import { Community, Facility, RoadSegment, ValidationIssue } from './types';

export function validateGeoJSON(
  jsonText: string,
  expectedKind: 'roads' | 'communities' | 'facilities'
): {
  ok: boolean;
  issues: ValidationIssue[];
  roads?: RoadSegment[];
  communities?: Community[];
  facilities?: Facility[];
} {
  const issues: ValidationIssue[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          file: `${expectedKind}.geojson`,
          message: `Malformed JSON: ${errorMsg}`,
          fix: 'Verify the file contains valid JSON syntax using a JSON linter.',
        },
      ],
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          file: `${expectedKind}.geojson`,
          message: 'Root object must be a GeoJSON FeatureCollection',
          fix: 'Ensure the top-level structure is { "type": "FeatureCollection", "features": [...] }',
        },
      ],
    };
  }

  const root = parsed as Record<string, unknown>;
  if (root.type !== 'FeatureCollection' || !Array.isArray(root.features)) {
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          file: `${expectedKind}.geojson`,
          message: `Expected "FeatureCollection", but found "${String(root.type)}"`,
          fix: 'Wrap your geographic features in a standard GeoJSON FeatureCollection.',
        },
      ],
    };
  }

  const features = root.features as unknown[];
  if (features.length === 0) {
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          file: `${expectedKind}.geojson`,
          message: 'FeatureCollection is empty (contains 0 features).',
          fix: 'Provide a dataset with at least one geographic feature.',
        },
      ],
    };
  }

  if (expectedKind === 'roads') {
    const validRoads: RoadSegment[] = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i] as Record<string, unknown>;
      const geom = f?.geometry as Record<string, unknown> | undefined;

      if (!geom || geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'roads.geojson',
            featureIndex: i,
            message: `Feature #${i} has geometry "${geom?.type ?? 'none'}", expected "LineString"`,
            fix: 'Convert roads into LineString geometries or split MultiLineString elements.',
          });
        }
        continue;
      }

      const coords = geom.coordinates as [number, number][];
      if (coords.length < 2) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'roads.geojson',
            featureIndex: i,
            message: `Feature #${i} LineString has fewer than 2 vertices.`,
            fix: 'Ensure road lines have at least start and end coordinates.',
          });
        }
        continue;
      }

      // Check coordinate validity
      let invalidCoord = false;
      for (const pt of coords) {
        if (!Array.isArray(pt) || typeof pt[0] !== 'number' || typeof pt[1] !== 'number' ||
            Number.isNaN(pt[0]) || Number.isNaN(pt[1]) ||
            pt[0] < -180 || pt[0] > 180 || pt[1] < -90 || pt[1] > 90) {
          invalidCoord = true;
          break;
        }
      }

      if (invalidCoord) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'roads.geojson',
            featureIndex: i,
            message: `Feature #${i} coordinates are outside valid WGS84 range (-180..180, -90..90).`,
            fix: 'Reproject your road network to WGS84 (EPSG:4326).',
          });
        }
        continue;
      }

      const props = (f.properties || {}) as Record<string, unknown>;
      const roadId = String(props.id || f.id || `road-${i + 1}`);

      // Calculate approximate length in meters
      let lengthM = 0;
      for (let c = 0; c < coords.length - 1; c++) {
        const p1 = coords[c];
        const p2 = coords[c + 1];
        const dLng = (p2[0] - p1[0]) * 111320 * Math.cos((p1[1] * Math.PI) / 180);
        const dLat = (p2[1] - p1[1]) * 110540;
        lengthM += Math.hypot(dLng, dLat);
      }

      validRoads.push({
        id: roadId,
        geometry: { type: 'LineString', coordinates: coords },
        highway: typeof props.highway === 'string' ? props.highway : 'road',
        lengthM: Math.round(lengthM),
        provenance: 'imported',
      });
    }

    return {
      ok: issues.length === 0 && validRoads.length > 0,
      issues,
      roads: validRoads,
    };
  }

  if (expectedKind === 'communities') {
    const validComms: Community[] = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i] as Record<string, unknown>;
      const geom = f?.geometry as Record<string, unknown> | undefined;

      if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'communities.geojson',
            featureIndex: i,
            message: `Feature #${i} has geometry "${geom?.type ?? 'none'}", expected "Point"`,
            fix: 'Provide settlements as Point geometries (e.g. centroid).',
          });
        }
        continue;
      }

      const coords = geom.coordinates as [number, number];
      if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
          coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'communities.geojson',
            featureIndex: i,
            message: `Feature #${i} coordinates [${coords[0]}, ${coords[1]}] out of bounds.`,
            fix: 'Ensure longitudes are -180..180 and latitudes -90..90 in WGS84.',
          });
        }
        continue;
      }

      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.community || `Community ${i + 1}`).slice(0, 200);
      const id = String(props.id || f.id || `comm-${i + 1}`);

      // Coerce population
      let pop: number | undefined;
      const rawPop = props.population ?? props.pop;
      if (typeof rawPop === 'number' && rawPop > 0) {
        pop = Math.round(rawPop);
      } else if (typeof rawPop === 'string') {
        const parsedPop = parseInt(rawPop.replace(/[, ]/g, ''), 10);
        if (!Number.isNaN(parsedPop) && parsedPop > 0) pop = parsedPop;
      }

      // Coerce urgency (1..5)
      let urgency: 1 | 2 | 3 | 4 | 5 = 3;
      const rawUrg = props.urgency ?? props.priority;
      if (rawUrg !== undefined) {
        const numUrg = Number(rawUrg);
        if (numUrg >= 1 && numUrg <= 5) {
          urgency = Math.round(numUrg) as 1 | 2 | 3 | 4 | 5;
        }
      }

      validComms.push({
        id,
        name,
        geometry: { type: 'Point', coordinates: coords },
        population: pop,
        urgency,
        provenance: 'imported',
      });
    }

    return {
      ok: issues.length === 0 && validComms.length > 0,
      issues,
      communities: validComms,
    };
  }

  if (expectedKind === 'facilities') {
    const validFacilities: Facility[] = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i] as Record<string, unknown>;
      const geom = f?.geometry as Record<string, unknown> | undefined;

      if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
        if (issues.length < 10) {
          issues.push({
            severity: 'error',
            file: 'facilities.geojson',
            featureIndex: i,
            message: `Feature #${i} has geometry "${geom?.type ?? 'none'}", expected "Point"`,
            fix: 'Provide medical and shelter locations as Point geometries.',
          });
        }
        continue;
      }

      const coords = geom.coordinates as [number, number];
      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.facility || `Facility ${i + 1}`).slice(0, 200);
      const id = String(props.id || f.id || `fac-${i + 1}`);

      const rawKind = String(props.kind || props.type || '').toLowerCase();
      const kind: 'hospital' | 'shelter' =
        rawKind.includes('shelter') || rawKind.includes('camp')
          ? 'shelter'
          : 'hospital';

      validFacilities.push({
        id,
        name,
        kind,
        geometry: { type: 'Point', coordinates: coords },
        provenance: 'imported',
      });
    }

    return {
      ok: issues.length === 0 && validFacilities.length > 0,
      issues,
      facilities: validFacilities,
    };
  }

  return { ok: false, issues: [{ severity: 'error', file: 'unknown', message: 'Unknown dataset kind', fix: '' }] };
}
