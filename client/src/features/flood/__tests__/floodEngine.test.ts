import { describe, it, expect } from 'vitest';
import { computeRasterChange } from '../rasterChange';
import { computeRoadImpacts } from '../roadImpact';
import { computeIsolation } from '../isolation';
import { computeRanking } from '../ranking';
import { generateSyntheticScenario } from '../sampleScenario';
import { DEFAULT_ANALYSIS_PARAMS } from '../constants';
import { validateGeoJSON } from '../validation';
import { RawRasterBuffer, FloodMask, RoadSegment, Community, Facility } from '../types';

describe('FloodOne Analysis Engine (Pure TS)', () => {
  // 1. Raster change detection
  describe('rasterChange.ts', () => {
    it('detects backscatter drop below threshold as candidate flood', () => {
      const width = 4;
      const height = 4;
      const numPixels = 16;

      // Pre-flood dry baseline backscatter: -10 dB
      const preData = new Float32Array(numPixels).fill(-10);

      // Post-flood: corner 4 pixels dropped by -6 dB to -16 dB (flood)
      const postData = new Float32Array(numPixels).fill(-10);
      postData[0] = -16;
      postData[1] = -16;
      postData[4] = -16;
      postData[5] = -16;

      const preRaster: RawRasterBuffer = {
        width,
        height,
        bbox: [0, 0, 1, 1],
        crs: 'EPSG:4326',
        data: preData,
        noData: -9999,
        provenance: 'synthetic',
      };

      const postRaster: RawRasterBuffer = {
        width,
        height,
        bbox: [0, 0, 1, 1],
        crs: 'EPSG:4326',
        data: postData,
        noData: -9999,
        provenance: 'synthetic',
      };

      const mask = computeRasterChange(preRaster, postRaster, {
        ...DEFAULT_ANALYSIS_PARAMS,
        thresholdDb: -3.0,
        waterCeilingDb: -15.0,
      });

      expect(mask.floodedPixelCount).toBe(4);
      expect(mask.floodedFraction).toBe(4 / 16);
      expect(mask.data[0]).toBe(1);
      expect(mask.data[1]).toBe(1);
      expect(mask.data[4]).toBe(1);
      expect(mask.data[5]).toBe(1);
      expect(mask.data[2]).toBe(0);
      expect(mask.data[15]).toBe(0);
    });

    it('skips nodata pixels safely without NaN contamination', () => {
      const preData = new Float32Array([ -10, -9999, -10, -10 ]);
      const postData = new Float32Array([ -16, -16, -10, -10 ]);

      const mask = computeRasterChange(
        { width: 2, height: 2, bbox: [0, 0, 1, 1], crs: 'EPSG:4326', data: preData, noData: -9999, provenance: 'synthetic' },
        { width: 2, height: 2, bbox: [0, 0, 1, 1], crs: 'EPSG:4326', data: postData, noData: -9999, provenance: 'synthetic' },
        DEFAULT_ANALYSIS_PARAMS
      );

      expect(mask.data[1]).toBe(0); // nodata was not marked as flooded
      expect(mask.data[0]).toBe(1); // valid flood pixel detected
    });
  });

  // 2. Road impacts & spatial sampling
  describe('roadImpact.ts', () => {
    it('marks road as impassable when overlap exceeds minOverlapFraction', () => {
      // 10x10 raster mask with a vertical strip of water at x=5
      const width = 10;
      const height = 10;
      const maskData = new Uint8Array(100);
      for (let y = 0; y < 10; y++) {
        maskData[y * 10 + 5] = 1;
      }

      const mask: FloodMask = {
        width,
        height,
        bbox: [0, 0, 10, 10], // bbox: x from 0 to 10, y from 0 to 10
        data: maskData,
        floodedFraction: 0.1,
        floodedPixelCount: 10,
      };

      // Road 1: crosses the flood column from [4, 5] to [6, 5]
      const road1: RoadSegment = {
        id: 'road-crossing-flood',
        geometry: {
          type: 'LineString',
          coordinates: [[4, 5], [6, 5]],
        },
        lengthM: 200,
      };

      // Road 2: entirely dry along x=1 from [1, 0] to [1, 9]
      const road2: RoadSegment = {
        id: 'road-dry',
        geometry: {
          type: 'LineString',
          coordinates: [[1, 0], [1, 9]],
        },
        lengthM: 900,
      };

      const result = computeRoadImpacts([road1, road2], mask, 0.25);

      expect(result.impassableRoadIds).toContain('road-crossing-flood');
      expect(result.impassableRoadIds).not.toContain('road-dry');
    });
  });

  // 3. Multi-source isolation & Dijkstra reachability
  describe('isolation.ts', () => {
    it('identifies isolated community when sole bridge/road is cut', () => {
      // Linear 3-node graph:
      // Community at Node A (0, 0)
      // Intermediate Node B (0.01, 0)
      // Hospital Facility at Node C (0.02, 0)
      // Edge 1: A -> B (road-1)
      // Edge 2: B -> C (road-2, cut by flood!)

      const communities: Community[] = [
        {
          id: 'comm-island',
          name: 'Island Hamlet',
          geometry: { type: 'Point', coordinates: [0, 0] },
          population: 1200,
          provenance: 'synthetic',
        },
      ];

      const facilities: Facility[] = [
        {
          id: 'fac-hosp',
          name: 'Central Hospital',
          kind: 'hospital',
          geometry: { type: 'Point', coordinates: [0.02, 0] },
        },
      ];

      const roads: RoadSegment[] = [
        {
          id: 'road-1',
          geometry: { type: 'LineString', coordinates: [[0, 0], [0.01, 0]] },
          lengthM: 1000,
        },
        {
          id: 'road-2',
          geometry: { type: 'LineString', coordinates: [[0.01, 0], [0.02, 0]] },
          lengthM: 1000,
        },
      ];

      // Case A: Road 2 is impassable
      const impassableCut = new Set(['road-2']);
      const resIsolated = computeIsolation(communities, facilities, roads, impassableCut, 100);
      const impactIsolated = resIsolated.get('comm-island');
      expect(impactIsolated?.isolated).toBe(true);
      expect(impactIsolated?.preFloodIsolated).toBe(false); // was reachable before cut!

      // Case B: Both roads passable
      const impassableNone = new Set<string>();
      const resPassable = computeIsolation(communities, facilities, roads, impassableNone, 100);
      const impactPassable = resPassable.get('comm-island');
      expect(impactPassable?.isolated).toBe(false);
      expect(impactPassable?.routeLengthM).toBeGreaterThanOrEqual(2000);
    });
  });

  // 4. Ranking & Explainable scoring
  describe('ranking.ts', () => {
    it('places isolated communities ahead of reachable communities due to isolation bonus', () => {
      const comm1: Community = {
        id: 'c1',
        name: 'Town Reachable Large',
        geometry: { type: 'Point', coordinates: [0, 0] },
        population: 5000,
        urgency: 3,
        provenance: 'synthetic',
      };
      const comm2: Community = {
        id: 'c2',
        name: 'Village Isolated Small',
        geometry: { type: 'Point', coordinates: [0.01, 0] },
        population: 800,
        urgency: 4,
        provenance: 'synthetic',
      };

      const reachMap = new Map();
      reachMap.set('c1', { isolated: false, preFloodIsolated: false, routeLengthM: 1500 });
      reachMap.set('c2', { isolated: true, preFloodIsolated: false, routeLengthM: null });

      const ranked = computeRanking([comm1, comm2], reachMap, DEFAULT_ANALYSIS_PARAMS);

      // Village c2 must be ranked #1 because it is isolated!
      expect(ranked[0].communityId).toBe('c2');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].reasons.some((r) => r.includes('Complete road isolation'))).toBe(true);
      expect(ranked[1].communityId).toBe('c1');
    });
  });

  // 5. Synthetic Scenario determinism
  describe('sampleScenario.ts', () => {
    it('generates reproducible deterministic scenario with seeded mulberry32', () => {
      const s1 = generateSyntheticScenario(12345);
      const s2 = generateSyntheticScenario(12345);

      expect(s1.vectors.communities.length).toBe(s2.vectors.communities.length);
      expect(s1.vectors.roads.length).toBe(s2.vectors.roads.length);
      expect(s1.preRaster.data[50]).toBe(s2.preRaster.data[50]);
      expect(s1.postRaster.data[50]).toBe(s2.postRaster.data[50]);
    });
  });

  // 6. Validation security & error handling
  describe('validation.ts', () => {
    it('catches invalid JSON gracefully with typed issue', () => {
      const res = validateGeoJSON('NOT JSON', 'roads');
      expect(res.ok).toBe(false);
      expect(res.issues[0].severity).toBe('error');
      expect(res.issues[0].fix).toContain('JSON syntax');
    });

    it('rejects geometries with wrong types (e.g. Point instead of LineString for roads)', () => {
      const wrongGeoJSON = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [75.3, 19.8] },
            properties: { id: 'bad-road' },
          },
        ],
      });

      const res = validateGeoJSON(wrongGeoJSON, 'roads');
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.message.includes('LineString'))).toBe(true);
    });
  });
});
