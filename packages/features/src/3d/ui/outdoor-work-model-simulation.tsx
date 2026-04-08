import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Box3,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Sphere,
  Vector3,
} from 'three';
import type { AlarmSeverity } from '@crane/domain/alarm';
import {
  GltfModel,
  SceneText,
  LidarSensorMesh,
  CameraSensorMesh,
  isLidarSensor,
  isCameraSensor,
  loadSceneInfoByRegionId,
  type SavedCameraInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';

interface OutdoorWorkModelSimulationProps {
  regionId: string;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  onSceneDataLoadingChange?: (isLoading: boolean) => void;
  onCameraInfoChange?: (camera: SavedCameraInfo | null) => void;
  onMoveTo?: (position: Vector3Tuple, target: Vector3Tuple) => void;
  onResetCamera?: () => void;
}

export function OutdoorWorkModelSimulation({
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  onSceneDataLoadingChange,
  onCameraInfoChange,
  onMoveTo,
  onResetCamera,
}: OutdoorWorkModelSimulationProps) {
  const camera = useThree((s) => s.camera);
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isSceneDataLoading, setIsSceneDataLoading] = useState(true);
  const registerFromModel = useValueMapperStore((s) => s.registerFromModel);
  const clearValueMapper = useValueMapperStore((s) => s.clear);
  const start = useValueGeneratorStore((s) => s.start);
  useValueGeneratorRunner();
  useEffect(() => {
    onSceneDataLoadingChange?.(isSceneDataLoading);
  }, [isSceneDataLoading, onSceneDataLoadingChange]);

  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const pushFocus = useObjectFocusStore((s) => s.pushFocus);

  const objectMapRef = useRef<Map<string, Object3D>>(new Map());
  const boxCacheRef = useRef<Map<string, Box3>>(new Map());

  const getObjectBounds = useCallback((id: string) => {
    const object = objectMapRef.current.get(id);
    if (object) {
      const liveBounds = new Box3().setFromObject(object);
      boxCacheRef.current.set(id, liveBounds);
      return liveBounds;
    }

    return boxCacheRef.current.get(id) ?? null;
  }, []);

  const handleObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        objectMapRef.current.set(id, object);
        boxCacheRef.current.set(id, new Box3().setFromObject(object));
        return;
      }

      objectMapRef.current.delete(id);
    },
    [],
  );

  const map = sceneInfo?.map;
  const models = sceneInfo?.models ?? [];
  const modelIds = useMemo(() => models.map((model) => model.id), [models]);
  const texts = sceneInfo?.texts ?? [];
  const sensors = sceneInfo?.sensors ?? [];

  const focusStack = useObjectFocusStore((s) => s.focusStack);

  const handleModelClick = useCallback(
    (id: string) => {
      // If clicking from full scene (stack empty), check if this model
      // overlaps with a larger model (e.g. crane inside a bay).
      // If so, push the container first to enable two-level back navigation.
      if (focusStack.length === 0) {
        const clickedBox = getObjectBounds(id);

        if (clickedBox) {
          const clickedSize = new Vector3();
          clickedBox.getSize(clickedSize);
          const clickedVolume = clickedSize.x * clickedSize.y * clickedSize.z;

          let bestContainer: string | null = null;
          let bestVolume = Infinity;

          for (const otherId of modelIds) {
            if (otherId === id) {
              continue;
            }

            const otherBox = getObjectBounds(otherId);
            if (!otherBox) {
              continue;
            }

            if (!otherBox.intersectsBox(clickedBox)) {
              continue;
            }

            const otherSize = new Vector3();
            otherBox.getSize(otherSize);
            const otherVolume = otherSize.x * otherSize.y * otherSize.z;

            // Only consider objects larger than the clicked one as containers
            if (otherVolume > clickedVolume && otherVolume < bestVolume) {
              bestContainer = otherId;
              bestVolume = otherVolume;
            }
          }

          if (bestContainer) {
            pushFocus(bestContainer);
            pushFocus(id);
            return;
          }
        }
      }

      pushFocus(id);
    },
    [focusStack.length, getObjectBounds, modelIds, pushFocus],
  );

  const { visibleModelIds, visibleGroupBox } = useMemo(() => {
    if (!focusedModelId) {
      return { visibleModelIds: null, visibleGroupBox: null };
    }

    const focusedBox = getObjectBounds(focusedModelId);

    if (!focusedBox) {
      return {
        visibleModelIds: new Set([focusedModelId]),
        visibleGroupBox: null,
      };
    }

    const result = new Set<string>();
    const groupBox = focusedBox.clone();

    for (const id of modelIds) {
      if (id === focusedModelId) {
        result.add(id);
        continue;
      }

      const otherBox = getObjectBounds(id);
      if (!otherBox) {
        continue;
      }

      if (focusedBox.intersectsBox(otherBox)) {
        result.add(id);
        groupBox.union(otherBox);
      }
    }

    return { visibleModelIds: result, visibleGroupBox: groupBox };
  }, [focusedModelId, getObjectBounds, modelIds]);

  const onMoveToRef = useRef(onMoveTo);
  onMoveToRef.current = onMoveTo;
  const onResetCameraRef = useRef(onResetCamera);
  onResetCameraRef.current = onResetCamera;

  useEffect(() => {
    if (!focusedModelId) {
      onResetCameraRef.current?.();
      return;
    }

    const ids = visibleModelIds;

    if (!ids) {
      return;
    }

    const groupBox = new Box3();
    let hasObject = false;

    for (const id of ids) {
      const obj = objectMapRef.current.get(id);

      if (obj) {
        groupBox.expandByObject(obj);
        hasObject = true;
      }
    }

    if (!hasObject) {
      return;
    }

    // Bounding sphere gives a single radius that works for any camera angle
    const sphere = new Sphere();
    groupBox.getBoundingSphere(sphere);
    const center = sphere.center;
    const radius = sphere.radius;

    // Compute required distance so the sphere fits in the viewport
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 75;
    const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 16 / 9;
    const vFov = MathUtils.degToRad(fov / 2);
    const hFov = Math.atan(Math.tan(vFov) * aspect);
    const effectiveFov = Math.min(vFov, hFov);

    const fitDistance = radius / Math.sin(effectiveFov);

    // Camera direction: use the initial scene camera direction (consistent angle)
    // instead of current camera position (which shifts as user orbits)
    const defaultDir = new Vector3(0, 0.75, 0.65).normalize();
    const newPosition = center
      .clone()
      .add(defaultDir.multiplyScalar(fitDistance));

    const position: Vector3Tuple = [
      newPosition.x,
      newPosition.y,
      newPosition.z,
    ];
    const target: Vector3Tuple = [center.x, center.y, center.z];

    onMoveToRef.current?.(position, target);
  }, [focusedModelId, visibleModelIds]);

  const clearFocus = useObjectFocusStore((s) => s.clearFocus);

  useEffect(() => {
    objectMapRef.current.clear();
    boxCacheRef.current.clear();

    return () => {
      clearFocus();
    };
  }, [regionId, clearFocus]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsSceneDataLoading(true);
      clearValueMapper();

      try {
        const data: SavedSceneInfo = await loadSceneInfoByRegionId(regionId);

        if (!isMounted) {
          return;
        }

        setSceneInfo(data);
        onCameraInfoChange?.(data.camera ?? null);
        data.models?.forEach((modelInfo) => {
          registerFromModel(modelInfo);
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        clearValueMapper();
        setSceneInfo(null);
        console.error('Failed to load monitoring scene.', error);
      } finally {
        if (isMounted) {
          setIsSceneDataLoading(false);
        }
      }
    };

    start();
    void load();

    return () => {
      isMounted = false;
      clearValueMapper();
    };
  }, [clearValueMapper, onCameraInfoChange, regionId, registerFromModel, start]);

  return (
    <>
      {map ? <GltfModel id={map.id} url={map.path} /> : null}
      {models.map((model) => {
        if (visibleModelIds && !visibleModelIds.has(model.id)) {
          return null;
        }

        return (
          <GltfModel
            key={model.id}
            id={model.id}
            url={model.path}
            equipName={model.equipName}
            opacity={model.opacity}
            alarmSeverity={
              model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null
            }
            alarmHighlightMesh={alarmHighlightMesh}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
            onSelect={handleModelClick}
            onObjectReady={handleObjectReady}
          />
        );
      })}
      {sensors.map((sensor) => {
        if (isLidarSensor(sensor)) {
          return (
            <LidarSensorMesh
              key={sensor.id}
              sensor={sensor}
              isSelected={false}
              onSelect={handleModelClick}
              isMonitoringMode
            />
          );
        }
        if (isCameraSensor(sensor)) {
          return (
            <CameraSensorMesh
              key={sensor.id}
              sensor={sensor}
              isSelected={false}
              onSelect={handleModelClick}
              isMonitoringMode
            />
          );
        }
        return null;
      })}
      {texts.map((text) => {
        if (visibleGroupBox) {
          const [tx] = text.position;

          if (tx < visibleGroupBox.min.x || tx > visibleGroupBox.max.x) {
            return null;
          }
        }

        return (
          <SceneText
            key={text.id}
            id={text.id}
            content={text.content}
            color={text.color}
            position={text.position}
            rotation={text.rotation}
            scale={text.scale}
          />
        );
      })}
    </>
  );
}
