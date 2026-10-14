import { FloodMask, RoadSegment } from './types';
import RBush from 'rbush';

interface RoadBBoxItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  road: RoadSegment;
}

export function computeRoadImpacts(
  roads: RoadSegment[],
  mask: FloodMask,
  minOverlapFraction: number
): { impassableRoadIds: string[]; roadOverlaps: Map<string, number> } {
  const { width, height, bbox, data } = mask;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  if (lngSpan <= 0 || latSpan <= 0 || width <= 0 || height <= 0) {
    return { impassableRoadIds: [], roadOverlaps: new Map() };
  }

  // Pixel resolution in degrees
  const pixelDx = lngSpan / width;
  const pixelDy = latSpan / height;

  // Build RBush index over all road segments
  const tree = new RBush<RoadBBoxItem>();
  const items: RoadBBoxItem[] = [];

  for (const road of roads) {
    const coords = road.geometry.coordinates;
    let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
    for (const pt of coords) {
      if (pt[0] < rMinX) rMinX = pt[0];
      if (pt[0] > rMaxX) rMaxX = pt[0];
      if (pt[1] < rMinY) rMinY = pt[1];
      if (pt[1] > rMaxY) rMaxY = pt[1];
    }
    items.push({
      minX: rMinX,
      minY: rMinY,
      maxX: rMaxX,
      maxY: rMaxY,
      road,
    });
  }

  tree.load(items);

  // Search roads overlapping flood raster bounds
  const candidateRoads = tree.search({
    minX: minLng,
    minY: minLat,
    maxX: maxLng,
    maxY: maxLat,
  });

  const impassableIds: string[] = [];
  const roadOverlaps = new Map<string, number>();

  for (const item of candidateRoads) {
    const road = item.road;
    const coords = road.geometry.coordinates;
    if (coords.length < 2) continue;

    let totalSamples = 0;
    let floodedSamples = 0;

    // Sample along each segment of the LineString
    for (let c = 0; c < coords.length - 1; c++) {
      const p1 = coords[c];
      const p2 = coords[c + 1];

      const segDx = p2[0] - p1[0];
      const segDy = p2[1] - p1[1];
      const distDeg = Math.hypot(segDx, segDy);
      // Sample step is roughly half a pixel resolution
      const stepDeg = Math.max(0.00005, Math.min(pixelDx, pixelDy) * 0.7);
      const numSteps = Math.max(2, Math.ceil(distDeg / stepDeg));

      for (let s = 0; s <= numSteps; s++) {
        const t = s / numSteps;
        const sLng = p1[0] + t * segDx;
        const sLat = p1[1] + t * segDy;

        if (sLng >= minLng && sLng <= maxLng && sLat >= minLat && sLat <= maxLat) {
          totalSamples++;
          // Raster grid coordinates (0,0 is top-left in standard imagery)
          const px = Math.floor(((sLng - minLng) / lngSpan) * width);
          const py = Math.floor(((maxLat - sLat) / latSpan) * height);

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = py * width + px;
            if (data[idx] === 1) {
              floodedSamples++;
            }
          }
        }
      }
    }

    const overlap = totalSamples > 0 ? floodedSamples / totalSamples : 0;
    roadOverlaps.set(road.id, overlap);

    if (overlap >= minOverlapFraction) {
      impassableIds.push(road.id);
    }
  }

  return { impassableRoadIds: impassableIds, roadOverlaps };
}
