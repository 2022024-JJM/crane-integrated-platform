import { Quaternion, Vector3, type Object3D } from 'three';
import {
  degToRad,
  getRestPose,
  type RestPose,
  type RigJoint,
} from '@crane/domain/3d';
import { addChannelDelta, beginNodePose } from './apply-channel';

const _pivot = new Vector3();
const _arm = new Vector3();
const _axis = new Vector3();
const _spin = new Quaternion();

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
  addChannelDelta(
    node,
    jointChannel(joint),
    joint.axis,
    jointDelta(joint, value),
  );
}

/**
 * 피벗 hinge 의 위치 보정. `addChannelDelta(rotation)` 은 노드 원점 중심으로
 * 돌리므로, 피벗이 있으면 rest 원점을 피벗 둘레로 같은 각도만큼 공전시킨다 —
 * `p' = pivot + R·(rest.p − pivot)`, R 은 노드 로컬 축을 rest 자세로 부모
 * 프레임에 옮긴 축의 회전. 회전(quaternion)은 이미 적용돼 있어야 하며 여기선
 * 위치만 바꾼다. 같은 노드의 다른 Δ 가 있으면 그 뒤에 부른다.
 */
export function applyJointPivot(
  node: Object3D,
  rest: RestPose,
  joint: RigJoint,
  deltaDeg: number,
): void {
  if (!joint.pivot || joint.type !== 'hinge') return;
  const d = Number.isFinite(deltaDeg) ? deltaDeg : 0;
  if (d === 0) return;
  _pivot.set(joint.pivot[0], joint.pivot[1], joint.pivot[2]);
  _axis.set(0, 0, 0);
  _axis[joint.axis] = 1;
  _axis.applyQuaternion(rest.quaternion);
  _spin.setFromAxisAngle(_axis, degToRad(d));
  _arm.copy(rest.position).sub(_pivot).applyQuaternion(_spin).add(_pivot);
  // 위치 채널 Δ(slide 등)가 먼저 더해져 있으면 그 Δ 는 보존한다.
  node.position.add(_arm).sub(rest.position);
}

/** 관절이 비활성일 때 원본 자세로 되돌린다. */
export function resetJointNode(node: Object3D): void {
  beginNodePose(node, getRestPose(node));
}
