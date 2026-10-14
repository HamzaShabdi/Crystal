import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { DEFAULT_ANALYSIS_PARAMS } from './constants';
import { generateSyntheticScenario } from './sampleScenario';
import {
  AnalysisParams,
  AnalysisResult,
  Provenance,
  RawRasterBuffer,
  ValidationIssue,
  VectorDatasets,
} from './types';
import { computeRasterChange } from './rasterChange';
import { computeRoadImpacts } from './roadImpact';
import { computeIsolation } from './isolation';
import { computeRanking } from './ranking';

export interface FloodState {
  provenance: Provenance;
  vectors: VectorDatasets;
  preRaster: RawRasterBuffer;
  postRaster: RawRasterBuffer;
  params: AnalysisParams;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisProgress: { stage: string; pct: number } | null;
  selectedCommunityId: string | null;
  hoveredCommunityId: string | null;
  layerVisibility: {
    flood: boolean;
    roads: boolean;
    cutRoads: boolean;
    communities: boolean;
    facilities: boolean;
  };
  activeTab: 'scenario' | 'import' | 'params' | 'help';
  cartoStyle: 'dark_all' | 'light_all' | 'voyager';
  validationIssues: ValidationIssue[];
  errorMessage: string | null;
}

type Action =
  | { type: 'SET_SCENARIO'; payload: ReturnType<typeof generateSyntheticScenario> }
  | {
      type: 'SET_IMPORTED_DATA';
      payload: {
        vectors: VectorDatasets;
        preRaster: RawRasterBuffer;
        postRaster: RawRasterBuffer;
        issues: ValidationIssue[];
      };
    }
  | { type: 'UPDATE_PARAMS'; payload: Partial<AnalysisParams> }
  | { type: 'START_ANALYSIS' }
  | { type: 'SET_PROGRESS'; payload: { stage: string; pct: number } }
  | { type: 'ANALYSIS_SUCCESS'; payload: AnalysisResult }
  | { type: 'ANALYSIS_ERROR'; payload: string }
  | { type: 'SELECT_COMMUNITY'; payload: string | null }
  | { type: 'HOVER_COMMUNITY'; payload: string | null }
  | { type: 'TOGGLE_LAYER'; payload: keyof FloodState['layerVisibility'] }
  | { type: 'SET_ACTIVE_TAB'; payload: FloodState['activeTab'] }
  | { type: 'SET_CARTO_STYLE'; payload: 'dark_all' | 'light_all' | 'voyager' }
  | { type: 'CLEAR_ERROR' };

const initialScenario = generateSyntheticScenario(4242);

const initialState: FloodState = {
  provenance: 'synthetic',
  vectors: initialScenario.vectors,
  preRaster: initialScenario.preRaster,
  postRaster: initialScenario.postRaster,
  params: DEFAULT_ANALYSIS_PARAMS,
  result: null,
  isAnalyzing: false,
  analysisProgress: null,
  selectedCommunityId: 'comm-1',
  hoveredCommunityId: null,
  layerVisibility: {
    flood: true,
    roads: true,
    cutRoads: true,
    communities: true,
    facilities: true,
  },
  activeTab: 'scenario',
  cartoStyle: 'dark_all',
  validationIssues: [],
  errorMessage: null,
};

function floodReducer(state: FloodState, action: Action): FloodState {
  switch (action.type) {
    case 'SET_SCENARIO':
      return {
        ...state,
        provenance: 'synthetic',
        vectors: action.payload.vectors,
        preRaster: action.payload.preRaster,
        postRaster: action.payload.postRaster,
        validationIssues: [],
        errorMessage: null,
        selectedCommunityId: 'comm-1',
      };
    case 'SET_IMPORTED_DATA':
      return {
        ...state,
        provenance: 'imported',
        vectors: action.payload.vectors,
        preRaster: action.payload.preRaster,
        postRaster: action.payload.postRaster,
        validationIssues: action.payload.issues,
        selectedCommunityId: action.payload.vectors.communities[0]?.id ?? null,
        errorMessage: null,
      };
    case 'UPDATE_PARAMS':
      return {
        ...state,
        params: { ...state.params, ...action.payload },
      };
    case 'START_ANALYSIS':
      return {
        ...state,
        isAnalyzing: true,
        errorMessage: null,
      };
    case 'SET_PROGRESS':
      return {
        ...state,
        analysisProgress: action.payload,
      };
    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        isAnalyzing: false,
        analysisProgress: null,
        result: action.payload,
      };
    case 'ANALYSIS_ERROR':
      return {
        ...state,
        isAnalyzing: false,
        analysisProgress: null,
        errorMessage: action.payload,
      };
    case 'SELECT_COMMUNITY':
      return {
        ...state,
        selectedCommunityId: action.payload,
      };
    case 'HOVER_COMMUNITY':
      return {
        ...state,
        hoveredCommunityId: action.payload,
      };
    case 'TOGGLE_LAYER':
      return {
        ...state,
        layerVisibility: {
          ...state.layerVisibility,
          [action.payload]: !state.layerVisibility[action.payload],
        },
      };
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };
    case 'SET_CARTO_STYLE':
      return {
        ...state,
        cartoStyle: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        errorMessage: null,
      };
    default:
      return state;
  }
}

