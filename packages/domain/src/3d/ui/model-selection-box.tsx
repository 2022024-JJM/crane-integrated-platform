import { useMemo } from 'react';
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Object3D,
} from 'three';

interface ModelSelectionBoxProps {
  clone: Object3D;
  isSelected: boolean;
  /**
   * 선택 box를 그릴 대상 객체. 주어지지 않으면 clone 전체를 박스로 그린다.
   * 자식 mesh가 선택된 경우 그 mesh를 넘겨 박스가 좁혀지도록 한다.
   */
  target?: Object3D | null;
}

const boundingBoxGeometryCache = new WeakMap<Object3D, BufferGeometry | null>();

/**
 * clone 전체의 bounding box(local space) 12개 모서리 line 만 만든다.
 * 이전에는 EdgesGeometry로 모든 mesh의 sharp edge를 그려 시각적으로 과했고,
 * 자식 메시 단위 선택을 도입할 때 부모/자식 selection box가 겹쳐 어지러워진다.
 * 가장 외곽 박스만 그리면 자식 선택 시에도 박스가 겹치지 않는다.
 */
function buildBoundingBoxFromClone(clone: Object3D): BufferGeometry | null {
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
  const sx = max.x - min.x;
  const sy = max.y - min.y;
  const sz = max.z - min.z;

  // 각 모서리를 양쪽 코너 끝에서만 짧게 그리고 가운데는 비운다.
  // 코너 길이를 해당 축의 35%까지 키워 시인성을 높인다.
  const lx = sx * 0.35;
  const ly = sy * 0.35;
  const lz = sz * 0.35;

  const positions: number[] = [];

  /**
   * (a, b)를 잇는 모서리의 양 끝 길이만큼 line segment 2개를 추가한다.
   */
  const pushEdgeBrackets = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    edgeLen: number,
  ) => {
    const dx = (bx - ax) / edgeLen;
    const dy = (by - ay) / edgeLen;
    const dz = (bz - az) / edgeLen;
    // a 코너에서 일정 거리만큼
    let len: number;
    if (dx !== 0) len = lx;
    else if (dy !== 0) len = ly;
    else len = lz;

    positions.push(ax, ay, az, ax + dx * len, ay + dy * len, az + dz * len);
    positions.push(bx, by, bz, bx - dx * len, by - dy * len, bz - dz * len);
  };

  // 12 모서리: bottom 4 + top 4 + vertical 4
  // bottom rectangle (y = min)
  pushEdgeBrackets(min.x, min.y, min.z, max.x, min.y, min.z, sx);
  pushEdgeBrackets(max.x, min.y, min.z, max.x, min.y, max.z, sz);
  pushEdgeBrackets(max.x, min.y, max.z, min.x, min.y, max.z, sx);
  pushEdgeBrackets(min.x, min.y, max.z, min.x, min.y, min.z, sz);
  // top rectangle (y = max)
  pushEdgeBrackets(min.x, max.y, min.z, max.x, max.y, min.z, sx);
  pushEdgeBrackets(max.x, max.y, min.z, max.x, max.y, max.z, sz);
  pushEdgeBrackets(max.x, max.y, max.z, min.x, max.y, max.z, sx);
  pushEdgeBrackets(min.x, max.y, max.z, min.x, max.y, min.z, sz);
  // vertical edges
  pushEdgeBrackets(min.x, min.y, min.z, min.x, max.y, min.z, sy);
  pushEdgeBrackets(max.x, min.y, min.z, max.x, max.y, min.z, sy);
  pushEdgeBrackets(max.x, min.y, max.z, max.x, max.y, max.z, sy);
  pushEdgeBrackets(min.x, min.y, max.z, min.x, max.y, max.z, sy);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(positions), 3),
  );
  return geometry;
}

function getBoundingBoxGeometry(object: Object3D) {
  const cached = boundingBoxGeometryCache.get(object);
  if (cached !== undefined) {
    return cached;
  }

  const geometry = buildBoundingBoxFromClone(object);
  boundingBoxGeometryCache.set(object, geometry);
  return geometry;
}

export function ModelSelectionBox({
  clone,
  isSelected,
  target,
}: ModelSelectionBoxProps) {
  const edgesGeometry = useMemo(() => {
    if (!isSelected) {
      return null;
    }

    return getBoundingBoxGeometry(target ?? clone);
  }, [isSelected, clone, target]);

  // ModelSelectionBox는 ModelMesh가 렌더하는 <primitive object={clone}>의
  // 자식으로 마운트되므로 부모 transform을 자동으로 상속받는다. 즉, 별도
  // useFrame 매트릭스 sync가 불필요하다(이전 구현은 매 프레임 invalidate를
  // 강제해 R3F on-demand 렌더링을 무력화했다).
  if (!isSelected || !edgesGeometry) {
    return null;
  }

  // 부모 모델 = 노란색, 자식 mesh = 청록(cyan). target prop 유무로 구분.
  // depthTest=false + renderOrder 1 → 모델 안쪽이어도 항상 보임.
  // 같은 라인을 약간 어둡게 한 번 더 그려 outline 효과로 시인성 보강.
  const isMeshSelection = Boolean(target);
  const mainColor = isMeshSelection ? '#22d3ee' : '#facc15';
  const shadowColor = isMeshSelection ? '#0e7490' : '#854d0e';

  return (
    <>
      <lineSegments
        geometry={edgesGeometry}
        renderOrder={1}
        scale={[1.02, 1.02, 1.02]}
      >
        <lineBasicMaterial
          color={shadowColor}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </lineSegments>
      <lineSegments geometry={edgesGeometry} renderOrder={2}>
        <lineBasicMaterial color={mainColor} depthTest={false} />
      </lineSegments>
    </>
  );
}
