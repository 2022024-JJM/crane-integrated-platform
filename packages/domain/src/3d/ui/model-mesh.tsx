import { useGLTF } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box3, Color, Material, Mesh, Object3D, Vector3 } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { Vector3Tuple } from '@crane/core/types/math';
import '../lib/bvh-setup';
import { bvhBuildQueue } from '../lib/bvh-build-queue';
import { extendGltfLoaderWithKtx2 } from '../lib/ktx2-loader';
import { invalidateShadows } from '../lib/shadow-invalidation';
import { withBaseUrl } from '@crane/core/lib/asset-url';
import { degToRad } from '../lib/math-utils';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { findMeshByPath, getMeshPath, makeMeshId } from '../lib/mesh-path';
import { seedRestPose } from '../lib/rest-pose-cache';
import { fillModelBottomOffsetFromClone } from '../lib/model-bottom-offset-cache';
import { applySeaSubmersion, clearSeaSubmersion } from '../lib/sea-submersion';
import {
  assignSharedSeaMaterials,
  createMeshMaterialBinding,
  ensureClonedMaterials,
  restoreOriginalMaterials,
  type MeshMaterialBinding,
} from '../lib/mesh-material-binding';
import { toLambertMaterials } from '../lib/lambert-material';
import { markSceneOpaqueStencils } from '../lib/scene-stencil';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { SavedMeshOverride } from '../model/types';
import type { AlarmHighlightSeverity } from './model-label';

/** 지형 LOD 사본 메시의 raycast 무력화 — 표면·클릭 히트는 LOD0 몫. */
function noopRaycast(): void {}

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
  /**
   * 수면 아래(y < SEA_LEVEL_Y)를 깊이 안개로 흐리게 한다(lib/sea-submersion.ts).
   * 바다가 있는 씬의 모든 모델에 켠다 — 물 위에 있는 모델엔 시각적 변화가
   * 없지만 slow path(머티리얼 clone)를 타게 된다. 지도는 켜지 않는다(드라이독
   * 등 수면 아래 지형에 안개가 끼면 안 된다).
   */
  seaSubmersion?: boolean;
  /**
   * 그림자를 드리울지. 기본 true. ground 지도도 드리운다 — GLB에 건물이 함께
   * 구워져 있어 끄면 건물 그림자가 통째로 사라진다. 예외는 컨텍스트 지형
   * (philly-terrain 178만 삼각형): shadow map 은 매 프레임 다시 그려지는데
   * 이 지형이 depth pass 의 대부분을 차지했고, 작업 구역 밖 도시 건물
   * 그림자는 관제 줌에서 보이지 않아 끈다 — 호출부(outdoor-work-model-
   * simulation·에디터)가 카탈로그 kind==='context' 로 판정한다. 플래그는
   * Canvas `shadows`가 꺼져 있으면 무비용이라 항상 설정해 두고, On/Off
   * 토글은 renderer 레벨(Canvas shadows + 조명 castShadow)이 담당한다 —
   * scene-render-preset.tsx.
   */
  castShadow?: boolean;
  /**
   * 그림자를 받을지. 기본 true. 컨텍스트 지형만 false — 받을 그림자(자기
   * 건물은 cast 를 껐고, 모델은 전부 작업 구역 안)가 없는데 화면의 큰
   * 면적에서 PCF 섀도 샘플링(프래그먼트당 9탭)만 하게 된다.
   */
  receiveShadow?: boolean;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  meshOverrides?: SavedMeshOverride[];
  /**
   * 클릭 hit-test 가속용 BVH를 빌드할지. 기본 true. 정밀 raycast가 필요 없는
   * 인스턴스(bbox 존 분류만 하는 mro2/philly 자산 뷰어 등)만 false로 빌드
   * 비용을 아낀다. 지도는 드롭/선택 raycast 대상이므로 빌드한다 — BVH 없이는
   * 포인터 이동마다 수십만 삼각형을 브루트포스 순회한다.
   */
  enableRaycastBvh?: boolean;
  /**
   * 실루엣 테두리(ObjectSilhouetteOutline)용 스무딩 노멀 사본을 로딩 뒤 워밍업
   * 큐에서 미리 만들지. 기본 false. 테두리가 실제로 그려질 수 있는 캔버스
   * (스텐실 켜진 에디터·모니터링)의 **모델**만 켠다 — 지도는 넣지 않는다
   * (bvh-build-queue 주석). 안 켜도 동작은 같고 첫 표시가 그만큼 늦을 뿐이다.
   */
  prepareOutline?: boolean;
  /**
   * 부모(GltfModel)가 이미 만든 clone 결과. 전달되면 여기서 다시 clone하지
   * 않는다 — useClonedModel 주석 참고.
   */
  clonedModel?: ClonedModel;
  /** 셰이딩 등급 — ModelShading 주석. clonedModel 이 주어지면 그쪽이 결정한다. */
  shading?: ModelShading;
  onSelect?: (id: string, event?: ThreeEvent<MouseEvent>) => void;
  /**
   * 더블클릭 시 별도 호출. R3F의 onClick은 detail 카운트가 신뢰적이지 않아
   * onDoubleClick(=DOM dblclick)을 별도 prop으로 분리한다.
   */
  onDoubleSelect?: (id: string, event: ThreeEvent<MouseEvent>) => void;
  onObjectReady?: (id: string, object: Object3D | null) => void;
  /** event는 Canvas 안 3D 본체 hover에서만 전달 (라벨 등 DOM 호출은 undefined). */
  onHoverStart?: (
    id: string,
    clientX: number,
    clientY: number,
    event?: ThreeEvent<PointerEvent>,
  ) => void;
  onHoverMove?: (
    id: string,
    clientX: number,
    clientY: number,
    event?: ThreeEvent<PointerEvent>,
  ) => void;
  onHoverEnd?: (id: string) => void;
  children?: React.ReactNode;
}

