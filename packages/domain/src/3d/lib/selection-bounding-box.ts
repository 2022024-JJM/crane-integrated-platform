import { Box3, Matrix4, Mesh, type Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 선택 박스(노란 12모서리 라인)의 점 계산.
 *
 * 원칙: 점은 **박스가 마운트되는 Object3D 의 로컬 좌표**로 만든다. 박스 라인은
 * 그 객체의 자식으로 씬 그래프에 들어가므로, 객체가 기즈모로 움직이든 리그
 * 드라이버로 회전하든 별도 동기화 없이 상속으로 따라간다.
 *
 * 이전 구현은 대상의 transform 을 항등으로 리셋하고 `Box3.setFromObject` 로
 * 월드 박스를 잰 뒤 되돌렸다. 대상이 씬 루트 직계(모델 clone)일 때만 우연히
 * 맞았고, 모델 안쪽 노드를 넘기면 노드 오프셋을 잃고 조상 transform 이 두 번
 * 적용돼 엉뚱한 곳에 그려졌다. 여기서는 대상을 mutate 하지 않고 각 메쉬의
 * `matrixWorld` 를 대상의 `matrixWorld` 역행렬로 되돌려 로컬 프레임에서 합친다.
 */

const boundingBoxPointsCache = new WeakMap<Object3D, Vector3Tuple[] | null>();

/**
 * drei `<Line>` 은 three-stdlib `Line2`/`LineSegments2`(둘 다 Mesh 파생)라
 * 메쉬 순회에 잡힌다. `segments` 모드는 `LineSegments2` 이고 `isLine2` 를
 * 갖지 않으므로 두 플래그를 모두 본다.
 */
function isSelectionLine(object: Object3D): boolean {
  const flags = object as { isLine2?: boolean; isLineSegments2?: boolean };
  return flags.isLine2 === true || flags.isLineSegments2 === true;
}

/**
 * `object` 하위 메쉬들의 AABB 를 `object` 로컬 프레임에서 구해 12모서리 24점
 * 배열로 만든다. 메쉬가 없으면 `null`. 대상의 transform 은 건드리지 않는다.
 */
export function computeLocalBoundingBoxPoints(
  object: Object3D,
): Vector3Tuple[] | null {
  object.updateWorldMatrix(true, true);

  const toLocal = new Matrix4().copy(object.matrixWorld).invert();
  const box = new Box3();
  const meshBox = new Box3();
  const relative = new Matrix4();

  object.traverse((child) => {
    if (!(child instanceof Mesh) || isSelectionLine(child)) return;
    const geometry = child.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    relative.multiplyMatrices(toLocal, child.matrixWorld);
    meshBox.copy(geometry.boundingBox).applyMatrix4(relative);
    box.union(meshBox);
  });

  if (box.isEmpty()) return null;

  const { min, max } = box;
  const points: Vector3Tuple[] = [];
  const pushEdge = (a: Vector3Tuple, b: Vector3Tuple) => {
    points.push(a, b);
  };

  // 12 모서리: bottom 4 + top 4 + vertical 4
  pushEdge([min.x, min.y, min.z], [max.x, min.y, min.z]);
  pushEdge([max.x, min.y, min.z], [max.x, min.y, max.z]);
  pushEdge([max.x, min.y, max.z], [min.x, min.y, max.z]);
  pushEdge([min.x, min.y, max.z], [min.x, min.y, min.z]);
  pushEdge([min.x, max.y, min.z], [max.x, max.y, min.z]);
  pushEdge([max.x, max.y, min.z], [max.x, max.y, max.z]);
  pushEdge([max.x, max.y, max.z], [min.x, max.y, max.z]);
  pushEdge([min.x, max.y, max.z], [min.x, max.y, min.z]);
  pushEdge([min.x, min.y, min.z], [min.x, max.y, min.z]);
  pushEdge([max.x, min.y, min.z], [max.x, max.y, min.z]);
  pushEdge([max.x, min.y, max.z], [max.x, max.y, max.z]);
  pushEdge([min.x, min.y, max.z], [min.x, max.y, max.z]);

  return points;
}

/**
 * 객체별로 캐시된 동일 참조를 돌려준다 — drei `<Line>` 은 points 참조가 바뀌면
 * geometry 를 다시 만든다. 로컬 프레임 박스는 대상 자신의 transform 에 불변이라
 * 대상이 움직여도 캐시가 유효하다.
 */
export function getCachedLocalBoundingBoxPoints(
  object: Object3D,
): Vector3Tuple[] | null {
  const cached = boundingBoxPointsCache.get(object);
  if (cached !== undefined) {
    return cached;
  }
  const points = computeLocalBoundingBoxPoints(object);
  boundingBoxPointsCache.set(object, points);
  return points;
}
