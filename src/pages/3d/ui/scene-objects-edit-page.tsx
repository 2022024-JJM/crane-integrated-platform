import type { SavedSceneInfo } from '@/entities/3d';
import {
  SceneTransformModeToggle,
  useSelectedSceneObjectEditor,
  useSceneObjectSelectionStore,
  useSceneTransformModeStore,
} from '@/features/3d';
import { useEffect, useState } from 'react';
import { SceneObjectInspector, SceneObjectsEditCanvas } from '@/widgets/3d';

const SCENE_FILE_URL = '/scenes/1dock.json';

export function SceneObjectsEditPage() {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const transformMode = useSceneTransformModeStore((state) => state.mode);
  const setTransformMode = useSceneTransformModeStore(
    (state) => state.setMode,
  );
  const resetTransformMode = useSceneTransformModeStore(
    (state) => state.resetMode,
  );
  const {
    selectedModel,
    updateSelectedTransform,
    updateSelectedTransformVector,
  } = useSelectedSceneObjectEditor({
    sceneInfo,
    setSceneInfo,
  });

  useEffect(() => {
    let isMounted = true;

    const loadScene = async () => {
      try {
        const res = await fetch(SCENE_FILE_URL);
        const data: SavedSceneInfo = await res.json();

        if (!isMounted) {
          return;
        }

        setSceneInfo(data);
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
      }
    };

    void loadScene();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    clearSelectedModel();
    resetTransformMode();

    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

  return (
    <div className="bg-muted/20 relative flex h-full min-h-0 w-full overflow-hidden">
      <div className="min-w-0 flex-1">
        <SceneObjectsEditCanvas
          sceneInfo={sceneInfo}
          transformMode={transformMode}
          onTransformVectorChange={updateSelectedTransformVector}
        />
      </div>
      <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto">
          <SceneTransformModeToggle
            mode={transformMode}
            disabled={!selectedModel}
            onModeChange={setTransformMode}
          />
        </div>
      </div>
      <aside className="absolute top-2 right-2 w-60 shrink-0">
        <SceneObjectInspector
          selectedModel={selectedModel}
          onTransformChange={updateSelectedTransform}
        />
      </aside>
    </div>
  );
}
