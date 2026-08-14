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
import { isSceneInfoEqual, sanitizeSceneInfo } from './scene-snapshot';

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

      // 저장 결과를 present로 반영하고, **그 결과 실제로 present가 된 객체**를
      // 기준선으로 삼는다.
      //
      // updateScene은 내용이 같으면 present를 바꾸지 않고 이전 참조를 유지한다
      // (use-scene-history의 isSceneInfoEqual 분기). 그런데 isDirty는 참조
      // 비교라, 여기서 savedSceneRef만 서버가 돌려준 새 객체로 바꾸면 내용이
      // 같은데도 참조가 달라져 **저장에 성공했는데 계속 "저장되지 않음"으로
      // 표시**된다. 그 상태에서는 페이지를 옮길 때마다 확인창이 뜨고 탭을 닫을
      // 때 beforeunload가 걸린다.
      updateScene(savedSceneInfo, { recordHistory: false });
      setInitialCamera(savedSceneInfo.camera ?? null);
      // updateScene이 present를 유지할지(내용 동일) 교체할지를 같은 기준으로
      // 판정해, 실제로 present가 될 객체를 기준선으로 삼는다.
      setSavedSceneRef(
        isSceneInfoEqual(sceneInfo, savedSceneInfo) ? sceneInfo : savedSceneInfo,
      );
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
