import { Quaternion, Vector3, type Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  degToRad,
  type RestPose,
  type RigAxis,
  type TagMappingChannel,
} from '@crane/domain/3d';

const AXES: Record<RigAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

// 프레임당 할당 0 을 위해 모듈 스코프에서 재사용.
const _q = new Quaternion();
const _qInv = new Quaternion();
const _p = new Vector3();
const _rp = new Vector3();

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
 * 채널 Δ 를 rest 기준으로 누적 적용하는 두 단계 API.
 *
 * 한 노드에 여러 채널·축이 걸릴 수 있다(예: 위치 x 와 z, 회전 y). 그래서
 * "rest 로 되돌린 뒤(begin) Δ 를 하나씩 더한다(add)" 로 나눴다 — 예전
 * applyJoint 는 채널마다 rest 를 다시 복사해 같은 노드의 다른 축 값을 지웠다.
 *
 * - rotation: **자기 로컬 축** 중심 회전(deg) → rest 에 post-multiply. 절대
 *   대입(`rotation.x = θ`)은 rest 가 항등이 아닌 Empty 의 원본 자세를 파괴한다.
 *   `pivot`(노드 rest 원점에서 회전 중심까지의 오프셋 — **부모 프레임 m**)을
 *   주면 원점이 아니라 그 점을 지나는 축으로 돈다. 부모 프레임에서 이 회전은
 *   Q·R·Q⁻¹(Q = 지금까지 누적된 노드 회전)이므로 위치를 p − (Q R Q⁻¹)p 만큼
 *   옮기면 피벗 점은 제자리다. 노드 scale 과 무관하다 — meshopt 양자화로
 *   scale 이 36 같은 값인 노드도 사람이 잰 m 그대로 쓴다.
 * - position: **부모 프레임 축** 방향 평행이동(m). 부모 scale 체인을 나눠
 *   로컬 단위로 환산한다. 갠트리 위 트롤리처럼 "부모 좌표계의 한 축을 따라
 *   미끄러지는" 쓰임이 일반적이라 부모 축을 택했다.
 * - scale: rest.scale 에 더하는 무차원 Δ. 값 0 = rest 원칙을 세 채널이 공유한다.
 */
export function beginNodePose(node: Object3D, rest: RestPose): void {
  node.position.copy(rest.position);
  node.quaternion.copy(rest.quaternion);
  node.scale.copy(rest.scale);
}

export function addChannelDelta(
  node: Object3D,
  channel: TagMappingChannel,
  axis: RigAxis,
  delta: number,
  pivot?: Vector3Tuple,
): void {
  const d = Number.isFinite(delta) ? delta : 0;
  if (d === 0) return;
  if (channel === 'rotation') {
    _q.setFromAxisAngle(AXES[axis], degToRad(d));
    if (pivot) {
      _p.set(pivot[0], pivot[1], pivot[2]);
      // (Q R Q⁻¹) p — 부모 프레임에서 본 이번 회전으로 p 를 돌린다.
      _rp
        .copy(_p)
        .applyQuaternion(_qInv.copy(node.quaternion).invert())
        .applyQuaternion(_q)
        .applyQuaternion(node.quaternion);
      node.position.add(_p.sub(_rp));
    }
    node.quaternion.multiply(_q);
    return;
  }
  if (channel === 'position') {
    const parentScale = accumulatedParentScale(node);
    node.position[axis] += parentScale > 0 ? d / parentScale : d;
    return;
  }
  node.scale[axis] += d;
}
