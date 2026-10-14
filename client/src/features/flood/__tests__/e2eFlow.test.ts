import { describe, it, expect } from 'vitest';
import { generateSyntheticScenario } from '../sampleScenario';
import { computeRasterChange } from '../rasterChange';
import { computeRoadImpacts } from '../roadImpact';
import { computeIsolation } from '../isolation';
import { computeRanking } from '../ranking';
import { generateQueueCsvString, generateResultsGeoJsonObject } from '../exports';
import { validateGeoJSON } from '../validation';
import { DEFAULT_ANALYSIS_PARAMS } from '../constants';
import { AnalysisResult } from '../types';

describe('End-to-End Pipeline & Integration Flow (M6 Gate)', () => {
  it('executes full screening workflow from synthetic baseline to export', () => {
    // Step 1: Auto-load synthetic scenario
    const scenario = generateSyntheticScenario(42);
    expect(scenario.vectors.communities.length).toBeGreaterThan(0);
    expect(scenario.vectors.roads.length).toBeGreaterThan(0);
    expect(scenario.vectors.facilities.length).toBeGreaterThan(0);

    // Step 2: Compute SAR change detection with default -3 dB threshold
    const mask = computeRasterChange(
      scenario.preRaster,
      scenario.postRaster,
      DEFAULT_ANALYSIS_PARAMS
    );
    expect(mask.floodedPixelCount).toBeGreaterThan(0);
    expect(mask.floodedFraction).toBeGreaterThan(0);

    // Step 3: Road intersection & submergence check
    const roadImpact = computeRoadImpacts(
      scenario.vectors.roads,
      mask,
      DEFAULT_ANALYSIS_PARAMS.minOverlapFraction
    );
    expect(roadImpact.impassableRoadIds.length).toBeGreaterThan(0);

    // Step 4: Multi-source Dijkstra reachability analysis
    const impassableSet = new Set(roadImpact.impassableRoadIds);
    const reachability = computeIsolation(
      scenario.vectors.communities,
      scenario.vectors.facilities,
      scenario.vectors.roads,
      impassableSet,
      DEFAULT_ANALYSIS_PARAMS.snapToleranceM
    );
    expect(reachability.size).toBe(scenario.vectors.communities.length);

    // Step 5: Ranking with explainable rationale
    const rankedImpacts = computeRanking(
      scenario.vectors.communities,
      reachability,
      DEFAULT_ANALYSIS_PARAMS
    );
    expect(rankedImpacts.length).toBe(scenario.vectors.communities.length);
    expect(rankedImpacts[0].rank).toBe(1);
    expect(rankedImpacts[0].reasons.length).toBeGreaterThan(0);

    // Verify isolated communities receive top priority
    const isolatedImpacts = rankedImpacts.filter((i) => i.isolated);
    if (isolatedImpacts.length > 0) {
      expect(rankedImpacts[0].isolated).toBe(true);
    }

    // Step 6: Full result bundling
    const fullResult: AnalysisResult = {
      mask,
      impassableRoadIds: roadImpact.impassableRoadIds,
      impacts: rankedImpacts,
      warnings: [],
      params: DEFAULT_ANALYSIS_PARAMS,
      generatedAt: new Date().toISOString(),
      provenance: 'synthetic',
    };

    // Step 7: CSV and GeoJSON exports
    const csv = generateQueueCsvString(fullResult);
    expect(csv).toContain('"rank"');
    expect(csv).toContain('"community_id"');
    expect(csv).toContain('"SYNTHETIC"');

    const geoJson = generateResultsGeoJsonObject(
      fullResult,
      scenario.vectors.roads,
      scenario.vectors.facilities
    );
    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.metadata.floodedPixelCount).toBe(mask.floodedPixelCount);
  });

  it('handles threshold adjustments dynamically', () => {
    const scenario = generateSyntheticScenario(42);

    // Low threshold (-6 dB drop required) -> less water detected
    const strictMask = computeRasterChange(scenario.preRaster, scenario.postRaster, {
      ...DEFAULT_ANALYSIS_PARAMS,
      thresholdDb: -6.0,
    });

    // High threshold (-1 dB drop required) -> more candidate water detected
    const sensitiveMask = computeRasterChange(scenario.preRaster, scenario.postRaster, {
      ...DEFAULT_ANALYSIS_PARAMS,
      thresholdDb: -1.0,
    });

    expect(sensitiveMask.floodedPixelCount).toBeGreaterThanOrEqual(strictMask.floodedPixelCount);
  });

  it('rejects invalid GeoJSON vectors with clear actionable diagnostic hints', () => {
    // 1. Invalid coordinates
    const nanGeoJSON = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [NaN, 19.8] },
          properties: { id: 'c1', name: 'Broken' },
        },
      ],
    });
    const resNaN = validateGeoJSON(nanGeoJSON, 'communities');
    expect(resNaN.ok).toBe(false);
    expect(resNaN.issues.length).toBeGreaterThan(0);

    // 2. Out of bounds coordinates (e.g. longitude > 180)
    const oobGeoJSON = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [250, 19.8] },
          properties: { id: 'c1', name: 'OutOfRange' },
        },
      ],
    });
    const resOOB = validateGeoJSON(oobGeoJSON, 'communities');
    expect(resOOB.ok).toBe(false);
    expect(resOOB.issues.some((i) => i.message.includes('longitude') || i.message.includes('bounds'))).toBe(true);
  });
});
