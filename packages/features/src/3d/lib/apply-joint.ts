import { Quaternion, Vector3, type Object3D } from 'three';
import {
  degToRad,
  getRestPose,
  resetToRestPose,
  type RigAxis,
  type RigJoint,
} from '@crane/domain/3d';

const AXES: Record<RigAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

// 프레임당 할당 0 을 위해 모듈 스코프에서 재사용.
const _q = new Quaternion();

/** NaN/Infinity 는 0 으로, 한계가 있으면 그 안으로 자른다. */
export function clampJointValue(joint: RigJoint, value: number): number {
  let v = Number.isFinite(value) ? value : 0;
  if (joint.min !== undefined && v < joint.min) v = joint.min;
  if (joint.max !== undefined && v > joint.max) v = joint.max;
  return v;
}

/**
 * 부모 체인의 누적 scale(x 성분) — 노드 로컬 1 단위가 월드 몇 미터인지.
 * uniform scale 을 전제한다(Blender export 가 그렇다).
 */
export function accumulatedParentScale(node: Object3D): number {
  let s = 1;
  let cursor = node.parent;
  while (cursor) {
    s *= cursor.scale.x;
    cursor = cursor.parent;
  }
  return s;
}

/**
 * rest pose 기준 상대 적용.
 *
 * - hinge: 노드 **자기 로컬 축** 중심 회전 → rest 에 post-multiply. 절대 대입
 *   (`rotation.x = θ`)은 rest 가 항등이 아닌 Empty 의 원본 자세를 파괴한다.
 * - slide: **부모 프레임 축** 방향 평행이동(m). 노드 로컬 단위로 환산하기 위해
 *   부모 scale 체인을 나눈다. 갠트리 위 트롤리처럼 "부모 좌표계의 한 축을 따라
 *   미끄러지는" 것이 일반적인 쓰임이라 부모 축을 택했다.
 */
export function applyJoint(
  node: Object3D,
  joint: RigJoint,
  value: number,
): void {
  const rest = getRestPose(node);
  const v = clampJointValue(joint, value) * (joint.sign ?? 1);

  if (joint.type === 'hinge') {
    node.quaternion
      .copy(rest.quaternion)
      .multiply(_q.setFromAxisAngle(AXES[joint.axis], degToRad(v)));
    return;
  }

  const parentScale = accumulatedParentScale(node);
  const local = parentScale > 0 ? v / parentScale : v;
  node.position.copy(rest.position);
  node.position[joint.axis] += local;
}

/** 관절이 비활성일 때 원본 자세로 되돌린다. */
export function resetJointNode(node: Object3D): void {
  resetToRestPose(node);
}
