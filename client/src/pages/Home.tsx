import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ListOrdered,
  Map as MapIcon,
} from 'lucide-react';
import { FloodOneLogo } from '../components/brand/FloodOneLogo';
import { CaveatBanner } from '../components/flood/CaveatBanner';
import { FloodMap } from '../components/map/FloodMap';
import { QueueList } from '../components/flood/QueueList';
import { ThresholdControl } from '../components/flood/ThresholdControl';
import { ImportPanel } from '../components/flood/ImportPanel';
import { ExportDialog } from '../components/flood/ExportDialog';
import { HelpModal } from '../components/flood/HelpModal';
import { useFlood } from '../features/flood/store';

export const Home: React.FC = () => {
  const { state, resetToSynthetic } = useFlood();
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'queue'>('map');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-paper relative">
      {/* Accessible Skip Links for Keyboard Users (WCAG 2.1 AA) */}
      <a
        href="#flood-map-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-signal focus:text-bg focus:font-bold focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to map
      </a>
      <a
        href="#response-queue-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-32 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-signal focus:text-bg focus:font-bold focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to response queue
      </a>

      {/* Screen Reader Analysis Status Announcer (aria-live="polite") */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.isAnalyzing
          ? 'Running flood impact and isolation analysis...'
          : state.result
          ? `Analysis updated. ${state.result.impacts.filter((i) => i.isolated).length} communities isolated.`
          : ''}
      </div>

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border z-20 flex-shrink-0">
        <FloodOneLogo size={34} />

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {/* Practice scenario reload button */}
          <button
            onClick={() => resetToSynthetic()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-2/80 border border-border text-xs text-muted hover:text-paper font-medium transition-colors"
            title="Reload synthetic practice scenario"
          >
            <RotateCcw className="w-3.5 h-3.5 text-caution" />
            <span>Practice Scenario</span>
          </button>

          {/* Import Data button */}
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-2/80 border border-signal/40 text-xs text-signal font-medium transition-all hover:scale-[1.02]"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Data</span>
          </button>

          {/* Export Results button */}
          <button
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-signal text-bg hover:bg-signal/90 text-xs font-bold transition-all shadow-sm shadow-signal/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {/* Methodology Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-1.5 rounded-md text-muted hover:text-paper hover:bg-surface-2 transition-colors"
            title="Scientific Methodology & Guide"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Persistent Caveat Banner */}
      <CaveatBanner />

      {/* Main Mission Control Body */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Mobile View Toggle Switch (< 768px) */}
        <div className="md:hidden absolute top-2 right-2 z-30 flex items-center bg-surface/90 backdrop-blur-md p-1 rounded-lg border border-border shadow-lg">
          <button
            onClick={() => setMobileTab('map')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
              mobileTab === 'map' ? 'bg-signal text-bg font-bold' : 'text-muted'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
          <button
            onClick={() => setMobileTab('queue')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
              mobileTab === 'queue' ? 'bg-signal text-bg font-bold' : 'text-muted'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Queue</span>
          </button>
        </div>

        {/* Center: Map Area */}
        <main
          className={`flex-1 h-full relative transition-all ${
            mobileTab === 'queue' ? 'hidden md:block' : 'block'
          }`}
        >
          <FloodMap />
        </main>

        {/* Right Panel: Ranked Response Queue */}
        <aside
          id="response-queue-panel"
          className={`w-full md:w-[380px] lg:w-[420px] h-full flex-shrink-0 z-10 transition-all ${
            mobileTab === 'map' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <QueueList />
        </aside>
      </div>

      {/* Bottom Bar: Live Threshold Slider & Metrics Strip */}
      <footer className="flex-shrink-0 z-20">
        <ThresholdControl />
      </footer>

      {/* Modal: Data Import */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border-strong rounded-xl max-w-3xl w-full shadow-2xl relative">
            <ImportPanel onClose={() => setShowImport(false)} />
          </div>
        </div>
      )}

      {/* Modal: Export */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {/* Modal: Scientific Methodology & Help */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};
