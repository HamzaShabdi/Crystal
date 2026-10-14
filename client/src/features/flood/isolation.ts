import { Community, Facility, RoadSegment } from './types';

export interface RouteReachability {
  isolated: boolean;
  preFloodIsolated: boolean;
  nearestFacilityId?: string;
  nearestFacilityName?: string;
  routeLengthM: number | null;
  noRoadAccessNearby?: boolean;
}

interface GraphEdge {
  targetNodeId: number;
  lengthM: number;
  roadId: string;
}

export function computeIsolation(
  communities: Community[],
  facilities: Facility[],
  roads: RoadSegment[],
  impassableRoadIds: Set<string>,
  snapToleranceM = 50
): Map<string, RouteReachability> {
  const results = new Map<string, RouteReachability>();

  if (facilities.length === 0) {
    // If no facilities are present, mark all as no facilities provided
    for (const comm of communities) {
      results.set(comm.id, {
        isolated: true,
        preFloodIsolated: false,
        routeLengthM: null,
      });
    }
    return results;
  }

  // 1. Build road graph with spatial snap of endpoints
  // Map coordinate [lng, lat] rounded to ~5 meters to Node IDs
  const coordToNodeId = new Map<string, number>();
  const nodeCoords: [number, number][] = [];

  function getOrAddNode(pt: [number, number]): number {
    // Round to 5 decimal places (~1.1 meter precision)
    const key = `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;
    if (coordToNodeId.has(key)) {
      return coordToNodeId.get(key)!;
    }
    const newId = nodeCoords.length;
    coordToNodeId.set(key, newId);
    nodeCoords.push(pt);
    return newId;
  }

  // Passable graph and full (pre-flood) graph
  const passableGraph: GraphEdge[][] = [];
  const fullGraph: GraphEdge[][] = [];

  for (const road of roads) {
    const coords = road.geometry.coordinates;
    if (coords.length < 2) continue;

    const u = getOrAddNode(coords[0] as [number, number]);
    const v = getOrAddNode(coords[coords.length - 1] as [number, number]);

    // Ensure array dimensions
    while (passableGraph.length <= Math.max(u, v)) {
      passableGraph.push([]);
      fullGraph.push([]);
    }

    const length = road.lengthM > 0 ? road.lengthM : 100;
    const isImpassable = impassableRoadIds.has(road.id);

    // Full graph always gets the edge
    fullGraph[u].push({ targetNodeId: v, lengthM: length, roadId: road.id });
    fullGraph[v].push({ targetNodeId: u, lengthM: length, roadId: road.id });

    // Passable graph only gets non-flooded edges
    if (!isImpassable) {
      passableGraph[u].push({ targetNodeId: v, lengthM: length, roadId: road.id });
      passableGraph[v].push({ targetNodeId: u, lengthM: length, roadId: road.id });
    }
  }

  const numNodes = nodeCoords.length;
  if (numNodes === 0) {
    for (const comm of communities) {
      results.set(comm.id, {
        isolated: true,
        preFloodIsolated: true,
        routeLengthM: null,
        noRoadAccessNearby: true,
      });
    }
    return results;
  }

  // Snap a point to nearest graph node
  function snapPoint(pt: [number, number]): { nodeId: number; distM: number } {
    let bestDist = Infinity;
    let bestNode = 0;
    for (let i = 0; i < numNodes; i++) {
      const nc = nodeCoords[i];
      const dLng = (pt[0] - nc[0]) * 111320 * Math.cos((pt[1] * Math.PI) / 180);
      const dLat = (pt[1] - nc[1]) * 110540;
      const dist = Math.hypot(dLng, dLat);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = i;
      }
    }
    return { nodeId: bestNode, distM: bestDist };
  }

  // Map facilities to nodes
  const facilityNodes: { facility: Facility; nodeId: number; distM: number }[] = [];
  for (const fac of facilities) {
    const snap = snapPoint(fac.geometry.coordinates as [number, number]);
    facilityNodes.push({
      facility: fac,
      nodeId: snap.nodeId,
      distM: snap.distM,
    });
  }

  // 2. Multi-source Dijkstra over passable graph
  const passableDist = new Float64Array(numNodes).fill(Infinity);
  const nearestFacilityForNode = new Array<Facility | undefined>(numNodes);

  // Min-heap simulation for Dijkstra
  const pq: { node: number; dist: number; facility: Facility }[] = [];

  for (const fn of facilityNodes) {
    if (fn.distM <= snapToleranceM * 4) {
      passableDist[fn.nodeId] = fn.distM;
      nearestFacilityForNode[fn.nodeId] = fn.facility;
      pq.push({ node: fn.nodeId, dist: fn.distM, facility: fn.facility });
    }
  }

  // Run Dijkstra
  while (pq.length > 0) {
    // Extract min
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].dist < pq[minIdx].dist) minIdx = i;
    }
    const current = pq.splice(minIdx, 1)[0];

    if (current.dist > passableDist[current.node]) continue;

    const neighbors = passableGraph[current.node] || [];
    for (const edge of neighbors) {
      const alt = current.dist + edge.lengthM;
      if (alt < passableDist[edge.targetNodeId]) {
        passableDist[edge.targetNodeId] = alt;
        nearestFacilityForNode[edge.targetNodeId] = current.facility;
        pq.push({ node: edge.targetNodeId, dist: alt, facility: current.facility });
      }
    }
  }

  // 3. Multi-source Dijkstra over full graph (pre-flood baseline)
  const fullDist = new Float64Array(numNodes).fill(Infinity);
  const fullPq: { node: number; dist: number }[] = [];
  for (const fn of facilityNodes) {
    if (fn.distM <= snapToleranceM * 4) {
      fullDist[fn.nodeId] = fn.distM;
      fullPq.push({ node: fn.nodeId, dist: fn.distM });
    }
  }

  while (fullPq.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < fullPq.length; i++) {
      if (fullPq[i].dist < fullPq[minIdx].dist) minIdx = i;
    }
    const current = fullPq.splice(minIdx, 1)[0];
    if (current.dist > fullDist[current.node]) continue;

    const neighbors = fullGraph[current.node] || [];
    for (const edge of neighbors) {
      const alt = current.dist + edge.lengthM;
      if (alt < fullDist[edge.targetNodeId]) {
        fullDist[edge.targetNodeId] = alt;
        fullPq.push({ node: edge.targetNodeId, dist: alt });
      }
    }
  }

  // 4. Evaluate each community
  for (const comm of communities) {
    const snap = snapPoint(comm.geometry.coordinates as [number, number]);
    const noRoadAccess = snap.distM > snapToleranceM * 3;

    const reachableInPassable =
      !noRoadAccess && Number.isFinite(passableDist[snap.nodeId]);
    const reachableInFull =
      !noRoadAccess && Number.isFinite(fullDist[snap.nodeId]);

    const nearestFac = nearestFacilityForNode[snap.nodeId];
    const routeLength = reachableInPassable
      ? Math.round(passableDist[snap.nodeId] + snap.distM)
      : null;

    results.set(comm.id, {
      isolated: !reachableInPassable,
      preFloodIsolated: !reachableInFull,
      nearestFacilityId: nearestFac?.id,
      nearestFacilityName: nearestFac?.name,
      routeLengthM: routeLength,
      noRoadAccessNearby: noRoadAccess,
    });
  }

  return results;
}
