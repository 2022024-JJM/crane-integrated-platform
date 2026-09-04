import {
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, MOUSE, Object3D, PerspectiveCamera, Vector3 } from 'three';
import {
  GltfModel,
  SceneText,
  getMeshPath,
  makeMeshId,
  modelObjectRegistry as sharedModelObjectRegistry,
  parseMeshId,
  prefetchModelBottomOffset,
  releaseGltfCache,
  resolveEnvironmentFileUrl,
  withBaseUrl,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import type { ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type SceneTransformField,
  type SceneSnapStep,
  type SceneTransformMode,
  type SceneTransformSpace,
  SCENE_CAMERA_CLIP,
  SCENE_DEFAULT_DPR,
  SCENE_GL_OPTIONS,
  MIN_SURFACE_DISTANCE,
  SceneEnvironment,
  SceneLighting,
  sceneCanvasShadows,
  SceneObjectBoundary,
  SceneSurfaceCamera,
  RigDriver,
  manualJointSource,
  rigValueStore,
  useIsObjectSelected,
  useSceneObjectSelectionStore,
} from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useSceneDrop } from './use-scene-drop';
import { useSceneTransform } from './use-scene-transform';
import { useMarqueeSelection } from './use-marquee-selection';
import {
  computeTopViewFallbackPose,
  computeTopViewPose,
  type CameraPose,
} from '../lib/top-view-pose';
import { collectWorldBounds } from '../lib/world-bounds';
import { EditorGroundGrid } from './editor-ground-grid';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [0, 50, 50];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [0, 0, 0];
// R3F Canvas의 Dpr 타입이 mutable 튜플이라 프리셋(readonly)을 복사해 쓴다.
// 모듈 레벨 상수라 렌더마다 참조가 바뀌지 않는다.
const EDITOR_DPR: [number, number] = [...SCENE_DEFAULT_DPR];
const INITIAL_PRELOAD_COUNT = 6;
/** F 포커스 시 바운딩 스피어 주변 여유 비율. */
const FOCUS_PADDING = 1.15;
/**
 * F 포커스 최소 거리 — SceneSurfaceCamera 휠 줌의 최소 표면 거리와 같다.
 * 텍스트처럼 작은 객체를 더 가깝게 잡으면 첫 휠 조작에서 그 거리로 튕겨
 * 나가므로 여기서 미리 맞춘다.
 */
const FOCUS_MIN_DISTANCE = MIN_SURFACE_DISTANCE;
const PRELOAD_BATCH_SIZE = 4;

/**
 * 모델 list rendering의 hot path 래퍼.
 *
 * 부모 캔버스가 `selectedIds: Set<string>`을 직접 구독하면 어떤 객체 하나를
 * 선택해도 Set 참조가 새로 생성되어 N개의 모델 prop이 모두 새로 평가되며
 * (memo는 prop 비교 단계까지 도달) 캔버스 전체가 reconcile 된다.
 *
 * 이 래퍼는 `useIsObjectSelected(id)`로 자기 자신의 boolean만 구독하므로
 * "이전 선택 + 새 선택" 두 wrapper만 리렌더되고 GltfModel은 memo로 막힌다.
 */
type SelectionAwareGltfModelProps = Omit<
  React.ComponentProps<typeof GltfModel>,
  'isSelected' | 'selectedMeshTarget'
>;

function getSelectedMeshIdForModel(
  modelId: string,
  primarySelectedId: string | null,
  selectedObjectType: string | null,
) {
  if (selectedObjectType !== 'mesh' || !primarySelectedId) {
    return null;
  }

  const parsed = parseMeshId(primarySelectedId);
  if (!parsed || parsed.modelId !== modelId) {
    return null;
  }

  return primarySelectedId;
}

function SelectionAwareGltfModel(props: SelectionAwareGltfModelProps) {
  const isSelected = useIsObjectSelected(props.id);
  // 이 모델 안의 자식 mesh가 선택되어 있으면 그 mesh 객체를 selection box
  // target으로 넘긴다. selectedObjectType이 'mesh'이고 primarySelectedId가
  // `${this.id}::...` 형태일 때만 해당.
  const selectedMeshId = useSceneObjectSelectionStore((state) =>
    getSelectedMeshIdForModel(
      props.id,
      state.primarySelectedId,
      state.selectedObjectType,
    ),
  );
  const selectedMeshTarget = selectedMeshId
    ? (sharedModelObjectRegistry.get(selectedMeshId) ?? null)
    : null;
  return (
    <GltfModel
      {...props}
      isSelected={isSelected}
      selectedMeshTarget={selectedMeshTarget}
    />
  );
}

type SelectionAwareSceneTextProps = Omit<
  React.ComponentProps<typeof SceneText>,
  'isSelected'
>;

function SelectionAwareSceneText(props: SelectionAwareSceneTextProps) {
  const isSelected = useIsObjectSelected(props.id);
  return <SceneText {...props} isSelected={isSelected} />;
}

