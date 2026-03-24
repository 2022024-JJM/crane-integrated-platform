import { OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type {
  OrbitControls as OrbitControlsImpl,
  TransformControls as TransformControlsImpl,
} from 'three-stdlib';
import {
  GltfModel,
  numRound,
  radToDeg,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import {
  type SceneTransformField,
  type SceneTransformMode,
  useSceneObjectSelectionStore,
} from '@/features/3d';
import { cn } from '@/shared/lib/utils';
import type { Vector3Tuple } from '@/shared/types/math';

interface SceneObjectsEditCanvasProps {
  sceneInfo: SavedSceneInfo | null;
  transformMode: SceneTransformMode;
  draggingModelCatalogItem: SceneModelCatalogItem | null;
  rootRef?: RefObject<HTMLDivElement | null>;
  onTransformVectorChange: (
    field: SceneTransformField,
    value: Vector3Tuple,
  ) => void;
  onAddModel: (
    catalogItem: SceneModelCatalogItem,
    position: Vector3Tuple,
  ) => void;
  onTransformInteractionStart?: () => void;
  onTransformInteractionEnd?: () => void;
}

interface TransformChangeEvent extends Event {
  value?: boolean;
}

type TransformControlsWithDraggingEvent = TransformControlsImpl & {
  addEventListener: (
    type: 'dragging-changed',
    listener: (event: TransformChangeEvent) => void,
  ) => void;
  removeEventListener: (
    type: 'dragging-changed',
    listener: (event: TransformChangeEvent) => void,
  ) => void;
};

function toVector3Tuple(values: [number, number, number]): Vector3Tuple {
  return values.map((value) => numRound(value)) as Vector3Tuple;
}

function getObjectTransformVectors(object: Object3D): Record<
  SceneTransformField,
  Vector3Tuple
> {
  return {
    position: toVector3Tuple([
      object.position.x,
      object.position.y,
      object.position.z,
    ]),
    rotation: toVector3Tuple([
      radToDeg(object.rotation.x),
      radToDeg(object.rotation.y),
      radToDeg(object.rotation.z),
    ]),
    scale: toVector3Tuple([object.scale.x, object.scale.y, object.scale.z]),
  };
}

export function SceneObjectsEditCanvas({
  sceneInfo,
  transformMode,
  draggingModelCatalogItem,
  rootRef,
  onTransformVectorChange,
  onAddModel,
  onTransformInteractionStart,
  onTransformInteractionEnd,
}: SceneObjectsEditCanvasProps) {
  const { t } = useTranslation();
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const transformControlsRef = useRef<TransformControlsImpl | null>(null);
  const modelObjectRegistryRef = useRef<Map<string, Object3D>>(new Map());
  const cameraRef = useRef<Camera | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const groundPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);
  const [pendingDropPosition, setPendingDropPosition] =
    useState<Vector3Tuple | null>(null);

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
    [selectedModelId],
  );

  const handleSelectModel = useCallback(
    (id: string) => {
      setSelectedObject(modelObjectRegistryRef.current.get(id) ?? null);
      selectModel(id);
    },
    [selectModel],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedObject(null);
    setIsTransformDragging(false);
    clearSelectedModel();
  }, [clearSelectedModel]);

  const syncSelectedObjectTransform = useCallback(() => {
    if (!selectedObject || !selectedModelId) {
      return;
    }

    const nextTransform = getObjectTransformVectors(selectedObject);
    onTransformVectorChange('position', nextTransform.position);
    onTransformVectorChange('rotation', nextTransform.rotation);
    onTransformVectorChange('scale', nextTransform.scale);
  }, [onTransformVectorChange, selectedModelId, selectedObject]);

  const resolveDropPosition = useCallback(
    (clientX: number, clientY: number): Vector3Tuple | null => {
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      if (!camera || !renderer) {
        return null;
      }

      const rect = renderer.domElement.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return null;
      }

      const pointer = new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const hitPoint = new Vector3();

      raycasterRef.current.setFromCamera(pointer, camera);

      if (!raycasterRef.current.ray.intersectPlane(groundPlane, hitPoint)) {
        return null;
      }

      return [
        numRound(hitPoint.x),
        numRound(hitPoint.y),
        numRound(hitPoint.z),
      ];
    },
    [groundPlane],
  );

  useEffect(() => {
    if (!orbitControlsRef.current) {
      return;
    }

    orbitControlsRef.current.enabled = !isTransformDragging;
  }, [isTransformDragging]);

  useEffect(() => {
    const controls = transformControlsRef.current as
      | TransformControlsWithDraggingEvent
      | null;
    if (!controls) {
      return;
    }

    const handleDraggingChanged = (event: TransformChangeEvent) => {
      setIsTransformDragging(Boolean(event.value));
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [selectedObject]);

  useEffect(() => {
    if (!draggingModelCatalogItem) {
      setPendingDropPosition(null);
    }
  }, [draggingModelCatalogItem]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background"
      onPointerDownCapture={(event) => {
        event.currentTarget.focus();
      }}
      onDragOver={(event) => {
        if (!draggingModelCatalogItem) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setPendingDropPosition(
          resolveDropPosition(event.clientX, event.clientY),
        );
      }}
      onDragLeave={() => {
        setPendingDropPosition(null);
      }}
      onDrop={(event) => {
        if (!draggingModelCatalogItem) {
          return;
        }

        event.preventDefault();

        const nextPosition = resolveDropPosition(
          event.clientX,
          event.clientY,
        );

        if (nextPosition) {
          onAddModel(draggingModelCatalogItem, nextPosition);
        }

        event.currentTarget.focus();
        setPendingDropPosition(null);
      }}
    >
      <Canvas
        camera={{ position: [0, 50, 50] }}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          rendererRef.current = gl;
        }}
        onPointerMissed={handleClearSelection}
      >
        <ambientLight intensity={2} />
        <directionalLight position={[0, 50, 10]} color="white" intensity={5} />
        <OrbitControls ref={orbitControlsRef} enableDamping={false} />
        {selectedObject ? (
          <TransformControls
            ref={transformControlsRef}
            object={selectedObject}
            mode={transformMode}
            space="local"
            onMouseDown={() => {
              setIsTransformDragging(true);
              onTransformInteractionStart?.();
            }}
            onMouseUp={() => {
              syncSelectedObjectTransform();
              setIsTransformDragging(false);
              onTransformInteractionEnd?.();
            }}
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
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
            onSelect={handleSelectModel}
            isSelected={model.id === selectedModelId}
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
          'pointer-events-none absolute inset-0 flex items-center justify-center transition',
          draggingModelCatalogItem
            ? 'bg-slate-950/6 backdrop-blur-[1px]'
            : 'opacity-0',
        )}
      >
        {draggingModelCatalogItem ? (
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/80 px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-semibold text-white">
              {draggingModelCatalogItem.label}
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
