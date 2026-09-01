import type { Object3D } from 'three';
import { numRound, radToDeg, resolveEulerContinuity } from '@crane/domain/3d';
import type { SceneTransformField } from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

function toVector3Tuple(values: [number, number, number]): Vector3Tuple {
  return values.map((value) => numRound(value)) as Vector3Tuple;
}

/**
 * Object3D의 현재 transform을 sceneInfo 단위(도, 3자리 반올림)로 읽는다.
 * rotation은 three가 quaternion에서 추출한 euler를 그대로 옮기므로,
 * y가 90°를 넘긴 자세는 플립된 표현(x/z에 ±180)으로 나올 수 있다 —
 * 드래그 경로에서는 getContinuousTransformVectors를 쓴다.
 */
export function getObjectTransformVectors(
  object: Object3D,
): Record<SceneTransformField, Vector3Tuple> {
  return {
    position: toVector3Tuple([
      object.position.x,
      object.position.y,
      object.position.z,
    ]),
    rotation: toVector3Tuple([
      radToDeg(object.rotation.x),
      radToDeg(object.rotation.y),
      radToDeg(object.rotation.z),
    ]),
    scale: toVector3Tuple([object.scale.x, object.scale.y, object.scale.z]),
  };
}

/**
 * getObjectTransformVectors에 오일러 연속성 보정을 얹는다.
 * prevRotationDeg(직전 프레임 또는 드래그 시작 시점의 euler deg)가 있으면
 * rotation을 그 기준에서 가까운 등가 표현으로 되돌려, 기즈모로 y를 90°
 * 너머로 돌릴 때 x/z가 0→180으로 튀는 플립을 없앤다.
 */
export function getContinuousTransformVectors(
  object: Object3D,
  prevRotationDeg: Vector3Tuple | undefined,
): Record<SceneTransformField, Vector3Tuple> {
  const vectors = getObjectTransformVectors(object);
  if (!prevRotationDeg) {
    return vectors;
  }
  return {
    ...vectors,
    rotation: toVector3Tuple(
      resolveEulerContinuity(prevRotationDeg, vectors.rotation),
    ),
  };
}
