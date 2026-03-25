import { Html, useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box3, Box3Helper, Material, Mesh, Object3D, Vector3 } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '@/shared/types/math';
import { degToRad } from '../lib/math-utils';

interface GltfModelProps {
  id: string;
  url: string;
  equipName?: string;
  opacity?: number;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function GltfModel({
  id,
  url,
  equipName,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  onSelect,
  isSelected = false,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: GltfModelProps) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const nextClone = SkeletonUtils.clone(scene);

    nextClone.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
        return;
      }

      child.material = child.material.clone();
    });

    return nextClone;
  }, [scene]);
  const modelRef = useRef<Object3D | null>(null);
  const selectionBox = useMemo(() => new Box3(), []);
  const selectionHelper = useMemo(() => {
    const helper = new Box3Helper(selectionBox, '#ffff00');
    const material = Array.isArray(helper.material)
      ? helper.material[0]
      : helper.material;

    material.depthTest = false;
    helper.renderOrder = 1;

    return helper;
  }, [selectionBox]);

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(id);
  };

  const handleHoverStart = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverStart?.(id, event.clientX, event.clientY);
  };

  const handleHoverMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverMove?.(id, event.clientX, event.clientY);
  };

  const handleHoverEnd = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverEnd?.(id);
  };

  const handleModelRef = useCallback(
    (object: Object3D | null) => {
      modelRef.current = object;
      onObjectReady?.(id, object);
    },
    [id, onObjectReady],
  );

  const offsetY = useMemo(() => {
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    return size.y + 0.2;
  }, [clone]);

  useEffect(() => {
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        const nextMaterial = material as Material & {
          opacity: number;
          transparent: boolean;
          depthWrite: boolean;
          needsUpdate: boolean;
        };

        nextMaterial.opacity = opacity;
        nextMaterial.transparent = opacity < 1;
        nextMaterial.depthWrite = opacity >= 1;
        nextMaterial.needsUpdate = true;
      });
    });
  }, [clone, opacity]);

  useFrame(() => {
    if (!isSelected || !modelRef.current) {
      return;
    }

    selectionBox.setFromObject(modelRef.current);
  });

  return (
    <>
      {/* 3D Mesh */}
      <primitive
        ref={handleModelRef}
        name={id}
        object={clone}
        position={position}
        rotation={rotation.map((deg) => degToRad(deg))}
        scale={scale}
        onClick={handleSelect}
        onPointerOver={handleHoverStart}
        onPointerMove={handleHoverMove}
        onPointerOut={handleHoverEnd}
      />
      {isSelected ? <primitive object={selectionHelper} /> : null}

      {/* 2D Label */}
      <Html
        transform
        sprite
        center
        zIndexRange={[5, 0]}
        position={[position[0], position[1] + offsetY, position[2]]}
      >
        <div
          className="cursor-pointer rounded bg-black/60 px-1 py-0 font-mono text-lg whitespace-nowrap text-white"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerEnter={(event) => {
            event.stopPropagation();
            onHoverStart?.(id, event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            onHoverMove?.(id, event.clientX, event.clientY);
          }}
          onPointerLeave={(event) => {
            event.stopPropagation();
            onHoverEnd?.(id);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(id);
          }}
        >
          {equipName}
        </div>
      </Html>
    </>
  );
}
