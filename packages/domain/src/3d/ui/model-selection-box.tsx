import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';

interface ModelSelectionBoxProps {
  modelRef: RefObject<Object3D | null>;
  clone: Object3D;
  isSelected: boolean;
}

function buildEdgesFromClone(clone: Object3D): BufferGeometry | null {
  const allPositions: number[] = [];
  const vec = new Vector3();

  clone.updateMatrixWorld(true);
  const cloneInverse = new Matrix4().copy(clone.matrixWorld).invert();

  clone.traverse((child) => {
    if (!(child instanceof Mesh) || !child.geometry) {
      return;
    }

    const edges = new EdgesGeometry(child.geometry, 30);
    const posAttr = edges.getAttribute('position');
    if (!posAttr) {
      edges.dispose();
      return;
    }

    // Transform from child's local space → clone's local space
    const toCloneLocal = new Matrix4()
      .copy(cloneInverse)
      .multiply(child.matrixWorld);

    for (let i = 0; i < posAttr.count; i++) {
      vec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      vec.applyMatrix4(toCloneLocal);
      allPositions.push(vec.x, vec.y, vec.z);
    }

    edges.dispose();
  });

  if (allPositions.length === 0) return null;

  const merged = new BufferGeometry();
  merged.setAttribute(
    'position',
    new Float32BufferAttribute(allPositions, 3),
  );
  return merged;
}

export function ModelSelectionBox({
  modelRef,
  clone,
  isSelected,
}: ModelSelectionBoxProps) {
  const [edgesGeometry, setEdgesGeometry] = useState<BufferGeometry | null>(
    null,
  );
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    if (!isSelected) {
      setEdgesGeometry((prev) => {
        prev?.dispose();
        return null;
      });
      return;
    }

    const geometry = buildEdgesFromClone(clone);
    setEdgesGeometry((prev) => {
      prev?.dispose();
      return geometry;
    });

    return () => {
      geometry?.dispose();
    };
  }, [isSelected, clone]);

  // Sync group transform with modelRef (primitive) every frame
  useFrame(() => {
    if (!groupRef.current || !modelRef.current) return;
    const model = modelRef.current;
    model.updateWorldMatrix(true, false);
    groupRef.current.matrixAutoUpdate = false;
    groupRef.current.matrix.copy(model.matrixWorld);
    groupRef.current.matrixWorld.copy(model.matrixWorld);
  });

  if (!isSelected || !edgesGeometry) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <lineSegments geometry={edgesGeometry} renderOrder={1}>
        <lineBasicMaterial color="#ffff00" depthTest={false} />
      </lineSegments>
    </group>
  );
}