// 머티리얼 상태 전이(원본 공유 ↔ 잠김 공유 ↔ 개별 클론)는
// lib/mesh-material-binding.ts 가 소유한다 — 타입은 호환을 위해 재노출.
export type { MeshMaterialBinding };

/**
 * clone tree의 모든 Object3D에 대해 GLTF 원본 transform을 캐시. mesh override
 * undo/redo 시 reset 기준으로 사용한다. clone 생성 직후의 값이므로 사용자
 * mutation이 섞이지 않은 진짜 원본이 보장된다.
 */
export interface OriginalTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
}

export interface ClonedModel {
  clone: Object3D;
  meshBindings: MeshMaterialBinding[];
  originalTransforms: Map<Object3D, OriginalTransform>;
}

/**
 * 머티리얼 셰이딩 등급. 'standard' = GLTF 의 PBR 그대로(기본, 야드 지도·
 * 크레인). 'lambert' = clone 시점에 PBR 을 Lambert 로 바꾼다(lib/
 * lambert-material.ts) — 관제와 무관한 컨텍스트 지형(카탈로그 kind
 * 'context')용. 조명·낮/밤에는 똑같이 반응하고 스펙큘러·환경맵 radiance
 * 샘플링만 없어 수 km 지형의 픽셀 비용이 준다. 호출부(outdoor-work-model-
 * simulation·에디터)가 kind 로 판정한다 — 두 화면이 같아야 한다.
 */
export type ModelShading = 'standard' | 'lambert';

export interface ClonedModelOptions {
  shading?: ModelShading;
}

/**
 * GLTF를 인스턴스 전용 트리로 clone한다. `injected`가 있으면 clone을 새로
 * 만들지 않고 그대로 쓴다 — GltfModel이 만든 clone을 ModelMesh가 재사용해
 * 인스턴스당 clone·computeBoundingSphere가 1회만 일어나게 하고, SelectionBox·
 * 라벨 앵커가 실제 렌더되는 트리와 같은 객체를 측정하도록 보장한다.
 */
