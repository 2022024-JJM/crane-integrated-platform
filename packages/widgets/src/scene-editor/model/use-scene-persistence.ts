import {
  useCallback,
  useEffect,
  useState,
  type SetStateAction,
} from 'react';
import {
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  UnknownRegionError,
  type SavedCameraInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { toast } from 'sonner';
import { sanitizeSceneInfo } from './scene-snapshot';

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
  // 마지막으로 저장된 sceneInfo의 참조. sceneInfo는 모든 mutation에서
  // 새 객체로 교체되므로 참조 비교만으로 dirty 판단이 가능하다.
  // 이전 구현은 매 sceneInfo 변경마다 JSON.stringify로 비교했는데,
  // 모델 수가 많을수록 직렬화 비용이 누적되어 큰 씬에서 입력 lag 원인이었다.
  const [savedSceneRef, setSavedSceneRef] = useState<SavedSceneInfo | null>(
    null,
  );
  const [initialCamera, setInitialCamera] = useState<SavedCameraInfo | null>(
    null,
  );

  const isDirty =
    sceneInfo !== null && savedSceneRef !== null && sceneInfo !== savedSceneRef;

  useEffect(() => {
    let isMounted = true;

    const loadScene = async () => {
      try {
        const data = await loadSceneInfoByRegionId(regionId);

        if (!isMounted) {
          return;
        }

        const sanitized = sanitizeSceneInfo(data);
        replaceScene(sanitized);
        setInitialCamera(sanitized.camera ?? null);
        setSavedSceneRef(sanitized);
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
        if (isMounted) {
          // 미등록 region은 원인이 분명하므로 그대로 보여준다. 예전에는
          // 조용히 1dock 씬으로 대체돼 사용자가 오인한 채 편집·저장했다.
          toast.error(
            error instanceof UnknownRegionError
              ? error.message
              : 'Failed to load scene.',
          );
        }
      }
    };

    onLoadReset();
    replaceScene(null);
    setInitialCamera(null);
    setSavedSceneRef(null);
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
      setSavedSceneRef(savedSceneInfo);
      toast.success('Scene saved.');
      return true;
    } catch (error) {
      console.error('Failed to save scene info.', error);
      // 미등록 region은 재시도해도 결과가 같다 — 원인을 밝히고 Retry는 뺀다.
      if (error instanceof UnknownRegionError) {
        toast.error(error.message);
        return false;
      }
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
