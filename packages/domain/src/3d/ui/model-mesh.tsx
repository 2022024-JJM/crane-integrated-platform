import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box3, BufferGeometry, Color, Material, Mesh, Object3D, Vector3 } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '@crane/core/types/math';
import '../lib/bvh-setup';
import { withBaseUrl } from '../lib/asset-url';
import { degToRad } from '../lib/math-utils';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { findMeshByPath, getMeshPath, makeMeshId } from '../lib/mesh-path';
import { fillModelBottomOffsetFromClone } from '../lib/model-bottom-offset-cache';
import {
  registerSceneOccluders,
  unregisterSceneOccluders,
} from '../lib/scene-occluder-registry';
import type { ThreeEvent } from '@react-three/fiber';
import type { SavedMeshOverride } from '../model/types';
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
  meshOverrides?: SavedMeshOverride[];
  /** 센서 raycast occluder로 등록할지. 기본 true. 지도는 false. */
  isSensorOccluder?: boolean;
  onSelect?: (id: string, event?: ThreeEvent<MouseEvent>) => void;
  /**
   * 더블클릭 시 별도 호출. R3F의 onClick은 detail 카운트가 신뢰적이지 않아
   * onDoubleClick(=DOM dblclick)을 별도 prop으로 분리한다.
   */
  onDoubleSelect?: (id: string, event: ThreeEvent<MouseEvent>) => void;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
  children?: React.ReactNode;
}

/**
 * GLTF 인스턴스의 메시 원본 material을 이후 lazy clone에서 복원할 수 있도록
 * 보관한다. 평소(opacity=1, alarm=null) fast-path에서는 mesh.material이
 * GLTF 원본 reference 그대로이며, alarm/opacity가 활성화되는 instance에서만
 * 1회 clone하여 instance 전용으로 mutate한다.
 */
interface MeshMaterialBinding {
  mesh: Mesh;
  /** 마운트 시점의 원본 material reference. fast-path 복원/판별에 사용. */
  original: Material | Material[];
  /** 이 instance용으로 lazy clone된 material(slow-path 진입 후). */
  cloned: Material | Material[] | null;
}

/**
 * clone tree의 모든 Object3D에 대해 GLTF 원본 transform을 캐시. mesh override
 * undo/redo 시 reset 기준으로 사용한다. clone 생성 직후의 값이므로 사용자
 * mutation이 섞이지 않은 진짜 원본이 보장된다.
 */
interface OriginalTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
}

export function useClonedModel(url: string) {
  const { scene } = useGLTF(withBaseUrl(url));

  return useMemo(() => {
    const nextClone = SkeletonUtils.clone(scene);
    const bindings: MeshMaterialBinding[] = [];
    const originalTransforms = new Map<Object3D, OriginalTransform>();

    nextClone.traverse((child) => {
      // 모든 Object3D(Mesh, Group, Bone 등)의 원본 transform을 캐시한다.
      // mesh override undo/redo 시 reset 기준이며, 사용자 편집 전 값이라
      // stale 위험이 없다.
      originalTransforms.set(child, {
        position: [child.position.x, child.position.y, child.position.z],
        rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
        scale: [child.scale.x, child.scale.y, child.scale.z],
        visible: child.visible,
      });

      if (!(child instanceof Mesh)) {
        return;
      }

      // material reference는 GLTF 원본을 그대로 공유한다. 같은 GLTF의
      // 모든 instance가 같은 material을 쓰므로 메모리·GPU 업로드 비용이
      // 1회로 줄어든다. 변경이 필요한 instance만 useEffect에서 lazy clone.
      bindings.push({
        mesh: child,
        original: child.material,
        cloned: null,
      });

      if (child.geometry) {
        child.geometry.computeBoundingSphere();
      }
    });

    // 같은 url의 모델이 처음 mount될 때 unscaled bottom offset을 캐시에 채운다.
    // 드롭 시 이 캐시 값에 사용자의 scale.y를 곱해 모델 바닥을 지면에 닿게 한다.
    fillModelBottomOffsetFromClone(url, nextClone);

    return { clone: nextClone, meshBindings: bindings, originalTransforms };
  }, [scene, url]);
}

