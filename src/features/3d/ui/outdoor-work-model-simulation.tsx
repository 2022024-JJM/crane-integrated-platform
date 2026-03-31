import { useEffect, useState } from 'react';
import type { AlarmSeverity } from '@/entities/alarm';
import {
  GltfModel,
  loadSceneInfoByRegionId,
  type SavedCameraInfo,
  type SavedSceneInfo,
} from '@/entities/3d';
import type { MonitoringHoveredModel } from '../model/types';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';

interface OutdoorWorkModelSimulationProps {
  regionId: string;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  onSceneDataLoadingChange?: (isLoading: boolean) => void;
  onHoveredModelChange?: (hoveredModel: MonitoringHoveredModel | null) => void;
  onCameraInfoChange?: (camera: SavedCameraInfo | null) => void;
}

export function OutdoorWorkModelSimulation({
  regionId,
  alarmsByCraneId,
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

  const map = sceneInfo?.map;
  const models = sceneInfo?.models ?? [];

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
      {map ? <GltfModel id={map.id} url={map.path} /> : <></>}
      {models.map((model) => (
        <GltfModel
          key={model.id}
          id={model.id}
          url={model.path}
          equipName={model.equipName}
          opacity={model.opacity}
          alarmSeverity={model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null}
          position={model.position}
          rotation={model.rotation}
          scale={model.scale}
          onHoverStart={handleHoveredModelChange}
          onHoverMove={handleHoveredModelChange}
          onHoverEnd={() => {
            onHoveredModelChange?.(null);
          }}
        />
      ))}
    </>
  );
}
