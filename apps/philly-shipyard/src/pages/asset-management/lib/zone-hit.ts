import type { Box3, Vector3 } from 'three';
import type { CraneZone } from '@crane/domain/3d';

/**
 * 레이캐스트 히트 지점(월드 좌표)을 모델 바운딩박스 기준 [0..1]로 정규화한 뒤
 * 먼저 매칭되는 존을 반환한다. (존 배열 순서 = 우선순위)
 */
export function classifyPointToZone(
  worldPoint: Vector3,
  modelBox: Box3,
  zones: CraneZone[],
): CraneZone | null {
  const size = {
    x: modelBox.max.x - modelBox.min.x,
    y: modelBox.max.y - modelBox.min.y,
    z: modelBox.max.z - modelBox.min.z,
  };
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return null;

  const nx = (worldPoint.x - modelBox.min.x) / size.x;
  const ny = (worldPoint.y - modelBox.min.y) / size.y;
  const nz = (worldPoint.z - modelBox.min.z) / size.z;

  for (const zone of zones) {
    for (const region of zone.regions ?? []) {
      const [minX, minY, minZ] = region.min;
      const [maxX, maxY, maxZ] = region.max;
      if (
        nx >= minX && nx <= maxX &&
        ny >= minY && ny <= maxY &&
        nz >= minZ && nz <= maxZ
      ) {
        return zone;
      }
    }
  }
  return null;
}
