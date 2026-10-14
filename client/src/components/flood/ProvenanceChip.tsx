import React from 'react';
import { Provenance } from '../../features/flood/types';

interface ProvenanceChipProps {
  provenance: Provenance;
  className?: string;
  size?: 'sm' | 'md';
}

export const ProvenanceChip: React.FC<ProvenanceChipProps> = ({
  provenance,
  className = '',
  size = 'sm',
}) => {
  const isSm = size === 'sm';
  const sizeClass = isSm ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (provenance) {
    case 'synthetic':
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-semibold uppercase tracking-wider rounded-full bg-caution/15 text-caution border border-caution/30 select-none ${sizeClass} ${className}`}
          title="Synthetic Practice Data — Generated deterministically for screening demonstration"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
          SYNTHETIC
        </span>
      );
    case 'imported':
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-semibold uppercase tracking-wider rounded-full bg-signal/15 text-signal border border-signal/30 select-none ${sizeClass} ${className}`}
          title="Imported Local Data — Loaded directly from client file buffers"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-signal" />
          IMPORTED
        </span>
      );
    case 'computed':
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-semibold uppercase tracking-wider rounded-full bg-purple-400/15 text-purple-300 border border-purple-400/30 select-none ${sizeClass} ${className}`}
          title="Computed Analysis Output"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          COMPUTED
        </span>
      );
  }
};