/**
 * material에 mutation이 필요한 instance만 lazy clone 한다. 한 번 clone되면
 * 이후 같은 instance의 추가 변경은 cloned material을 재사용한다.
 */
function ensureClonedMaterials(binding: MeshMaterialBinding): Material[] {
  if (binding.cloned) {
    return Array.isArray(binding.cloned) ? binding.cloned : [binding.cloned];
  }

  if (Array.isArray(binding.original)) {
    const cloned = binding.original.map((material) => {
      const c = material.clone();
      if ('color' in c && c.color instanceof Color) {
        (c as unknown as { _originalColor: Color })._originalColor =
          c.color.clone();
      }
      return c;
    });
    binding.cloned = cloned;
    binding.mesh.material = cloned;
    return cloned;
  }

  const cloned = binding.original.clone();
  if ('color' in cloned && cloned.color instanceof Color) {
    (cloned as unknown as { _originalColor: Color })._originalColor = (
      cloned.color as Color
    ).clone();
  }
  binding.cloned = cloned;
  binding.mesh.material = cloned;
  return [cloned];
}

/**
 * fast-path 복원: cloned material이 있으면 dispose 하고 mesh.material을 다시
 * GLTF 원본 reference로 되돌린다. opacity/alarm 모두 비활성화된 상태로 돌아갈 때
 * 호출된다.
 */
function restoreOriginalMaterials(binding: MeshMaterialBinding): void {
  if (!binding.cloned) return;

  const cloned = Array.isArray(binding.cloned)
    ? binding.cloned
    : [binding.cloned];
  for (const c of cloned) {
    c.dispose();
  }
  binding.cloned = null;
  binding.mesh.material = binding.original;
}

export function useModelLabelOffsetY(clone: Object3D, scale: Vector3Tuple) {
  return useMemo(() => {
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    return Math.max(size.y * scale[1] + 0.2, 2.0);
  }, [clone, scale]);
}

/**
 * 라벨을 모델의 정중앙 위에 띄우기 위한 unscaled local anchor.
 *
 * (x, z) = clone bbox의 중심 — 모델의 origin이 한쪽으로 치우쳐 있어도
 *           시각적 정중앙에 라벨이 온다.
 * y      = clone bbox의 최상단 + 약간의 padding — 모델 위에 살짝 떠 있게.
 *
 * 이 hook이 반환하는 값은 unscaled local 좌표다. ModelMesh의 primitive 자식
 * 으로 라벨을 마운트하면 부모 scale/rotation/position이 자동 적용되어 라벨이
 * 모델과 함께 움직이고 회전한다. 드래그 중에도 sceneInfo state와 무관하게
 * 정확히 따라간다.
 */
export function useModelLabelLocalAnchor(
  clone: Object3D,
): Vector3Tuple {
  return useMemo(() => {
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

    if (box.isEmpty()) {
      return [0, 2, 0];
    }
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    // unscaled bbox top + 약간의 padding (unscaled 단위). 부모 scale이 곱해져
    // 화면에서 적절한 거리가 된다.
    const topY = box.max.y + 0.2;
    return [cx, topY, cz];
  }, [clone]);
}

