import { Html, useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box3, Box3Helper, Color, Material, Mesh, Object3D, Vector3 } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '@/shared/types/math';
import { degToRad } from '../lib/math-utils';

type AlarmHighlightSeverity = 'critical' | 'high' | 'medium' | 'info';

const ALARM_LABEL_CLASS: Record<AlarmHighlightSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  info: 'bg-blue-500 text-white',
};

interface GltfModelProps {
  id: string;
  url: string;
  equipName?: string;
  opacity?: number;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  alarmSeverity?: AlarmHighlightSeverity | null;
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
  alarmSeverity = null,
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
  const { clone, meshMaterials } = useMemo(() => {
    const nextClone = SkeletonUtils.clone(scene);
    const materials: Material[] = [];

    nextClone.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const cloned = material.clone();
          if ('color' in cloned && cloned.color instanceof Color) {
            (cloned as Material & { _originalColor: Color })._originalColor = cloned.color.clone();
          }
          materials.push(cloned);
          return cloned;
        });
        return;
      }

      const cloned = child.material.clone();
      if ('color' in cloned && cloned.color instanceof Color) {
        (cloned as Material & { _originalColor: Color })._originalColor = (cloned.color as Color).clone();
      }
      child.material = cloned;
      materials.push(cloned);

      if (child.geometry) {
        child.geometry.computeBoundingSphere();
      }
    });

    return { clone: nextClone, meshMaterials: materials };
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

  const handleSelect = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(id);
  }, [id, onSelect]);

  const handleHoverStart = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverStart?.(id, event.clientX, event.clientY);
  }, [id, onHoverStart]);

  const handleHoverMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverMove?.(id, event.clientX, event.clientY);
  }, [id, onHoverMove]);

  const handleHoverEnd = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverEnd?.(id);
  }, [id, onHoverEnd]);

  const handleModelRef = useCallback((object: Object3D | null) => {
    modelRef.current = object;
  }, []);

  const rotationRad = useMemo(
    () => rotation.map((deg) => degToRad(deg)) as Vector3Tuple,
    [rotation],
  );

  const offsetY = useMemo(() => {
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    return Math.max(size.y * scale[1] + 0.2, 2.0);
  }, [clone, scale]);

  useEffect(() => {
    for (const material of meshMaterials) {
      const mat = material as Material & {
        opacity: number;
        transparent: boolean;
        depthWrite: boolean;
        needsUpdate: boolean;
      };

      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      mat.depthWrite = opacity >= 1;
      mat.needsUpdate = true;
    }
  }, [meshMaterials, opacity]);


  useEffect(() => {
    if (!onObjectReady) {
      return;
    }

    const object = modelRef.current;
    const frame = requestAnimationFrame(() => {
      const nextObject = modelRef.current;

      onObjectReady(
        id,
        nextObject && nextObject.parent ? nextObject : object?.parent ? object : null,
      );
    });

    return () => {
      cancelAnimationFrame(frame);
      onObjectReady(id, null);
    };
  }, [id, onObjectReady]);

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
        rotation={rotationRad}
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
          className={`cursor-pointer rounded px-2 py-0.5 font-mono text-2xl font-bold whitespace-nowrap drop-shadow-lg ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : 'bg-black/80 text-white'}`}
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
