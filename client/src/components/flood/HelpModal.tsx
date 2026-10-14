import React from 'react';
import { HelpCircle, X, Shield, Activity, Compass, FileCheck } from 'lucide-react';
import { RADAR_CAVEATS } from '../../features/flood/constants';

export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-border-strong rounded-xl max-w-2xl w-full p-6 text-paper shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-paper p-1 rounded-md hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-border pb-3">
          <HelpCircle className="w-5 h-5 text-signal" />
          <h2 className="font-heading font-bold text-lg text-paper">
            FloodOne Methodology & Scientific Foundations
          </h2>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-paper/90 font-sans">
          {/* Section 1: Vision */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-signal mb-1">
              1. The Problem We Solve
            </h3>
            <p className="text-muted">
              After a severe flood event, disaster responders know roughly where the water is, but almost never know <em>which communities have lost vehicular access to a hospital or shelter</em>. Satellite change maps stop at &quot;water here&quot;. FloodOne turns raw Sentinel-1 radar change signals into an explainable rescue-priority queue answering <strong>who is cut off and who to reach first</strong>.
            </p>
          </div>

          {/* Section 2: Four-Stage Engine */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-signal mb-1">
              2. Four-Stage Deterministic Pipeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="bg-surface-2/60 p-2.5 rounded border border-border/50">
                <span className="font-mono text-signal font-bold block mb-0.5">Stage 1: SAR Change Mask</span>
                <span>Computes differential backscatter (Post_dB − Pre_dB). Specular reflection over open water creates a pronounced backscatter drop (&le; −3 dB default).</span>
              </div>
              <div className="bg-surface-2/60 p-2.5 rounded border border-border/50">
                <span className="font-mono text-signal font-bold block mb-0.5">Stage 2: Road Submergence</span>
                <span>Samples road geometries using an RBush spatial index. Segments with flooded fraction &ge; 30% are marked impassable.</span>
              </div>
              <div className="bg-surface-2/60 p-2.5 rounded border border-border/50">
                <span className="font-mono text-signal font-bold block mb-0.5">Stage 3: Graph Reachability</span>
                <span>Runs multi-source Dijkstra from all district hospitals and shelters over passable edges to identify completely isolated clusters.</span>
              </div>
              <div className="bg-surface-2/60 p-2.5 rounded border border-border/50">
                <span className="font-mono text-signal font-bold block mb-0.5">Stage 4: Explainable Queue</span>
                <span>Calculates weighted priority scores: <code className="text-signal font-mono font-bold">score = wP&middot;norm(pop) + wU&middot;norm(urg) + wD&middot;norm(dist) + ISOLATION_BONUS</code>.</span>
              </div>
            </div>
          </div>

          {/* Section 3: Scientific Caveats */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-caution mb-1">
              3. Operational Honesty & Caveats
            </h3>
            <ul className="space-y-1 bg-surface-2/40 p-3 rounded border border-border/40 text-muted">
              {RADAR_CAVEATS.map((c, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-caution font-mono">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-signal text-bg font-bold rounded-lg hover:bg-signal/90 text-xs transition-colors"
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
