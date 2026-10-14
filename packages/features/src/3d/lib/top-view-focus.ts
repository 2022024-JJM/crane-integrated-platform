import { Box3, Vector3 } from 'three';

/**
 * 관제 모드 탑뷰의 프레이밍 — 지도 전체(컨텍스트 지형까지)가 아니라 **장비가
 * 있는 범위**를 한 화면에. 옥포는 야드 전체, 필리는 도크 한 구석이라 지도
 * 기준이면 장비가 몇 픽셀이 된다. 장비 AABB 합집합에 여백을 두르고, 장비가
 * 한 대뿐이거나 몰려 있으면 최소 한 변을 보장한다.
 */
export const TOP_VIEW_EQUIPMENT_MARGIN_M = 80;
export const TOP_VIEW_EQUIPMENT_MIN_SIZE_M = 400;

/** XZ 로 여백을 두르고 최소 크기를 보장한 박스. 비면 null. */
export function expandTopViewBounds(
  bounds: Box3 | null,
  metersPerUnit: number,
  marginM: number = TOP_VIEW_EQUIPMENT_MARGIN_M,
  minSizeM: number = TOP_VIEW_EQUIPMENT_MIN_SIZE_M,
): Box3 | null {
  if (!bounds || bounds.isEmpty()) return null;
  const mpu = metersPerUnit > 0 ? metersPerUnit : 1;
  const margin = marginM / mpu;
  const minSize = minSizeM / mpu;
  const out = bounds.clone();
  out.expandByVector(new Vector3(margin, 0, margin));
  const size = out.getSize(new Vector3());
  const center = out.getCenter(new Vector3());
  const half = Math.max(size.x, size.z, minSize) / 2;
  // 정사각이 아니라 긴 변 기준 최소만 — 짧은 변은 그대로 두어 화면에 맞춘다.
  if (size.x < minSize) {
    out.min.x = center.x - half;
    out.max.x = center.x + half;
  }
  if (size.z < minSize) {
    out.min.z = center.z - half;
    out.max.z = center.z + half;
  }
  return out;
}
