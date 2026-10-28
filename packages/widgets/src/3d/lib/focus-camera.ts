import type { Object3D } from 'three';
import type { CameraPose } from '@crane/core/lib/top-view-pose';
import type { Vector3Tuple } from '@crane/core/types/math';
import { makeMeshId, modelObjectRegistry } from '@crane/domain/3d';

/**
 * 객체를 화면에 맞추는 프레이밍 수학 — F 포커스(에디터 캔버스 fitToObjects)와
 * 인스펙터 노드 선택기의 노드 미리보기(EditorCameraBridge)가 같은 식을 쓴다.
 * 보는 방향은 유지하고, 바운딩 스피어가 fov 의 좁은 쪽에 들어오는 거리로
 * 물러난다.
 */

/** 바운딩 스피어 주변 여유 비율. */
export const FOCUS_PADDING = 1.15;

/**
 * 반지름 `radius` 의 바운딩 스피어가 세로·가로 fov 중 좁은 쪽에 들어오는 거리.
 * `fov` 가 null(원근 fov 를 모를 때)이면 반각 45° 로 본다. 직교 탑뷰도 같은
 * 식이다 — 카메라가 같은 구도의 원근 높이에 서고(userData 의 fov) applyPose
 * 가 거리로 프러스텀을 잡는다. `minDistance` 아래로는 내려가지 않는다.
 */
export function focusDistance(
  radius: number,
  fov: number | null,
  aspect: number | null,
  minDistance: number,
): number {
  let halfFov = Math.PI / 4;
  if (fov !== null) {
    const halfVertical = (fov * Math.PI) / 360;
    halfFov = Math.min(
      halfVertical,
      Math.atan(Math.tan(halfVertical) * (aspect ?? 1)),
    );
  }
  const safeRadius = Math.max(radius, 1e-3);
  return Math.max(
    (safeRadius / Math.sin(halfFov)) * FOCUS_PADDING,
    minDistance,
  );
}

/** `center` 를 보며 단위 벡터 `direction` 쪽으로 `distance` 만큼 물러난 포즈. */
export function focusPose(
  center: Vector3Tuple,
  direction: Vector3Tuple,
  distance: number,
): CameraPose {
  return {
    position: [
      center[0] + direction[0] * distance,
      center[1] + direction[1] * distance,
      center[2] + direction[2] * distance,
    ],
    target: [center[0], center[1], center[2]],
  };
}

/**
 * 미리보기 대상 객체 — 루트(`''`)는 모델의 clone, 그 밖은 ModelMesh 가
 * `makeMeshId` 로 등록한 노드. 노드 선택 표시(selectedMeshTarget)와 같은 조회.
 */
export function resolvePreviewNode(
  modelId: string,
  nodePath: string,
): Object3D | undefined {
  return nodePath === ''
    ? modelObjectRegistry.get(modelId)
    : modelObjectRegistry.get(makeMeshId(modelId, nodePath));
}
