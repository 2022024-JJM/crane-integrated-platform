import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from 'react';
import {
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  type SavedCameraInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
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
  getCameraState?: () => SavedCameraInfo | null;
}

interface UseScenePersistenceResult {
  isDirty: boolean;
  isSaving: boolean;
  initialCamera: SavedCameraInfo | null;
  saveCurrentScene: () => Promise<boolean>;
}

export function useScenePersistence({
  regionId,
  sceneInfo,
  replaceScene,
  updateScene,
  onLoadReset,
  getCameraState,
}: UseScenePersistenceParams): UseScenePersistenceResult {
  const [isSaving, setIsSaving] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState<string | null>(
    null,
  );
  const [initialCamera, setInitialCamera] = useState<SavedCameraInfo | null>(
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
        setInitialCamera(data.camera ?? null);
        setSavedSceneSnapshot(createSceneSnapshot(data));
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
        if (isMounted) {
          toast.error('Failed to load scene.');
        }
      }
    };

    onLoadReset();
    replaceScene(null);
    setInitialCamera(null);
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
      const cameraState = getCameraState?.() ?? null;
      const sceneWithCamera: SavedSceneInfo = {
        ...sceneInfo,
        camera: cameraState,
      };
      const sanitizedSceneInfo = sanitizeSceneInfo(sceneWithCamera);
      const savedSceneInfo = await saveSceneInfoByRegionId(
        regionId,
        sanitizedSceneInfo,
      );

      updateScene(savedSceneInfo, { recordHistory: false });
      setInitialCamera(savedSceneInfo.camera ?? null);
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
  }, [getCameraState, isSaving, regionId, sceneInfo, updateScene]);

  return {
    isDirty,
    isSaving,
    initialCamera,
    saveCurrentScene,
  };
}
