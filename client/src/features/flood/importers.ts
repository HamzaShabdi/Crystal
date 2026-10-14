import * as GeoTIFF from 'geotiff';
import proj4 from 'proj4';
import { MAX_RASTER_PIXELS } from './constants';
import { RasterMeta, RawRasterBuffer, ValidationIssue } from './types';

export interface GeoTIFFImportResult {
  ok: boolean;
  meta?: RasterMeta;
  buffer?: RawRasterBuffer;
  issues: ValidationIssue[];
}

export async function parseGeoTIFFFile(
  file: File | Blob,
  filename: string
): Promise<GeoTIFFImportResult> {
  const issues: ValidationIssue[] = [];

  try {
    const tiff = await GeoTIFF.fromBlob(file);
    const image = await tiff.getImage();

    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const geoKeys = image.getGeoKeys();
    const fileBbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]
    const resolution = image.getResolution();
    const noData = image.getGDALNoData();

    // Check size guard
    let downsampleFactor = 1;
    const totalPixels = width * height;
    if (totalPixels > MAX_RASTER_PIXELS) {
      downsampleFactor = Math.ceil(Math.sqrt(totalPixels / MAX_RASTER_PIXELS));
      issues.push({
        severity: 'warning',
        file: filename,
        message: `Raster exceeds memory budget (${(totalPixels / 1e6).toFixed(1)} Mpx). Downsampled ${downsampleFactor}×.`,
        fix: 'File was automatically downsampled to prevent browser tab crash.',
      });
    }

    // Determine CRS
    let crsName = 'EPSG:4326';
    let isProjected = false;
    let projDefinition: string | undefined;

    if (geoKeys?.ProjectedCSTypeGeoKey) {
      crsName = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
      isProjected = true;
    } else if (geoKeys?.GeographicTypeGeoKey) {
      crsName = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
    }

    // Convert Bbox to WGS84 if projected
    let wgs84Bbox: [number, number, number, number] = [
      fileBbox[0],
      fileBbox[1],
      fileBbox[2],
      fileBbox[3],
    ];

    if (isProjected && Math.abs(fileBbox[0]) > 180) {
      try {
        // Attempt proj4 transform
        const pMin = proj4(crsName, 'EPSG:4326', [fileBbox[0], fileBbox[1]]);
        const pMax = proj4(crsName, 'EPSG:4326', [fileBbox[2], fileBbox[3]]);
        wgs84Bbox = [pMin[0], pMin[1], pMax[0], pMax[1]];
      } catch {
        // Fallback or warning
        issues.push({
          severity: 'warning',
          file: filename,
          message: `Could not directly reproject ${crsName} bounds to WGS84. Verify coordinates.`,
          fix: 'Export your GeoTIFF with EPSG:4326 in QGIS or GDAL.',
        });
      }
    }

    // Read raster values (First band = VV or VH)
    const rasters = await image.readRasters({
      samples: [0],
      interleave: false,
    });

    const rawArray = rasters[0] as unknown as Float32Array | Float64Array | Uint16Array | Int16Array;
    let finalWidth = width;
    let finalHeight = height;
    let finalData: Float32Array;

    if (downsampleFactor > 1) {
      finalWidth = Math.floor(width / downsampleFactor);
      finalHeight = Math.floor(height / downsampleFactor);
      finalData = new Float32Array(finalWidth * finalHeight);

      for (let y = 0; y < finalHeight; y++) {
        for (let x = 0; x < finalWidth; x++) {
          const srcIdx = y * downsampleFactor * width + x * downsampleFactor;
          finalData[y * finalWidth + x] = Number(rawArray[srcIdx]);
        }
      }
    } else {
      finalData = new Float32Array(rawArray.length);
      for (let i = 0; i < rawArray.length; i++) {
        finalData[i] = Number(rawArray[i]);
      }
    }

    const meta: RasterMeta = {
      width: finalWidth,
      height: finalHeight,
      bands: samplesPerPixel,
      bbox: wgs84Bbox,
      pixelSize: [Math.abs(resolution[0] * downsampleFactor), Math.abs(resolution[1] * downsampleFactor)],
      crs: crsName,
      noData: noData ?? null,
      source: filename,
      provenance: 'imported',
    };

    const buffer: RawRasterBuffer = {
      width: finalWidth,
      height: finalHeight,
      bbox: wgs84Bbox,
      crs: crsName,
      data: finalData,
      noData: noData ?? null,
      provenance: 'imported',
    };

    return {
      ok: true,
      meta,
      buffer,
      issues,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          file: filename,
          message: `GeoTIFF parsing failed: ${errorMsg}`,
          fix: 'Verify the file is an uncorrupted Cloud Optimized GeoTIFF (COG) or standard GeoTIFF.',
        },
      ],
    };
  }
}

export function validateRasterPairCompatibility(
  preMeta: RasterMeta,
  postMeta: RasterMeta
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (preMeta.width !== postMeta.width || preMeta.height !== postMeta.height) {
    issues.push({
      severity: 'error',
      file: 'raster-pair',
      message: `Grid dimension mismatch: Pre is ${preMeta.width}×${preMeta.height} px while Post is ${postMeta.width}×${postMeta.height} px.`,
      fix: 'Both Sentinel-1 GeoTIFFs must be resampled/clipped to identical pixel grids.',
    });
  }

  // Check CRS match
  if (preMeta.crs !== postMeta.crs) {
    issues.push({
      severity: 'error',
      file: 'raster-pair',
      message: `Coordinate reference system mismatch: Pre is ${preMeta.crs} while Post is ${postMeta.crs}.`,
      fix: 'Reproject both images to the same CRS (preferably EPSG:4326 or same UTM zone).',
    });
  }

  // Check BBox alignment (must be within ~0.5 pixel)
  const dXMin = Math.abs(preMeta.bbox[0] - postMeta.bbox[0]);
  const dYMin = Math.abs(preMeta.bbox[1] - postMeta.bbox[1]);
  const tolerance = Math.max(preMeta.pixelSize[0], postMeta.pixelSize[0]) * 1.5;

  if (dXMin > tolerance || dYMin > tolerance) {
    issues.push({
      severity: 'warning',
      file: 'raster-pair',
      message: 'Pre and post images cover slightly different bounding extents.',
      fix: 'Clip both images to the exact same AOI bounding box before upload.',
    });
  }

  return issues;
}
