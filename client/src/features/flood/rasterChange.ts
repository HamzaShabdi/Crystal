import { AnalysisParams, FloodMask, RawRasterBuffer } from './types';

export function computeRasterChange(
  preRaster: RawRasterBuffer,
  postRaster: RawRasterBuffer,
  params: AnalysisParams
): FloodMask {
  const { width, height, bbox } = preRaster;
  const numPixels = width * height;

  if (postRaster.width !== width || postRaster.height !== height) {
    throw new Error(
      `Dimension mismatch: Pre (${width}x${height}) vs Post (${postRaster.width}x${postRaster.height})`
    );
  }

  const preRaw = preRaster.data;
  const postRaw = postRaster.data;
  const noDataPre = preRaster.noData ?? -9999;
  const noDataPost = postRaster.noData ?? -9999;

  // Convert linear power to dB if detected (linear values typically > 0 and mean > 20)
  const isPreLinear = checkIfLinear(preRaw, noDataPre);
  const isPostLinear = checkIfLinear(postRaw, noDataPost);

  const preDb = new Float32Array(numPixels);
  const postDb = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const valPre = preRaw[i];
    const valPost = postRaw[i];

    if (valPre === noDataPre || Number.isNaN(valPre) || (isPreLinear && valPre <= 0)) {
      preDb[i] = NaN;
    } else {
      preDb[i] = isPreLinear ? 10 * Math.log10(valPre) : valPre;
    }

    if (valPost === noDataPost || Number.isNaN(valPost) || (isPostLinear && valPost <= 0)) {
      postDb[i] = NaN;
    } else {
      postDb[i] = isPostLinear ? 10 * Math.log10(valPost) : valPost;
    }
  }

  // Optional 3x3 median filtering to suppress radar speckle
  const filteredPost = params.speckleFilter
    ? apply3x3MedianFilter(postDb, width, height)
    : postDb;

  const maskData = new Uint8Array(numPixels);
  let floodedCount = 0;
  let validCount = 0;

  for (let i = 0; i < numPixels; i++) {
    const pPre = preDb[i];
    const pPost = filteredPost[i];

    if (Number.isNaN(pPre) || Number.isNaN(pPost)) {
      maskData[i] = 0;
      continue;
    }

    validCount++;
    const diff = pPost - pPre; // Negative value indicates drop in backscatter (smooth water)

    // A candidate flood pixel has backscatter drop <= thresholdDb (e.g. -3 dB)
    // AND post backscatter is below the water ceiling (e.g. -15 dB) to prevent false hits on rough targets
    const meetsDrop = diff <= params.thresholdDb;
    const meetsCeiling = pPost <= params.waterCeilingDb;

    if (meetsDrop && meetsCeiling) {
      maskData[i] = 1;
      floodedCount++;
    } else {
      maskData[i] = 0;
    }
  }

  const floodedFraction = validCount > 0 ? floodedCount / validCount : 0;

  return {
    width,
    height,
    bbox,
    data: maskData,
    floodedFraction,
    floodedPixelCount: floodedCount,
  };
}

function checkIfLinear(data: Float32Array, noData: number): boolean {
  // Sample up to 500 valid pixels
  let sampleCount = 0;
  let sampleSum = 0;
  const step = Math.max(1, Math.floor(data.length / 500));

  for (let i = 0; i < data.length && sampleCount < 500; i += step) {
    const val = data[i];
    if (val !== noData && !Number.isNaN(val)) {
      sampleSum += val;
      sampleCount++;
    }
  }

  if (sampleCount === 0) return false;
  const mean = sampleSum / sampleCount;
  // Synthetic/calibrated SAR dB is negative (e.g. -25 to -5 dB). Linear SAR is positive (e.g. 50 to 5000)
  return mean > 10;
}

function apply3x3MedianFilter(
  data: Float32Array,
  width: number,
  height: number
): Float32Array {
  const result = new Float32Array(data.length);
  const window = new Float32Array(9);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (Number.isNaN(data[idx])) {
        result[idx] = NaN;
        continue;
      }

      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const val = data[ny * width + nx];
          if (!Number.isNaN(val)) {
            window[count++] = val;
          }
        }
      }

      if (count === 0) {
        result[idx] = data[idx];
      } else {
        // Find median of the valid elements
        const subarray = window.subarray(0, count);
        subarray.sort();
        result[idx] = subarray[Math.floor(count / 2)];
      }
    }
  }

  return result;
}
