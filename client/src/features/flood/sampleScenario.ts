import { Community, Facility, RoadSegment, RawRasterBuffer, VectorDatasets } from './types';

// Deterministic 32-bit PRNG (mulberry32)
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticScenarioData {
  vectors: VectorDatasets;
  preRaster: RawRasterBuffer;
  postRaster: RawRasterBuffer;
  center: [number, number];
  bbox: [number, number, number, number];
}

export function generateSyntheticScenario(seed = 4242): SyntheticScenarioData {
  const rand = mulberry32(seed);

  // Center coordinate: fictional delta river valley
  const centerLng = 75.320;
  const centerLat = 19.850;
  const span = 0.11; // ~12 km

  const minX = centerLng - span / 2;
  const maxX = centerLng + span / 2;
  const minY = centerLat - span / 2;
  const maxY = centerLat + span / 2;
  const bbox: [number, number, number, number] = [minX, minY, maxX, maxY];

  // 1. Facilities
  const facilities: Facility[] = [
    {
      id: 'fac-hosp-1',
      name: 'Kasa District Hospital',
      kind: 'hospital',
      geometry: {
        type: 'Point',
        coordinates: [centerLng + 0.032, centerLat + 0.028],
      },
      provenance: 'synthetic',
    },
    {
      id: 'fac-hosp-2',
      name: 'Valley General Medical Center',
      kind: 'hospital',
      geometry: {
        type: 'Point',
        coordinates: [centerLng - 0.038, centerLat - 0.032],
      },
      provenance: 'synthetic',
    },
    {
      id: 'fac-shelt-1',
      name: 'Civic Stadium Relief Shelter',
      kind: 'shelter',
      geometry: {
        type: 'Point',
        coordinates: [centerLng + 0.036, centerLat - 0.025],
      },
      provenance: 'synthetic',
    },
    {
      id: 'fac-shelt-2',
      name: 'North Highland Emergency Camp',
      kind: 'shelter',
      geometry: {
        type: 'Point',
        coordinates: [centerLng - 0.028, centerLat + 0.035],
      },
      provenance: 'synthetic',
    },
  ];

  // 2. Communities with populations and urgency ratings
  const communities: Community[] = [
    {
      id: 'comm-1',
      name: 'Kasa Riverside',
      geometry: { type: 'Point', coordinates: [centerLng - 0.012, centerLat + 0.005] },
      population: 4200,
      urgency: 4,
      provenance: 'synthetic',
    },
    {
      id: 'comm-2',
      name: 'Rampur Delta',
      geometry: { type: 'Point', coordinates: [centerLng + 0.005, centerLat - 0.008] },
      population: 2900,
      urgency: 5,
      provenance: 'synthetic',
    },
    {
      id: 'comm-3',
      name: 'Nandgaon East',
      geometry: { type: 'Point', coordinates: [centerLng + 0.040, centerLat + 0.015] },
      population: 1100,
      urgency: 2,
      provenance: 'synthetic',
    },
    {
      id: 'comm-4',
      name: 'Bhilwadi Island',
      geometry: { type: 'Point', coordinates: [centerLng - 0.008, centerLat - 0.018] },
      population: 3400,
      urgency: 5,
      provenance: 'synthetic',
    },
    {
      id: 'comm-5',
      name: 'Shivpuri Heights',
      geometry: { type: 'Point', coordinates: [centerLng - 0.042, centerLat + 0.028] },
      population: 1850,
      urgency: 3,
      provenance: 'synthetic',
    },
    {
      id: 'comm-6',
      name: 'Deolali Settlement',
      geometry: { type: 'Point', coordinates: [centerLng + 0.018, centerLat + 0.022] },
      population: 950,
      urgency: 2,
      provenance: 'synthetic',
    },
    {
      id: 'comm-7',
      name: 'Talwandi Lowlands',
      geometry: { type: 'Point', coordinates: [centerLng - 0.020, centerLat - 0.002] },
      population: 5200,
      urgency: 4,
      provenance: 'synthetic',
    },
    {
      id: 'comm-8',
      name: 'Anandpur Crossing',
      geometry: { type: 'Point', coordinates: [centerLng + 0.024, centerLat - 0.035] },
      population: 2300,
      urgency: 1,
      provenance: 'synthetic',
    },
    {
      id: 'comm-9',
      name: 'Miraj Valley Ward',
      geometry: { type: 'Point', coordinates: [centerLng - 0.035, centerLat - 0.020] },
      population: 3100,
      urgency: 3,
      provenance: 'synthetic',
    },
    {
      id: 'comm-10',
      name: 'Vadgaon Hills',
      geometry: { type: 'Point', coordinates: [centerLng + 0.030, centerLat + 0.042] },
      population: 820,
      urgency: 1,
      provenance: 'synthetic',
    },
  ];

  // 3. Grid road network with bridges across river
  const roads: RoadSegment[] = [];
  let roadIdCounter = 1;

  // Grid steps (approx 8x8 main corridors)
  const steps = 7;
  const xStep = span / steps;
  const yStep = span / steps;

  // Pre-calculate grid coordinate nodes
  const nodes: [number, number][][] = [];
  for (let i = 0; i <= steps; i++) {
    nodes[i] = [];
    for (let j = 0; j <= steps; j++) {
      const nx = minX + i * xStep + (rand() - 0.5) * 0.003;
      const ny = minY + j * yStep + (rand() - 0.5) * 0.003;
      nodes[i][j] = [nx, ny];
    }
  }

  // Helper to approximate length in meters
  function calcDistM(p1: [number, number], p2: [number, number]): number {
    const dLng = (p2[0] - p1[0]) * 111320 * Math.cos((p1[1] * Math.PI) / 180);
    const dLat = (p2[1] - p1[1]) * 110540;
    return Math.round(Math.hypot(dLng, dLat));
  }

  // Create Horizontal Road Segments
  for (let j = 0; j <= steps; j++) {
    for (let i = 0; i < steps; i++) {
      const p1 = nodes[i][j];
      const p2 = nodes[i + 1][j];
      roads.push({
        id: `road-h-${roadIdCounter++}`,
        geometry: {
          type: 'LineString',
          coordinates: [p1, p2],
        },
        highway: j % 2 === 0 ? 'primary' : 'secondary',
        lengthM: calcDistM(p1, p2),
        provenance: 'synthetic',
      });
    }
  }

  // Create Vertical Road Segments
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j < steps; j++) {
      const p1 = nodes[i][j];
      const p2 = nodes[i][j + 1];
      roads.push({
        id: `road-v-${roadIdCounter++}`,
        geometry: {
          type: 'LineString',
          coordinates: [p1, p2],
        },
        highway: i % 2 === 0 ? 'primary' : 'secondary',
        lengthM: calcDistM(p1, p2),
        provenance: 'synthetic',
      });
    }
  }

  // Connector links to ensure communities and facilities are linked to the closest road nodes
  const allPoints = [...communities, ...facilities];
  allPoints.forEach((pt, idx) => {
    // Find closest node
    let bestDist = Infinity;
    let bestNode: [number, number] = nodes[0][0];
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const d = calcDistM(pt.geometry.coordinates as [number, number], nodes[i][j]);
        if (d < bestDist) {
          bestDist = d;
          bestNode = nodes[i][j];
        }
      }
    }
    roads.push({
      id: `road-conn-${idx + 1}`,
      geometry: {
        type: 'LineString',
        coordinates: [pt.geometry.coordinates as [number, number], bestNode],
      },
      highway: 'service',
      lengthM: bestDist,
      provenance: 'synthetic',
    });
  });

  // 4. Raster generation: 120 x 120 grid
  const rWidth = 120;
  const rHeight = 120;
  const numPixels = rWidth * rHeight;
  const preData = new Float32Array(numPixels);
  const postData = new Float32Array(numPixels);

  // River path: Meanders from top-left (minX + 0.2*span, maxY) to bottom-right (maxX - 0.1*span, minY)
  // Parametric river center line: x(y) = centerLng + 0.02 * sin(8 * (y - minY)/span) - 0.015 * ((y - centerY)/span)
  const pixelDx = span / rWidth;
  const pixelDy = span / rHeight;

  for (let py = 0; py < rHeight; py++) {
    const lat = maxY - py * pixelDy;
    const normY = (lat - minY) / span; // 0 (bottom) to 1 (top)

    // River centerline longitude for this latitude
    const riverLng = centerLng + Math.sin(normY * Math.PI * 2.2) * 0.022 - (normY - 0.5) * 0.025;
    // River width expands in downstream delta (normY < 0.4)
    const floodWidth = normY < 0.45 ? 0.028 : 0.016;

    for (let px = 0; px < rWidth; px++) {
      const idx = py * rWidth + px;
      const lng = minX + px * pixelDx;

      const distToRiver = Math.abs(lng - riverLng);

      // Typical dry baseline backscatter: -10 to -7 dB
      const baseBackscatter = -8.5 + (rand() - 0.5) * 2.2;
      preData[idx] = baseBackscatter;

      if (distToRiver < floodWidth) {
        // Severe flooding: drop by 4 to 8 dB down to -18 to -15 dB specular water
        const floodSeverity = (1 - distToRiver / floodWidth);
        const dropDb = 3.5 + floodSeverity * 4.5 + (rand() - 0.5) * 0.8;
        postData[idx] = Math.min(baseBackscatter - dropDb, -15.5);
      } else if (distToRiver < floodWidth * 1.35 && rand() > 0.45) {
        // Marginal flooded patches / waterlogged fields
        const dropDb = 2.0 + (rand() * 2.0);
        postData[idx] = baseBackscatter - dropDb;
      } else {
        // Normal dry conditions, slight seasonal noise (+/- 0.8 dB)
        postData[idx] = baseBackscatter + (rand() - 0.5) * 1.2;
      }
    }
  }

  const preRaster: RawRasterBuffer = {
    width: rWidth,
    height: rHeight,
    bbox,
    crs: 'EPSG:4326',
    data: preData,
    noData: -9999,
    provenance: 'synthetic',
  };

  const postRaster: RawRasterBuffer = {
    width: rWidth,
    height: rHeight,
    bbox,
    crs: 'EPSG:4326',
    data: postData,
    noData: -9999,
    provenance: 'synthetic',
  };

  return {
    vectors: {
      roads,
      communities,
      facilities,
      provenance: 'synthetic',
    },
    preRaster,
    postRaster,
    center: [centerLng, centerLat],
    bbox,
  };
}
