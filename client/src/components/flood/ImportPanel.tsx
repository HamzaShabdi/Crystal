import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useFlood } from '../../features/flood/store';
import { parseGeoTIFFFile, validateRasterPairCompatibility } from '../../features/flood/importers';
import { validateGeoJSON } from '../../features/flood/validation';
import {
  RasterMeta,
  RawRasterBuffer,
  RoadSegment,
  Community,
  Facility,
  ValidationIssue,
} from '../../features/flood/types';

export const ImportPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, dispatch, resetToSynthetic } = useFlood();

  const [preBuffer, setPreBuffer] = useState<RawRasterBuffer | null>(null);
  const [preMeta, setPreMeta] = useState<RasterMeta | null>(null);
  const [postBuffer, setPostBuffer] = useState<RawRasterBuffer | null>(null);
  const [postMeta, setPostMeta] = useState<RasterMeta | null>(null);

  const [roads, setRoads] = useState<RoadSegment[] | null>(null);
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [facilities, setFacilities] = useState<Facility[] | null>(null);

  const [allIssues, setAllIssues] = useState<ValidationIssue[]>([]);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  // Handle GeoTIFF file upload
  const handleGeoTiffUpload = async (file: File, kind: 'pre' | 'post') => {
    setLoadingFile(`${kind}-${file.name}`);
    try {
      const res = await parseGeoTIFFFile(file, file.name);
      if (res.ok && res.buffer && res.meta) {
        if (kind === 'pre') {
          setPreBuffer(res.buffer);
          setPreMeta(res.meta);
        } else {
          setPostBuffer(res.buffer);
          setPostMeta(res.meta);
        }
      }
      setAllIssues((prev) => [...prev, ...res.issues]);
    } finally {
      setLoadingFile(null);
    }
  };

  // Handle GeoJSON file upload
  const handleGeoJSONUpload = async (
    file: File,
    kind: 'roads' | 'communities' | 'facilities'
  ) => {
    setLoadingFile(`${kind}-${file.name}`);
    try {
      const text = await file.text();
      const res = validateGeoJSON(text, kind);

      if (res.roads) setRoads(res.roads);
      if (res.communities) setCommunities(res.communities);
      if (res.facilities) setFacilities(res.facilities);

      setAllIssues((prev) => [...prev, ...res.issues]);
    } finally {
      setLoadingFile(null);
    }
  };

  // Run compatibility check whenever both rasters are loaded
  const checkCompatibility = () => {
    if (preMeta && postMeta) {
      const issues = validateRasterPairCompatibility(preMeta, postMeta);
      return issues;
    }
    return [];
  };

  const compatIssues = checkCompatibility();

  const canApply =
    (preBuffer && postBuffer) || (roads && communities && facilities);

  const handleApplyData = () => {
    dispatch({
      type: 'SET_IMPORTED_DATA',
      payload: {
        preRaster: preBuffer ?? state.preRaster,
        postRaster: postBuffer ?? state.postRaster,
        vectors: {
          roads: roads ?? state.vectors.roads,
          communities: communities ?? state.vectors.communities,
          facilities: facilities ?? state.vectors.facilities,
          provenance: 'imported',
        },
        issues: [...allIssues, ...compatIssues],
      },
    });
    onClose();
  };

  return (
    <div className="p-5 space-y-5 text-paper font-sans max-h-[85vh] overflow-y-auto">
      {/* Title & Reset to Practice */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="font-heading font-bold text-lg text-paper">
            Import Operational Data
          </h3>
          <p className="text-xs text-muted">
            All files are parsed locally in browser memory. Zero remote upload.
          </p>
        </div>

        <button
          onClick={() => {
            resetToSynthetic();
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-2 hover:bg-surface border border-border text-xs text-signal transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Practice Scenario</span>
        </button>
      </div>

      {/* Grid: Imagery vs Vectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Section 1: Satellite SAR Imagery */}
        <div className="space-y-3 bg-surface p-4 rounded-lg border border-border">
          <h4 className="font-heading font-semibold text-sm text-signal flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4" />
            Sentinel-1 SAR GeoTIFF Pair
          </h4>

          {/* Pre-Flood Image Dropzone */}
          <div className="border border-dashed border-border hover:border-signal/50 rounded-lg p-3 text-center transition-colors bg-surface-2/40">
            <input
              type="file"
              accept=".tif,.tiff"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGeoTiffUpload(f, 'pre');
              }}
              className="hidden"
              id="pre-tiff-input"
            />
            <label htmlFor="pre-tiff-input" className="cursor-pointer block">
              <span className="text-xs font-semibold block text-paper">
                Pre-Flood Baseline GeoTIFF
              </span>
              <span className="text-[11px] text-muted block mt-0.5">
                {preMeta
                  ? `✔ Loaded: ${preMeta.source} (${preMeta.width}×${preMeta.height} px, ${preMeta.crs})`
                  : 'Click or drop pre-disaster Sentinel-1 GeoTIFF'}
              </span>
            </label>
          </div>

          {/* Post-Flood Image Dropzone */}
          <div className="border border-dashed border-border hover:border-signal/50 rounded-lg p-3 text-center transition-colors bg-surface-2/40">
            <input
              type="file"
              accept=".tif,.tiff"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGeoTiffUpload(f, 'post');
              }}
              className="hidden"
              id="post-tiff-input"
            />
            <label htmlFor="post-tiff-input" className="cursor-pointer block">
              <span className="text-xs font-semibold block text-paper">
                Post-Flood Event GeoTIFF
              </span>
              <span className="text-[11px] text-muted block mt-0.5">
                {postMeta
                  ? `✔ Loaded: ${postMeta.source} (${postMeta.width}×${postMeta.height} px, ${postMeta.crs})`
                  : 'Click or drop post-disaster Sentinel-1 GeoTIFF'}
              </span>
            </label>
          </div>

          {/* Compatibility Banner */}
          {compatIssues.length > 0 && (
            <div className="p-2.5 rounded bg-urgent/15 border border-urgent/30 text-urgent text-xs space-y-1">
              {compatIssues.map((iss, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{iss.message}</span>
                    <span className="block text-[11px] opacity-90">{iss.fix}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: GeoJSON Vectors */}
        <div className="space-y-3 bg-surface p-4 rounded-lg border border-border">
          <h4 className="font-heading font-semibold text-sm text-signal flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Infrastructure & Settlement GeoJSON
          </h4>

          {/* Roads input */}
          <div className="border border-dashed border-border hover:border-signal/50 rounded-lg p-2.5 text-center transition-colors bg-surface-2/40">
            <input
              type="file"
              accept=".json,.geojson"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGeoJSONUpload(f, 'roads');
              }}
              className="hidden"
              id="roads-geojson-input"
            />
            <label htmlFor="roads-geojson-input" className="cursor-pointer block">
              <span className="text-xs font-semibold block text-paper">Roads (LineString)</span>
              <span className="text-[11px] text-muted block">
                {roads ? `✔ ${roads.length} road segments verified` : 'Upload roads.geojson'}
              </span>
            </label>
          </div>

          {/* Communities input */}
          <div className="border border-dashed border-border hover:border-signal/50 rounded-lg p-2.5 text-center transition-colors bg-surface-2/40">
            <input
              type="file"
              accept=".json,.geojson"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGeoJSONUpload(f, 'communities');
              }}
              className="hidden"
              id="comm-geojson-input"
            />
            <label htmlFor="comm-geojson-input" className="cursor-pointer block">
              <span className="text-xs font-semibold block text-paper">Communities (Point)</span>
              <span className="text-[11px] text-muted block">
                {communities
                  ? `✔ ${communities.length} communities verified`
                  : 'Upload communities.geojson (population, urgency)'}
              </span>
            </label>
          </div>

          {/* Facilities input */}
          <div className="border border-dashed border-border hover:border-signal/50 rounded-lg p-2.5 text-center transition-colors bg-surface-2/40">
            <input
              type="file"
              accept=".json,.geojson"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGeoJSONUpload(f, 'facilities');
              }}
              className="hidden"
              id="fac-geojson-input"
            />
            <label htmlFor="fac-geojson-input" className="cursor-pointer block">
              <span className="text-xs font-semibold block text-paper">Facilities (Hospitals / Shelters)</span>
              <span className="text-[11px] text-muted block">
                {facilities
                  ? `✔ ${facilities.length} emergency facilities verified`
                  : 'Upload facilities.geojson (hospitals, shelters)'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Issues & Warnings List */}
      {allIssues.length > 0 && (
        <div className="bg-surface p-4 rounded-lg border border-border space-y-2">
          <h4 className="font-heading font-semibold text-xs text-caution flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            File Validation Diagnostics ({allIssues.length})
          </h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
            {allIssues.map((iss, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-surface-2/70 border border-border/50 flex items-start justify-between gap-2"
              >
                <div>
                  <span className="font-mono text-[10px] text-signal uppercase block">
                    [{iss.file}]
                  </span>
                  <span className="text-paper">{iss.message}</span>
                  <span className="text-muted block text-[11px] mt-0.5">
                    💡 Fix: {iss.fix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-surface-2 hover:bg-surface border border-border text-xs text-muted hover:text-paper transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApplyData}
          disabled={!canApply}
          className={`px-5 py-2 rounded font-medium text-xs flex items-center gap-2 transition-all ${
            canApply
              ? 'bg-signal text-bg font-bold hover:bg-signal/90 shadow-md shadow-signal/20'
              : 'bg-surface-2 text-muted/40 cursor-not-allowed border border-border'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Apply Custom Data & Run Analysis</span>
        </button>
      </div>
    </div>
  );
};
