import { useEffect, useState } from 'react';
import {
  GltfModel,
  loadSceneInfoByRegionId,
  type SavedSceneInfo,
} from '@/entities/3d';
import type { MonitoringHoveredModel } from '../model/types';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';

interface OutdoorWorkModelSimulationProps {
  regionId: string;
  onSceneDataLoadingChange?: (isLoading: boolean) => void;
  onHoveredModelChange?: (hoveredModel: MonitoringHoveredModel | null) => void;
}

export function OutdoorWorkModelSimulation({
  regionId,
  onSceneDataLoadingChange,
  onHoveredModelChange,
}: OutdoorWorkModelSimulationProps) {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isSceneDataLoading, setIsSceneDataLoading] = useState(true);
  const { registerFromModel } = useValueMapperStore();
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
  }, [onHoveredModelChange, regionId, registerFromModel, start]);

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
