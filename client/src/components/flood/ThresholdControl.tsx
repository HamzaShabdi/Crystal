import React, { useState } from 'react';
import { Sliders, HelpCircle, ChevronDown, ChevronUp, RefreshCw, Layers } from 'lucide-react';
import { useFlood } from '../../features/flood/store';

export const ThresholdControl: React.FC = () => {
  const { state, dispatch, runAnalysis } = useFlood();
  const { params, isAnalyzing } = state;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-surface border-t border-border px-4 py-2.5 text-xs text-paper">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Main Threshold Slider */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex items-center gap-1.5 font-medium whitespace-nowrap">
            <Sliders className="w-3.5 h-3.5 text-signal" />
            <span className="font-heading">Change Threshold</span>
            <div className="group relative">
              <HelpCircle className="w-3 h-3 text-muted hover:text-signal cursor-help" />
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-surface-2 text-paper rounded border border-signal/30 shadow-lg text-[11px] leading-relaxed z-50 pointer-events-none">
                Sentinel-1 backscatter drop in dB (Post − Pre). More negative values (e.g. −5 dB) require stronger specular drops; higher values (e.g. −2 dB) catch shallower water but increase noise.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <input
              type="range"
              min="-10.0"
              max="-1.0"
              step="0.1"
              value={params.thresholdDb}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_PARAMS',
                  payload: { thresholdDb: parseFloat(e.target.value) },
                })
              }
              className="w-full accent-signal cursor-pointer h-1.5 bg-surface-2 rounded-lg"
              id="threshold-slider"
            />
            <span className="font-mono text-signal font-semibold w-14 text-right">
              {params.thresholdDb.toFixed(1)} dB
            </span>
          </div>

          {/* Polarization Band Toggle */}
          <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-border">
            <button
              onClick={() =>
                dispatch({ type: 'UPDATE_PARAMS', payload: { band: 'VV' } })
              }
              className={`px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                params.band === 'VV'
                  ? 'bg-signal/20 text-signal border border-signal/40'
                  : 'text-muted hover:text-paper'
              }`}
            >
              VV
            </button>
            <button
              onClick={() =>
                dispatch({ type: 'UPDATE_PARAMS', payload: { band: 'VH' } })
              }
              className={`px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                params.band === 'VH'
                  ? 'bg-signal/20 text-signal border border-signal/40'
                  : 'text-muted hover:text-paper'
              }`}
            >
              VH
            </button>
          </div>
        </div>

        {/* Live Metrics Quick Strip */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Flooded Area:</span>
            <span className="text-signal font-bold">
              {state.result ? `${(state.result.mask.floodedFraction * 100).toFixed(1)}%` : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted">Cut Roads:</span>
            <span className="text-urgent font-bold">
              {state.result ? state.result.impassableRoadIds.length : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted">Isolated:</span>
            <span className="text-urgent font-bold">
              {state.result
                ? state.result.impacts.filter((i) => i.isolated).length
                : '—'}
            </span>
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-1.5 text-signal font-mono text-[11px] animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Analyzing…</span>
            </div>
          )}

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-muted hover:text-paper px-2 py-1 rounded hover:bg-surface-2 transition-colors font-sans text-xs"
          >
            <span>Advanced</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Advanced Parameters Drawer */}
      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn font-sans text-xs">
          <div>
            <label className="text-muted block mb-1">
              Water Ceiling ({params.waterCeilingDb} dB)
            </label>
            <input
              type="range"
              min="-25.0"
              max="-10.0"
              step="0.5"
              value={params.waterCeilingDb}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_PARAMS',
                  payload: { waterCeilingDb: parseFloat(e.target.value) },
                })
              }
              className="w-full accent-signal"
            />
            <span className="text-[10px] text-muted">Excludes bright non-water returns</span>
          </div>

          <div>
            <label className="text-muted block mb-1">
              Min Road Submergence ({(params.minOverlapFraction * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={params.minOverlapFraction}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_PARAMS',
                  payload: { minOverlapFraction: parseFloat(e.target.value) },
                })
              }
              className="w-full accent-signal"
            />
            <span className="text-[10px] text-muted">Fraction of segment length flooded</span>
          </div>

          <div>
            <label className="text-muted block mb-1">
              Snap Tolerance ({params.snapToleranceM} m)
            </label>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={params.snapToleranceM}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_PARAMS',
                  payload: { snapToleranceM: parseInt(e.target.value, 10) },
                })
              }
              className="w-full accent-signal"
            />
            <span className="text-[10px] text-muted">Graph connection distance</span>
          </div>

          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={params.speckleFilter}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_PARAMS',
                    payload: { speckleFilter: e.target.checked },
                  })
                }
                className="accent-signal rounded"
              />
              <span className="font-medium text-paper">3×3 Speckle Filter</span>
            </label>
            <span className="text-[10px] text-muted mt-1">
              Suppresses granular radar noise
            </span>
          </div>

          {/* Ranking Weights Row */}
          <div className="md:col-span-4 pt-2.5 mt-1 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted">Pop Weight (wP)</span>
                <span className="font-mono text-signal font-semibold">
                  {(params.weights.population * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={params.weights.population}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_PARAMS',
                    payload: {
                      weights: {
                        ...params.weights,
                        population: parseFloat(e.target.value),
                      },
                    },
                  })
                }
                className="w-full accent-signal"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted">Urgency Weight (wU)</span>
                <span className="font-mono text-caution font-semibold">
                  {(params.weights.urgency * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={params.weights.urgency}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_PARAMS',
                    payload: {
                      weights: {
                        ...params.weights,
                        urgency: parseFloat(e.target.value),
                      },
                    },
                  })
                }
                className="w-full accent-caution"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted">Distance Weight (wD)</span>
                <span className="font-mono text-ok font-semibold">
                  {(params.weights.distance * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={params.weights.distance}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_PARAMS',
                    payload: {
                      weights: {
                        ...params.weights,
                        distance: parseFloat(e.target.value),
                      },
                    },
                  })
                }
                className="w-full accent-ok"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
