import { computeRasterChange } from './rasterChange';
import { computeRoadImpacts } from './roadImpact';
import { computeIsolation } from './isolation';
import { computeRanking } from './ranking';
import {
  AnalysisParams,
  AnalysisResult,
  RawRasterBuffer,
  VectorDatasets,
} from './types';

export interface WorkerRunPayload {
  preRaster: RawRasterBuffer;
  postRaster: RawRasterBuffer;
  vectors: VectorDatasets;
  params: AnalysisParams;
}

export type WorkerRequest = {
  id: string;
  type: 'run';
  payload: WorkerRunPayload;
};

export type WorkerResponse =
  | { id: string; type: 'progress'; stage: string; pct: number }
  | { id: string; type: 'done'; result: AnalysisResult }
  | { id: string; type: 'error'; message: string; fix?: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (!req || req.type !== 'run') return;

  const { id, payload } = req;
  const { preRaster, postRaster, vectors, params } = payload;

  try {
    // Stage 1: Raster change detection
    self.postMessage({
      id,
      type: 'progress',
      stage: 'Evaluating SAR backscatter difference & candidate flood mask…',
      pct: 25,
    } as WorkerResponse);

    const mask = computeRasterChange(preRaster, postRaster, params);

    // Stage 2: Road impact
    self.postMessage({
      id,
      type: 'progress',
      stage: 'Intersecting road network with candidate flood signal…',
      pct: 50,
    } as WorkerResponse);

    const { impassableRoadIds } = computeRoadImpacts(
      vectors.roads,
      mask,
      params.minOverlapFraction
    );
    const impassableSet = new Set(impassableRoadIds);

    // Stage 3: Graph isolation
    self.postMessage({
      id,
      type: 'progress',
      stage: 'Running multi-source Dijkstra reachability to hospitals & shelters…',
      pct: 75,
    } as WorkerResponse);

    const reachability = computeIsolation(
      vectors.communities,
      vectors.facilities,
      vectors.roads,
      impassableSet,
      params.snapToleranceM
    );

    // Stage 4: Priority queue ranking
    self.postMessage({
      id,
      type: 'progress',
      stage: 'Calculating explainable rescue-priority scoring…',
      pct: 95,
    } as WorkerResponse);

    const impacts = computeRanking(vectors.communities, reachability, params);

    const warnings: string[] = [];
    if (mask.floodedFraction > 0.6) {
      warnings.push(
        'Unusually high candidate flood fraction (>60%). Verify calibration or scene acquisition date.'
      );
    }
    if (mask.floodedFraction === 0) {
      warnings.push(
        'No candidate change detected at current threshold. Try lowering the dB threshold.'
      );
    }
    if (vectors.facilities.length === 0) {
      warnings.push('No emergency facilities provided; reachability could not be computed.');
    }

    const result: AnalysisResult = {
      mask,
      impassableRoadIds,
      impacts,
      warnings,
      params,
      generatedAt: new Date().toISOString(),
      provenance: vectors.provenance,
    };

    self.postMessage({
      id,
      type: 'done',
      result,
    } as WorkerResponse);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({
      id,
      type: 'error',
      message: `Worker analysis failed: ${errorMsg}`,
      fix: 'Check input geometry bounds, raster grid dimensions, and coordinate values.',
    } as WorkerResponse);
  }
};
