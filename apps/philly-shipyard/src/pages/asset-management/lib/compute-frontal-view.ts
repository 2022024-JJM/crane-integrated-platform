import { Box3, Vector3, type Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

// R3F 기본 카메라 fov (Canvas에 fov 미지정 시 75)
const CAMERA_FOV_DEG = 75;
// 뷰어 컨테이너의 대략적 가로/세로 비 — 가로 폭 fit 계산용 보수적 추정치
const ASPECT_ESTIMATE = 1.4;
// 프레이밍 여백
const FIT_MARGIN = 1.15;

/**
 * 모델 바운딩 박스 기준 정면·근접 카메라 위치/타깃 계산.
 *
 * "정면"은 수평 footprint가 짧은 축에서 바라본 모습 — 긴 축(예: 골리앗 거더
 * 스팬)이 화면 가로로 펼쳐진다. 거리는 화면에 실제 보이는 폭/높이 기준으로
 * 맞추고, 시선 방향 깊이의 절반을 더해 모델 표면 밖에서 시작하도록 한다.
 */
export function computeFrontalView(
  object: Object3D,
): { position: Vector3Tuple; target: Vector3Tuple } | null {
  object.updateWorldMatrix(true, true);
  return computeFrontalViewFromBox(new Box3().setFromObject(object));
}

/**
 * 여러 오브젝트(조립 파트)의 합집합 바운딩박스 기준 정면 뷰.
 * 씬 부모를 통째로 재면 바닥 그리드까지 포함되므로 파트만 합산한다.
 */
export function computeFrontalViewFromObjects(
  objects: Object3D[],
): { position: Vector3Tuple; target: Vector3Tuple } | null {
  const box = new Box3();
  for (const object of objects) {
    object.updateWorldMatrix(true, true);
    box.union(new Box3().setFromObject(object));
  }
  return computeFrontalViewFromBox(box);
}

/** 바운딩 박스 기준 정면 뷰 — 서브 존(파트 내 영역)처럼 Object3D가 없는 대상용 */
export function computeFrontalViewFromBox(
  box: Box3,
): { position: Vector3Tuple; target: Vector3Tuple } | null {
  if (box.isEmpty()) return null;

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  // 시선축: 수평(x/z) 중 짧은 축 — 반대편 긴 축이 프레임 가로를 채운다
  const viewAxis: 'x' | 'z' = size.x <= size.z ? 'x' : 'z';
  const visibleWidth = viewAxis === 'x' ? size.z : size.x;
  const viewDepth = viewAxis === 'x' ? size.x : size.z;

  const vFov = (CAMERA_FOV_DEG * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * ASPECT_ESTIMATE);
  const fitDist = Math.max(
    (visibleWidth / 2) / Math.tan(hFov / 2),
    (size.y / 2) / Math.tan(vFov / 2),
  );
  const dist = fitDist * FIT_MARGIN + viewDepth / 2;

  const position: Vector3Tuple =
    viewAxis === 'x'
      ? [center.x + dist, center.y + size.y * 0.1, center.z]
      : [center.x, center.y + size.y * 0.1, center.z + dist];

  return {
    position,
    target: [center.x, center.y, center.z],
  };
}