export function ModelMesh({
  id,
  url,
  opacity = 1,
  alarmSeverity = null,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  meshOverrides,
  isSensorOccluder = true,
  onSelect,
  onDoubleSelect,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  children,
}: ModelMeshProps) {
  const { clone, meshBindings, originalTransforms } = useClonedModel(url);
  const modelRef = useRef<Object3D | null>(null);
  // 이전 effect에서 override가 적용된 적이 있는 target들. 다음 effect 실행 시
  // 모두 originalTransforms로 reset한 뒤 현재 override를 다시 적용한다.
  const touchedTargetsRef = useRef<Set<Object3D>>(new Set());

  const handleSelect = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect?.(id, event);
    },
    [id, onSelect],
  );

  const handleDoubleSelect = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onDoubleSelect?.(id, event);
    },
    [id, onDoubleSelect],
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
    // Fast path: opacity 100% + 알람 없음 → mesh.material을 GLTF 원본
    // reference 그대로 두어 같은 GLTF의 모든 instance가 material을 공유한다.
    // 메모리·GPU 업로드 비용이 instance 수에 비례해 누적되지 않는다.
    const needsMutation = opacity < 1 || alarmSeverity !== null;

    if (!needsMutation) {
      for (const binding of meshBindings) {
        restoreOriginalMaterials(binding);
      }
      return;
    }

    // Slow path: 이 instance만 lazy clone하여 mutate.
    for (const binding of meshBindings) {
      const materials = ensureClonedMaterials(binding);
      for (const material of materials) {
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
    }
  }, [meshBindings, opacity, alarmSeverity]);

  // 인스턴스 언마운트 시 lazy clone된 material을 dispose 한다.
  useEffect(() => {
    return () => {
      for (const binding of meshBindings) {
        restoreOriginalMaterials(binding);
      }
    };
  }, [meshBindings]);

  // meshOverrides 적용. undo/redo로 override가 변하면 매 effect 실행 시
  // (1) 이전에 touched된 target들을 useClonedModel이 캐시한 GLTF 원본 transform
  //     으로 reset
  // (2) 현재 override 다시 적용
  // 하는 방식으로 stale 상태를 막는다.
  useEffect(() => {
    // path → mesh material binding lookup (opacity override 시 lazy clone)
    const bindingByMesh = new Map<Object3D, MeshMaterialBinding>();
    for (const binding of meshBindings) {
      bindingByMesh.set(binding.mesh, binding);
    }

    const touched = touchedTargetsRef.current;

    // (1) reset
    for (const target of touched) {
      const original = originalTransforms.get(target);
      if (!original) continue;
      target.position.set(
        original.position[0],
        original.position[1],
        original.position[2],
      );
      target.rotation.set(
        original.rotation[0],
        original.rotation[1],
        original.rotation[2],
      );
      target.scale.set(
        original.scale[0],
        original.scale[1],
        original.scale[2],
      );
      target.visible = original.visible;
    }
    touched.clear();

    if (!meshOverrides || meshOverrides.length === 0) {
      return;
    }

    // (2) 현재 override 적용. 단, 현재 transform이 이미 override 값과 거의
    // 같으면 skip — TransformControls가 드래그 중 mesh를 직접 mutate하므로
    // 같은 값으로 set 하면 controls 내부 상태와 충돌해 점프가 발생할 수 있다.
    const EPS = 1e-4;
    const close = (a: number, b: number) => Math.abs(a - b) < EPS;
    for (const ov of meshOverrides) {
      const target = findMeshByPath(clone, ov.meshPath);
      if (!target) continue;

      touched.add(target);

      if (
        ov.position &&
        !(
          close(target.position.x, ov.position[0]) &&
          close(target.position.y, ov.position[1]) &&
          close(target.position.z, ov.position[2])
        )
      ) {
        target.position.set(ov.position[0], ov.position[1], ov.position[2]);
      }
      if (ov.rotation) {
        const rx = degToRad(ov.rotation[0]);
        const ry = degToRad(ov.rotation[1]);
        const rz = degToRad(ov.rotation[2]);
        if (
          !(
            close(target.rotation.x, rx) &&
            close(target.rotation.y, ry) &&
            close(target.rotation.z, rz)
          )
        ) {
          target.rotation.set(rx, ry, rz);
        }
      }
      if (
        ov.scale &&
        !(
          close(target.scale.x, ov.scale[0]) &&
          close(target.scale.y, ov.scale[1]) &&
          close(target.scale.z, ov.scale[2])
        )
      ) {
        target.scale.set(ov.scale[0], ov.scale[1], ov.scale[2]);
      }
      if (typeof ov.visible === 'boolean') {
        target.visible = ov.visible;
      }

      if (typeof ov.opacity === 'number' && ov.opacity < 1) {
        const binding = bindingByMesh.get(target);
        if (binding) {
          const materials = ensureClonedMaterials(binding);
          for (const material of materials) {
            const mat = material as Material & {
              opacity: number;
              transparent: boolean;
              depthWrite: boolean;
              needsUpdate: boolean;
            };
            mat.opacity = ov.opacity;
            mat.transparent = true;
            mat.depthWrite = false;
            mat.needsUpdate = true;
          }
        }
      }
    }
  }, [meshOverrides, meshBindings, clone, originalTransforms]);

  useEffect(() => {
    const object = modelRef.current;
    let registeredObject: Object3D | null = null;
    // mesh path → registry id 매핑. 언마운트 시 같이 unregister 한다.
    const registeredMeshIds: string[] = [];

    const frame = requestAnimationFrame(() => {
      const nextObject = modelRef.current;
      const ready =
        nextObject && nextObject.parent
          ? nextObject
          : object?.parent
            ? object
            : null;

      if (ready) {
        modelObjectRegistry.register(id, ready);
        registeredObject = ready;

        // 자식 mesh를 모두 registry에 등록한다. 더블클릭 drill-in 후
        // TransformControls가 곧바로 mesh를 잡을 수 있도록 mount 시 1회 traverse.
        for (const binding of meshBindings) {
          const meshPath = getMeshPath(clone, binding.mesh);
          if (meshPath === null) continue;
          const meshId = makeMeshId(id, meshPath);
          modelObjectRegistry.register(meshId, binding.mesh);
          registeredMeshIds.push(meshId);
        }
      }

      onObjectReadyRef.current?.(id, ready);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (registeredObject) {
        modelObjectRegistry.unregister(id, registeredObject);
      } else {
        modelObjectRegistry.unregister(id);
      }
      for (const meshId of registeredMeshIds) {
        modelObjectRegistry.unregister(meshId);
      }
      onObjectReadyRef.current?.(id, null);
    };
  }, [id, clone, meshBindings]);

  // 센서(LIDAR/Camera) raycast의 occluder 후보로 이 모델의 mesh들을 등록한다.
  // 각 geometry에 BVH(boundsTree)를 빌드해 raycast 가속. mount 시 1회.
  // 부모 모델의 transform은 TransformControls/sceneInfo를 통해 mesh의
  // worldMatrix에 자동 반영되므로 raycast 결과도 항상 최신 위치 기준이다.
  //
  // 지도(isSensorOccluder=false)는 지형 역할이라 등록하지 않는다 — 등록하면
  // 지도 mesh가 카메라/LIDAR 바로 앞에 있어 모든 ray가 0 거리에서 지도를
  // 때리면서 frustum이 붕괴하거나 sensor.far로 fallback된다.
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    if (!isSensorOccluder) return;
    const meshes: Mesh[] = [];
    for (const binding of meshBindings) {
      const geometry = binding.mesh.geometry as BufferGeometry & {
        boundsTree?: unknown;
        computeBoundsTree?: () => void;
      };
      if (!geometry.boundsTree && geometry.computeBoundsTree) {
        geometry.computeBoundsTree();
      }
      meshes.push(binding.mesh);
    }
    registerSceneOccluders(scene, id, meshes);
    return () => {
      unregisterSceneOccluders(scene, id);
    };
  }, [id, scene, meshBindings, isSensorOccluder]);

  // primitive 자체에 prop transform을 적용하면 React가 매 렌더에서 clone의
  // position/rotation/scale을 덮어쓴다. value-mapper가 매 tick `object.position`
  // 을 mutate하는 fast path가 이 동작을 그대로 활용한다(다음 렌더 사이에는
  // 덮어쓰지 않음).
  //
  // children(ModelSelectionBox 등)을 primitive 자식으로 직접 마운트하면
  // three.js scene graph에서 clone의 children 배열에 추가되어 부모 transform
  // (TransformControls가 매 frame mutate하는 transform 포함)을 자동 상속한다.
  // 이전에는 별도 group으로 묶어 sceneInfo의 position/rotation/scale prop을
  // 사용했는데, 드래그 중 sceneInfo write가 멈추면 group이 멈춰서 selection
  // box가 객체와 분리되는 문제가 있었다.
  return (
    <primitive
      ref={handleModelRef}
      name={id}
      object={clone}
      position={position}
      rotation={rotationRad}
      scale={scale}
      onClick={handleSelect}
      onDoubleClick={handleDoubleSelect}
      onPointerOver={handleHoverStart}
      onPointerMove={handleHoverMove}
      onPointerOut={handleHoverEnd}
    >
      {children}
    </primitive>
  );
}

export { type ModelMeshProps };
