import React, { useState } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  MapPin,
  Key,
  CheckCircle2,
  Edit2,
  Check,
} from 'lucide-react';
import { useFlood } from '../../features/flood/store';
import {
  CARTO_BASEMAP_STYLES,
  CartoBasemapStyleId,
  getCartoApiKey,
  setCartoApiKey,
} from '../../features/flood/cartoConfig';

export const LayerPanel: React.FC = () => {
  const { state, dispatch } = useFlood();
  const { layerVisibility, result, vectors, cartoStyle } = state;
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState(getCartoApiKey());

  const cutRoadsCount = result?.impassableRoadIds.length ?? 0;
  const isolatedCount = result?.impacts.filter((i) => i.isolated).length ?? 0;

  const currentApiKey = getCartoApiKey();
  const maskedKey = `${currentApiKey.slice(0, 7)}...${currentApiKey.slice(-4)}`;

  const handleSaveKey = () => {
    setCartoApiKey(keyInput);
    setEditingKey(false);
    // Trigger style re-apply
    dispatch({ type: 'SET_CARTO_STYLE', payload: cartoStyle });
  };

  const layers = [
    {
      key: 'flood' as const,
      name: 'Candidate Flood Signal',
      color: '#22D3EE',
      icon: <span className="w-3 h-3 rounded-sm bg-signal shadow-sm shadow-signal/40 inline-block" />,
      count: result ? `${(result.mask.floodedFraction * 100).toFixed(1)}%` : '—',
      desc: 'Specular radar backscatter anomaly',
    },
    {
      key: 'cutRoads' as const,
      name: 'Cut / Severed Road Links',
      color: '#E5484D',
      icon: <span className="w-3.5 h-1 rounded bg-urgent inline-block animate-pulse" />,
      count: cutRoadsCount,
      desc: 'Segments exceeding submersion threshold',
    },
    {
      key: 'roads' as const,
      name: 'Passable Road Network',
      color: '#8DA2B3',
      icon: <span className="w-3.5 h-1 rounded bg-muted inline-block" />,
      count: vectors.roads.length - cutRoadsCount,
      desc: 'Navigable transit corridors',
    },
    {
      key: 'communities' as const,
      name: 'Communities & Settlements',
      color: '#F5F1EA',
      icon: <span className="w-2.5 h-2.5 rounded-full border border-paper bg-signal inline-block" />,
      count: `${isolatedCount} cut-off / ${vectors.communities.length}`,
      desc: 'Population clusters at risk',
    },
    {
      key: 'facilities' as const,
      name: 'Hospitals & Relief Shelters',
      color: '#3FB68B',
      icon: <span className="text-xs">🏥</span>,
      count: vectors.facilities.length,
      desc: 'Medical triage and food camps',
    },
  ];

  return (
    <div className="bg-surface/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-2.5 w-68 text-xs font-sans text-paper select-none max-h-[85vh] overflow-y-auto">
      {/* Map Layers Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 font-heading font-semibold text-paper">
          <Layers className="w-3.5 h-3.5 text-signal" />
          <span>Operational Layers</span>
        </div>
        <span className="font-mono text-[10px] text-muted">Toggle</span>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-1">
        {layers.map((layer) => {
          const isVisible = layerVisibility[layer.key];

          return (
            <div
              key={layer.key}
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', payload: layer.key })}
              className={`flex items-center justify-between p-1.5 rounded transition-all cursor-pointer ${
                isVisible ? 'bg-surface-2/70 text-paper' : 'text-muted/60 hover:bg-surface-2/40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 flex items-center justify-center w-4">
                  {layer.icon}
                </div>
                <div className="truncate">
                  <div className="font-medium text-[11px] truncate">{layer.name}</div>
                  <div className="text-[9px] text-muted truncate">{layer.desc}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                <span className="font-mono text-[10px] text-signal">{layer.count}</span>
                <button
                  type="button"
                  className="text-muted hover:text-paper"
                  aria-label={`Toggle ${layer.name}`}
                >
                  {isVisible ? (
                    <Eye className="w-3.5 h-3.5 text-signal" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-muted" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CARTO Basemap Styles Section */}
      <div className="mt-3 pt-2.5 border-t border-border/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-heading font-semibold text-[11px] text-paper flex items-center gap-1">
            <MapPin className="w-3 h-3 text-signal" />
            CARTO Basemap Style
          </span>
          <span className="text-[10px] font-mono text-signal uppercase tracking-wider font-semibold">
            High-Res @2x
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {CARTO_BASEMAP_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() =>
                dispatch({ type: 'SET_CARTO_STYLE', payload: style.id })
              }
              className={`p-1.5 rounded text-center border transition-all ${
                cartoStyle === style.id
                  ? 'bg-signal/15 border-signal text-signal font-bold shadow-sm shadow-signal/20'
                  : 'bg-surface-2/50 border-border text-muted hover:text-paper hover:bg-surface-2'
              }`}
              title={style.description}
            >
              <div
                className="w-full h-3 rounded-sm mb-1 border border-border/50"
                style={{ backgroundColor: style.thumbnailColor }}
              />
              <span className="text-[10px] block truncate">{style.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CARTO API Key Active Status Pill */}
      <div className="mt-2.5 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1 text-ok font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
            <span>CARTO API Active</span>
          </div>
          <button
            onClick={() => setEditingKey(!editingKey)}
            className="text-muted hover:text-signal flex items-center gap-0.5"
            title="Inspect or change CARTO API Key"
          >
            <Key className="w-2.5 h-2.5" />
            <span>{maskedKey}</span>
            <Edit2 className="w-2.5 h-2.5 ml-0.5" />
          </button>
        </div>

        {editingKey && (
          <div className="mt-1.5 p-2 rounded bg-surface-2 border border-signal/40 space-y-1.5 animate-fadeIn">
            <label className="text-[10px] text-muted block font-sans">
              CARTO Platform API Key:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-surface text-paper font-mono text-[10px] px-2 py-1 rounded border border-border focus:border-signal outline-none"
                placeholder="Enter CARTO API key"
              />
              <button
                onClick={handleSaveKey}
                className="p-1 rounded bg-signal text-bg font-bold hover:bg-signal/90"
                title="Save Key"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[9px] text-muted block leading-tight font-sans">
              Key is stored securely in browser storage and appended to high-res tile requests.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
