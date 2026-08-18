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
import { Box3, MOUSE, Object3D, Vector3 } from 'three';
import {
  GltfModel,
  SceneText,
  getMeshPath,
  makeMeshId,
  modelObjectRegistry as sharedModelObjectRegistry,
  parseMeshId,
  prefetchModelBottomOffset,
  releaseGltfCache,
  withBaseUrl,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import type { ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type SceneTransformField,
  type SceneTransformMode,
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SceneEnvironment,
  SceneLighting,
  SceneObjectBoundary,
  useIsObjectSelected,
  useSceneObjectSelectionStore,
} from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useSceneDrop } from './use-scene-drop';
import { useSceneTransform } from './use-scene-transform';
import { useMarqueeSelection } from './use-marquee-selection';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [0, 50, 50];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [0, 0, 0];
const INITIAL_PRELOAD_COUNT = 6;
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
  showLabels?: boolean;
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
  fitAllRef?: RefObject<(() => void) | null>;
  fitSelectedRef?: RefObject<(() => void) | null>;
  resetCameraRef?: RefObject<(() => void) | null>;
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
  showLabels = true,
  onMultiTransformCommit,
  onTransformInteractionStart,
  onTransformInteractionEnd,
  fitAllRef,
  fitSelectedRef,
  resetCameraRef,
}: SceneObjectsEditCanvasProps) {
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
  const toggleMesh = useSceneObjectSelectionStore((state) => state.toggleMesh);
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
  // 마퀴에서 제외할 id 집합 — 지도는 잠금과 무관하게 항상 제외한다
  // (다중 선택 불참, selectMap 주석 참고). 잠긴 모델·텍스트도 선택 불가
  // 규칙에 따라 제외한다.
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
      const isCtrl =
        lastPointerEventRef.current?.ctrlKey ||
        lastPointerEventRef.current?.metaKey;
      // event.eventObject: 핸들러가 붙은 primitive(=clone root)
      // event.object: 클릭된 가장 깊은 Mesh
      const cloneRoot = event.eventObject;
      const target = event.object;
      const meshPath = getMeshPath(cloneRoot, target);
      if (meshPath === null || meshPath === '') {
        return;
      }
      const meshId = makeMeshId(id, meshPath);
      const meshObject = sharedModelObjectRegistry.get(meshId) ?? null;
      if (isCtrl) {
        toggleMesh(meshId);
      } else {
        setSelectedObject(meshObject);
        selectMesh(meshId);
      }
    },
    [selectMesh, toggleMesh, setSelectedObject],
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

  // 지도 선택 — Ctrl 다중 선택 분기가 없다. 지도는 단독 선택만 허용한다
  // (selectMap 주석 참고). 더블클릭 drill-in도 두지 않는다 — 지형 메시는
  // 수만 개라 자식 단위 편집이 의미가 없다.
  const handleSelectMap = useCallback(
    (id: string) => {
      if (dragJustEndedRef.current) return;
      setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
      selectMap(id);
    },
    [dragJustEndedRef, selectMap, setSelectedObject],
  );

  const selectAll = useSceneObjectSelectionStore((state) => state.selectAll);

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
    selectAll,
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

      const box = new Box3();
      for (const obj of objects) {
        box.expandByObject(obj);
      }

      if (box.isEmpty()) return;

      const center = new Vector3();
      const size = new Vector3();
      box.getCenter(center);
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 1.0;

      const cam = controls.object;
      const direction = new Vector3()
        .subVectors(cam.position, controls.target)
        .normalize();

      cam.position.copy(center).addScaledVector(direction, distance);
      controls.target.copy(center);
      controls.update();

      if (cameraStateRef) {
        cameraStateRef.current = {
          position: [cam.position.x, cam.position.y, cam.position.z],
          target: [center.x, center.y, center.z],
        };
      }
    },
    [cameraStateRef, orbitControlsRef],
  );

  const sceneModelIds = useMemo(
    () => sceneInfo?.models.map((model) => model.id) ?? [],
    [sceneInfo?.models],
  );

  const getSceneModelObject = useCallback(
    (id: string) => modelObjectRegistryRef.current.get(id) ?? null,
    [],
  );

  const fitAll = useCallback(() => {
    const objects = sceneModelIds
      .map((id) => getSceneModelObject(id))
      .filter((object): object is Object3D => object !== null);
    fitToObjects(objects);
  }, [fitToObjects, getSceneModelObject, sceneModelIds]);

  const fitSelected = useCallback(() => {
    const objects: Object3D[] = [];
    const selectedIds = useSceneObjectSelectionStore.getState().selectedIds;
    const seenModelIds = new Set<string>();
    for (const id of selectedIds) {
      const meshIdInfo = parseMeshId(id);
      const modelId = meshIdInfo?.modelId ?? id;

      if (!sceneModelIds.includes(modelId) || seenModelIds.has(modelId)) {
        continue;
      }

      const obj = getSceneModelObject(modelId);
      if (!obj) {
        continue;
      }

      seenModelIds.add(modelId);
      objects.push(obj);
    }
    fitToObjects(objects);
  }, [fitToObjects, getSceneModelObject, sceneModelIds]);

  const cameraPosition = initialCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = initialCamera?.target ?? DEFAULT_CAMERA_TARGET;

  const resetCamera = useCallback(() => {
    const controls = orbitControlsRef.current as OrbitControlsImpl | null;
    if (!controls) return;
    const cam = controls.object;
    cam.position.set(...cameraPosition);
    controls.target.set(...cameraTarget);
    controls.update();

    if (cameraStateRef) {
      cameraStateRef.current = {
        position: [...cameraPosition],
        target: [...cameraTarget],
      };
    }
  }, [cameraPosition, cameraTarget, cameraStateRef, orbitControlsRef]);

  useEffect(() => {
    if (fitAllRef) {
      fitAllRef.current = fitAll;
    }
    if (fitSelectedRef) {
      fitSelectedRef.current = fitSelected;
    }
    if (resetCameraRef) {
      resetCameraRef.current = resetCamera;
    }
  }, [
    fitAll,
    fitAllRef,
    fitSelected,
    fitSelectedRef,
    resetCamera,
    resetCameraRef,
  ]);

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

  // Space 키를 누르는 동안 OrbitControls LEFT를 PAN으로 전환
  // (기본은 undefined = marquee 전용, Space 누르면 pan 가능)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const controls = orbitControlsRef.current as OrbitControlsImpl | null;
      if (!controls) return;
      controls.mouseButtons.LEFT = MOUSE.PAN;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const controls = orbitControlsRef.current as OrbitControlsImpl | null;
      if (!controls) return;
      (controls.mouseButtons as Record<string, unknown>).LEFT = undefined;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [orbitControlsRef]);

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
        <SceneLighting />
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
          // 뷰어(ThreeSceneViewer)와 동일한 줌 규칙 — 포인터 방향 줌,
          // 지오메트리 관통 방지, far(5000) 안쪽에서 줌 아웃 정지.
          zoomToCursor
          minDistance={5}
          maxDistance={3000}
          mouseButtons={{
            LEFT: undefined,
            MIDDLE: MOUSE.ROTATE,
            RIGHT: MOUSE.PAN,
          }}
        />
        {/* margin은 기즈모 "중심"과 모서리 사이 거리다. scale(≈시각 반경
            40px) + 12px(중앙 툴바의 top-3와 같은 여백)로 잡아, 기즈모
            가장자리가 툴바와 같은 간격으로 캔버스 좌하단에 붙는다. */}
        <GizmoHelper alignment="bottom-left" margin={[52, 52]}>
          <GizmoViewport
            // 기본 40의 2/3 크기.
            scale={40 * (2 / 3)}
            axisColors={['#ff0000', '#00ff00', '#0000ff']}
            labelColor="white"
          />
        </GizmoHelper>
        {transformTarget ? (
          <TransformControls
            key={transformTarget.uuid}
            ref={transformControlsRef}
            object={transformTarget}
            mode={transformMode}
            space="local"
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
              enableRaycastBvh={false}
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
              showLabel={showLabels}
              opacity={model.opacity}
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
