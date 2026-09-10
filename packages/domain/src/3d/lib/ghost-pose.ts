import type { Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 고스트(미래 자세 사본)에 씌울 자세 스냅샷.
 *
 * 컴포넌트 파일(`ui/ghost-model.tsx`)이 아니라 여기 두는 이유는
 * `react-refresh/only-export-components` 다 — 컴포넌트 파일에 비컴포넌트
 * export 가 섞이면 Fast Refresh 가 깨진다(AGENTS.md Known Caveats).
 */

export interface GhostNodePose {
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
  position: Vector3Tuple;
  quaternion: readonly [number, number, number, number];
  scale: Vector3Tuple;
}

/**
 * 노드 하나의 현재 **로컬** transform 을 스냅샷 항목으로 만든다.
 *
 * 월드가 아니라 로컬인 이유: 고스트는 같은 GLB 를 clone 해 같은 계층으로
 * 세우므로, 각 노드에 로컬 값을 그대로 얹으면 부모 체인이 월드 자세를
 * 재구성한다. 월드 값을 쓰면 부모가 이미 움직인 만큼 두 번 적용된다.
 */
export function captureGhostNodePose(
  nodePath: string,
  node: Object3D,
): GhostNodePose {
  return {
    nodePath,
    position: [node.position.x, node.position.y, node.position.z],
    quaternion: [
      node.quaternion.x,
      node.quaternion.y,
      node.quaternion.z,
      node.quaternion.w,
    ],
    scale: [node.scale.x, node.scale.y, node.scale.z],
  };
}
