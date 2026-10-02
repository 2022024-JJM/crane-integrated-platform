import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  AMBIENT,
  AXES_HELPER_SIZE,
  GRID_HELPER,
} from '../../lib/point-cloud/config';

export function SceneHelpers() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const mat = grid.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        m.transparent = true;
        m.opacity = GRID_HELPER.opacity;
      }
    } else {
      mat.transparent = true;
      mat.opacity = GRID_HELPER.opacity;
    }
  }, []);

  return (
    <>
      <ambientLight color={AMBIENT.color} intensity={AMBIENT.intensity} />
      <gridHelper
        ref={gridRef}
        args={[
          GRID_HELPER.size,
          GRID_HELPER.divisions,
          GRID_HELPER.color1,
          GRID_HELPER.color2,
        ]}
      />
      <axesHelper args={[AXES_HELPER_SIZE]} />
    </>
  );
}