export function useClonedModel(
  url: string,
  injected?: ClonedModel,
  { shading = 'standard' }: ClonedModelOptions = {},
): ClonedModel {
  // 4번째 인자: KTX2(GPU 압축 텍스처) 디코드 배선 — lib/ktx2-loader.ts 주석.
  // KTX2 GLB 를 로드하는 모든 경로가 같은 배선을 가져야 한다(누락 시 throw).
  const { scene } = useGLTF(
    withBaseUrl(url),
    true,
    true,
    extendGltfLoaderWithKtx2,
  );

  return useMemo(() => {
    if (injected) {
      return injected;
    }
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
      // 리그 드라이버의 rest pose 도 여기서 잡는다 — clone 직후라 사용자 편집·
      // 구동이 섞이지 않은 GLTF 원본이다(rest-pose-cache.ts 참고).
      seedRestPose(child);

      if (!(child instanceof Mesh)) {
        return;
      }

      // 저비용 셰이딩(컨텍스트 지형)은 바인딩을 만들기 전에 바꾼다 —
      // 바인딩·opacity clone·바다 잠김 패치가 전부 바뀐 머티리얼 기준으로
      // 돈다. 변환본은 원본당 하나로 캐시돼 clone 간 공유된다.
      if (shading === 'lambert') {
        child.material = toLambertMaterials(child.material);
      }
      // "불투명 씬 메시가 그려졌다" 스텐실 표식 — 바다 평면이 이 비트가 없는
      // 픽셀에서만 그려진다(lib/scene-stencil.ts). 원본(GLTF 캐시 공유)에
      // 직접 켠다: 멱등이고 렌더 결과가 바뀌지 않으며, 알람 tint·잠김 공유
      // variant 는 clone 으로 물려받는다. 스텐실 없는 캔버스에선 무효.
      markSceneOpaqueStencils(child.material);

      // material reference는 GLTF 원본을 그대로 공유한다. 같은 GLTF의
      // 모든 instance가 같은 material을 쓰므로 메모리·GPU 업로드 비용이
      // 1회로 줄어든다. 변경이 필요한 instance만 useEffect에서 전이한다
      // (mesh-material-binding.ts — 잠김 공유 또는 개별 clone).
      bindings.push(createMeshMaterialBinding(child));

      // 지오메트리는 GLTF 캐시로 인스턴스 간 공유되므로 최초 1회만 계산한다.
      if (child.geometry && !child.geometry.boundingSphere) {
        child.geometry.computeBoundingSphere();
      }

      if (import.meta.env.DEV) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          if ((mat as { transmission?: number }).transmission) {
            console.warn(
              `[3d] transmission 머티리얼 감지: ${url} / ${mat.name} — ` +
                'three.js가 매 프레임 씬 전체를 한 번 더 렌더링합니다. ' +
                '지도라면 pnpm optimize:map 을 돌려 제거하세요.',
            );
          }
        }
      }
    });

    // 지형 타일 LOD 사본(tile-terrain-glb.mjs --lod, extras {lod>0}) 초기화 —
    // 기본 숨김 + raycast 제외. clone 시점에 해야 첫 프레임부터 LOD0 만
    // 그려진다(effect 는 한 프레임 늦어 4중 렌더가 잠깐 생긴다). raycast 는
    // 항상 LOD0 이 담당한다 — three raycaster 는 visible 을 보지 않아 LOD0 이
    // 숨겨져 있어도 히트되므로, 표면 높이·드롭·클릭이 LOD 상태와 무관하게
    // 일정하다. 가시성 전환은 features 의 SceneTerrainLod 가 한다.
    nextClone.traverse((child) => {
      const lod = (child.userData as { lod?: unknown }).lod;
      if (typeof lod !== 'number' || lod <= 0) return;
      // GLTFLoader 는 다중 프리미티브 노드를 Group+자식 Mesh 로 펼치며 extras
      // 를 자식에도 복제한다 — 가시성은 **최상위 캐리어만** 소유해야 한다.
      // 자식까지 끄면 SceneTerrainLod 가 그룹을 켜도 자식이 꺼진 채 남아
      // 타일이 통째로 사라진다(원경 지형 소실로 실측된 결함).
      for (let p = child.parent; p; p = p.parent) {
        const parentLod = (p.userData as { lod?: unknown }).lod;
        if (typeof parentLod === 'number' && parentLod > 0) return;
      }
      child.visible = false;
      child.traverse((sub) => {
        if (!(sub instanceof Mesh)) return;
        sub.raycast = noopRaycast;
        // BVH·워밍업 큐 제외 표식(아래 enqueue 필터가 본다).
        (sub.userData as { terrainLodProxy?: boolean }).terrainLodProxy = true;
      });
    });

    // 같은 url의 모델이 처음 mount될 때 unscaled bottom offset을 캐시에 채운다.
    // 드롭 시 이 캐시 값에 사용자의 scale.y를 곱해 모델 바닥을 지면에 닿게 한다.
    fillModelBottomOffsetFromClone(url, nextClone);

    return { clone: nextClone, meshBindings: bindings, originalTransforms };
  }, [scene, url, injected, shading]);
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
 *
 * `enabled=false`(라벨 없는 인스턴스 — 지도 등)면 bbox 순회를 통째로 건너뛴다.
 * 지도급 트리(수십만 정점)에서 setFromObject + updateMatrixWorld 2회는
 * 마운트 시 수백 ms짜리 낭비다.
 */
