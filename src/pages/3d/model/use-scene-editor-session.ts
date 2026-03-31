import { type SceneModelCatalogItem } from '@/entities/3d';
import {
  useSelectedSceneObjectEditor,
  useSceneObjectSelectionStore,
  useSceneTransformModeStore,
} from '@/features/3d';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSceneHistory } from './use-scene-history';
import { useScenePersistence } from './use-scene-persistence';
import { useSceneUnsavedChangesGuard } from './use-scene-unsaved-changes-guard';
import { createSceneManipulationActions } from './scene-manipulation-actions';

interface UseSceneEditorSessionParams {
  regionId: string;
}

interface UseSceneEditorSessionResult {
  sceneInfo: ReturnType<typeof useSceneHistory>['sceneInfo'];
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
  const transformHistoryBaseRef = useRef(null);
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

  const onLoadReset = useCallback(() => {
    clearSelectedModel();
    resetTransformMode();
  }, [clearSelectedModel, resetTransformMode]);

  const { isDirty, isSaving, saveCurrentScene } = useScenePersistence({
    regionId,
    sceneInfo,
    replaceScene,
    updateScene,
    onLoadReset,
  });

  const manipulation = useMemo(
    () =>
      createSceneManipulationActions({
        updateScene,
        commitHistoryFrom,
        selectModel,
        clearSelectedModel,
        selectedModelId,
        sceneInfo,
        transformHistoryBaseRef,
      }),
    [
      updateScene,
      commitHistoryFrom,
      selectModel,
      clearSelectedModel,
      selectedModelId,
      sceneInfo,
    ],
  );

  useEffect(() => {
    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

  useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: saveCurrentScene,
  });

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
    addModel: manipulation.addModel,
    selectPlacedModel: manipulation.selectPlacedModel,
    deletePlacedModel: manipulation.deletePlacedModel,
    deleteMap: manipulation.deleteMap,
    startTransformInteraction: manipulation.startTransformInteraction,
    endTransformInteraction: manipulation.endTransformInteraction,
  };
}
