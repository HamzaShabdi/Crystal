import { AnalysisParams, Community, CommunityImpact } from './types';
import { RouteReachability } from './isolation';

export function computeRanking(
  communities: Community[],
  reachabilityMap: Map<string, RouteReachability>,
  params: AnalysisParams
): CommunityImpact[] {
  if (communities.length === 0) return [];

  // Determine population and distance ranges for min-max normalization
  let maxPop = 1;
  let maxDist = 1;

  for (const c of communities) {
    const pop = c.population ?? 500;
    if (pop > maxPop) maxPop = pop;

    const reach = reachabilityMap.get(c.id);
    if (reach && reach.routeLengthM && reach.routeLengthM > maxDist) {
      maxDist = reach.routeLengthM;
    }
  }

  const { weights, isolationBonus } = params;
  const rawList: (Omit<CommunityImpact, 'rank'>)[] = [];

  for (const c of communities) {
    const reach = reachabilityMap.get(c.id) ?? {
      isolated: true,
      preFloodIsolated: false,
      routeLengthM: null,
    };

    const pop = c.population ?? 500;
    const urgency = c.urgency ?? 3;

    // Normalizations (0 to 1)
    const normPop = Math.min(1, pop / maxPop);
    const normUrg = (urgency - 1) / 4; // urgency 1..5 -> 0..1

    // For distance: if isolated, distance penalty is maximal (1.0). Otherwise normalized distance.
    const normDist = reach.isolated
      ? 1.0
      : reach.routeLengthM
      ? Math.min(1, reach.routeLengthM / maxDist)
      : 0.5;

    // Base score from weighted factors
    let score =
      weights.population * normPop +
      weights.urgency * normUrg +
      weights.distance * normDist;

    // Isolated bonus ensures cut off communities precede reachable ones
    if (reach.isolated) {
      score += isolationBonus;
    }

    // Human-readable, transparent reasoning bullets
    const reasons: string[] = [];

    if (reach.noRoadAccessNearby) {
      reasons.push('Data Caveat: Settlement is beyond road network buffer (>150m) in provided geometry.');
    } else if (reach.isolated) {
      if (reach.preFloodIsolated) {
        reasons.push('Cut-off: No baseline route to hospital/shelter existed in pre-disaster network.');
      } else {
        reasons.push('CRITICAL: Complete road isolation — all vehicular links to facilities severed by candidate flood.');
      }
    } else {
      const distKm = ((reach.routeLengthM ?? 0) / 1000).toFixed(1);
      const facName = reach.nearestFacilityName ?? 'Nearest Facility';
      reasons.push(`Passable route: Accessible to ${facName} (${distKm} km driving distance).`);
    }

    reasons.push(`Population context: ~${pop.toLocaleString()} residents (weight ${(weights.population * 100).toFixed(0)}%).`);
    reasons.push(`Assigned urgency level: ${urgency}/5 (weight ${(weights.urgency * 100).toFixed(0)}%).`);

    rawList.push({
      communityId: c.id,
      communityName: c.name,
      isolated: reach.isolated,
      preFloodIsolated: reach.preFloodIsolated,
      nearestFacilityId: reach.nearestFacilityId,
      nearestFacilityName: reach.nearestFacilityName,
      routeLengthM: reach.routeLengthM,
      populationAtRisk: pop,
      urgency,
      score: Math.round(score * 1000) / 1000,
      reasons,
      coordinates: c.geometry.coordinates as [number, number],
    });
  }

  // Sort by score descending (higher priority first)
  rawList.sort((a, b) => b.score - a.score);

  // Assign 1-indexed ranks
  return rawList.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
