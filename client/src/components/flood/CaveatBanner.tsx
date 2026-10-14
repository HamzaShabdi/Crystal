import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useFlood } from '../../features/flood/store';
import { ProvenanceChip } from './ProvenanceChip';
import { RADAR_CAVEATS } from '../../features/flood/constants';

export const CaveatBanner: React.FC = () => {
  const { state } = useFlood();
  const [expanded, setExpanded] = useState(false);
  const isSynthetic = state.provenance === 'synthetic';

  return (
    <div className="w-full bg-surface border-b border-border text-paper px-4 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <ProvenanceChip provenance={state.provenance} />

          <div className="flex items-center gap-1.5 font-medium">
            {isSynthetic ? (
              <span className="text-caution flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <strong className="tracking-wide uppercase font-mono">Practice Scenario:</strong>
                Not observed ground data. Illustrative benchmark only.
              </span>
            ) : (
              <span className="text-signal flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <strong className="tracking-wide uppercase font-mono">Screening Mode:</strong>
                Exploratory SAR signal — verify road conditions with ground responders before asset deployment.
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted hover:text-paper inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-2 transition-colors font-mono text-[11px]"
          aria-expanded={expanded}
        >
          <Info className="w-3.5 h-3.5 text-signal" />
          <span>Scientific Caveats</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-border/60 text-xs text-muted grid grid-cols-1 md:grid-cols-2 gap-2 animate-fadeIn font-sans">
          {RADAR_CAVEATS.map((caveat, idx) => (
            <div key={idx} className="flex items-start gap-1.5 bg-surface-2/60 p-2 rounded border border-border/40">
              <span className="text-signal font-mono text-[11px]">[{idx + 1}]</span>
              <span>{caveat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