export function useModelLabelLocalAnchor(
  clone: Object3D,
  enabled = true,
): Vector3Tuple {
  return useMemo(() => {
    if (!enabled) {
      return [0, 2, 0];
    }
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
  }, [clone, enabled]);
}

export function ModelMesh({
  id,
  url,
  opacity = 1,
  alarmSeverity = null,
  seaSubmersion = false,
  castShadow = true,
  receiveShadow = true,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  meshOverrides,
  enableRaycastBvh = true,
  prepareOutline = false,
  clonedModel,
  shading = 'standard',
  onSelect,
  onDoubleSelect,
  onObjectReady,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  children,
}: ModelMeshProps) {
  const { clone, meshBindings, originalTransforms } = useClonedModel(
    url,
    clonedModel,
    { shading },
  );
  // 아래 effect 들은 리컨실러 밖에서 머티리얼·노드를 직접 변조한다 — R3F 의
  // auto-invalidate 가 걸리지 않아 frameloop='demand' 캔버스(대시보드 3D
  // 미리보기 모달)에서 알람 색·잠김 안개·오버라이드가 다음 조작까지 화면에
  // 안 나타난다. 변조 후 invalidate 로 프레임을 깨운다('always' 에선 무해).
  const invalidate = useThree((s) => s.invalidate);
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
      onHoverStart?.(id, event.clientX, event.clientY, event);
    },
    [id, onHoverStart],
  );

  const handleHoverMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverMove?.(id, event.clientX, event.clientY, event);
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
    // 머티리얼 상태 전이(mesh-material-binding.ts):
    //   개별 클론 — opacity<1 또는 알람 tint. 인스턴스 전용 뮤테이션이라
    //     원본에서 clone 해 이 인스턴스만 물들인다(잠김 씬이면 clone 시
    //     패치 포함).
    //   잠김 공유 — seaSubmersion 만 필요한 "기본 상태". 원본당 1개의 패치
    //     클론을 전 인스턴스가 refcount 공유한다 — 예전엔 바다 씬 전 모델이
    //     인스턴스별로 clone 해 모델 수에 비례해 머티리얼·refreshMaterial
    //     비용이 늘었다. **공유본에는 어떤 프로퍼티도 쓰지 않는다.**
    //   원본 공유 — 둘 다 아님. GLTF 원본 reference 그대로.
    const needsIndividual = opacity < 1 || alarmSeverity !== null;

    if (!needsIndividual) {
      for (const binding of meshBindings) {
        if (seaSubmersion) {
          assignSharedSeaMaterials(binding);
        } else {
          restoreOriginalMaterials(binding);
        }
      }
      invalidate();
      return;
    }

    // 개별 클론 경로: 이 instance만 lazy clone하여 mutate.
    for (const binding of meshBindings) {
      const materials = ensureClonedMaterials(binding, seaSubmersion);
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

        // 클론 생성 후 seaSubmersion prop 이 뒤바뀐 경우의 패치 갱신 —
        // 생성 시 패치는 ensureClonedMaterials 가 했다(멱등).
        if (seaSubmersion) {
          applySeaSubmersion(mat);
        } else {
          clearSeaSubmersion(mat);
        }

        mat.needsUpdate = true;
      }
    }
    invalidate();
  }, [meshBindings, opacity, alarmSeverity, seaSubmersion, invalidate]);

  // 그림자 플래그 — clone은 인스턴스 전용 트리이므로 여기서 걸어도 다른
  // 인스턴스에 새지 않는다. useClonedModel의 useMemo에 넣지 않는 이유:
  // injected clone 재사용 경로에서는 그 useMemo가 돌지 않고, castShadow
  // prop 변경에도 반응해야 하기 때문.
  useEffect(() => {
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;
    });
    invalidate();
  }, [clone, castShadow, receiveShadow, invalidate]);

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
      target.scale.set(original.scale[0], original.scale[1], original.scale[2]);
      target.visible = original.visible;
    }
    touched.clear();

    if (!meshOverrides || meshOverrides.length === 0) {
      // 위 (1) reset 이 노드를 되돌렸을 수 있다 — demand 캔버스 프레임 깨움.
      invalidate();
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
          // 잠김 공유 중이던 바인딩도 여기서 개별로 승격된다 — 승격은
          // 원본에서 clone 하므로 seaSubmersion 을 넘겨 잠김 패치를 다시
          // 건다(안 넘기면 이 메시만 안개가 빠지는 회귀).
          const materials = ensureClonedMaterials(binding, seaSubmersion);
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
    invalidate();
  }, [
    meshOverrides,
    meshBindings,
    clone,
    originalTransforms,
    seaSubmersion,
    invalidate,
  ]);

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

        // 자식 mesh를 모두 registry에 등록한다. 계층 목록·더블클릭 drill-in 으로
        // 고른 노드의 바운딩 박스 대상과 F키 카메라 포커스가 여기서 찾는다.
        for (const binding of meshBindings) {
          const meshPath = getMeshPath(clone, binding.mesh);
          if (meshPath === null) continue;
          const meshId = makeMeshId(id, meshPath);
          modelObjectRegistry.register(meshId, binding.mesh);
          registeredMeshIds.push(meshId);
        }
        // Mesh 가 아닌 중간 노드(Group/Empty/Bone)도 같은 id 형식으로 등록한다.
        // 리깅 관절은 대개 피벗에 놓인 Empty 라, 계층 목록에서 골랐을 때 박스를
        // 그리려면 registry 에서 찾을 수 있어야 한다. 노드 선택은 읽기 전용이라
        // 기즈모는 붙지 않는다. forEachRoot 는 meshId 를 제외하므로 레이캐스트·
        // 카메라 핏에는 섞이지 않는다.
        clone.traverse((child) => {
          if (child === clone || child instanceof Mesh) return;
          const nodePath = getMeshPath(clone, child);
          if (nodePath === null) return;
          const nodeId = makeMeshId(id, nodePath);
          modelObjectRegistry.register(nodeId, child);
          registeredMeshIds.push(nodeId);
        });
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

  // 그림자 온디맨드 무효화(shadow-invalidation 주석의 깔때기 3) — 이
  // 인스턴스가 캐스터 집합·자세를 바꾸는 React 커밋 전부를 한 effect 로
  // 덮는다: GLB 로드 완료(clone 마운트), 배치 props 커밋(기즈모 커밋·인스펙터·
  // undo/redo·정렬), meshOverrides(transform·visible), castShadow 플립,
  // 언마운트(cleanup). 위 meshOverrides effect 뒤에 있어 같은 커밋의 mutate 가
  // 끝난 상태로 다음 렌더에 실린다. 과잉 발화는 무해하다(그 프레임 shadow
  // pass 1회일 뿐) — 그림자 꺼진 캔버스에선 no-op.
  useEffect(() => {
    invalidateShadows();
    return () => {
      invalidateShadows();
    };
  }, [clone, position, rotation, scale, meshOverrides, castShadow]);

  // 각 geometry에 BVH(boundsTree)를 빌드해 클릭 hit-test raycast를 가속한다.
  // BVH가 아직 없어도 raycast는 동작한다(acceleratedRaycast는 boundsTree가
  // 없으면 기본 raycast로 폴백). 빌드는 전역 큐가 유휴 시간에 나눠 한다 —
  // 지도 포함 이유, 언마운트 시 BVH 를 버리지 않는 이유는 bvh-build-queue 주석.
  // bbox 존 분류만 하는 자산 뷰어처럼 정밀 raycast가 필요 없는 곳만
  // enableRaycastBvh=false로 비용을 아낀다. prepareOutline 은 같은 큐에
  // 실루엣 테두리용 사본 작업을 더 넣는다(BVH 뒤에 돈다).
  useEffect(() => {
    if (!enableRaycastBvh && !prepareOutline) return;
    // 지형 LOD 사본은 제외 — raycast 자체가 무력화돼 있어(BVH 무용) 큐만
    // +131% 불린다. BVH 는 raycast 를 담당하는 LOD0 에만 빌드한다.
    const meshes = meshBindings
      .map((binding) => binding.mesh)
      .filter(
        (mesh) =>
          (mesh.userData as { terrainLodProxy?: boolean }).terrainLodProxy !==
          true,
      );
    const options = { bvh: enableRaycastBvh, outline: prepareOutline };
    bvhBuildQueue.enqueue(meshes, options);
    return () => {
      bvhBuildQueue.cancel(meshes, options);
    };
  }, [meshBindings, enableRaycastBvh, prepareOutline]);

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
