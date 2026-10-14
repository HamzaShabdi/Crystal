import React from 'react';
import { Info } from 'lucide-react';

export const Legend: React.FC = () => {
  return (
    <div className="bg-surface/90 backdrop-blur-md border border-border rounded-lg shadow-xl p-2.5 w-52 text-xs font-sans text-paper select-none">
      <div className="flex items-center gap-1.5 font-heading font-semibold pb-1.5 mb-1.5 border-b border-border/60 text-[11px] text-paper">
        <Info className="w-3 h-3 text-signal" />
        <span>Cartographic Symbology</span>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3 rounded-sm bg-signal/70 border border-signal shadow-sm shadow-signal/30" />
          <span>Candidate Flood (SAR)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-4 h-1 rounded bg-urgent shadow-sm shadow-urgent/40 animate-pulse" />
          <span>Cut / Severed Road</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-4 h-1 rounded bg-muted/80" />
          <span>Passable Transit Road</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-urgent border border-paper" />
          <span>Isolated Settlement</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-signal border border-paper" />
          <span>Accessible Settlement</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs">🏥</span>
          <span>District Hospital</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs">⛺</span>
          <span>Emergency Relief Shelter</span>
        </div>
      </div>
    </div>
  );
};
