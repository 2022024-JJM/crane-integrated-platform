import { Raycaster, Vector3, type Object3D } from 'three';

const sharedRay = new Raycaster();
// 아래에서 hits[0](최상단 표면)만 쓰므로 BVH raycast 를 첫 히트에서 조기
// 종료시킨다(three-mesh-bvh 가 읽는 플래그, bvh-setup). 수직 레이는 겹겹이
// 쌓인 지도 레이어(도로선·아스팔트·바닥)를 전부 관통하는데, 기본값이면
// 그 교차를 모두 수집한 뒤 버리게 된다.
sharedRay.firstHitOnly = true;
const downDir = new Vector3(0, -1, 0);
const origin = new Vector3();

/**
 * 주어진 (x, z) 위치에서 위에서 아래로 raycast해 mapObject 표면의 y를 구한다.
 * 항만 지도처럼 표면 높이가 y!=0이고 평평하지 않은 모델 위에 객체를 정확히
 * 올려놓을 때 사용한다. 표면을 못 찾으면 null.
 *
 * 시작 높이는 충분히 크게 잡아 모델의 가장 높은 곳보다 위에서 시작한다.
 */
export function raycastMapSurfaceY(
  mapObject: Object3D,
  x: number,
  z: number,
): number | null {
  origin.set(x, 1e6, z);
  sharedRay.set(origin, downDir);
  const hits = sharedRay.intersectObject(mapObject, true);
  if (hits.length === 0) return null;
  return hits[0].point.y;
}
