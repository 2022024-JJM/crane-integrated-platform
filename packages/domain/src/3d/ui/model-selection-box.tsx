import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { Box3, Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  SELECTION_LINE_COLOR,
  SELECTION_LINE_WIDTH,
} from '../lib/selection-style';

interface ModelSelectionBoxProps {
  clone: Object3D;
  isSelected: boolean;
  /**
   * 선택 box를 그릴 대상 객체. 주어지지 않으면 clone 전체를 박스로 그린다.
   * 자식 mesh가 선택된 경우 그 mesh를 넘겨 박스가 좁혀지도록 한다.
   */
  target?: Object3D | null;
}

const boundingBoxPointsCache = new WeakMap<Object3D, Vector3Tuple[] | null>();

const noRaycast = () => null;

/**
 * clone 전체의 bounding box(local space) 12개 모서리를 line segment 점 배열로
 * 만든다(24개 점, 2개씩 한 모서리). EdgesGeometry로 모든 mesh의 sharp edge를
 * 그리면 시각적으로 과하므로 가장 외곽 박스만 그린다.
 */
function buildBoundingBoxPoints(clone: Object3D): Vector3Tuple[] | null {
  // Box3.setFromObject는 worldMatrix를 사용하므로 worldMatrix를 항등으로
  // 만들어 local space bbox를 얻는다(clone은 ModelSelectionBox와 같은
  // 부모 group transform을 공유하므로 local box면 충분하다).
  const prevPos = clone.position.clone();
  const prevRot = clone.rotation.clone();
  const prevScale = clone.scale.clone();
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.updateMatrixWorld(true);

  const box = new Box3().setFromObject(clone);

  clone.position.copy(prevPos);
  clone.rotation.copy(prevRot);
  clone.scale.copy(prevScale);
  clone.updateMatrixWorld(true);

  if (box.isEmpty()) return null;

  const { min, max } = box;
  const points: Vector3Tuple[] = [];
  const pushEdge = (a: Vector3Tuple, b: Vector3Tuple) => {
    points.push(a, b);
  };

  // 12 모서리: bottom 4 + top 4 + vertical 4
  // bottom rectangle (y = min)
  pushEdge([min.x, min.y, min.z], [max.x, min.y, min.z]);
  pushEdge([max.x, min.y, min.z], [max.x, min.y, max.z]);
  pushEdge([max.x, min.y, max.z], [min.x, min.y, max.z]);
  pushEdge([min.x, min.y, max.z], [min.x, min.y, min.z]);
  // top rectangle (y = max)
  pushEdge([min.x, max.y, min.z], [max.x, max.y, min.z]);
  pushEdge([max.x, max.y, min.z], [max.x, max.y, max.z]);
  pushEdge([max.x, max.y, max.z], [min.x, max.y, max.z]);
  pushEdge([min.x, max.y, max.z], [min.x, max.y, min.z]);
  // vertical edges
  pushEdge([min.x, min.y, min.z], [min.x, max.y, min.z]);
  pushEdge([max.x, min.y, min.z], [max.x, max.y, min.z]);
  pushEdge([max.x, min.y, max.z], [max.x, max.y, max.z]);
  pushEdge([min.x, min.y, max.z], [min.x, max.y, max.z]);

  return points;
}

function getBoundingBoxPoints(object: Object3D) {
  const cached = boundingBoxPointsCache.get(object);
  if (cached !== undefined) {
    return cached;
  }

  const points = buildBoundingBoxPoints(object);
  boundingBoxPointsCache.set(object, points);
  return points;
}

export function ModelSelectionBox({
  clone,
  isSelected,
  target,
}: ModelSelectionBoxProps) {
  // drei <Line>은 points 참조가 바뀌면 geometry를 다시 만들므로
  // 객체별로 캐시된 동일 참조를 넘긴다.
  const points = useMemo(() => {
    if (!isSelected) {
      return null;
    }

    return getBoundingBoxPoints(target ?? clone);
  }, [isSelected, clone, target]);

  // ModelSelectionBox는 ModelMesh가 렌더하는 <primitive object={clone}>의
  // 자식으로 마운트되므로 부모 transform을 자동으로 상속받는다. 즉, 별도
  // useFrame 매트릭스 sync가 불필요하다(이전 구현은 매 프레임 invalidate를
  // 강제해 R3F on-demand 렌더링을 무력화했다).
  if (!isSelected || !points) {
    return null;
  }

  // depthTest=false + renderOrder 1 → 모델 안쪽이어도 항상 보임.
  // raycast 차단: R3F가 primitive 자식까지 재귀 raycast하므로, 두꺼운 선이
  // 클릭 대상(event.object)이 되어 mesh path 계산에 끼어들지 않도록 한다.
  return (
    <Line
      segments
      points={points}
      color={SELECTION_LINE_COLOR}
      lineWidth={SELECTION_LINE_WIDTH}
      depthTest={false}
      renderOrder={1}
      raycast={noRaycast}
    />
  );
}
