import { OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Object3D, NoToneMapping } from 'three';
import {
  GltfModel,
  SceneText,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type SceneTransformField,
  type SceneTransformMode,
  useSceneObjectSelectionStore,
} from '@/features/3d';
import { cn } from '@/shared/lib/utils';
import type { Vector3Tuple } from '@/shared/types/math';
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
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
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
  onTransformInteractionStart,
  onTransformInteractionEnd,
}: SceneObjectsEditCanvasProps) {
  const { t } = useTranslation();
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const selectText = useSceneObjectSelectionStore((state) => state.selectText);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const modelObjectRegistryRef = useRef<Map<string, Object3D>>(new Map());

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
    selectedModelId,
    sceneModels: sceneInfo?.models,
    sceneTexts: sceneInfo?.texts,
    modelObjectRegistryRef,
    onTransformVectorChange,
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

      if (id === selectedModelId) {
        setSelectedObject(object);
      }

      if (id === selectedModelId && !object) {
        setIsTransformDragging(false);
      }
    },
    [selectedModelId, setIsTransformDragging, setSelectedObject],
  );

  const handleSelectModel = useCallback(
    (id: string) => {
      setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
      selectModel(id);
    },
    [selectModel, setSelectedObject],
  );

  const handleSelectText = useCallback(
    (id: string) => {
      setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
      selectText(id);
    },
    [selectText, setSelectedObject],
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

  const cameraPosition = initialCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = initialCamera?.target ?? DEFAULT_CAMERA_TARGET;

  useEffect(() => {
    if (!draggingModelCatalogItem && !isDraggingText) {
      setPendingDropPosition(null);
    }
  }, [draggingModelCatalogItem, isDraggingText, setPendingDropPosition]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background"
      onPointerDownCapture={(event) => {
        event.currentTarget.focus();
      }}
      onDragOver={handleSceneDragOver}
      onDragLeave={handleDragLeave}
    >
      <Canvas
        key={initialCamera ? 'loaded' : 'default'}
        camera={{ position: cameraPosition }}
        gl={{
          toneMapping: NoToneMapping,
          powerPreference: 'high-performance',
          antialias: true,
        }}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          rendererRef.current = gl;
        }}
        onPointerMissed={handleClearSelection}
      >
        <ambientLight intensity={2} />
        <directionalLight position={[0, 50, 10]} color="white" intensity={5} />
        <OrbitControls ref={orbitControlsRef} enableDamping={false} target={cameraTarget} onChange={handleOrbitChange} />
        {transformTarget ? (
          <TransformControls
            key={transformTarget.uuid}
            ref={transformControlsRef}
            object={transformTarget}
            mode={transformMode}
            translationSnap={transformMode === 'translate' ? 1 : undefined}
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
            isSelected={model.id === selectedModelId}
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
            isSelected={text.id === selectedModelId}
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

      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition',
          draggingModelCatalogItem || isDraggingText
            ? 'pointer-events-auto bg-slate-950/6 backdrop-blur-[1px]'
            : 'pointer-events-none opacity-0',
        )}
        onDragOver={handleSceneDragOver}
        onDrop={handleSceneDrop}
      >
        {draggingModelCatalogItem || isDraggingText ? (
          <div className="pointer-events-none rounded-2xl border border-amber-500/30 bg-slate-950/80 px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-semibold text-white">
              {isDraggingText
                ? t('monitoring:editor.addText')
                : draggingModelCatalogItem?.label}
            </p>
            <p className="text-xs text-slate-300">
              {t('monitoring:editor.dropHint')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
