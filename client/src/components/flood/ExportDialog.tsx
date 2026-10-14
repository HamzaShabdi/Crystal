import React from 'react';
import { Download, FileSpreadsheet, MapPin, X, ShieldAlert, Check } from 'lucide-react';
import { useFlood } from '../../features/flood/store';
import { exportQueueToCsv, exportResultsToGeoJSON } from '../../features/flood/exports';

export const ExportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state } = useFlood();
  const { result, vectors } = state;

  if (!result) return null;

  const handleDownloadCsv = () => {
    exportQueueToCsv(result);
  };

  const handleDownloadGeoJSON = () => {
    exportResultsToGeoJSON(result, vectors.roads, vectors.facilities);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-border-strong rounded-xl max-w-md w-full p-6 text-paper shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-paper p-1 rounded-md hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-border pb-3">
          <Download className="w-5 h-5 text-signal" />
          <h3 className="font-heading font-bold text-lg text-paper">
            Export Screening Results
          </h3>
        </div>

        <div className="space-y-3 font-sans text-xs">
          <p className="text-muted leading-relaxed">
            Exports include all calculated priority scores, cut road statuses, and scientific provenance metadata.
          </p>

          <div className="p-3 rounded bg-surface-2 border border-border space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted">Ranked Communities:</span>
              <span className="text-paper font-bold">{result.impacts.length} entries</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted">Impassable Road Segments:</span>
              <span className="text-urgent font-bold">{result.impassableRoadIds.length} segments</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted">Data Provenance:</span>
              <span className="text-signal uppercase font-bold">{result.provenance}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {/* Download CSV button */}
            <button
              onClick={() => {
                handleDownloadCsv();
                onClose();
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-2 hover:bg-surface-2/80 border border-signal/40 text-paper transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-signal" />
                <div className="text-left">
                  <div className="font-semibold text-xs text-paper">Priority Queue (CSV)</div>
                  <div className="text-[10px] text-muted">Ready for Excel, Google Sheets, LibreOffice</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-signal" />
            </button>

            {/* Download GeoJSON button */}
            <button
              onClick={() => {
                handleDownloadGeoJSON();
                onClose();
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-2 hover:bg-surface-2/80 border border-signal/40 text-paper transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-signal" />
                <div className="text-left">
                  <div className="font-semibold text-xs text-paper">Spatial Layers (GeoJSON)</div>
                  <div className="text-[10px] text-muted">RFC 7946 format for QGIS, ArcGIS, Mapbox</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-signal" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-muted font-mono bg-surface-2/40 p-2 rounded border border-border/40">
          Formula-injection guards active. Cells starting with =, +, -, @ sanitized.
        </div>
      </div>
    </div>
  );
};
