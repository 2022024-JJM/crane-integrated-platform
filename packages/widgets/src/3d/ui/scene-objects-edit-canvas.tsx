import {
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, Object3D, NoToneMapping, Vector3 } from 'three';
import {
  GltfModel,
  SceneText,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type SceneTransformField,
  type SceneTransformMode,
  useSceneObjectSelectionStore,
} from '@crane/features/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useSceneDrop } from './use-scene-drop';
import { useSceneTransform } from './use-scene-transform';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [0, 50, 50];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [0, 0, 0];

interface SceneObjectsEditCanvasProps {
  sceneInfo: SavedSceneInfo | null;
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
  isDraggingText?: boolean;
  onAddText?: (position: Vector3Tuple) => void;
  showLabels?: boolean;
  onMultiTransformCommit?: (
    updates: Array<{ id: string; position: Vector3Tuple }>,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
  fitAllRef?: RefObject<(() => void) | null>;
  fitSelectedRef?: RefObject<(() => void) | null>;
}

export function SceneObjectsEditCanvas({
  sceneInfo,
  catalogItems,
  transformMode,
  draggingModelCatalogItem,
  rootRef,
  cameraStateRef,
  initialCamera,
  onTransformVectorChange,
  onAddModel,
  isDraggingText = false,
  onAddText,
  showLabels = true,
  onMultiTransformCommit,
  onTransformInteractionStart,
  onTransformInteractionEnd,
  fitAllRef,
  fitSelectedRef,
}: SceneObjectsEditCanvasProps) {
  // 모든 카탈로그 모델 GLB를 사전 로드하여 드래그 앤 드롭 시 Suspense 깜빡임 방지
  useEffect(() => {
    for (const item of catalogItems) {
      useGLTF.preload(item.path);
    }
  }, [catalogItems]);

  const { t } = useTranslation();
  const selectedIds = useSceneObjectSelectionStore(
    (state) => state.selectedIds,
  );
  const primarySelectedId = useSceneObjectSelectionStore(
    (state) => state.primarySelectedId,
  );
  const selectModel = useSceneObjectSelectionStore(
    (state) => state.selectModel,
  );
  const selectText = useSceneObjectSelectionStore((state) => state.selectText);
  const toggleModel = useSceneObjectSelectionStore(
    (state) => state.toggleModel,
  );
  const toggleText = useSceneObjectSelectionStore((state) => state.toggleText);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const modelObjectRegistryRef = useRef<Map<string, Object3D>>(new Map());
  const lastPointerEventRef = useRef<PointerEvent | MouseEvent | null>(null);

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
    isDraggingText,
    onAddModel,
    onAddText,
  });

  const {
    orbitControlsRef,
    transformControlsRef,
    setSelectedObject,
    setIsTransformDragging,
    transformTarget,
    syncSelectedObjectTransform,
    handleTransformMouseDown,
    handleTransformMouseUp,
  } = useSceneTransform({
    primarySelectedId,
    selectedIds,
    transformMode,
    sceneModels: sceneInfo?.models,
    sceneTexts: sceneInfo?.texts,
    modelObjectRegistryRef,
    onTransformVectorChange,
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

  const handleSelectModel = useCallback(
    (id: string) => {
      const isCtrl = lastPointerEventRef.current?.ctrlKey || lastPointerEventRef.current?.metaKey;
      if (isCtrl) {
        toggleModel(id);
      } else {
        setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
        selectModel(id);
      }
    },
    [selectModel, toggleModel, setSelectedObject],
  );

  const handleSelectText = useCallback(
    (id: string) => {
      const isCtrl = lastPointerEventRef.current?.ctrlKey || lastPointerEventRef.current?.metaKey;
      if (isCtrl) {
        toggleText(id);
      } else {
        setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
        selectText(id);
      }
    },
    [selectText, toggleText, setSelectedObject],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedObject(null);
    setIsTransformDragging(false);
    clearSelectedModel();
  }, [clearSelectedModel, setIsTransformDragging, setSelectedObject]);

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

  const fitAll = useCallback(() => {
    fitToObjects(Array.from(modelObjectRegistryRef.current.values()));
  }, [fitToObjects, modelObjectRegistryRef]);

  const fitSelected = useCallback(() => {
    const objects: Object3D[] = [];
    for (const id of selectedIds) {
      const obj = modelObjectRegistryRef.current.get(id);
      if (obj) objects.push(obj);
    }
    fitToObjects(objects);
  }, [fitToObjects, selectedIds, modelObjectRegistryRef]);

  useEffect(() => {
    if (fitAllRef) {
      fitAllRef.current = fitAll;
    }
    if (fitSelectedRef) {
      fitSelectedRef.current = fitSelected;
    }
  }, [fitAll, fitAllRef, fitSelected, fitSelectedRef]);

  const cameraPosition = initialCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = initialCamera?.target ?? DEFAULT_CAMERA_TARGET;

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
    if (!draggingModelCatalogItem && !isDraggingText) {
      setPendingDropPosition(null);
    }
  }, [draggingModelCatalogItem, isDraggingText, setPendingDropPosition]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="border-border/70 relative h-full min-h-0 overflow-hidden rounded-2xl border bg-(--canvas-background)"
      onPointerDownCapture={(event) => {
        event.currentTarget.focus();
        lastPointerEventRef.current = event.nativeEvent;
      }}
      onDragOver={handleSceneDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleSceneDrop}
    >
      <Canvas
        camera={{ position: cameraPosition }}
        gl={{
          toneMapping: NoToneMapping,
          powerPreference: 'high-performance',
          antialias: true,
        }}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          rendererRef.current = gl;
          if (cameraStateRef) {
            cameraStateRef.current = {
              position: [camera.position.x, camera.position.y, camera.position.z],
              target: cameraTarget,
            };
          }
        }}
        onPointerMissed={handleClearSelection}
      >
        <ambientLight intensity={2} />
        <directionalLight position={[0, 50, 10]} color="white" intensity={5} />
        <OrbitControls
          ref={orbitControlsRef}
          enableDamping={false}
          target={cameraTarget}
          onChange={handleOrbitChange}
        />
        <GizmoHelper alignment="top-right" margin={[80, 80]}>
          <GizmoViewport
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
        {sceneInfo?.map ? (
          <GltfModel
            id={sceneInfo.map.id}
            onSelect={handleClearSelection}
            url={sceneInfo.map.path}
          />
        ) : null}
        {sceneInfo?.models.map((model) => (
          <GltfModel
            key={model.id}
            id={model.id}
            url={model.path}
            equipName={model.equipName}
            showLabel={showLabels}
            opacity={model.opacity}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
            onSelect={handleSelectModel}
            isSelected={selectedIds.has(model.id)}
            onObjectReady={handleModelObjectReady}
          />
        ))}
        {(sceneInfo?.texts ?? []).map((text) => (
          <SceneText
            key={text.id}
            id={text.id}
            content={text.content}
            color={text.color}
            position={text.position}
            rotation={text.rotation}
            scale={text.scale}
            isSelected={selectedIds.has(text.id)}
            onSelect={handleSelectText}
            onObjectReady={handleModelObjectReady}
          />
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

      {(draggingModelCatalogItem || isDraggingText) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-card/95 rounded-2xl border border-amber-500/30 px-4 py-3 text-center shadow-lg">
            <p className="text-foreground text-sm font-semibold">
              {isDraggingText
                ? t('monitoring:editor.addText')
                : draggingModelCatalogItem?.label}
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
