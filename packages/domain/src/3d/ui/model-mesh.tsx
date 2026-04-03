import { useGLTF } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box3, Color, Material, Mesh, Object3D, Vector3 } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '@crane/core/types/math';
import { degToRad } from '../lib/math-utils';
import type { ThreeEvent } from '@react-three/fiber';
import type { AlarmHighlightSeverity } from './model-label';

const ALARM_MESH_COLOR: Record<AlarmHighlightSeverity, number> = {
  critical: 0xdc2626,
  high: 0xf97316,
  medium: 0xeab308,
  info: 0x3b82f6,
};

interface ModelMeshProps {
  id: string;
  url: string;
  opacity?: number;
  alarmSeverity?: AlarmHighlightSeverity | null;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  onSelect?: (id: string) => void;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
  children?: React.ReactNode;
}

export function useClonedModel(url: string) {
  const { scene } = useGLTF(url);

  return useMemo(() => {
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
            (cloned as Material & { _originalColor: Color })._originalColor =
              cloned.color.clone();
          }
          materials.push(cloned);
          return cloned;
        });
        return;
      }

      const cloned = child.material.clone();
      if ('color' in cloned && cloned.color instanceof Color) {
        (cloned as Material & { _originalColor: Color })._originalColor = (
          cloned.color as Color
        ).clone();
      }
      child.material = cloned;
      materials.push(cloned);

      if (child.geometry) {
        child.geometry.computeBoundingSphere();
      }
    });

    return { clone: nextClone, meshMaterials: materials };
  }, [scene]);
}

export function useModelLabelOffsetY(clone: Object3D, scale: Vector3Tuple) {
  return useMemo(() => {
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    return Math.max(size.y * scale[1] + 0.2, 2.0);
  }, [clone, scale]);
}

export function ModelMesh({
  id,
  url,
  opacity = 1,
  alarmSeverity = null,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  onSelect,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  children,
}: ModelMeshProps) {
  const { clone, meshMaterials } = useClonedModel(url);
  const modelRef = useRef<Object3D | null>(null);

  const handleSelect = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect?.(id);
    },
    [id, onSelect],
  );

  const handleHoverStart = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverStart?.(id, event.clientX, event.clientY);
    },
    [id, onHoverStart],
  );

  const handleHoverMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverMove?.(id, event.clientX, event.clientY);
    },
    [id, onHoverMove],
  );

  const handleHoverEnd = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverEnd?.(id);
    },
    [id, onHoverEnd],
  );

  const handleModelRef = useCallback((object: Object3D | null) => {
    modelRef.current = object;
  }, []);

  const onObjectReadyRef = useRef(onObjectReady);
  onObjectReadyRef.current = onObjectReady;

  const rotationRad = useMemo(
    () => rotation.map((deg) => degToRad(deg)) as Vector3Tuple,
    [rotation],
  );

  useEffect(() => {
    for (const material of meshMaterials) {
      const mat = material as Material & {
        opacity: number;
        transparent: boolean;
        depthWrite: boolean;
        color?: Color;
        _originalColor?: Color;
        needsUpdate: boolean;
      };

      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      mat.depthWrite = opacity >= 1;

      if (mat.color && mat._originalColor) {
        if (alarmSeverity && alarmSeverity in ALARM_MESH_COLOR) {
          mat.color.setHex(ALARM_MESH_COLOR[alarmSeverity]);
        } else {
          mat.color.copy(mat._originalColor);
        }
      }

      mat.needsUpdate = true;
    }
  }, [meshMaterials, opacity, alarmSeverity]);

  useEffect(() => {
    if (!onObjectReadyRef.current) {
      return;
    }

    const object = modelRef.current;
    const frame = requestAnimationFrame(() => {
      const nextObject = modelRef.current;

      onObjectReadyRef.current?.(
        id,
        nextObject && nextObject.parent
          ? nextObject
          : object?.parent
            ? object
            : null,
      );
    });

    return () => {
      cancelAnimationFrame(frame);
      onObjectReadyRef.current?.(id, null);
    };
  }, [id]);

  return (
    <>
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
      {children}
    </>
  );
}

export { type ModelMeshProps };
