import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Hospital,
  Compass,
  Users,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { CommunityImpact } from '../../features/flood/types';
import { ProvenanceChip } from './ProvenanceChip';
import { useFlood } from '../../features/flood/store';

interface ImpactDetailProps {
  impact: CommunityImpact;
}

export const ImpactDetail: React.FC<ImpactDetailProps> = ({ impact }) => {
  const { state } = useFlood();
  const [copied, setCopied] = useState(false);

  const coordStr = `${impact.coordinates[1].toFixed(5)}, ${impact.coordinates[0].toFixed(5)}`;

  const handleCopyCoord = () => {
    navigator.clipboard.writeText(coordStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-2 rounded-lg border border-border p-3.5 space-y-3 font-sans text-paper">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface border border-border text-signal">
              RANK #{impact.rank}
            </span>
            <ProvenanceChip provenance={state.provenance} size="sm" />
            <h4 className="font-heading font-bold text-base tracking-tight text-paper">
              {impact.communityName}
            </h4>
          </div>
          <button
            onClick={handleCopyCoord}
            className="flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-signal transition-colors mt-1"
            title="Copy coordinates"
          >
            <Compass className="w-3 h-3 text-signal" />
            <span>{coordStr}</span>
            {copied ? (
              <Check className="w-3 h-3 text-ok" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Priority Score badge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono text-muted">Priority Score</span>
          <span className="font-mono font-bold text-lg text-signal">
            {impact.score.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Status Banner */}
      {impact.isolated ? (
        <div className="flex items-center gap-2 p-2.5 rounded bg-urgent/15 border border-urgent/30 text-urgent text-xs font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>ROAD ISOLATION DETECTED: Cut off from nearest emergency medical facilities.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded bg-ok/15 border border-ok/30 text-ok text-xs font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Passable route available ({((impact.routeLengthM ?? 0) / 1000).toFixed(1)} km to {impact.nearestFacilityName ?? 'facility'}).
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-surface/80 p-2 rounded border border-border/50">
          <div className="flex items-center gap-1 text-muted text-[10px]">
            <Users className="w-3 h-3 text-signal" />
            <span>POPULATION</span>
          </div>
          <span className="font-mono font-bold text-paper text-sm">
            {impact.populationAtRisk.toLocaleString()}
          </span>
        </div>

        <div className="bg-surface/80 p-2 rounded border border-border/50">
          <div className="flex items-center gap-1 text-muted text-[10px]">
            <Flame className="w-3 h-3 text-caution" />
            <span>URGENCY</span>
          </div>
          <span className="font-mono font-bold text-paper text-sm">
            {impact.urgency} / 5
          </span>
        </div>

        <div className="bg-surface/80 p-2 rounded border border-border/50">
          <div className="flex items-center gap-1 text-muted text-[10px]">
            <Hospital className="w-3 h-3 text-ok" />
            <span>NEAREST</span>
          </div>
          <span className="font-mono text-paper text-xs truncate block" title={impact.nearestFacilityName}>
            {impact.nearestFacilityName ?? 'None'}
          </span>
        </div>
      </div>

      {/* Explainable Reasons */}
      <div>
        <h5 className="font-heading font-semibold text-xs text-signal flex items-center gap-1.5 mb-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          Transparent Ranking Rationale
        </h5>
        <ul className="space-y-1.5 text-xs text-paper/90 bg-surface/60 p-2.5 rounded border border-border/50">
          {impact.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-1.5 leading-snug">
              <span className="text-signal font-mono text-[10px] mt-0.5">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Verification footer */}
      <div className="text-[10px] text-muted font-mono bg-surface/30 px-2.5 py-1.5 rounded border border-border/30">
        ⚠ Verify access with aerial recon or forward reconnaissance before team deployment.
      </div>
    </div>
  );
};
