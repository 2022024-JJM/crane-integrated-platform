import {
  createSceneModel,
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import {
  useSelectedSceneObjectEditor,
  useSceneObjectSelectionStore,
  useSceneTransformModeStore,
} from '@/features/3d';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createSceneSnapshot,
  sanitizeSceneInfo,
} from './scene-snapshot';
import { useSceneHistory } from './use-scene-history';
import { useSceneUnsavedChangesGuard } from './use-scene-unsaved-changes-guard';

interface UseSceneEditorSessionParams {
  regionId: string;
}

interface UseSceneEditorSessionResult {
  sceneInfo: SavedSceneInfo | null;
  selectedModelId: string | null;
  selectedModelLabel: string | null;
  selectedModel: ReturnType<typeof useSelectedSceneObjectEditor>['selectedModel'];
  isSaving: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  transformMode: ReturnType<typeof useSceneTransformModeStore.getState>['mode'];
  undo: () => void;
  redo: () => void;
  setTransformMode: ReturnType<typeof useSceneTransformModeStore.getState>['setMode'];
  saveCurrentScene: () => Promise<boolean>;
  updateSelectedName: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedName'];
  updateSelectedOpacity: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedOpacity'];
  updateSelectedTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransform'];
  updateSelectedTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransformVector'];
  removeSelectedModel: () => void;
  addModel: (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => void;
  selectPlacedModel: (id: string) => void;
  deletePlacedModel: (id: string) => void;
  deleteMap: () => void;
  startTransformInteraction: () => void;
  endTransformInteraction: () => void;
}

export function useSceneEditorSession({
  regionId,
}: UseSceneEditorSessionParams): UseSceneEditorSessionResult {
  const [isSaving, setIsSaving] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState<string | null>(
    null,
  );
  const transformHistoryBaseRef = useRef<SavedSceneInfo | null>(null);
  const {
    sceneInfo,
    replaceScene,
    updateScene,
    commitHistoryFrom,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useSceneHistory();
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const transformMode = useSceneTransformModeStore((state) => state.mode);
  const setTransformMode = useSceneTransformModeStore(
    (state) => state.setMode,
  );
  const resetTransformMode = useSceneTransformModeStore(
    (state) => state.resetMode,
  );
  const {
    selectedModel,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
  } = useSelectedSceneObjectEditor({
    sceneInfo,
    updateSceneInfo: updateScene,
  });
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

    clearSelectedModel();
    resetTransformMode();
    replaceScene(null);
    setSavedSceneSnapshot(null);
    void loadScene();

    return () => {
      isMounted = false;
    };
  }, [clearSelectedModel, regionId, replaceScene, resetTransformMode]);

  useEffect(() => {
    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

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

  useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: saveCurrentScene,
  });

  const addModel = useCallback(
    (catalogItem: SceneModelCatalogItem, position: [number, number, number]) => {
      const nextModel = createSceneModel({
        catalogItem,
        position,
      });

      updateScene((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          models: [...prev.models, nextModel],
        };
      });

      selectModel(nextModel.id);
    },
    [selectModel, updateScene],
  );

  const deleteMap = useCallback(() => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        map: null,
      };
    });
  }, [updateScene]);

  const selectPlacedModel = useCallback(
    (id: string) => {
      selectModel(id);
    },
    [selectModel],
  );

  const deletePlacedModel = useCallback(
    (id: string) => {
      updateScene((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          models: prev.models.filter((model) => model.id !== id),
        };
      });

      if (selectedModelId === id) {
        clearSelectedModel();
      }
    },
    [clearSelectedModel, selectedModelId, updateScene],
  );

  const startTransformInteraction = useCallback(() => {
    transformHistoryBaseRef.current = sceneInfo;
  }, [sceneInfo]);

  const endTransformInteraction = useCallback(() => {
    commitHistoryFrom(transformHistoryBaseRef.current);
    transformHistoryBaseRef.current = null;
  }, [commitHistoryFrom]);

  return {
    sceneInfo,
    selectedModelId,
    selectedModelLabel: selectedModel?.equipName.trim() || selectedModel?.id || null,
    selectedModel,
    isSaving,
    isDirty,
    canUndo,
    canRedo,
    transformMode,
    undo,
    redo,
    setTransformMode,
    saveCurrentScene,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
    addModel,
    selectPlacedModel,
    deletePlacedModel,
    deleteMap,
    startTransformInteraction,
    endTransformInteraction,
  };
}
