import type { Object3D } from 'three';
import { getRestPose, type RigJoint } from '@crane/domain/3d';
import { addChannelDelta, beginNodePose } from './apply-channel';

export { accumulatedParentScale } from './apply-channel';

/** NaN/Infinity 는 0 으로, 한계가 있으면 그 안으로 자른다. */
export function clampJointValue(joint: RigJoint, value: number): number {
  let v = Number.isFinite(value) ? value : 0;
  if (joint.min !== undefined && v < joint.min) v = joint.min;
  if (joint.max !== undefined && v > joint.max) v = joint.max;
  return v;
}

/** 관절 값을 rest 기준 Δ 로 환산한다(클램프·sign 적용). 드라이버가 누적할 때 쓴다. */
export function jointDelta(joint: RigJoint, value: number): number {
  return clampJointValue(joint, value) * (joint.sign ?? 1);
}

export function jointChannel(joint: RigJoint): 'rotation' | 'position' {
  return joint.type === 'hinge' ? 'rotation' : 'position';
}

/**
 * 관절 하나를 단독 적용한다 — rest 로 되돌린 뒤 Δ 를 더한다. 같은 노드에
 * 여러 관절·맵핑이 걸리는 경우는 드라이버가 beginNodePose/addChannelDelta 로
 * 직접 누적한다(apply-channel.ts 참고).
 */
export function applyJoint(
  node: Object3D,
  joint: RigJoint,
  value: number,
): void {
  beginNodePose(node, getRestPose(node));
  addChannelDelta(node, jointChannel(joint), joint.axis, jointDelta(joint, value));
}

/** 관절이 비활성일 때 원본 자세로 되돌린다. */
export function resetJointNode(node: Object3D): void {
  beginNodePose(node, getRestPose(node));
}
