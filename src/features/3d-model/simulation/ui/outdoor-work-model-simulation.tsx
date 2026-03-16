import { useEffect, useState } from 'react';
import { GltfModel, type SavedSceneInfo } from '@/entities/3d-model';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';

export function OutdoorWorkModelSimulation() {
  const SCENE_FILE_URL = '/scenes/1dock.json';
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const { registerFromModel } = useValueMapperStore();
  const start = useValueGeneratorStore((s) => s.start);
  useValueGeneratorRunner();

  const map = sceneInfo?.map;
  const models = sceneInfo?.models ?? [];

  useEffect(() => {
    const load = async () => {
      const res = await fetch(SCENE_FILE_URL);
      const data: SavedSceneInfo = await res.json();

      setSceneInfo(data);
      data.models?.map((modelInfo) => {
        registerFromModel(modelInfo);
      });
    };

    load();
    start();
  }, []);

  return (
    <>
      {map ? <GltfModel id={map.id} url={map.path} /> : <></>}
      {models.map((model) => (
        <GltfModel
          key={model.id}
          id={model.id}
          url={model.path}
          equipName={model.equipName}
          position={model.position}
          rotation={model.rotation}
          scale={model.scale}
        />
      ))}
    </>
  );
}
