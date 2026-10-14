import { AnalysisParams } from './types';

export const DEFAULT_ANALYSIS_PARAMS: AnalysisParams = {
  thresholdDb: -3.0,
  band: 'VV',
  waterCeilingDb: -15.0,
  minOverlapFraction: 0.30,
  snapToleranceM: 50,
  speckleFilter: false,
  weights: {
    population: 0.5,
    urgency: 0.3,
    distance: 0.2,
  },
  isolationBonus: 1.0,
};

export const MAX_RASTER_PIXELS = 25_000_000; // 25 Mpx memory budget
export const MAX_VECTOR_FEATURES = 100_000;
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export const CAVEAT_SCREENING_NOTICE =
  'Candidate change detected — verify before deployment. This exploratory screening signal is derived from SAR backscatter anomalies and does not constitute validated flood truth.';

export const SYNTHETIC_BANNER_TEXT =
  'SYNTHETIC PRACTICE SCENARIO — NOT OBSERVED DATA. For training, demonstration, and interface calibration only.';

export const RADAR_CAVEATS = [
  'Sentinel-1 radar backscatter drop indicates candidate specular reflection over new open water.',
  'Subject to false positives in calm conditions, radar shadows, smooth surfaces, or airport runways.',
  'Subject to false negatives in flooded dense vegetation or urban double-bounce reflections.',
  'Always ground-truth rescue routes before asset dispatch.'
];
