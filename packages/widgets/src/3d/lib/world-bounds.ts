import { Box3, Vector3, type Object3D } from 'three';

/**
 * 객체들의 월드 AABB 합집합. 빈 배열이거나 아무것도 기여하지 않으면 null.
 *
 * setFromObject 는 대상 자신의 matrixWorld 를 (현재 부모 matrixWorld 기준으로)
 * 갱신한다 — 조상까지 올라가지는 않는다. keydown·버튼 클릭은 렌더 루프
 * 밖이라 직전 변형이 월드 행렬에 아직 안 실렸을 수 있는데, 조상은 매 프레임
 * 렌더러가 갱신해 두므로 자기 행렬만 갱신하면 충분하다(마퀴 판정
 * use-marquee-selection 과 같은 관례). 지오메트리가 비어 있는 객체(폰트
 * sync 전 텍스트)는 월드 위치 한 점만 기여해 최소한 중심은 맞춘다.
 */
export function collectWorldBounds(objects: Object3D[]): Box3 | null {
  if (objects.length === 0) return null;

  const box = new Box3();
  const objectBox = new Box3();
  const worldPosition = new Vector3();
  for (const obj of objects) {
    objectBox.setFromObject(obj);
    if (objectBox.isEmpty()) {
      box.expandByPoint(obj.getWorldPosition(worldPosition));
    } else {
      box.union(objectBox);
    }
  }

  return box.isEmpty() ? null : box;
}