/** 도구 모음의 카메라 버튼이 호출하는 액션(focusSelectedRef 와 같은 방식). */
export interface SceneEditorCameraActions {
  /** 마지막으로 로드/저장된 카메라(없으면 편집기 기본 시점)로 복귀. */
  resetView: () => void;
  /** 지도(없으면 배치된 객체 전체)가 화면에 꽉 차는 탑뷰. */
  topView: () => void;
}

interface SceneObjectsEditCanvasProps {
  sceneInfo: SavedSceneInfo | null;
  /** 배경 파노라마 fallback 해석에 쓴다 (씬이 배경을 지정하지 않은 경우). */
  regionId: string;
  catalogItems: SceneModelCatalogItem[];
  transformMode: SceneTransformMode;
  draggingModelCatalogItem: SceneModelCatalogItem | null;
  rootRef?: RefObject<HTMLDivElement | null>;
  cameraStateRef?: RefObject<SavedCameraInfo | null>;
  initialCamera?: SavedCameraInfo | null;
  onTransformVectorChange: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
  onAddModel: (
    catalogItem: SceneModelCatalogItem,
    position: Vector3Tuple,
  ) => void;
  onTransformCommit?: (
    position: Vector3Tuple | null,
    rotation: Vector3Tuple | null,
    scale: Vector3Tuple | null,
  ) => void;
  onMultiTransformCommit?: (
    updates: Array<{
      id: string;
      position?: Vector3Tuple;
      rotation?: Vector3Tuple;
      scale?: Vector3Tuple;
    }>,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
  /** 선택 객체로 카메라를 즉시 이동(F 키)하는 함수를 부모에 노출한다. */
  focusSelectedRef?: RefObject<(() => void) | null>;
  /** 초기 시점/탑뷰 액션을 부모에 노출한다. */
  cameraActionsRef?: RefObject<SceneEditorCameraActions | null>;
  /** 기즈모 스냅 적용 여부. */
  snapEnabled: boolean;
  /**
   * 기즈모 스냅 단위(이동 m · 회전 rad · 크기). 켜져 있을 때만 쓴다. 저장값
   * (부모 프레임·도·배율) 기준 격자다 — transformSpace 는 축 방향만 정한다.
   */
  snapStep: SceneSnapStep;
  /** 기즈모 축 기준. scale 모드는 three 가 local 을 강제한다. */
  transformSpace: SceneTransformSpace;
  /** 원점 기준 바닥 격자(시각 전용) 표시 여부. */
  showGrid: boolean;
}

export function SceneObjectsEditCanvas({
  sceneInfo,
  regionId,
  catalogItems,
  transformMode,
  draggingModelCatalogItem,
  rootRef,
  cameraStateRef,
  initialCamera,
  onTransformVectorChange,
  onTransformCommit,
  onAddModel,
  onMultiTransformCommit,
  onTransformInteractionStart,
  onTransformInteractionEnd,
  focusSelectedRef,
  cameraActionsRef,
  snapEnabled,
  snapStep,
  transformSpace,
  showGrid,
}: SceneObjectsEditCanvasProps) {
  // 에디터에서는 수동 조작 소스만 켠다 — 슬라이더가 값 저장소에 직접 쓰고
  // RigDriver 가 매 프레임 노드에 적용한다. 서버 값은 이 화면에 흐르지 않는다.
  useEffect(() => {
    manualJointSource.start(rigValueStore);
    return () => {
      manualJointSource.stop();
      rigValueStore.reset();
    };
  }, []);

  // 뷰어(OutdoorWorkModelSimulation)와 같은 규칙 — 바다가 있는 씬의 모델에만
  // 수면 아래 잠김 처리. 지도에는 걸지 않는다.
  const hasSea =
    resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !== null;
  // 언마운트 시점의 씬을 읽기 위한 ref — 프리로드 effect는 catalogItems에만
  // 의존해야 하므로(씬이 바뀔 때마다 재프리로드하면 안 된다) sceneInfo를
  // 의존성에 넣지 않고 여기서 최신값을 따라간다.
  const sceneInfoRef = useRef(sceneInfo);
  sceneInfoRef.current = sceneInfo;

  // 모든 카탈로그 모델 GLB를 사전 로드하여 드래그 앤 드롭 시 Suspense 깜빡임 방지.
  // 동시에 각 모델의 unscaled bbox bottom offset도 prefetch 해두어, 드롭 직후
  // 모델 바닥이 정확히 지면(y=0)에 닿도록 한다. 사용자 scale은 드롭 시점에 곱한다.
  useEffect(() => {
    const eagerItems = catalogItems.slice(0, INITIAL_PRELOAD_COUNT);
    const deferredItems = catalogItems.slice(INITIAL_PRELOAD_COUNT);
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const preloadItem = (item: SceneModelCatalogItem) => {
      useGLTF.preload(withBaseUrl(item.path));
      void prefetchModelBottomOffset(item.path);
    };

    eagerItems.forEach(preloadItem);

    const scheduleBatch = (startIndex: number) => {
      const runBatch = () => {
        if (cancelled) {
          return;
        }

        const nextItems = deferredItems.slice(
          startIndex,
          startIndex + PRELOAD_BATCH_SIZE,
        );
        nextItems.forEach(preloadItem);

        if (startIndex + PRELOAD_BATCH_SIZE < deferredItems.length) {
          scheduleBatch(startIndex + PRELOAD_BATCH_SIZE);
        }
      };

      if (typeof requestIdleCallback !== 'undefined') {
        idleHandle = requestIdleCallback(runBatch, { timeout: 300 });
        return;
      }

      timeoutHandle = setTimeout(runBatch, 32);
    };

    if (deferredItems.length > 0) {
      scheduleBatch(0);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      // 에디터를 떠나면 프리로드한 카탈로그(40개, 약 97MB)를 비운다.
      // 단 **현재 씬이 실제로 쓰는 모델은 남긴다** — 에디터에서 나가면 보통
      // 같은 지역의 모니터링 화면으로 가는데, 거기서 곧바로 다시 필요한
      // 것들이라 지웠다가 다시 받으면 수십 MB를 헛되이 왕복한다.
      // 남는 것은 "드래그 앤 드롭 편의를 위해 미리 당겨왔지만 이 씬에는
      // 배치되지 않은" 모델들이고, 그게 해제 대상의 대부분이다.
      const inUse = new Set([
        ...(sceneInfoRef.current?.models ?? []).map((m) => m.path),
        ...(sceneInfoRef.current?.maps ?? []).map((m) => m.path),
      ]);
      releaseGltfCache(
        catalogItems
          .map((item) => item.path)
          .filter((path) => !inUse.has(path)),
      );
    };
  }, [catalogItems]);

  const { t } = useTranslation();
  // selectedIds 자체는 더 이상 부모에서 구독하지 않는다. 모델/텍스트 wrapper가
  // boolean selector(useIsObjectSelected)로 자기 자신만 구독하고, 콜백 안에서는
  // store.getState()로 즉시 fetch 한다. 100개 모델 씬에서 한 객체를 선택할 때
  // 캔버스 전체 리렌더(N→2)를 막는다.
  const primarySelectedId = useSceneObjectSelectionStore(
    (state) => state.primarySelectedId,
  );
  const selectModel = useSceneObjectSelectionStore(
    (state) => state.selectModel,
  );
  const selectText = useSceneObjectSelectionStore((state) => state.selectText);
  const selectMap = useSceneObjectSelectionStore((state) => state.selectMap);
  const selectMesh = useSceneObjectSelectionStore((state) => state.selectMesh);
  const toggleModel = useSceneObjectSelectionStore(
    (state) => state.toggleModel,
  );
  const toggleText = useSceneObjectSelectionStore((state) => state.toggleText);
  const toggleMap = useSceneObjectSelectionStore((state) => state.toggleMap);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const modelObjectRegistryRef = useRef<Map<string, Object3D>>(new Map());
  const lastPointerEventRef = useRef<PointerEvent | MouseEvent | null>(null);

  // 잠금은 씬 데이터다(SavedModelInfo/SavedMapInfo.locked). 잠금 해제된
  // 지도만 선택/변형 대상이다. 대부분의 씬에서 빈 배열이라 아래 경로들
  // (transform target 탐색, 마퀴 제외)이 사실상 무비용이다.
  const unlockedMaps = useMemo(
    () => (sceneInfo?.maps ?? []).filter((m) => m.locked === false),
    [sceneInfo?.maps],
  );
  // 마퀴에서 제외할 id 집합 — 지도는 잠금과 무관하게 항상 제외한다:
  // 지형 AABB가 화면을 덮어 스크린 공간 교차 판정에 어떤 마퀴든 반드시
  // 걸리기 때문이다(Ctrl 토글·Ctrl+A는 잠금 해제 시 참여). 잠긴
  // 모델·텍스트도 선택 불가 규칙에 따라 제외한다.
  const marqueeExcludedIds = useMemo(
    () =>
      new Set([
        ...(sceneInfo?.maps ?? []).map((m) => m.id),
        ...(sceneInfo?.models ?? []).filter((m) => m.locked).map((m) => m.id),
        ...(sceneInfo?.texts ?? []).filter((t) => t.locked).map((t) => t.id),
      ]),
    [sceneInfo?.maps, sceneInfo?.models, sceneInfo?.texts],
  );

  const {
    cameraRef,
    rendererRef,
    pendingDropPosition,
    setPendingDropPosition,
    handleSceneDragOver,
    handleSceneDrop,
    handleDragLeave,
  } = useSceneDrop({
    catalogItems,
    draggingModelCatalogItem,
    mapObjectId: sceneInfo?.maps?.[0]?.id ?? null,
    onAddModel,
  });

  const {
    orbitControlsRef,
    transformControlsRef,
    setSelectedObject,
    setIsTransformDragging,
    isTransformDragging,
    transformTarget,
    syncSelectedObjectTransform,
    handleTransformMouseDown,
    handleTransformMouseUp,
    dragJustEndedRef,
  } = useSceneTransform({
    primarySelectedId,
    transformMode,
    sceneModels: sceneInfo?.models,
    sceneTexts: sceneInfo?.texts,
    sceneMaps: unlockedMaps,
    modelObjectRegistryRef,
    onTransformVectorChange,
    onTransformCommit,
    onMultiTransformCommit,
    onTransformInteractionStart,
    onTransformInteractionEnd,
    snapEnabled,
    snapStep,
  });

  const handleModelObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        modelObjectRegistryRef.current.set(id, object);
      } else {
        modelObjectRegistryRef.current.delete(id);
      }

