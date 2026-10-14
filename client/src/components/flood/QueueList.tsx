import React, { useState } from 'react';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Users,
  Compass,
} from 'lucide-react';
import { useFlood } from '../../features/flood/store';
import { ImpactDetail } from './ImpactDetail';

export const QueueList: React.FC = () => {
  const { state, dispatch } = useFlood();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'isolated' | 'passable'>('all');

  const impacts = state.result?.impacts ?? [];

  const filteredImpacts = impacts.filter((item) => {
    const matchesSearch = item.communityName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === 'isolated') return item.isolated;
    if (filterMode === 'passable') return !item.isolated;
    return true;
  });

  const selectedImpact = impacts.find(
    (i) => i.communityId === state.selectedCommunityId
  );

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border select-text">
      {/* Queue Header */}
      <div className="p-3 border-b border-border bg-surface flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-base tracking-tight text-paper">
              Response Priority Queue
            </h3>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-2 text-signal border border-border">
              {impacts.length} targets
            </span>
          </div>

          <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-border text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                filterMode === 'all'
                  ? 'bg-signal/20 text-signal font-bold'
                  : 'text-muted hover:text-paper'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('isolated')}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                filterMode === 'isolated'
                  ? 'bg-urgent/20 text-urgent font-bold'
                  : 'text-muted hover:text-paper'
              }`}
            >
              Cut-off
            </button>
            <button
              onClick={() => setFilterMode('passable')}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                filterMode === 'passable'
                  ? 'bg-ok/20 text-ok font-bold'
                  : 'text-muted hover:text-paper'
              }`}
            >
              Passable
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search communities by name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface-2 text-paper text-xs rounded border border-border focus:border-signal outline-none font-sans placeholder:text-muted/60"
          />
        </div>
      </div>

      {/* Queue List Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredImpacts.length === 0 ? (
          <div className="p-6 text-center text-muted text-xs font-mono">
            No matching communities found.
          </div>
        ) : (
          filteredImpacts.map((imp, idx) => {
            const isSelected = imp.communityId === state.selectedCommunityId;

            return (
              <div
                key={imp.communityId}
                onClick={() =>
                  dispatch({ type: 'SELECT_COMMUNITY', payload: imp.communityId })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dispatch({ type: 'SELECT_COMMUNITY', payload: imp.communityId });
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIdx = (idx + 1) % filteredImpacts.length;
                    dispatch({ type: 'SELECT_COMMUNITY', payload: filteredImpacts[nextIdx].communityId });
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIdx = (idx - 1 + filteredImpacts.length) % filteredImpacts.length;
                    dispatch({ type: 'SELECT_COMMUNITY', payload: filteredImpacts[prevIdx].communityId });
                  }
                }}
                onMouseEnter={() =>
                  dispatch({ type: 'HOVER_COMMUNITY', payload: imp.communityId })
                }
                onMouseLeave={() =>
                  dispatch({ type: 'HOVER_COMMUNITY', payload: null })
                }
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`Rank ${imp.rank}: ${imp.communityName}, ${imp.isolated ? 'isolated' : 'accessible'}, population ${imp.populationAtRisk}`}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                  isSelected
                    ? 'bg-surface-2 border-signal shadow-sm shadow-signal/10 ring-1 ring-signal'
                    : 'bg-surface hover:bg-surface-2/80 border-border/80'
                }`}
              >
                {/* Left: Rank badge & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`font-mono font-bold text-xs w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                      imp.isolated
                        ? 'bg-urgent/20 text-urgent border border-urgent/40'
                        : 'bg-surface-2 text-muted border border-border'
                    }`}
                  >
                    #{imp.rank}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading font-semibold text-sm text-paper truncate">
                        {imp.communityName}
                      </span>
                      {imp.isolated ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-urgent/15 text-urgent border border-urgent/30">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Cut-off
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-ok/15 text-ok border border-ok/30">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Open
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5 font-mono">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-signal" />
                        {imp.populationAtRisk.toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>Urg: {imp.urgency}/5</span>
                      {imp.routeLengthM && (
                        <>
                          <span>•</span>
                          <span>{(imp.routeLengthM / 1000).toFixed(1)} km</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Score */}
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] uppercase font-mono text-muted block">Score</span>
                  <span className="font-mono font-bold text-sm text-signal">
                    {imp.score.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Community Evidence Card Inset */}
      {selectedImpact && (
        <div className="p-3 border-t border-border bg-surface max-h-[48%] overflow-y-auto">
          <ImpactDetail impact={selectedImpact} />
        </div>
      )}
    </div>
  );
};
