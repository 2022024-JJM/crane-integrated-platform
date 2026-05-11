import type { LatLng, Site } from '@crane/domain/region';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine 공식으로 두 좌표 사이 대원 거리(km).
 * 작은 거리에서는 평면 근사와 거의 같지만, 사이트가 한국·미국처럼 멀리 떨어진 경우에도 정확하다.
 */
function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * 주어진 좌표에서 maxDistanceKm 안에 있는 가장 가까운 site를 반환.
 * 모든 site가 너무 멀면 null.
 */
export function findNearestSite(
  center: LatLng,
  sites: Site[],
  maxDistanceKm: number,
): Site | null {
  let best: { site: Site; dist: number } | null = null;
  for (const site of sites) {
    const d = distanceKm(center, site.center);
    if (d > maxDistanceKm) continue;
    if (!best || d < best.dist) best = { site, dist: d };
  }
  return best?.site ?? null;
}
