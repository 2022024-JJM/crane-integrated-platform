import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box3, Object3D } from 'three';
import type { AlarmSeverity } from '@/entities/alarm';
import {
  GltfModel,
  SceneText,
  loadSceneInfoByRegionId,
  type SavedCameraInfo,
  type SavedSceneInfo,
} from '@/entities/3d';
import type { MonitoringHoveredModel } from '../model/types';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';

interface OutdoorWorkModelSimulationProps {
  regionId: string;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  onSceneDataLoadingChange?: (isLoading: boolean) => void;
  onHoveredModelChange?: (hoveredModel: MonitoringHoveredModel | null) => void;
  onCameraInfoChange?: (camera: SavedCameraInfo | null) => void;
}

export function OutdoorWorkModelSimulation({
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  onSceneDataLoadingChange,
  onHoveredModelChange,
  onCameraInfoChange,
}: OutdoorWorkModelSimulationProps) {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isSceneDataLoading, setIsSceneDataLoading] = useState(true);
  const registerFromModel = useValueMapperStore((s) => s.registerFromModel);
  const start = useValueGeneratorStore((s) => s.start);
  useValueGeneratorRunner();
  useEffect(() => {
    onSceneDataLoadingChange?.(isSceneDataLoading);
  }, [isSceneDataLoading, onSceneDataLoadingChange]);

  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const focusModel = useObjectFocusStore((s) => s.focusModel);

  const objectMapRef = useRef<Map<string, Object3D>>(new Map());

  const handleObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        objectMapRef.current.set(id, object);
      } else {
        objectMapRef.current.delete(id);
      }
    },
    [],
  );

  const handleModelClick = useCallback(
    (id: string) => {
      focusModel(id);
    },
    [focusModel],
  );

  const map = sceneInfo?.map;
  const models = sceneInfo?.models ?? [];
  const texts = sceneInfo?.texts ?? [];
  const isFocusMode = focusedModelId !== null;

  const visibleModelIds = useMemo(() => {
    if (!focusedModelId) {
      return null;
    }

    const focusedObject = objectMapRef.current.get(focusedModelId);

    if (!focusedObject) {
      return new Set([focusedModelId]);
    }

    const focusedBox = new Box3().setFromObject(focusedObject);
    const result = new Set<string>();

    for (const [id, object] of objectMapRef.current) {
      if (id === focusedModelId) {
        result.add(id);
        continue;
      }

      const otherBox = new Box3().setFromObject(object);

      if (focusedBox.intersectsBox(otherBox)) {
        result.add(id);
      }
    }

    return result;
  }, [focusedModelId]);

  const clearFocus = useObjectFocusStore((s) => s.clearFocus);

  useEffect(() => {
    return () => {
      clearFocus();
    };
  }, [regionId, clearFocus]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsSceneDataLoading(true);

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
      onHoveredModelChange?.(null);
    };
  }, [onCameraInfoChange, onHoveredModelChange, regionId, registerFromModel, start]);

  const handleHoveredModelChange = (
    id: string,
    clientX: number,
    clientY: number,
  ) => {
    const hoveredModel = models.find((model) => model.id === id);

    if (!hoveredModel) {
      onHoveredModelChange?.(null);
      return;
    }

    onHoveredModelChange?.({
      model: hoveredModel,
      position: {
        x: clientX,
        y: clientY,
      },
    });
  };

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
            alarmSeverity={model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null}
            alarmHighlightMesh={alarmHighlightMesh}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
            onSelect={handleModelClick}
            onObjectReady={handleObjectReady}
            onHoverStart={handleHoveredModelChange}
            onHoverMove={handleHoveredModelChange}
            onHoverEnd={() => {
              onHoveredModelChange?.(null);
            }}
          />
        );
      })}
      {!isFocusMode
        ? texts.map((text) => (
            <SceneText
              key={text.id}
              id={text.id}
              content={text.content}
              color={text.color}
              position={text.position}
              rotation={text.rotation}
              scale={text.scale}
            />
          ))
        : null}
    </>
  );
}
