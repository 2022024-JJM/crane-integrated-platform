import { Quaternion, Vector3, type Object3D } from 'three';

/**
 * 노드별 rest pose(GLTF 원본 로컬 transform) 캐시.
 *
 * 리그 드라이버는 관절 값을 **rest 기준 상대**로 적용한다 — Blender export 의
 * Empty 노드는 rest 쿼터니언이 항등이 아닌 것이 보통이라(러핑 붐 ≈ X+45.9°)
 * `rotation.x = θ` 절대 대입은 원본 자세를 파괴한다. 그래서 최초 한 번 잡아 둔
 * rest 를 기준으로 `q = rest ∘ Δ` 를 매 프레임 다시 만든다.
 *
 * WeakMap 을 Object3D 로 키잉하는 이유: useGLTF 캐시·StrictMode 재마운트·HMR
 * 에서 같은 노드가 다시 지나가도 "이미 구동된 자세를 rest 로 재캡처" 하지
 * 않게 하려는 것이다. useClonedModel 이 clone 직후(사용자 편집 전) seed 하므로
 * 캐시 값은 항상 GLTF 원본이고, seed 를 거치지 않은 노드는 최초 접근 시점의
 * 자세가 rest 가 된다.
 */
export interface RestPose {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

const cache = new WeakMap<Object3D, RestPose>();

function capture(node: Object3D): RestPose {
  return {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  };
}

/** 이미 있으면 덮어쓰지 않는다 — 재마운트 시 구동된 자세가 rest 가 되는 것을 막는다. */
export function seedRestPose(node: Object3D): void {
  if (!cache.has(node)) {
    cache.set(node, capture(node));
  }
}

export function hasRestPose(node: Object3D): boolean {
  return cache.has(node);
}

/** 없으면 현재 자세를 rest 로 잡는다(최초 접근 = rest). */
export function getRestPose(node: Object3D): RestPose {
  let pose = cache.get(node);
  if (!pose) {
    pose = capture(node);
    cache.set(node, pose);
  }
  return pose;
}

/** 위치·회전만 되돌린다. scale 은 리그가 건드리지 않으므로 그대로 둔다. */
export function resetToRestPose(node: Object3D): void {
  const pose = cache.get(node);
  if (!pose) return;
  node.position.copy(pose.position);
  node.quaternion.copy(pose.quaternion);
}
