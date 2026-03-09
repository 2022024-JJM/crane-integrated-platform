import { Html, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '../model/types';
import { degToRad } from '../lib/math-utils';
import { Box3, Vector3 } from 'three';

interface GltfModelProps {
  id: string;
  url: string;
  equipName?: string;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
}

export function GltfModel({
  id,
  url,
  equipName,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: GltfModelProps) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const [offsetY, setOffsetY] = useState<number>(0);

  useEffect(() => {
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);

    setOffsetY(size.y + 0.2);
  }, []);

  return (
    <>
      {/* 3D Mesh */}
      <primitive
        key={id}
        name={id}
        object={clone}
        position={position}
        rotation={rotation.map((deg) => degToRad(deg))}
        scale={scale}
      />

      {/* 2D Label */}
      <Html
        key={id}
        transform
        sprite
        center
        zIndexRange={[5, 0]}
        position={[position[0], position[1] + offsetY, position[2]]}
      >
        <div
          className="
              px-1 py-0
              text-white bg-black/60
              rounded text-lg font-mono
              whitespace-nowrap cursor-pointer
            "
        >
          {equipName}
        </div>
      </Html>
    </>
  );
}
