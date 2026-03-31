import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import {
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  type SavedSceneInfo,
} from '@/entities/3d';
import { toast } from 'sonner';
import { createSceneSnapshot, sanitizeSceneInfo } from './scene-snapshot';

interface UpdateSceneOptions {
  recordHistory?: boolean;
}

interface UseScenePersistenceParams {
  regionId: string;
  sceneInfo: SavedSceneInfo | null;
  replaceScene: (sceneInfo: SavedSceneInfo | null) => void;
  updateScene: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: UpdateSceneOptions,
  ) => void;
  onLoadReset: () => void;
}

interface UseScenePersistenceResult {
  isDirty: boolean;
  isSaving: boolean;
  saveCurrentScene: () => Promise<boolean>;
}

export function useScenePersistence({
  regionId,
  sceneInfo,
  replaceScene,
  updateScene,
  onLoadReset,
}: UseScenePersistenceParams): UseScenePersistenceResult {
  const [isSaving, setIsSaving] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState<string | null>(
    null,
  );

  const currentSceneSnapshot = useMemo(
    () => createSceneSnapshot(sceneInfo),
    [sceneInfo],
  );
  const isDirty =
    sceneInfo !== null &&
    savedSceneSnapshot !== null &&
    currentSceneSnapshot !== savedSceneSnapshot;

  useEffect(() => {
    let isMounted = true;

    const loadScene = async () => {
      try {
        const data = await loadSceneInfoByRegionId(regionId);

        if (!isMounted) {
          return;
        }

        replaceScene(data);
        setSavedSceneSnapshot(createSceneSnapshot(data));
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
      }
    };

    onLoadReset();
    replaceScene(null);
    setSavedSceneSnapshot(null);
    void loadScene();

    return () => {
      isMounted = false;
    };
  }, [onLoadReset, regionId, replaceScene]);

  const saveCurrentScene = useCallback(async () => {
    if (!sceneInfo || isSaving) {
      return false;
    }

    setIsSaving(true);

    try {
      const sanitizedSceneInfo = sanitizeSceneInfo(sceneInfo);
      const savedSceneInfo = await saveSceneInfoByRegionId(
        regionId,
        sanitizedSceneInfo,
      );

      updateScene(savedSceneInfo, { recordHistory: false });
      setSavedSceneSnapshot(createSceneSnapshot(savedSceneInfo));
      toast.success('Scene saved.');
      return true;
    } catch (error) {
      console.error('Failed to save scene info.', error);
      toast.error('Failed to save scene.', {
        action: {
          label: 'Retry',
          onClick: () => {
            void saveCurrentScene();
          },
        },
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, regionId, sceneInfo, updateScene]);

  return {
    isDirty,
    isSaving,
    saveCurrentScene,
  };
}
