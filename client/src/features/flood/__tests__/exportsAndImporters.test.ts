import { describe, it, expect } from 'vitest';
import {
  sanitizeCsvValue,
  generateQueueCsvString,
  generateResultsGeoJsonObject,
} from '../exports';
import { generateSyntheticScenario } from '../sampleScenario';
import { DEFAULT_ANALYSIS_PARAMS } from '../constants';
import { AnalysisResult } from '../types';

describe('Exports & Security Guards', () => {
  describe('Formula Injection Prevention (C-XSS-4)', () => {
    it('prefixes formula triggers (=, +, -, @) with single quote', () => {
      expect(sanitizeCsvValue('=cmd|"/c calc"!A0')).toBe('\'=cmd|"/c calc"!A0');
      expect(sanitizeCsvValue('+12345')).toBe('\'+12345');
      expect(sanitizeCsvValue('-10dB')).toBe('\'-10dB');
      expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');
    });

    it('leaves standard alphanumeric strings untouched', () => {
      expect(sanitizeCsvValue('Kasa Settlement')).toBe('Kasa Settlement');
      expect(sanitizeCsvValue('Hospital-North')).toBe('Hospital-North');
      expect(sanitizeCsvValue('1000')).toBe('1000');
    });

    it('handles null and undefined gracefully', () => {
      expect(sanitizeCsvValue(null)).toBe('');
      expect(sanitizeCsvValue(undefined)).toBe('');
    });
  });

  describe('CSV Queue Export Generation', () => {
    it('generates well-formatted CSV with expected headers and sanitized values', () => {
      const mockResult: AnalysisResult = {
        mask: {
          width: 10,
          height: 10,
          bbox: [0, 0, 1, 1],
          data: new Uint8Array(100),
          floodedFraction: 0.1,
          floodedPixelCount: 10,
        },
        impassableRoadIds: ['r1'],
        impacts: [
          {
            communityId: 'c1',
            communityName: '=MaliciousVillage',
            coordinates: [75.3, 19.8],
            isolated: true,
            populationAtRisk: 1500,
            urgency: 4,
            score: 2.5,
            rank: 1,
            nearestFacilityName: 'General Hospital',
            routeLengthM: null,
            reasons: ['Complete road isolation', 'Population 1,500'],
          },
        ],
        warnings: [],
        params: DEFAULT_ANALYSIS_PARAMS,
        generatedAt: '2026-10-12T12:00:00Z',
        provenance: 'synthetic',
      };

      const csv = generateQueueCsvString(mockResult);

      expect(csv).toContain('"rank"');
      expect(csv).toContain('"community_id"');
      expect(csv).toContain('"name"');
      expect(csv).toContain('"isolated"');
      // Verify formula injection guard was applied to malicious name
      expect(csv).toContain('\'=MaliciousVillage');
      expect(csv).toContain('SYNTHETIC');
    });
  });

  describe('GeoJSON Results Export Generation', () => {
    it('creates RFC 7946 compliant FeatureCollection with metadata', () => {
      const scenario = generateSyntheticScenario(12345);
      const mockResult: AnalysisResult = {
        mask: {
          width: 10,
          height: 10,
          bbox: [75.25, 19.78, 75.39, 19.92],
          data: new Uint8Array(100),
          floodedFraction: 0.05,
          floodedPixelCount: 5,
        },
        impassableRoadIds: [scenario.vectors.roads[0].id],
        impacts: [
          {
            communityId: scenario.vectors.communities[0].id,
            communityName: scenario.vectors.communities[0].name,
            coordinates: scenario.vectors.communities[0].geometry.coordinates as [number, number],
            isolated: true,
            populationAtRisk: 2500,
            urgency: 4,
            score: 2.1,
            rank: 1,
            nearestFacilityName: 'Test Hospital',
            routeLengthM: null,
            reasons: ['Complete isolation'],
          },
        ],
        warnings: [],
        params: DEFAULT_ANALYSIS_PARAMS,
        generatedAt: '2026-10-12T12:00:00Z',
        provenance: 'synthetic',
      };

      const geoJson = generateResultsGeoJsonObject(
        mockResult,
        scenario.vectors.roads.slice(0, 5),
        scenario.vectors.facilities
      );

      expect(geoJson.type).toBe('FeatureCollection');
      expect(geoJson.metadata).toBeDefined();
      expect(geoJson.metadata.generatedBy).toBe('FloodOne v1.0');
      expect(geoJson.metadata.disclaimer).toContain('Exploratory screening signal');
      expect(geoJson.features.length).toBeGreaterThan(0);

      // Verify feature properties
      const communityFeature = geoJson.features.find(
        (f) => f.properties?.featureType === 'community'
      );
      expect(communityFeature).toBeDefined();
      expect(communityFeature?.properties?.rank).toBe(1);
      expect(communityFeature?.properties?.isolated).toBe(true);

      const roadFeature = geoJson.features.find(
        (f) => f.properties?.featureType === 'road' && f.properties?.roadId === scenario.vectors.roads[0].id
      );
      expect(roadFeature).toBeDefined();
      expect(roadFeature?.properties?.cutByFlood).toBe(true);
      expect(roadFeature?.properties?.status).toBe('impassable');
    });
  });

  describe('Raster Pair Compatibility Validation (importers.ts)', () => {
    const baseMeta: import('../types').RasterMeta = {
      width: 500,
      height: 500,
      bands: 1,
      bbox: [75.2, 19.7, 75.4, 19.9],
      pixelSize: [0.0004, 0.0004],
      crs: 'EPSG:4326',
      noData: -9999,
      source: 'pre.tif',
      provenance: 'imported',
    };

    it('approves compatible raster pairs without errors', async () => {
      const { validateRasterPairCompatibility } = await import('../importers');
      const postMeta = { ...baseMeta, source: 'post.tif' };
      const issues = validateRasterPairCompatibility(baseMeta, postMeta);
      expect(issues.filter((i) => i.severity === 'error').length).toBe(0);
    });

    it('rejects dimension mismatches with actionable error hint', async () => {
      const { validateRasterPairCompatibility } = await import('../importers');
      const postMeta = { ...baseMeta, width: 600, height: 500 };
      const issues = validateRasterPairCompatibility(baseMeta, postMeta);
      expect(issues.some((i) => i.message.includes('dimension mismatch'))).toBe(true);
      expect(issues.some((i) => i.severity === 'error')).toBe(true);
    });

    it('rejects CRS reference system mismatches', async () => {
      const { validateRasterPairCompatibility } = await import('../importers');
      const postMeta = { ...baseMeta, crs: 'EPSG:32643' };
      const issues = validateRasterPairCompatibility(baseMeta, postMeta);
      expect(issues.some((i) => i.message.includes('reference system mismatch'))).toBe(true);
    });
  });
});