      if (id === primarySelectedId) {
        setSelectedObject(object);
      }

      if (id === primarySelectedId && !object) {
        setIsTransformDragging(false);
      }
    },
    [primarySelectedId, setIsTransformDragging, setSelectedObject],
  );

  // 마지막 단일 클릭 시각. dblclick 윈도우 안의 두 번째 click이면 selectModel을
  // skip하여 직후 발화할 onDoubleClick의 selectMesh가 덮어쓰이지 않게 한다.
  const lastClickTimeRef = useRef(0);
  const lastClickIdRef = useRef<string | null>(null);
  const DOUBLE_CLICK_WINDOW_MS = 300;

  const handleSelectModel = useCallback(
    (id: string) => {
      if (dragJustEndedRef.current) return;
      const now = performance.now();
      const isLikelySecondClick =
        lastClickIdRef.current === id &&
        now - lastClickTimeRef.current < DOUBLE_CLICK_WINDOW_MS;
      lastClickTimeRef.current = now;
      lastClickIdRef.current = id;
      if (isLikelySecondClick) {
        // 곧 onDoubleClick이 따라온다. selection을 건드리지 않는다.
        return;
      }

      const isCtrl =
        lastPointerEventRef.current?.ctrlKey ||
        lastPointerEventRef.current?.metaKey;
      if (isCtrl) {
        toggleModel(id);
      } else {
        setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
        selectModel(id);
      }
    },
    [dragJustEndedRef, selectModel, toggleModel, setSelectedObject],
  );

  const handleDoubleSelectModel = useCallback(
    (id: string, event: ThreeEvent<MouseEvent>) => {
      // R3F의 onDoubleClick은 DOM dblclick과 매핑되어 onClick의 detail 카운트
      // 보다 안정적이다. 더블클릭 시 클릭된 자식 mesh path를 계산해 drill-in.
      //
      // 노드 선택은 읽기 전용(바운딩 박스만)이라 기즈모 대상을 세우지 않고,
      // Ctrl 토글로 모델 멀티 선택에 섞이지도 않는다 — 항상 단일 선택.
      // event.eventObject: 핸들러가 붙은 primitive(=clone root)
      // event.object: 클릭된 가장 깊은 Mesh
      const cloneRoot = event.eventObject;
      const target = event.object;
      const meshPath = getMeshPath(cloneRoot, target);
      if (meshPath === null || meshPath === '') {
        return;
      }
      selectMesh(makeMeshId(id, meshPath));
    },
    [selectMesh],
  );

  const handleSelectText = useCallback(
    (id: string) => {
      if (dragJustEndedRef.current) return;
      const isCtrl =
        lastPointerEventRef.current?.ctrlKey ||
        lastPointerEventRef.current?.metaKey;
      if (isCtrl) {
        toggleText(id);
      } else {
        setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
        selectText(id);
      }
    },
    [dragJustEndedRef, selectText, toggleText, setSelectedObject],
  );

  // 지도 선택 — 잠금 해제된 지도는 Ctrl 토글로 다중 선택에 참여한다
  // (마퀴만 제외, selectMap 주석 참고). 더블클릭 drill-in은 두지 않는다 —
  // 지형 메시는 수만 개라 자식 단위 편집이 의미가 없다.
  const handleSelectMap = useCallback(
    (id: string) => {
      if (dragJustEndedRef.current) return;
      const isCtrl =
        lastPointerEventRef.current?.ctrlKey ||
        lastPointerEventRef.current?.metaKey;
      if (isCtrl) {
        toggleMap(id);
      } else {
        setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
        selectMap(id);
      }
    },
    [dragJustEndedRef, selectMap, toggleMap, setSelectedObject],
  );

  const selectAll = useSceneObjectSelectionStore((state) => state.selectAll);

  // 마퀴는 레지스트리의 id만 알고 타입을 모른다. 여기서 텍스트/모델을
  // 분류해 넘겨야 단일 텍스트 선택이 'model'로 태깅돼 존재 검증에서
  // 풀리는 일이 없다. 지도·잠금 객체는 marqueeExcludedIds로 이미 제외.
  const textIdSet = useMemo(
    () => new Set((sceneInfo?.texts ?? []).map((t) => t.id)),
    [sceneInfo?.texts],
  );
  const selectAllClassified = useCallback(
    (ids: string[]) =>
      selectAll(
        ids.map((id) => ({
          id,
          type: textIdSet.has(id) ? ('text' as const) : ('model' as const),
        })),
      ),
    [selectAll, textIdSet],
  );

  const {
    marqueeStyle,
    isMarqueeActive,
    marqueeContainerRef: setMarqueeEl,
    marqueeJustEndedRef,
  } = useMarqueeSelection({
    cameraRef,
    rendererRef,
    modelObjectRegistryRef,
    isTransformDragging,
    dragJustEndedRef,
    isDraggingExternalItem: !!draggingModelCatalogItem,
    excludedIds: marqueeExcludedIds,
    selectAll: selectAllClassified,
    clearSelectedModel,
  });

  const handleClearSelection = useCallback(() => {
    if (dragJustEndedRef.current) return;
    if (marqueeJustEndedRef.current) return;
    setSelectedObject(null);
    setIsTransformDragging(false);
    clearSelectedModel();
  }, [
    clearSelectedModel,
    dragJustEndedRef,
    marqueeJustEndedRef,
    setIsTransformDragging,
    setSelectedObject,
  ]);

  const combinedRootRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (rootRef) rootRef.current = el;
      setMarqueeEl(el);
    },
    [rootRef, setMarqueeEl],
  );

  const handleOrbitChange = useCallback(() => {
    if (!cameraStateRef || !orbitControlsRef.current) return;
    const controls = orbitControlsRef.current as OrbitControlsImpl;
    const cam = controls.object;
    cameraStateRef.current = {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
  }, [cameraStateRef, orbitControlsRef]);

  const fitToObjects = useCallback(
    (objects: Object3D[]) => {
      const controls = orbitControlsRef.current as OrbitControlsImpl | null;
      if (!controls || objects.length === 0) return;

      const box = collectWorldBounds(objects);
      if (!box) return;

      const center = new Vector3();
      const size = new Vector3();
      box.getCenter(center);
      box.getSize(size);

      // 바운딩 스피어가 세로·가로 fov 중 좁은 쪽에 들어오는 거리. 예전에는
      // 가장 긴 변 길이를 그대로 거리로 써서 fov·종횡비에 따라 잘리거나
      // 지나치게 멀었다.
      const cam = controls.object;
      const radius = Math.max(size.length() / 2, 1e-3);
      let halfFov = Math.PI / 4;
      if (cam instanceof PerspectiveCamera) {
        const halfVertical = (cam.fov * Math.PI) / 360;
        halfFov = Math.min(
          halfVertical,
          Math.atan(Math.tan(halfVertical) * cam.aspect),
        );
      }
      const distance = Math.max(
        (radius / Math.sin(halfFov)) * FOCUS_PADDING,
        FOCUS_MIN_DISTANCE,
      );

      const direction = new Vector3()
        .subVectors(cam.position, controls.target)
        .normalize();

      // 거리 상한은 두지 않는다 — update()가 OrbitControls maxDistance(3000)로
      // 잘라 준다. 지도처럼 큰 객체는 뷰어 탑뷰와 같은 상한에서 멈춘다.
      cam.position.copy(center).addScaledVector(direction, distance);
      controls.target.copy(center);
      // 감쇠를 잠시 끄고 update() 한다 — 켠 채로 부르면 직전 드래그의 잔여
      // 관성이 이후 프레임에 계속 적용돼 방금 맞춘 포즈가 흘러간다
      // (ThreeSceneViewer.applyCameraState와 같은 이유).
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      if (cameraStateRef) {
        cameraStateRef.current = {
          position: [cam.position.x, cam.position.y, cam.position.z],
          target: [center.x, center.y, center.z],
        };
      }
    },
    [cameraStateRef, orbitControlsRef],
  );

  // 씬에 존재하는 id만 포커스 대상이다(스토어에 남은 stale 선택 방어). 지도는
  // 잠금 여부와 무관하게 포함 — 선택돼 있기만 하면 대상이다.
  const sceneObjectIds = useMemo(
    () => ({
      models: new Set(sceneInfo?.models.map((model) => model.id) ?? []),
      texts: new Set(sceneInfo?.texts?.map((text) => text.id) ?? []),
      maps: new Set(sceneInfo?.maps?.map((map) => map.id) ?? []),
    }),
    [sceneInfo?.maps, sceneInfo?.models, sceneInfo?.texts],
  );

  // F 포커스 — 모델·텍스트·지도·드릴인 메시 모두 대상. 조회 순서는
  // use-scene-transform과 같다(캔버스 로컬 registry → 도메인 전역 registry;
  // 메시는 전역에만 등록된다).
  const focusSelected = useCallback(() => {
    const objects: Object3D[] = [];
    const seen = new Set<Object3D>();
    const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
    for (const id of selectedIds) {
      const meshIdInfo = parseMeshId(id);
      let obj: Object3D | undefined;

      if (meshIdInfo) {
        if (!sceneObjectIds.models.has(meshIdInfo.modelId)) continue;
        // 메시가 아직 등록 전이면 부모 모델로 폴백한다.
        obj =
          sharedModelObjectRegistry.get(id) ??
          modelObjectRegistryRef.current.get(meshIdInfo.modelId);
      } else {
        if (
          !sceneObjectIds.models.has(id) &&
          !sceneObjectIds.texts.has(id) &&
          !sceneObjectIds.maps.has(id)
        ) {
          continue;
        }
        obj =
          modelObjectRegistryRef.current.get(id) ??
          sharedModelObjectRegistry.get(id);
      }

      // 같은 Object3D 중복 방지(메시 폴백으로 부모가 두 번 들어오는 경우).
      if (!obj || seen.has(obj)) continue;
      seen.add(obj);
      objects.push(obj);
    }
    fitToObjects(objects);
  }, [fitToObjects, sceneObjectIds]);

  const cameraPosition = initialCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = initialCamera?.target ?? DEFAULT_CAMERA_TARGET;

  useEffect(() => {
    if (focusSelectedRef) {
      focusSelectedRef.current = focusSelected;
    }
  }, [focusSelected, focusSelectedRef]);

  // 도구 모음의 초기 시점/탑뷰. 포즈 계산은 lib/top-view-pose 가 하고 여기서는
  // OrbitControls 에 적용만 한다(감쇠 처리는 fitToObjects 와 같은 이유).
  const applyCameraPose = useCallback(
    (pose: CameraPose) => {
      const controls = orbitControlsRef.current as OrbitControlsImpl | null;
      if (!controls) return;
      const cam = controls.object;
      cam.position.set(...pose.position);
      controls.target.set(...pose.target);
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      if (cameraStateRef) {
        cameraStateRef.current = {
          position: [...pose.position],
          target: [...pose.target],
        };
      }
    },
    [cameraStateRef, orbitControlsRef],
  );

  // initialCamera 는 저장 후에도 갱신되므로 "마지막으로 로드/저장된 시점"이다.
  const resetView = useCallback(() => {
    applyCameraPose({ position: cameraPosition, target: cameraTarget });
  }, [applyCameraPose, cameraPosition, cameraTarget]);

  // 바운즈 우선순위: 지도 → 배치된 객체 전체 → (아무것도 없으면) 현재 거리를
  // 유지한 채 타깃 바로 위. 지도 GLB 가 아직 로드 전이면 박스가 비어 있어
  // 객체 전체로 내려간다.
  const topView = useCallback(() => {
    const controls = orbitControlsRef.current as OrbitControlsImpl | null;
    if (!controls) return;
    const registry = modelObjectRegistryRef.current;
    const mapId = sceneInfo?.maps?.[0]?.id;
    const mapObject = mapId ? registry.get(mapId) : undefined;
    let bounds = mapObject ? new Box3().setFromObject(mapObject) : null;
    if (!bounds || bounds.isEmpty()) {
      bounds = collectWorldBounds([...registry.values()]);
    }

    const cam = controls.object;
    let pose: CameraPose | null = null;
    if (bounds && cam instanceof PerspectiveCamera) {
      pose = computeTopViewPose(bounds, cam.aspect, cam.fov, {
        minDistance: FOCUS_MIN_DISTANCE,
      });
    }
    if (!pose) {
      pose = computeTopViewFallbackPose(
        [cam.position.x, cam.position.y, cam.position.z],
        [controls.target.x, controls.target.y, controls.target.z],
      );
    }
    applyCameraPose(pose);
  }, [applyCameraPose, orbitControlsRef, sceneInfo?.maps]);

  useEffect(() => {
    if (cameraActionsRef) {
      cameraActionsRef.current = { resetView, topView };
    }
  }, [cameraActionsRef, resetView, topView]);

  const appliedCameraRef = useRef<SavedCameraInfo | null>(null);
  useEffect(() => {
    if (!initialCamera || initialCamera === appliedCameraRef.current) return;
    const controls = orbitControlsRef.current as OrbitControlsImpl | null;
    if (!controls) return;

    const cam = controls.object;
    cam.position.set(...initialCamera.position);
    controls.target.set(...initialCamera.target);
    controls.update();
    appliedCameraRef.current = initialCamera;

    if (cameraStateRef) {
      cameraStateRef.current = {
        position: [...initialCamera.position],
        target: [...initialCamera.target],
      };
    }
  }, [initialCamera, cameraStateRef, orbitControlsRef]);

  useEffect(() => {
    if (!draggingModelCatalogItem) {
      setPendingDropPosition(null);
    }
  }, [draggingModelCatalogItem, setPendingDropPosition]);

  return (
    <div
      ref={combinedRootRef}
      tabIndex={0}
      className="border-border/70 relative isolate h-full min-h-0 overflow-hidden border bg-(--canvas-background)"
      onPointerDownCapture={(event) => {
        event.currentTarget.focus();
        lastPointerEventRef.current = event.nativeEvent;
      }}
      onDragOver={handleSceneDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleSceneDrop}
    >
      <Canvas
        // 카메라 클립·gl 옵션·조명 모두 뷰어와 같은 프리셋을 쓴다. 예전에는
        // 각자 값을 들고 있다가 어긋나(에디터 조명이 25% 밝았다) 저작 화면과
        // 실제 화면이 달랐다 — scene-render-preset 주석 참고.
        camera={{ position: cameraPosition, ...SCENE_CAMERA_CLIP }}
        gl={SCENE_GL_OPTIONS}
        shadows={sceneCanvasShadows(sceneInfo?.lighting)}
        dpr={EDITOR_DPR}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          rendererRef.current = gl;
          if (cameraStateRef) {
            cameraStateRef.current = {
              position: [
                camera.position.x,
                camera.position.y,
                camera.position.z,
              ],
              target: cameraTarget,
            };
          }
        }}
        onPointerMissed={handleClearSelection}
      >
        <SceneLighting sceneInfo={sceneInfo} />
        <RigDriver sceneInfo={sceneInfo} />
        <SceneSurfaceCamera
          regionId={regionId}
          environmentId={sceneInfo?.environmentId}
        />
        {/* 배경도 편집 대상이므로 에디터에서 그대로 보여준다 — 뷰어와 같은
            자체 Suspense라 EXR(수 MB)이 맵·모델 표시를 붙잡지 않는다. */}
        <Suspense fallback={null}>
          <SceneEnvironment
            regionId={regionId}
            environmentId={sceneInfo?.environmentId}
          />
        </Suspense>
        <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          // 뷰어와 같은 감쇠값 — 저작 화면과 실제 화면의 조작감이 달라지면
          // 에디터에서 잡은 카메라 구도가 뷰어에서 다르게 느껴진다.
          enableDamping
          dampingFactor={0.12}
          target={cameraTarget}
          onChange={handleOrbitChange}
          // 뷰어(ThreeSceneViewer)와 동일한 규칙 — 휠 줌은 SceneSurfaceCamera
          // (표면 기준 dolly)가 맡으므로 여기선 끈다. minDistance는 회전/팬 반경
          // clamp일 뿐이라 낮게 둔다(표면 피벗이 가까울 때 튕기지 않게).
          enableZoom={false}
          minDistance={5}
          maxDistance={3000}
          mouseButtons={{
            LEFT: undefined,
            MIDDLE: MOUSE.ROTATE,
            RIGHT: MOUSE.PAN,
          }}
        />
        {/* margin은 기즈모 "중심"과 모서리 사이 거리다. scale(≈시각 반경
            27px) + 12px(오버레이들의 top-3/right-3 와 같은 여백) + 여유로
            52px. 우상단은 도구 모음이 헤더 바로 올라가 비어 있다(Blender 의
            내비게이션 기즈모 위치). */}
        <GizmoHelper alignment="top-right" margin={[52, 52]}>
          <GizmoViewport
            // 기본 40의 2/3 크기.
            scale={40 * (2 / 3)}
            axisColors={['#ff0000', '#00ff00', '#0000ff']}
            labelColor="white"
            // 방향 표시 전용 — 축 머리를 클릭해 카메라가 툭 스냅되면 배치
            // 중인 시점을 잃는다. 클릭·호버 반응을 끈다.
            disabled
          />
        </GizmoHelper>
        {/* 바닥 격자 — 높이·범위 규칙은 EditorGroundGrid 주석 참고. */}
        {showGrid ? <EditorGroundGrid /> : null}
        {transformTarget ? (
          <TransformControls
            key={transformTarget.uuid}
            ref={transformControlsRef}
            object={transformTarget}
            mode={transformMode}
            space={transformSpace}
            // 스냅은 three 에 맡기지 않는다 — local 공간에서 격자가 객체의
            // 회전 프레임에 놓여 저장값이 격자를 벗어난다. useSceneTransform 의
            // liveSync 가 저장값(부모 프레임) 기준으로 스냅한다(snap-transform).
            onMouseDown={handleTransformMouseDown}
            onMouseUp={handleTransformMouseUp}
            onObjectChange={syncSelectedObjectTransform}
          />
        ) : null}
        {/* 지도 — 잠금(locked)이면 클릭이 선택 해제로 떨어지고(기존 동작),
            해제하면 일반 모델과 같은 선택·드래그 대상이 된다. 잠금 상태는
            좌측 패널 토글로 바꾼다.

            잠금 여부와 무관하게 항상 SelectionAwareGltfModel을 쓴다 —
            컴포넌트 타입을 갈아끼우면 토글할 때마다 수십~수백 MB짜리
            지형 GLB가 unmount/remount 되어 화면이 한 번 깜빡인다.
            차이는 클릭 핸들러(선택 vs 선택 해제)뿐이다. */}
        {/* GLB를 로드하는 객체는 개별 경계로 감싼다 — 경로가 틀린 모델
            하나가 캔버스 전체를 비우지 않도록. SceneObjectBoundary 주석 참고.
            에디터는 로딩 오버레이가 없으므로 Suspense도 객체별로 분리해
            준비된 것부터 보여준다(뷰어는 오버레이 때문에 공유 Suspense 유지). */}
        {sceneInfo?.maps?.map((m) => (
          <SceneObjectBoundary
            key={m.id}
            label={`map ${m.path}`}
            isolateSuspense
          >
            <SelectionAwareGltfModel
              id={m.id}
              url={m.path}
              position={m.position}
              rotation={m.rotation}
              scale={m.scale}
              // BVH는 기본값(빌드)을 쓴다 — 지도는 클릭 선택·드롭 raycast
              // 대상이라 BVH 없이는 포인터 이동마다 수십만 삼각형을 브루트
              // 포스 순회한다(model-mesh 주석 참고). 라벨은 지도에 없으므로
              // 마운트 시 bbox 순회를 건너뛴다.
              showLabel={false}
              // 지도도 그림자를 드리운다(기본값) — 뷰어(outdoor-work-model-
              // simulation)와 같은 규칙. 지도 GLB에 건물이 포함되어 있다.
              onSelect={
                m.locked === false ? handleSelectMap : handleClearSelection
              }
              onObjectReady={handleModelObjectReady}
            />
          </SceneObjectBoundary>
        ))}
        {sceneInfo?.models.map((model) => (
          <SceneObjectBoundary
            key={model.id}
            label={`model ${model.equipName || model.id} (${model.path})`}
            isolateSuspense
          >
            <SelectionAwareGltfModel
              id={model.id}
              url={model.path}
              equipName={model.equipName}
              showLabel={!model.labelHidden}
              opacity={model.opacity}
              seaSubmersion={hasSea}
              position={model.position}
              rotation={model.rotation}
              scale={model.scale}
              meshOverrides={model.meshOverrides}
              // 잠긴 모델은 클릭이 선택 해제로 떨어진다 — 지도 잠금과 같은
              // 규칙. 핸들러만 갈아끼우고 컴포넌트는 유지해 GLB 리마운트를
              // 피한다(위 지도 주석 참고).
              onSelect={model.locked ? handleClearSelection : handleSelectModel}
              onDoubleSelect={
                model.locked ? undefined : handleDoubleSelectModel
              }
              onObjectReady={handleModelObjectReady}
            />
          </SceneObjectBoundary>
        ))}
        {/* drei Text는 첫 마운트에서 폰트 preload로 suspend 한다. 경계 없이
            두면 suspension이 Canvas 루트까지 올라가 씬 전체가 fallback으로
            내려앉아 화면이 한 번 깜빡인다 — 첫 텍스트 추가 시 특히 눈에 띈다.
            개별 Suspense로 격리해 폰트가 준비될 때까지 그 텍스트만 늦게 뜬다. */}
        {(sceneInfo?.texts ?? []).map((text) => (
          <Suspense key={text.id} fallback={null}>
            <SelectionAwareSceneText
              id={text.id}
              content={text.content}
              color={text.color}
              position={text.position}
              rotation={text.rotation}
              scale={text.scale}
              // 잠긴 텍스트는 클릭이 선택 해제로 떨어진다 — 잠긴 모델과 같은
              // 규칙. undefined를 넘기면 SceneText가 클릭을 삼키기만 하므로
              // handleClearSelection을 넘겨야 빈 공간 클릭과 동일하게 동작한다.
              onSelect={text.locked ? handleClearSelection : handleSelectText}
              onObjectReady={handleModelObjectReady}
            />
          </Suspense>
        ))}
        {pendingDropPosition ? (
          <mesh
            position={[
              pendingDropPosition[0],
              pendingDropPosition[1] + 0.02,
              pendingDropPosition[2],
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.8, 1.15, 32]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.92} />
          </mesh>
        ) : null}
      </Canvas>

      {isMarqueeActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 border border-sky-400/80 bg-sky-400/10"
          style={marqueeStyle}
        />
      )}

      {draggingModelCatalogItem && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-card/95 rounded-2xl border border-amber-500/30 px-4 py-3 text-center shadow-lg">
            <p className="text-foreground text-sm font-semibold">
              {draggingModelCatalogItem.label}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('monitoring:editor.dropHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
