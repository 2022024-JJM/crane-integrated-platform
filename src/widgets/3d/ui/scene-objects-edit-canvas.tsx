import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { GltfModel, type SavedSceneInfo } from '@/entities/3d';
import { useSceneObjectSelectionStore } from '@/features/3d';

interface SceneObjectsEditCanvasProps {
  sceneInfo: SavedSceneInfo | null;
}

export function SceneObjectsEditCanvas({
  sceneInfo,
}: SceneObjectsEditCanvasProps) {
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );

  return (
    <Canvas
      camera={{ position: [0, 50, 50] }}
      onPointerMissed={() => {
        clearSelectedModel();
      }}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[0, 50, 10]} color="white" intensity={5} />
      <OrbitControls enableDamping={false} />
      {sceneInfo?.map ? (
        <GltfModel
          id={sceneInfo.map.id}
          onSelect={() => {
            clearSelectedModel();
          }}
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
          onSelect={selectModel}
          isSelected={model.id === selectedModelId}
        />
      ))}
    </Canvas>
  );
}
