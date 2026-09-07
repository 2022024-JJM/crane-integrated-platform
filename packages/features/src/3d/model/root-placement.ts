import type { Object3D } from 'three';
import {
  accumulatedParentScale,
  addChannelDelta,
  beginNodePose,
} from '../lib/apply-channel';
import {
  stripChannelDeltas,
  type ChannelPose,
} from '../lib/strip-channel-delta';
import { rigLiveReadouts } from './rig-live-readouts';

/**
 * 모델 루트의 **배치 자세**(씬에 저장되는 값) ↔ 화면 자세(배치 + 태그 Δ) 변환.
 * 기즈모 커밋·스냅(widgets use-scene-transform)이 쓴다.
 *
 * Δ 는 드라이버가 rigLiveReadouts 에 남긴 "루트에 마지막으로 적용한 Δ"
 * (드래그 중엔 드래그 직전 값)다. readout 이 없는 객체(텍스트·지도·루트 맵핑
 * 없는 모델)는 화면 자세가 곧 배치 자세라 복사만 한다.
 */

/** node 의 현재 자세에서 Δ 를 벗긴 배치 자세를 `out` 에 쓴다. */
export function readRootPlacement(
  modelId: string,
  node: Object3D,
  out: ChannelPose,
): ChannelPose {
  out.position.copy(node.position);
  out.quaternion.copy(node.quaternion);
  out.scale.copy(node.scale);
  const deltas = rigLiveReadouts.get(modelId)?.rootDeltas;
  if (deltas && deltas.length > 0) {
    stripChannelDeltas(out, deltas, accumulatedParentScale(node));
  }
  return out;
}

/** 배치 자세를 node 에 넣고 같은 Δ 를 다시 더해 화면 자세로 만든다. */
export function writeRootPlacement(
  modelId: string,
  node: Object3D,
  placement: ChannelPose,
): void {
  beginNodePose(node, placement);
  const deltas = rigLiveReadouts.get(modelId)?.rootDeltas;
  if (!deltas) return;
  for (const { channel, axis, delta } of deltas) {
    addChannelDelta(node, channel, axis, delta);
  }
}