// Fallback synchronous compute if WebWorker is unavailable or fails
function runAnalysisSync(
  preRaster: RawRasterBuffer,
  postRaster: RawRasterBuffer,
  vectors: VectorDatasets,
  params: AnalysisParams
): AnalysisResult {
  const mask = computeRasterChange(preRaster, postRaster, params);
  const { impassableRoadIds } = computeRoadImpacts(
    vectors.roads,
    mask,
    params.minOverlapFraction
  );
  const impassableSet = new Set(impassableRoadIds);
  const reachability = computeIsolation(
    vectors.communities,
    vectors.facilities,
    vectors.roads,
    impassableSet,
    params.snapToleranceM
  );
  const impacts = computeRanking(vectors.communities, reachability, params);

  const warnings: string[] = [];
  if (mask.floodedFraction > 0.6) {
    warnings.push('Unusually high candidate flood fraction (>60%). Verify calibration.');
  }
  if (mask.floodedFraction === 0) {
    warnings.push('No candidate change detected at current threshold.');
  }

  return {
    mask,
    impassableRoadIds,
    impacts,
    warnings,
    params,
    generatedAt: new Date().toISOString(),
    provenance: vectors.provenance,
  };
}

interface FloodContextType {
  state: FloodState;
  dispatch: React.Dispatch<Action>;
  runAnalysis: () => void;
  resetToSynthetic: () => void;
}

const FloodContext = createContext<FloodContextType | null>(null);

export const FloodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(floodReducer, initialState);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('./analysis.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e) => {
        const res = e.data;
        if (!res) return;
        if (res.type === 'progress') {
          dispatch({ type: 'SET_PROGRESS', payload: { stage: res.stage, pct: res.pct } });
        } else if (res.type === 'done') {
          dispatch({ type: 'ANALYSIS_SUCCESS', payload: res.result });
        } else if (res.type === 'error') {
          dispatch({ type: 'ANALYSIS_ERROR', payload: res.message });
        }
      };

      worker.onerror = () => {
        // Fallback to sync runner
        console.warn('Worker error; falling back to main-thread compute.');
      };

      workerRef.current = worker;

      return () => {
        worker.terminate();
      };
    } catch (e) {
      console.warn('Could not spawn Web Worker, will use main thread compute:', e);
    }
  }, []);

  const runAnalysis = () => {
    dispatch({ type: 'START_ANALYSIS' });

    if (workerRef.current) {
      try {
        workerRef.current.postMessage({
          id: Math.random().toString(36).slice(2),
          type: 'run',
          payload: {
            preRaster: state.preRaster,
            postRaster: state.postRaster,
            vectors: state.vectors,
            params: state.params,
          },
        });
        return;
      } catch (err) {
        console.warn('Failed postMessage to worker, running sync:', err);
      }
    }

    // Synchronous execution fallback
    try {
      const res = runAnalysisSync(
        state.preRaster,
        state.postRaster,
        state.vectors,
        state.params
      );
      dispatch({ type: 'ANALYSIS_SUCCESS', payload: res });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'ANALYSIS_ERROR', payload: msg });
    }
  };

  // Run initial analysis on mount
  useEffect(() => {
    runAnalysis();
  }, [state.vectors, state.preRaster, state.postRaster]);

  // Debounced auto-rerun when parameters change (debounced <= 300 ms as required by PRD C1)
  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      runAnalysis();
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [state.params]);

  const resetToSynthetic = () => {
    const sc = generateSyntheticScenario(4242);
    dispatch({ type: 'SET_SCENARIO', payload: sc });
  };

  return (
    <FloodContext.Provider value={{ state, dispatch, runAnalysis, resetToSynthetic }}>
      {children}
    </FloodContext.Provider>
  );
};

export function useFlood() {
  const ctx = useContext(FloodContext);
  if (!ctx) throw new Error('useFlood must be used within FloodProvider');
  return ctx;
}
